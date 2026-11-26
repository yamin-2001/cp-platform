/**
 * Browser check for the registration fixes.
 *
 *   1. A CF handle typed on the sign-up form is persisted (it used to be
 *      silently dropped by the backend).
 *   2. A password shorter than the minimum is rejected by the form with the
 *      same message the API would give (the two used to disagree: 6 vs 8).
 *   3. A valid handle that fails validation is rejected with a clear message.
 *
 * Usage: node scripts/e2e-register-check.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5173'
const HERE = dirname(fileURLToPath(import.meta.url))
const CHROME = process.env.CHROME_BIN || 'google-chrome'
const PORT = 9224

const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1440,900',
    '--user-data-dir=/tmp/cplab-chrome-profile-register',
    'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function cdpTarget() {
    for (let i = 0; i < 40; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
            const targets = await res.json()
            const page = targets.find(t => t.type === 'page')
            if (page) return page.webSocketDebuggerUrl
        } catch { /* not up yet */ }
        await sleep(250)
    }
    throw new Error('Chrome did not expose a debugging target')
}

const wsUrl = await cdpTarget()
const ws = new WebSocket(wsUrl)
await new Promise(r => { ws.onopen = r })

let msgId = 0
const pending = new Map()
const consoleErrors = []

ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg)
        pending.delete(msg.id)
        return
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map(a => a.value ?? a.description ?? '').join(' '))
    }
    if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push('EXCEPTION: ' + (msg.params.exceptionDetails?.exception?.description
            || msg.params.exceptionDetails?.text || 'unknown'))
    }
}

const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++msgId
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
})

const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text)
    return r.result?.result?.value
}

const navigate = async (url) => {
    await send('Page.navigate', { url })
    await sleep(2500)
}

/** Wait until `expr` returns truthy in the page, or time out. */
const waitFor = async (expr, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (await evaluate(`(() => { try { return !!(${expr}) } catch { return false } })()`)) return true
        await sleep(200)
    }
    return false
}

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')

// ─── Fix: password length ─────────────────────────────────────────────────────
console.log('\n=== Fix: the form rejects a password shorter than the minimum ===')
await navigate(`${BASE}/register`)
const formReady = await waitFor(`document.querySelector('input[placeholder="Your name"]')`)
console.log('register form rendered:', formReady)
if (!formReady) {
    console.log('  page state:', await evaluate(`({ url: location.pathname, inputs: [...document.querySelectorAll('input')].map(i => ({ t: i.type, ph: i.placeholder })) })`))
}

const pwState = await evaluate(`(() => {
    const pw = document.querySelector('input[type=password]')
    // React sets the DOM *property*, so read that rather than the attribute.
    return { minLength: pw?.minLength, placeholder: pw?.placeholder, type: pw?.type }
})()`)
console.log('password input:', JSON.stringify(pwState))
console.log(Number(pwState.minLength) === 8
    ? '  -> the form requires 8 characters, matching the backend'
    : `  -> UNEXPECTED: the form requires ${pwState.minLength}`)

const shortPw = await evaluate(`(async () => {
    const inputs = [...document.querySelectorAll('input')]
    const set = (el, v) => {
        if (!el) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const name = inputs.find(i => i.placeholder === 'Your name')
    const email = inputs.find(i => i.type === 'email')
    const pw = inputs.find(i => i.type === 'password')
    const submit = [...document.querySelectorAll('button')].find(b => /create account/i.test(b.textContent || ''))
    if (!name || !email || !pw || !submit) {
        return { ok: false, reason: 'form fields not found',
                 inputs: inputs.map(i => ({ type: i.type, ph: i.placeholder })) }
    }
    set(name, 'Short Pass')
    set(email, 'shortpass@example.com')
    set(pw, 'abc')
    submit.click()
    await new Promise(r => setTimeout(r, 2500))
    return {
        ok: true,
        url: location.pathname,
        stillOnRegister: location.pathname === '/register',
        message: (document.body.innerText.match(/at least \\d+ characters/i) || [])[0] || null,
        toast: (document.body.innerText.match(/password must be[^\\n]*/i) || [])[0] || null,
    }
})()`)
console.log('short password:', JSON.stringify(shortPw))
console.log(shortPw.ok && shortPw.stillOnRegister && /at least 8 characters/i.test(shortPw.message || '')
    ? '  -> blocked with the message "at least 8 characters"'
    : '  -> UNEXPECTED: the short password was not rejected as expected')

// ─── Fix: the CF handle is persisted at registration ─────────────────────────
console.log('\n=== Fix: a CF handle typed at sign-up is persisted ===')
const email = `reg${Date.now()}@example.com`
const registered = await evaluate(`(async () => {
    const inputs = [...document.querySelectorAll('input')]
    const set = (el, v) => {
        if (!el) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const name = inputs.find(i => i.placeholder === 'Your name')
    const email = inputs.find(i => i.type === 'email')
    const pw = inputs.find(i => i.type === 'password')
    const handle = inputs.find(i => i.placeholder === 'tourist')
    const submit = [...document.querySelectorAll('button')].find(b => /create account/i.test(b.textContent || ''))
    if (!name || !email || !pw || !handle || !submit) {
        return { ok: false, reason: 'form fields not found',
                 inputs: inputs.map(i => ({ type: i.type, ph: i.placeholder })) }
    }
    set(name, 'Reg Tester')
    set(email, '${email}')
    set(pw, 'supersecret123')
    set(handle, 'tourist')
    submit.click()
    await new Promise(r => setTimeout(r, 4000))
    return { ok: true, url: location.pathname, text: document.body.innerText.slice(0, 200).replace(/\\n+/g, ' | ') }
})()`)
console.log('registered:', JSON.stringify(registered).slice(0, 250))

// The account's own record must carry the handle.
const me = await evaluate(`(async () => {
    const r = await fetch('/api/auth/me', { credentials: 'include' })
    const d = await r.json()
    return { success: d.success, handle: d.user?.codeforcesHandle ?? null }
})()`)
console.log('/api/auth/me:', JSON.stringify(me))
console.log(me.handle === 'tourist'
    ? '  -> the handle was persisted through registration'
    : `  -> UNEXPECTED: the handle is ${JSON.stringify(me.handle)}`)

// And the UI must show it as linked.
const profile = await evaluate(`(async () => {
    history.pushState({}, '', '/profile')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await new Promise(r => setTimeout(r, 2500))
    return {
        linked: /currently linked/i.test(document.body.innerText),
        showsHandle: /tourist/.test(document.body.innerText),
    }
})()`)
console.log('profile:', JSON.stringify(profile))
console.log(profile.linked && profile.showsHandle
    ? '  -> the Profile screen shows the handle as linked'
    : '  -> UNEXPECTED: the Profile screen does not show the linked handle')

// ─── Fix: an invalid handle is rejected ──────────────────────────────────────
console.log('\n=== Fix: an invalid CF handle is rejected with a clear message ===')
await navigate(`${BASE}/register`)
const invalid = await evaluate(`(async () => {
    const inputs = [...document.querySelectorAll('input')]
    const set = (el, v) => {
        if (!el) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const submit = [...document.querySelectorAll('button')].find(b => /create account/i.test(b.textContent || ''))
    if (!submit) return { ok: false, reason: 'submit button not found' }
    set(inputs.find(i => i.placeholder === 'Your name'), 'Bad Handle')
    set(inputs.find(i => i.type === 'email'), 'badhandle${Date.now()}@example.com')
    set(inputs.find(i => i.type === 'password'), 'supersecret123')
    set(inputs.find(i => i.placeholder === 'tourist'), 'not a valid handle!')
    submit.click()
    await new Promise(r => setTimeout(r, 3000))
    return {
        ok: true,
        stillOnRegister: location.pathname === '/register',
        message: (document.body.innerText.match(/invalid codeforces handle[^\\n]*/i) || [])[0] || null,
    }
})()`)
console.log('invalid handle:', JSON.stringify(invalid))
console.log(invalid.ok && invalid.stillOnRegister && invalid.message
    ? '  -> rejected with a clear message'
    : '  -> UNEXPECTED: the invalid handle was not rejected')

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n=== Console errors ===')
if (!consoleErrors.length) console.log('  (none)')
else [...new Set(consoleErrors)].forEach(e => console.log('  !', e.slice(0, 250)))

ws.close()
chrome.kill()
process.exit(0)

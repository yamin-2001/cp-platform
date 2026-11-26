/**
 * End-to-end browser check.
 *
 * Drives the real frontend (served by Vite, proxying /api to the real
 * backend on :4000) in headless Chrome, logging in with a real account and
 * walking every route. Failures are captured from the page's console and
 * from failed network requests.
 *
 * Usage: node scripts/e2e-check.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5173'
const HERE = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(HERE, '..', 'e2e-shots')
mkdirSync(OUT_DIR, { recursive: true })

const CHROME = process.env.CHROME_BIN || 'google-chrome'
const PORT = 9222

const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1440,900',
    '--user-data-dir=/tmp/cplab-chrome-profile',
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
const failedRequests = []

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
    if (msg.method === 'Network.responseReceived') {
        const { status, url } = msg.params.response
        if (status >= 400) failedRequests.push(`${status} ${url}`)
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
    await sleep(2200)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')

// ─── Log in ───────────────────────────────────────────────────────────────────
console.log(`\n=== Logging in at ${BASE} ===`)
await navigate(`${BASE}/login`)

// Fill the form the same way a user would.
const filled = await evaluate(`(() => {
    const inputs = [...document.querySelectorAll('input')]
    const email = inputs.find(i => i.type === 'email' || /email/i.test(i.name + i.placeholder))
    const pass  = inputs.find(i => i.type === 'password')
    if (!email || !pass) return { ok: false, reason: 'inputs not found', count: inputs.length }
    const set = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set(email, 'e2e@example.com')
    set(pass, 'supersecret123')
    const form = email.closest('form')
    const button = form?.querySelector('button[type=submit]') || [...document.querySelectorAll('button')].find(b => /log ?in|sign ?in/i.test(b.textContent))
    if (!button) return { ok: false, reason: 'submit button not found' }
    button.click()
    return { ok: true }
})()`)
console.log('form fill:', JSON.stringify(filled))
await sleep(3500)

const afterLogin = await evaluate(`({
    url: location.pathname,
    hasSidebar: !!document.querySelector('aside'),
    bodyText: document.body.innerText.slice(0, 200).replace(/\\n+/g, ' | ')
})`)
console.log('after login:', JSON.stringify(afterLogin))

// ─── Walk the routes ──────────────────────────────────────────────────────────
const ROUTES = [
    ['/dashboard',     'Dashboard'],
    ['/suggestions',   'Suggestions'],
    ['/problems',      'Search'],
    ['/practicesets',  'Practice Sets'],
    ['/profile',       'Profile'],
]

console.log('\n=== Walking routes ===')
for (const [route, label] of ROUTES) {
    const before = consoleErrors.length
    await navigate(`${BASE}${route}`)
    const info = await evaluate(`({
        url: location.pathname,
        title: (document.querySelector('h1,h2')||{}).textContent || '',
        text: document.body.innerText.slice(0, 120).replace(/\\n+/g, ' | ')
    })`)
    const newErrors = consoleErrors.slice(before)
    console.log(`${route.padEnd(16)} -> ${info.url.padEnd(16)} ${info.title.slice(0, 30).padEnd(32)} errors:${newErrors.length}`)
    if (newErrors.length) newErrors.forEach(e => console.log('     !', e.slice(0, 200)))

    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot.result?.data) {
        writeFileSync(join(OUT_DIR, `${route.replace(/\//g, '-')}.png`), Buffer.from(shot.result.data, 'base64'))
    }
}

// ─── Practice set: create from suggestions, then flip a problem's status ─────
console.log('\n=== Practice set flow ===')
await navigate(`${BASE}/suggestions`)

// Wait for the suggestion cards to load.
await sleep(2500)

const created = await evaluate(`(async () => {
    const openBtn = [...document.querySelectorAll('button')].find(b => /save as set/i.test(b.textContent || ''))
    if (!openBtn) {
        return { ok: false, reason: 'no Save as Set button',
                 buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 20) }
    }
    openBtn.click()
    await new Promise(r => setTimeout(r, 800))

    const title = document.querySelector('input[placeholder*="title" i], input[placeholder*="name" i]')
        || [...document.querySelectorAll('input[type=text]')].pop()
    if (!title) {
        return { ok: false, reason: 'no title input',
                 inputs: [...document.querySelectorAll('input')].map(i => ({ t: i.type, p: i.placeholder })) }
    }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(title, 'E2E Generated Set')
    title.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 300))

    const create = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create')
    if (!create) {
        return { ok: false, reason: 'no Create button',
                 buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 20) }
    }
    create.click()
    await new Promise(r => setTimeout(r, 3500))
    return { ok: true, url: location.pathname, text: document.body.innerText.slice(0, 120).replace(/\\n+/g, ' | ') }
})()`)
console.log('create set:', JSON.stringify(created).slice(0, 400))

// Navigate to the practice sets list, then into the set we just made.
await navigate(`${BASE}/practicesets`)
const setLink = await evaluate(`(async () => {
    // The card title is an <h3>; the "Open" link sits in the card's actions.
    const card = [...document.querySelectorAll('h3')].find(h => /E2E Generated Set/i.test(h.textContent))
    if (!card) {
        return { found: false,
                 headings: [...document.querySelectorAll('h3')].map(h => h.textContent.trim()).slice(0, 10),
                 links: [...document.querySelectorAll('a')].map(a => a.textContent.trim()).filter(Boolean).slice(0, 10) }
    }
    const link = card.closest('.card')?.querySelector('a')
    if (!link) return { found: false, reason: 'no Open link in card' }
    link.click()
    await new Promise(r => setTimeout(r, 2500))
    return { found: true, url: location.pathname }
})()`)
console.log('open set:', JSON.stringify(setLink))

const detail = await evaluate(`({
    url: location.pathname,
    rows: document.querySelectorAll('tbody tr').length,
    solvedBtns: [...document.querySelectorAll('button')].filter(b => /✓\\s*solved/i.test(b.textContent || '')).length,
})`)
console.log('detail:', JSON.stringify(detail))

if (detail.solvedBtns > 0) {
    const before = await evaluate(`(async () => {
        const r = await fetch('/api/auth/me', { credentials: 'include' })
        const d = await r.json()
        return d.user?.stats?.totalSolved
    })()`)
    console.log('stats.totalSolved before click:', before)

    await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => /✓\\s*solved/i.test(x.textContent || ''))
        if (b) { b.click(); return 'clicked' }
        return 'not found'
    })()`)
    await sleep(2500)

    const after = await evaluate(`(async () => {
        const r = await fetch('/api/auth/me', { credentials: 'include' })
        const d = await r.json()
        return { totalSolved: d.user?.stats?.totalSolved, url: location.pathname }
    })()`)
    console.log('stats.totalSolved after click :', after.totalSolved, '(before:', before, ')')
    console.log(after.totalSolved === before + 1
        ? '  -> counter incremented correctly'
        : `  -> UNEXPECTED (expected ${before + 1})`)

    // Now reset it and confirm the credit is reversed.
    const resetClick = await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find(x => /reset/i.test(x.textContent || ''))
        if (b) { b.click(); return 'clicked' }
        return 'not found'
    })()`)
    await sleep(2500)

    const afterReset = await evaluate(`(async () => {
        const r = await fetch('/api/auth/me', { credentials: 'include' })
        const d = await r.json()
        return d.user?.stats?.totalSolved
    })()`)
    console.log('stats.totalSolved after reset :', afterReset, '(reset clicked:', resetClick, ')')
    console.log(afterReset === before
        ? '  -> credit correctly reversed'
        : `  -> UNEXPECTED (expected ${before})`)
}

const shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result?.data) {
    writeFileSync(join(OUT_DIR, 'practice-set-detail.png'), Buffer.from(shot.result.data, 'base64'))
}

// ─── Failed login must NOT redirect away from the login form ─────────────────
console.log('\n=== Failed login (must stay on /login and show the error) ===')
await navigate(`${BASE}/login`)
const badLogin = await evaluate(`(async () => {
    const inputs = [...document.querySelectorAll('input')]
    const email = inputs.find(i => i.type === 'email')
    const pass  = inputs.find(i => i.type === 'password')
    const set = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set(email, 'e2e@example.com')
    set(pass, 'definitely-the-wrong-password')
    const btn = [...document.querySelectorAll('button')].find(b => /sign ?in|log ?in/i.test(b.textContent || ''))
    btn.click()
    await new Promise(r => setTimeout(r, 3000))
    return {
        url: location.pathname,
        stillOnLogin: location.pathname === '/login',
        errorVisible: /invalid email or password/i.test(document.body.innerText),
    }
})()`)
console.log('failed login:', JSON.stringify(badLogin))
console.log(badLogin.stillOnLogin && badLogin.errorVisible
    ? '  -> stayed on the login form and showed the error (no redirect loop)'
    : '  -> PROBLEM: the user was redirected away or the error was swallowed')

// ─── Log out ──────────────────────────────────────────────────────────────────
console.log('\n=== Logging out ===')
await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /log ?out/i.test(b.textContent || b.getAttribute('aria-label') || ''))
    if (btn) { btn.click(); return 'clicked' }
    return 'button not found'
})()`)
await sleep(2500)
const afterLogout = await evaluate(`({ url: location.pathname })`)
console.log('after logout:', JSON.stringify(afterLogout))

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n=== Console errors ===')
if (!consoleErrors.length) console.log('  (none)')
else [...new Set(consoleErrors)].forEach(e => console.log('  !', e.slice(0, 250)))

console.log('\n=== Failed requests (4xx/5xx) ===')
if (!failedRequests.length) console.log('  (none)')
else [...new Set(failedRequests)].forEach(r => console.log('  !', r))

ws.close()
chrome.kill()
process.exit(0)

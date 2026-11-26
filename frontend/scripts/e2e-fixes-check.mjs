/**
 * Focused browser check for the second-round fixes.
 *
 * Covers the three behaviours that the existing e2e script does not touch:
 *   1. Clicking a tag filter sends exactly ONE request and the request
 *      actually carries the tag (the old code fired two requests and sent
 *      the previous tag set).
 *   2. The "Clear" button clears the tags and re-requests with NO tags.
 *   3. Saving a CF handle for the first time makes the "Last synced" line
 *      appear without a page reload.
 *
 * Usage: node scripts/e2e-fixes-check.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5173'
const HERE = dirname(fileURLToPath(import.meta.url))
const CHROME = process.env.CHROME_BIN || 'google-chrome'
const PORT = 9223

const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1440,900',
    '--user-data-dir=/tmp/cplab-chrome-profile-fixes',
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
const suggestionRequests = []

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
    if (msg.method === 'Network.requestWillBeSent') {
        const { url } = msg.params.request
        if (url.includes('/api/problems/suggestions')) suggestionRequests.push(url)
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

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')

// ─── Log in ───────────────────────────────────────────────────────────────────
console.log(`\n=== Logging in at ${BASE} ===`)
await navigate(`${BASE}/login`)

await evaluate(`(() => {
    const inputs = [...document.querySelectorAll('input')]
    const email = inputs.find(i => i.type === 'email')
    const pass  = inputs.find(i => i.type === 'password')
    const set = (el, v) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set(email, 'e2e@example.com')
    set(pass, 'supersecret123')
    ;[...document.querySelectorAll('button')].find(b => /sign ?in|log ?in/i.test(b.textContent || '')).click()
    return true
})()`)
await sleep(3500)
console.log('after login:', await evaluate(`location.pathname`))

// ─── Fix 1 + 2: tag filter and the Clear button ───────────────────────────────
console.log('\n=== Fix: tag filter fires ONE request and carries the tag ===')
await navigate(`${BASE}/suggestions`)
await sleep(2500)

// Baseline: how many requests the page load itself produces.
const baseline = suggestionRequests.length
console.log(`requests after page load: ${baseline}`)
suggestionRequests.forEach(u => console.log('   ', u.replace(BASE, '')))
console.log(baseline === 1
    ? '  -> one request on mount'
    : `  -> NOTE: ${baseline} requests on mount`)

const tagClick = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'dp')
    if (!btn) return { ok: false, reason: 'no dp tag button',
                      tags: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 30) }
    btn.click()
    await new Promise(r => setTimeout(r, 3000))
    return { ok: true }
})()`)
console.log('tag click:', JSON.stringify(tagClick))

const afterTag = suggestionRequests.slice(baseline)
console.log(`requests triggered by the tag click: ${afterTag.length}`)
afterTag.forEach(u => console.log('   ', u.replace(BASE, '')))
console.log(afterTag.length === 1
    ? '  -> exactly ONE request (no StrictMode double-fire)'
    : `  -> UNEXPECTED: ${afterTag.length} requests`)
console.log(afterTag.length && afterTag[0].includes('tags=')
    ? '  -> request carries the tags parameter'
    : '  -> UNEXPECTED: no tags parameter in the request')

// The card list must now reflect the filter (every card shows a "dp" tag).
const cardsShowDp = await evaluate(`(() => {
    const cards = [...document.querySelectorAll('label')]
    if (!cards.length) return { ok: false, reason: 'no suggestion cards rendered' }
    // A tag chip renders as its own element, so match on element text
    // rather than a word-boundary regex over the whole card.
    const withDp = cards.filter(c => [...c.querySelectorAll('span')].some(s => s.textContent.trim() === 'dp'))
    return { ok: true, total: cards.length, withDp: withDp.length }
})()`)
console.log('cards:', JSON.stringify(cardsShowDp))
console.log(cardsShowDp.ok && cardsShowDp.withDp > 0
    ? '  -> the returned problems actually carry the dp tag'
    : '  -> UNEXPECTED: no card carries the dp tag')

console.log('\n=== Fix: the Clear button clears the filter and re-requests without tags ===')
const clearResult = await evaluate(`(async () => {
    const before = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Clear').length
    if (!before) return { ok: false, reason: 'no Clear button visible while tags are active' }
    ;[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Clear').click()
    await new Promise(r => setTimeout(r, 3000))
    return { ok: true }
})()`)
console.log('clear click:', JSON.stringify(clearResult))

const afterClear = suggestionRequests.slice(baseline + afterTag.length)
console.log(`requests triggered by Clear: ${afterClear.length}`)
afterClear.forEach(u => console.log('   ', u.replace(BASE, '')))
console.log(afterClear.length === 1
    ? '  -> exactly ONE request'
    : `  -> UNEXPECTED: ${afterClear.length} requests`)
console.log(afterClear.length && !afterClear[0].includes('tags=')
    ? '  -> request carries NO tags parameter (the filter was really cleared)'
    : '  -> UNEXPECTED: the tags parameter survived the clear')

const clearVisible = await evaluate(`(() => {
    // The tags panel's "Clear" is the one sitting next to the "TAGS" label.
    // The selection bar has a "Clear" of its own, so match on position.
    const panel = [...document.querySelectorAll('p')].find(p => p.textContent.trim() === 'Tags')
        ?.parentElement
    return {
        tagsPanelClear: panel
            ? [...panel.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Clear').length
            : -1,
        activeTags: [...document.querySelectorAll('button')].filter(b => b.className.includes('badge-primary')).length,
    }
})()`)
console.log('after clear, UI state:', JSON.stringify(clearVisible))
console.log(clearVisible.tagsPanelClear === 0 && clearVisible.activeTags === 0
    ? '  -> the tag chips are no longer active and the tags-panel Clear is hidden'
    : '  -> UNEXPECTED: the UI still shows active tags')

// ─── Fix 3: sync status appears after saving a CF handle ──────────────────────
console.log('\n=== Fix: "Last synced" appears right after saving a CF handle ===')
await navigate(`${BASE}/profile`)
await sleep(2000)

// The e2e account already carries a handle from a previous run. Clear it
// through the API first so this exercises the real "first time" path: a
// user with no handle has no syncStatus loaded at all.
const cleared = await evaluate(`(async () => {
    const r = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeforcesHandle: '' }),
    })
    const d = await r.json()
    return { status: r.status, handle: d.user?.codeforcesHandle ?? null }
})()`)
console.log('handle cleared:', JSON.stringify(cleared))

// Reload so the app picks up the handle-less user from a clean session.
await navigate(`${BASE}/profile`)
await sleep(2000)

const hasSyncLine = () => evaluate(`/last synced/i.test(document.body.innerText)`)

console.log('sync line before saving a handle:', await hasSyncLine())

const saveResult = await evaluate(`(async () => {
    const input = [...document.querySelectorAll('input')].find(i => i.placeholder && /tourist/i.test(i.placeholder))
    if (!input) return { ok: false, reason: 'no handle input' }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'tourist')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 300))

    const verify = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Verify')
    if (!verify) return { ok: false, reason: 'no Verify button' }
    verify.click()
    await new Promise(r => setTimeout(r, 4000))

    const save = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Handle')
    if (!save) {
        return { ok: false, reason: 'the handle did not verify, so there is no Save Handle button',
                 text: document.body.innerText.slice(0, 300).replace(/\\n+/g, ' | ') }
    }
    save.click()
    await new Promise(r => setTimeout(r, 3500))
    return { ok: true, text: document.body.innerText.slice(0, 300).replace(/\\n+/g, ' | ') }
})()`)
console.log('save handle:', JSON.stringify(saveResult).slice(0, 300))

const syncLineAfter = await hasSyncLine()
console.log('sync line after saving the handle:', syncLineAfter)
console.log(syncLineAfter
    ? '  -> the "Last synced" line is visible without a page reload'
    : '  -> UNEXPECTED: still hidden')

// The saved handle must also be reflected in the input, i.e. the profile
// really did persist it.
const handleState = await evaluate(`(() => {
    const input = [...document.querySelectorAll('input')].find(i => i.placeholder && /tourist|e\\.g\\./i.test(i.placeholder))
    return {
        inputValue: input?.value ?? null,
        linkedLine: /currently linked/i.test(document.body.innerText),
    }
})()`)
console.log('handle state:', JSON.stringify(handleState))
console.log(handleState.inputValue === 'tourist' && handleState.linkedLine
    ? '  -> the handle was persisted and is shown as linked'
    : '  -> UNEXPECTED: the handle was not persisted')

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n=== Console errors ===')
if (!consoleErrors.length) console.log('  (none)')
else [...new Set(consoleErrors)].forEach(e => console.log('  !', e.slice(0, 250)))

ws.close()
chrome.kill()
process.exit(0)

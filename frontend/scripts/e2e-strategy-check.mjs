/**
 * Browser check for the strategy and level fixes.
 *
 * Covers the four behaviours introduced when the selection algorithm was
 * rewritten:
 *   1. The tag panel is collapsed to the popular tags, with an "All N"
 *      toggle to reveal the rest.
 *   2. A selected tag stays visible even when it is not a popular one.
 *   3. Each strategy returns problems spread across the rating band it
 *      promised, instead of collapsing onto a single rating level.
 *   4. "Random" returns problems from across the whole bank, not just from
 *      around the user's rating.
 *   5. A user with no Codeforces account can set their own estimated rating
 *      and the suggestions are matched against it.
 *
 * Usage: node scripts/e2e-strategy-check.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5173'
const CHROME = process.env.CHROME_BIN || 'google-chrome'
const PORT = 9226

const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--window-size=1440,900',
    '--user-data-dir=/tmp/cplab-chrome-profile-strategy',
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

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')

let failures = 0
const check = (label, ok, detail = '') => {
    console.log(ok ? `  -> PASS  ${label}` : `  -> FAIL  ${label}${detail ? ' — ' + detail : ''}`)
    if (!ok) failures++
}

/**
 * Locate the tags panel. The "Tags" caption gains a nested "N selected"
 * span once a tag is chosen, so an exact text match is not reliable.
 * Returns the container that holds the chips.
 */
const FIND_PANEL = `(() => {
    const label = [...document.querySelectorAll('p')]
        .find(p => (p.textContent || '').trim().startsWith('Tags'))
    if (!label) return null
    const row = label.parentElement
    // The chips live in the sibling div after the caption's own row.
    return (row && row.nextElementSibling) || row
})()`

// ─── Register a fresh user with no Codeforces account ────────────────────────
console.log(`\n=== Registering a handle-less user at ${BASE} ===`)
const email = `strategy${Date.now()}@example.com`
const password = 'supersecret123'

await navigate(`${BASE}/register`)
await evaluate(`(() => {
    const inputs = [...document.querySelectorAll('input')]
    const set = (el, v) => {
        if (!el) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set(inputs.find(i => i.type === 'email'), ${JSON.stringify(email)})
    set(inputs.find(i => i.type === 'password'), ${JSON.stringify(password)})
    const name = inputs.find(i => i.type === 'text')
    if (name) set(name, 'Strategy Tester')
    const btn = [...document.querySelectorAll('button')].find(b => /sign ?up|create|register/i.test(b.textContent || ''))
    if (btn) btn.click()
    return true
})()`)
await sleep(3500)
console.log('after register:', await evaluate(`location.pathname`))
console.log('user:', email)

// ─── 1. The tag panel is collapsed ───────────────────────────────────────────
console.log('\n=== Fix: the tag panel starts collapsed ===')
await navigate(`${BASE}/suggestions`)
await sleep(2000)

const panelState = await evaluate(`(() => {
    const panel = ${FIND_PANEL}
    if (!panel) return { ok: false, reason: 'no TAGS label' }
    const chips = [...panel.querySelectorAll('button.badge')]
    const allBtn = [...document.querySelectorAll('button')]
        .find(b => /^All \\d+$/.test(b.textContent.trim()))
    return {
        ok: true,
        chips: chips.length,
        chipNames: chips.map(c => c.textContent.trim()),
        toggleText: allBtn ? allBtn.textContent.trim() : null,
    }
})()`)
console.log('panel:', JSON.stringify(panelState))
check('the panel shows fewer than every tag', panelState.ok && panelState.chips < 38,
    `showed ${panelState.chips}`)
check('an "All N" toggle is offered', !!panelState.toggleText, String(panelState.toggleText))

const expanded = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('button')].find(b => /^All \\d+$/.test(b.textContent.trim()))
    if (!btn) return { ok: false, reason: 'no toggle' }
    btn.click()
    await new Promise(r => setTimeout(r, 800))
    const panel = ${FIND_PANEL}
    const chips = panel ? [...panel.querySelectorAll('button.badge')] : []
    const back = [...document.querySelectorAll('button')].find(b => /show fewer/i.test(b.textContent.trim()))
    return { ok: true, chips: chips.length, backText: back ? back.textContent.trim() : null }
})()`)
console.log('expanded:', JSON.stringify(expanded))
check('expanding reveals every tag', expanded.ok && expanded.chips >= 38, `showed ${expanded.chips}`)
check('the toggle becomes "Show fewer"', !!expanded.backText)

// Collapse again so the rest of the run is not affected.
await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('button')].find(b => /show fewer/i.test(b.textContent.trim()))
    if (btn) btn.click()
    await new Promise(r => setTimeout(r, 500))
    return true
})()`)

// ─── 2. A selected non-popular tag stays visible ────────────────────────────
console.log('\n=== Fix: a selected non-popular tag stays visible ===')
const hiddenTag = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('button')].find(b => /^All \\d+$/.test(b.textContent.trim()))
    if (btn) { btn.click(); await new Promise(r => setTimeout(r, 700)) }
    const POPULAR = ['dp','graphs','greedy','math','binary search','implementation',
        'data structures','strings','trees','number theory','geometry','two pointers','bitmasks',
        'dfs and similar','sortings']
    const chips = [...document.querySelectorAll('button.badge')].map(c => c.textContent.trim())
    // Pick a real Codeforces tag that is not in the popular list, so it
    // must not be reachable while the panel is collapsed.
    const nonPopular = chips.find(t => !POPULAR.includes(t))
    if (!nonPopular) return { ok: false, reason: 'no non-popular tag found' }
    const target = [...document.querySelectorAll('button.badge')].find(c => c.textContent.trim() === nonPopular)
    target.click()
    await new Promise(r => setTimeout(r, 1800))
    // Collapse again and see whether the selection is still shown.
    const fewer = [...document.querySelectorAll('button')].find(b => /show fewer/i.test(b.textContent.trim()))
    if (fewer) { fewer.click(); await new Promise(r => setTimeout(r, 700)) }
    const panel = ${FIND_PANEL}
    const visible = panel ? [...panel.querySelectorAll('button.badge')].map(c => c.textContent.trim()) : []
    return { ok: true, nonPopular, stillVisible: visible.includes(nonPopular), visible }
})()`)
console.log('non-popular tag:', JSON.stringify(hiddenTag))
check('a selected non-popular tag remains visible', hiddenTag.ok && hiddenTag.stillVisible,
    `visible: ${hiddenTag.visible?.join(',')}`)

// Clear the tag filter.
await evaluate(`(async () => {
    const panel = ${FIND_PANEL}
    const clear = panel ? [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === 'Clear') : null
    if (clear) clear.click()
    await new Promise(r => setTimeout(r, 1500))
    return true
})()`)

// ─── 3 & 4. The strategies spread across their band ─────────────────────────
console.log('\n=== Fix: each strategy spreads across its rating band ===')

const readRatings = async (label) => {
    await evaluate(`(async () => {
        const btn = [...document.querySelectorAll('button[role="radio"]')].find(b => b.textContent.trim() === ${JSON.stringify(label)})
        if (btn) btn.click()
        await new Promise(r => setTimeout(r, 2500))
        return true
    })()`)
    return evaluate(`(() => {
        const cards = [...document.querySelectorAll('label')].filter(l => l.querySelector('input[type="checkbox"]'))
        // The problem's rating is the bold number in the card's right-hand
        // column; the "N AC" line below it is the solved count. The two
        // live in separate child divs of that column, so read the first.
        const ratings = cards.map(c => {
            const col = [...c.querySelectorAll('div')]
                .filter(d => /text-right/.test(d.className || ''))[0]
            if (!col) return null
            const first = col.firstElementChild
            const n = Number((first?.textContent || '').trim())
            return Number.isFinite(n) && n > 0 ? n : null
        }).filter(Boolean)
        const meta = (document.body.textContent || '').match(/· (\\d+) excluded · (\\d+)[–-](\\d+)/)
        return { cards: cards.length, ratings, meta: meta ? meta.slice(1) : null }
    })()`)
}

for (const [label, minLevels] of [['Upsolve', 2], ['Stretch', 2], ['Smart', 2]]) {
    const r = await readRatings(label)
    const distinct = [...new Set(r.ratings)].sort((a, b) => a - b)
    console.log(`  ${label}: ${r.cards} cards, ratings ${r.ratings.join(',')}`)
    check(`${label} returns more than one rating level`, distinct.length >= minLevels,
        `distinct: ${distinct.join(',')}`)
}

// The rating is read out of the "AC" count in the card, which is the
// solved-count, not the problem rating. Read the rating from the API
// instead so the assertion is about the actual rating.
console.log('\n=== Fix: the strategies spread across their band (API level) ===')
const apiSpread = await evaluate(`(async () => {
    const results = {}
    for (const strategy of ['smart', 'upsolve', 'stretch', 'random']) {
        const res = await fetch('/api/problems/suggestions?strategy=' + strategy + '&count=20', { credentials: 'include' })
        const body = await res.json()
        results[strategy] = {
            ratings: body.suggestions.map(p => p.rating),
            meta: body.meta,
        }
    }
    return results
})()`)
for (const strategy of ['smart', 'upsolve', 'stretch', 'random']) {
    const r = apiSpread[strategy]
    const distinct = [...new Set(r.ratings)].sort((a, b) => a - b)
    console.log(`  ${strategy}: ${r.ratings.length} cards, ratings ${r.ratings.join(',')}`)
    console.log(`     meta: ${JSON.stringify(r.meta)}`)
    if (strategy === 'random') {
        check('random spreads across the whole bank', distinct.length >= 3,
            `distinct: ${distinct.join(',')}`)
        const far = r.ratings.filter(x => x < 1200 || x > 2200)
        check('random includes problems far from the user level', far.length > 0,
            `ratings: ${r.ratings.join(',')}`)
    } else {
        check(`${strategy} spreads across the band`, distinct.length >= 2,
            `distinct: ${distinct.join(',')}`)
        const { rMin, rMax } = r.meta
        check(`${strategy} respects its own window`,
            r.ratings.every(x => x >= rMin && x <= rMax),
            `window ${rMin}–${rMax}, ratings ${r.ratings.join(',')}`)
    }
}

// ─── 5. A handle-less user can set their own level ──────────────────────────
console.log('\n=== Fix: a handle-less user can set their own estimated rating ===')
await navigate(`${BASE}/profile`)
await sleep(1500)

const levelForm = await evaluate(`(() => {
    const card = [...document.querySelectorAll('h2')].find(h => /your level/i.test(h.textContent))
    if (!card) return { ok: false, reason: 'no "Your Level" card' }
    const body = card.closest('.card-body')
    const number = body.querySelector('input[type="number"]')
    const save  = [...body.querySelectorAll('button')].find(b => /save/i.test(b.textContent || ''))
    return { ok: true, hasInput: !!number, hasSave: !!save, value: number ? number.value : null }
})()`)
console.log('level form:', JSON.stringify(levelForm))
check('the "Your Level" card is shown without a CF account', levelForm.ok)
check('it offers a rating input', levelForm.hasInput)
check('it offers a Save button', levelForm.hasSave)

const saved = await evaluate(`(async () => {
    const card = [...document.querySelectorAll('h2')].find(h => /your level/i.test(h.textContent))
    const body = card.closest('.card-body')
    const number = body.querySelector('input[type="number"]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(number, '1750')
    number.dispatchEvent(new Event('input', { bubbles: true }))
    number.dispatchEvent(new Event('blur', { bubbles: true }))
    await new Promise(r => setTimeout(r, 400))
    ;[...body.querySelectorAll('button')].find(b => /save/i.test(b.textContent || '')).click()
    await new Promise(r => setTimeout(r, 2500))
    const toast = document.body.textContent.includes('Level saved')
    return { ok: true, toast }
})()`)
console.log('save level:', JSON.stringify(saved))
check('the estimated rating saves', saved.toast)

// The suggestions must now be matched against 1750, not the 1200 fallback.
await navigate(`${BASE}/suggestions`)
await sleep(2500)
const recalibrated = await evaluate(`(async () => {
    const res = await fetch('/api/problems/suggestions?strategy=smart&count=20', { credentials: 'include' })
    const body = await res.json()
    return { userRating: body.meta.userRating, rMin: body.meta.rMin, rMax: body.meta.rMax }
})()`)
console.log('after setting the level:', JSON.stringify(recalibrated))
check('the suggestions use the estimate, not the 1200 fallback',
    recalibrated.userRating === 1750, `userRating=${recalibrated.userRating}`)

const levelLine = await evaluate(`(() => {
    const t = document.body.textContent || ''
    const m = t.match(/Your level:\\s*(\\d+)/)
    return { ok: !!m, value: m ? m[1] : null }
})()`)
console.log('level line:', JSON.stringify(levelLine))
check('the page shows the level the suggestions are using', levelLine.ok, JSON.stringify(levelLine))

// ─── Console errors ──────────────────────────────────────────────────────────
console.log('\n=== Console errors ===')
if (consoleErrors.length) {
    consoleErrors.forEach(e => console.log('  !', e))
    failures += consoleErrors.length
} else {
    console.log('  (none)')
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
ws.close()
chrome.kill()
process.exit(failures === 0 ? 0 : 1)

/**
 * Input validation helpers.
 *
 * Every value that reaches a Mongo query must pass through here first. The
 * reason is NoSQL injection: if `email` can be an object, then
 * `findOne({ email })` becomes `findOne({ email: { $ne: null } })` and returns
 * the first document in the collection. Coercing to a string closes that off
 * and also gives us a place to enforce format rules.
 */

const MAX_STRING = 500

/** Coerce to a trimmed string. Returns null for anything non-scalar. */
export const asString = (value) => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (trimmed.length > MAX_STRING) return null
    return trimmed
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isValidEmail = (value) => {
    const email = asString(value)
    if (!email) return false
    if (email.length > 254) return false
    return EMAIL_RE.test(email)
}

/** Password rules: 8–72 chars. bcrypt silently truncates beyond 72 bytes. */
export const isValidPassword = (value) => {
    if (typeof value !== 'string') return false
    if (value.length < 8) return false
    // Count bytes, not characters — bcrypt's limit is on bytes.
    if (Buffer.byteLength(value, 'utf8') > 72) return false
    return true
}

/** Codeforces handles are latin letters, digits and underscores, 1–40 chars. */
export const isValidHandle = (value) => {
    const handle = asString(value)
    if (!handle) return false
    return /^[A-Za-z0-9_]{1,40}$/.test(handle)
}

/**
 * Parse an integer from a query/body value, clamped to [min, max].
 * Returns `fallback` when the value is absent or not numeric.
 */
export const clampInt = (value, { min = 1, max = Number.MAX_SAFE_INTEGER, fallback = min } = {}) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, Math.trunc(n)))
}

/** Parse a float from a query/body value, clamped to [min, max]. */
export const clampNumber = (value, { min = -Infinity, max = Infinity, fallback = min } = {}) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
}

/** Split a comma-separated tag list into a clean array of strings. */
export const parseTags = (value, { max = 20, maxLen = 40 } = {}) => {
    const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
    const out = []
    for (const raw of list) {
        const tag = asString(raw)
        if (!tag || tag.length > maxLen) continue
        if (!out.includes(tag)) out.push(tag)
        if (out.length >= max) break
    }
    return out
}

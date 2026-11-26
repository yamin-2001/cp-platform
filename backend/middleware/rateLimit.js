/**
 * A small in-memory rate limiter.
 *
 * Login and registration are the endpoints worth throttling: they are
 * unauthenticated, they run a bcrypt comparison, and an unthrottled login
 * endpoint is a free password-guessing oracle (and a CPU burner, since bcrypt
 * at cost 12 is deliberately slow).
 *
 * This is per-process state, which is the right trade-off for a single
 * instance. Behind more than one instance it would need a shared store such
 * as Redis; the limiter is written so that swap is a drop-in change.
 */

const WINDOW_MS = 15 * 60 * 1000

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map()

// Drop expired buckets periodically so the map cannot grow without bound.
const sweeper = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key)
    }
}, WINDOW_MS)
sweeper.unref?.()

const clientKey = (req) => {
    // `trust proxy` is enabled in server.js, so `req.ip` already accounts for
    // X-Forwarded-For when the app runs behind a proxy.
    return req.ip || req.socket?.remoteAddress || 'unknown'
}

/**
 * @param {object}  options
 * @param {number}  options.limit     Max requests per window.
 * @param {number}  options.windowMs  Window length in milliseconds.
 * @param {string}  options.message   Message returned when the limit is hit.
 * @param {string}  options.key       Namespace so different routes have
 *                                    independent counters.
 */
export const rateLimit = ({ limit = 10, windowMs = WINDOW_MS, message = 'Too many requests. Please try again later.', key = 'default' } = {}) => {
    return (req, res, next) => {
        const id = `${key}:${clientKey(req)}`
        const now = Date.now()

        let bucket = buckets.get(id)
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + windowMs }
            buckets.set(id, bucket)
        }

        bucket.count++

        const remaining = Math.max(0, limit - bucket.count)
        res.setHeader('X-RateLimit-Limit', limit)
        res.setHeader('X-RateLimit-Remaining', remaining)
        res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000))

        if (bucket.count > limit) {
            const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
            res.setHeader('Retry-After', retryAfter)
            return res.status(429).json({ success: false, message })
        }

        next()
    }
}

/**
 * HTTP error helpers.
 *
 * Every failure path in this API answers with the same body shape the
 * frontend already understands — `{ success: false, message }` — but *also*
 * with a real HTTP status code. The frontend's `request()` helper only
 * dispatches its "session expired" redirect on a 401, so a middleware that
 * answers 200 for an auth failure silently breaks the logout flow.
 *
 * `message` is always a safe, human-readable string. Details about the
 * underlying failure go to the server log instead of the response body.
 */

/**
 * An error that carries an intended HTTP status and a safe client message.
 * The global error handler in app.js reads `status` and `expose`.
 */
export class HttpError extends Error {
    constructor(status, message, { cause } = {}) {
        super(message, { cause })
        this.status = status
        this.expose = true
    }
}

/**
 * Send an error response.
 *
 * `status`  — the HTTP status to use.
 * `message` — what the client sees. Must not contain internal detail.
 * `err`     — the original error, logged server-side only.
 */
export const sendError = (res, status, message, err) => {
    if (err) {
        const detail = err.stack || err.message || String(err)
        console.error(`[api] ${status} ${message} ::`, detail)
    }
    return res.status(status).json({ success: false, message })
}

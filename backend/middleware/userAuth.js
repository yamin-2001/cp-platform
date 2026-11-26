import jwt from 'jsonwebtoken'

/**
 * Auth middleware.
 *
 * A missing or invalid token is a 401, not a 200 with `{ success: false }`.
 * The frontend's API client only dispatches its "session expired" redirect
 * when `res.status === 401`, so answering 200 here left the app showing a
 * stale authenticated shell with no way to recover.
 *
 * The JWT library's own error text ("jwt malformed", "jwt expired") is never
 * returned to the client — it tells an attacker the difference between a
 * forged and a merely stale token.
 */
const userAuth = async (req, res, next) => {
    const { token } = req.cookies

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized. Please login again.' })
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = decoded.id
        next()
    } catch (e) {
        console.warn('[auth] token rejected:', e.message)
        return res.status(401).json({ success: false, message: 'Not authorized. Please login again.' })
    }
}

export default userAuth

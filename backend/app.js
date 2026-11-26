import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import authRouter        from './routes/authRouter.js'
import cfRouter          from './routes/cfRouter.js'
import problemRouter     from './routes/problemRouter.js'
import practiceSetRouter from './routes/practiceSetRouter.js'
import { HttpError } from './utils/httpError.js'

/**
 * The Express application.
 *
 * This module deliberately does not listen on a port and does not connect to
 * the database — those are the entrypoint's job (see server.js). Keeping them
 * separate means the test suite can mount the app on an ephemeral port
 * without opening 4000 or racing the real server's connection.
 */
export const createApp = () => {
    const app = express()

    app.disable('x-powered-by')
    app.set('trust proxy', 1)

    app.use(express.json({ limit: '100kb' }))
    app.use(cookieParser())

    // Allow a comma-separated list of origins; fall back to the single
    // CLIENT_URL for the common single-origin deployment.
    //
    // The Vite dev server runs on 5173, not the 3000 that the frontend's
    // production build is served from, so both are allowed by default. A
    // disallowed origin is a 403, not a 500 — the previous code threw from
    // inside the cors middleware, which surfaced as an opaque server error.
    const configuredOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean)

    const allowedOrigins = new Set([
        'http://localhost:3000',
        'http://localhost:5173',
        // `vite preview` serves the production build on 4173 by default.
        'http://localhost:4173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
        ...configuredOrigins,
    ])

    app.use(cors({
        origin: (origin, cb) => {
            // No Origin header — same-origin, curl, or a server-side call.
            if (!origin) return cb(null, true)
            if (allowedOrigins.has(origin)) return cb(null, true)
            cb(new HttpError(403, 'Origin not allowed by CORS'))
        },
        credentials: true,
    }))

    app.get('/', (req, res) => res.send('API Working fine'))

    app.get('/health', (req, res) => {
        const states = ['disconnected', 'connected', 'connecting', 'disconnecting']
        const dbState = states[mongoose.connection.readyState] ?? 'unknown'
        res.status(dbState === 'connected' ? 200 : 503).json({
            success: dbState === 'connected',
            status: dbState === 'connected' ? 'ok' : 'degraded',
            database: dbState,
            uptime: Math.round(process.uptime()),
        })
    })

    app.use('/api/auth',         authRouter)
    app.use('/api/cf',           cfRouter)
    app.use('/api/problems',     problemRouter)
    app.use('/api/practicesets', practiceSetRouter)

    // 404 for anything that did not match a route.
    app.use((req, res) => {
        res.status(404).json({ success: false, message: `No route for ${req.method} ${req.originalUrl}` })
    })

    // Global error handler. Everything that reaches here has already had its
    // client-safe message decided by the handler that threw; this is the last
    // resort for unexpected failures (including async rejections that were not
    // wrapped) and must never leak a stack trace to the client.
    app.use((err, req, res, next) => {
        if (res.headersSent) return next(err)

        const status = err.status || err.statusCode || 500
        const message = err.expose && err.message
            ? err.message
            : (status === 500 ? 'Something went wrong. Please try again.' : err.message)

        if (status >= 500) {
            console.error('[api] unhandled error:', err.stack || err.message || err)
        } else {
            console.warn(`[api] ${status}:`, err.message)
        }

        res.status(status).json({ success: false, message })
    })

    return app
}

export default createApp

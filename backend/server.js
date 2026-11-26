import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from './config/mongodb.js'
import { validateEnv, failFast } from './config/env.js'
import { createApp } from './app.js'

// Configuration is checked before anything else starts listening.
const envCheck = validateEnv()
if (!envCheck.ok) failFast(envCheck)

const app = createApp()
const port = process.env.PORT || 4000

const server = app.listen(port, () => console.log(`Server started on PORT: ${port}`))

// The database connection is awaited and watched: previously `connectDB()`
// was called without await or catch, so a failed connection left the server
// running and every request failing with an opaque 500.
connectDB().catch((e) => {
    console.error('[db] initial connection failed:', e.message)
    console.error('[db] the server is running but the database is unreachable — restarting is usually the fix.')
})

mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'))

const shutdown = (signal) => {
    console.log(`\n[server] ${signal} received, shutting down…`)
    server.close(async () => {
        try {
            await mongoose.connection.close(false)
            console.log('[server] closed cleanly')
        } catch (e) {
            console.error('[server] error closing database:', e.message)
        }
        process.exit(0)
    })
    // Do not hang forever on a stuck connection.
    setTimeout(() => {
        console.error('[server] forced shutdown after timeout')
        process.exit(1)
    }, 10000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandled rejection:', reason)
})

export { app }

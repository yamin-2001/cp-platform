/**
 * Environment validation.
 *
 * The server used to start happily with a missing `JWT_SECRET` and only
 * fail later, at the first login, with a confusing 500. Configuration
 * mistakes are boot-time problems, so they are checked at boot.
 */

const REQUIRED = [
    { key: 'MONGODB_URI', hint: 'e.g. mongodb://127.0.0.1:27017' },
    { key: 'JWT_SECRET',  hint: 'a long random string' },
]

/**
 * Validate the environment.
 * @returns {{ ok: true } | { ok: false, missing: Array<{key: string, hint: string}> }}
 */
export const validateEnv = () => {
    const missing = REQUIRED.filter(({ key }) => {
        const value = process.env[key]
        return !value || !value.trim()
    })

    // A short JWT secret is worse than none in practice — it is guessable.
    const secret = process.env.JWT_SECRET
    if (secret && secret.trim().length < 32 && process.env.NODE_ENV === 'production') {
        return {
            ok: false,
            missing: [{ key: 'JWT_SECRET', hint: 'must be at least 32 characters in production' }],
        }
    }

    return missing.length ? { ok: false, missing } : { ok: true }
}

/** Print a clear, actionable message and exit. */
export const failFast = ({ missing }) => {
    console.error('\n[config] Cannot start — the environment is incomplete:\n')
    for (const { key, hint } of missing) {
        console.error(`  • ${key} is not set (${hint})`)
    }
    console.error('\n  Add these to backend/.env and try again.\n')
    process.exit(1)
}

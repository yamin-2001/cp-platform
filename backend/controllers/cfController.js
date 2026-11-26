import axios from 'axios'
import userModel from '../models/userModel.js'
import problemModel from '../models/problemModel.js'
import practiceSetModel from '../models/practiceSetModel.js'
import { asString } from '../utils/validate.js'
import { sendError } from '../utils/httpError.js'

const CF_API = 'https://codeforces.com/api'

// Codeforces' `user.status` endpoint returns submissions newest-first and
// paginates with `from` (1-based index) and `count` (page size, max 10 000).
// A single `count=10000` request silently truncates the history of anyone
// with more than 10 000 submissions, and CF caps the page size, so the
// history is walked in pages.
const CF_PAGE_SIZE = 1000
const CF_MAX_PAGES = 20   // up to 20 000 submissions

const cfGet = async (path, params, timeout = 10000) => {
    const { data } = await axios.get(`${CF_API}${path}`, { params, timeout })
    return data
}

export const validateHandle = async (req, res) => {
    const handle = asString(req.params.handle)
    if (!handle) {
        return res.status(400).json({ success: false, message: 'Please provide a Codeforces handle.' })
    }

    try {
        const data = await cfGet('/user.info', { handles: handle }, 8000)
        if (data.status !== 'OK' || !data.result?.length) {
            return res.status(404).json({ success: false, message: 'Handle not found on Codeforces.' })
        }
        const u = data.result[0]
        return res.json({
            success: true,
            cfUser: { handle: u.handle, rating: u.rating || 0, maxRating: u.maxRating || 0, rank: u.rank || 'unrated', avatar: u.avatar || '' }
        })
    } catch (e) {
        if (e.response?.status === 400) {
            return res.status(404).json({ success: false, message: 'Handle not found on Codeforces.' })
        }
        return sendError(res, 502, 'Could not reach Codeforces. Try again.', e)
    }
}

export const syncWithCF = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId)
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

        if (!user.codeforcesHandle) {
            return res.status(400).json({ success: false, message: 'No Codeforces handle set. Update your profile first.' })
        }

        // ── CF user info (rating, rank) ──────────────────────────────────────
        try {
            const info = await cfGet('/user.info', { handles: user.codeforcesHandle }, 8000)
            if (info.status === 'OK' && info.result?.[0]) {
                const u = info.result[0]
                user.cfRating    = u.rating    || 0
                user.cfMaxRating = u.maxRating || 0
                user.cfRank      = u.rank      || ''
                user.cfAvatar    = u.avatar    || ''
            }
        } catch (e) {
            // A failed rating lookup should not abort the whole sync — the
            // submission history is the part that matters.
            console.warn('[cf] user.info failed:', e.message)
        }

        // ── Submission history, walked page by page ──────────────────────────
        const submissions = []
        let from = 1
        for (let page = 0; page < CF_MAX_PAGES; page++) {
            let data
            try {
                data = await cfGet('/user.status', {
                    handle: user.codeforcesHandle,
                    from,
                    count: CF_PAGE_SIZE,
                }, 20000)
            } catch (e) {
                console.warn(`[cf] user.status page ${page} failed:`, e.message)
                break
            }

            if (data.status !== 'OK') break

            const batch = data.result || []
            submissions.push(...batch)

            // A short page means we have reached the end of the history.
            if (batch.length < CF_PAGE_SIZE) break
            from += CF_PAGE_SIZE
        }

        const solvedKeys    = new Set()
        const attemptedKeys = new Set()

        for (const sub of submissions) {
            if (!sub.problem?.contestId) continue
            const key = `${sub.problem.contestId}__${sub.problem.index}`
            if (sub.verdict === 'OK') {
                solvedKeys.add(key)
                attemptedKeys.delete(key)
            } else if (!solvedKeys.has(key)) {
                attemptedKeys.add(key)
            }
        }

        // ── Match against our problem bank ────────────────────────────────────
        const allKeys = [...solvedKeys, ...attemptedKeys]
        const matched = allKeys.length
            ? await problemModel.find({
                $or: allKeys.map(k => {
                    const [c, i] = k.split('__')
                    return { contestId: Number(c), index: i }
                })
              }).select('_id contestId index difficulty').lean()
            : []

        const solvedIds    = []
        const attemptedIds = []
        for (const p of matched) {
            const key = `${p.contestId}__${p.index}`
            if (solvedKeys.has(key))    solvedIds.push(p._id)
            else if (attemptedKeys.has(key)) attemptedIds.push(p._id)
        }

        const solvedDocs = matched.filter(p => solvedKeys.has(`${p.contestId}__${p.index}`))

        // ── Merge, don't overwrite ───────────────────────────────────────────
        // The previous code assigned `user.solvedProblems = solvedIds`, which
        // discarded every problem the user had marked solved by hand. The CF
        // account is a source of truth for *its* problems, not for the
        // user's local work, so the two sets are unioned.
        const previousSolved    = user.solvedProblems.map(String)
        const previousAttempted = user.attemptedProblems.map(String)

        const union = (a, b) => {
            const seen = new Set()
            const out = []
            for (const id of [...a, ...b]) {
                const key = String(id)
                if (seen.has(key)) continue
                seen.add(key)
                out.push(id)
            }
            return out
        }

        const mergedSolved    = union(previousSolved, solvedIds)
        const mergedAttempted = union(
            previousAttempted.filter(id => !mergedSolved.some(s => String(s) === String(id))),
            attemptedIds
        )

        user.solvedProblems    = mergedSolved
        user.attemptedProblems = mergedAttempted
        user.stats.totalSolved    = mergedSolved.length
        user.stats.totalAttempted = mergedAttempted.length
        user.stats.easyCount   = solvedDocs.filter(p => p.difficulty === 'easy').length
        user.stats.mediumCount = solvedDocs.filter(p => p.difficulty === 'medium').length
        user.stats.hardCount   = solvedDocs.filter(p => p.difficulty === 'hard').length
        user.stats.lastSynced  = new Date()
        await user.save({ validateBeforeSave: false })

        // ── Auto-update practice set statuses ────────────────────────────────
        // Only ever *promotes* an entry. A practice set entry that the user
        // manually reset stays reset — the CF verdict is older information,
        // not newer.
        const practiceSets = await practiceSetModel.find({ user: req.userId }).populate('problems.problem', 'contestId index')
        let autoMarked = 0
        for (const ps of practiceSets) {
            let changed = false
            for (const entry of ps.problems) {
                const p = entry.problem
                if (!p) continue
                const key = `${p.contestId}__${p.index}`
                if (solvedKeys.has(key) && entry.status !== 'solved') {
                    entry.status   = 'solved'
                    entry.solvedAt = new Date()
                    changed = true
                    autoMarked++
                } else if (attemptedKeys.has(key) && entry.status === 'unsolved') {
                    entry.status = 'attempted'
                    changed = true
                }
            }
            if (changed) await ps.save()
        }

        return res.json({
            success: true,
            message: `Synced ${submissions.length} submissions.`,
            stats: {
                totalSubmissions: submissions.length,
                solved:      mergedSolved.length,
                attempted:   mergedAttempted.length,
                easyCount:   user.stats.easyCount,
                mediumCount: user.stats.mediumCount,
                hardCount:   user.stats.hardCount,
                autoMarked,
                cfRating:    user.cfRating,
                cfRank:      user.cfRank,
            }
        })

    } catch (e) {
        return sendError(res, 500, 'Could not sync with Codeforces.', e)
    }
}

export const getSyncStatus = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select('codeforcesHandle cfRating cfRank cfAvatar stats')
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' })
        return res.json({
            success:        true,
            handle:         user.codeforcesHandle,
            cfRating:       user.cfRating,
            cfRank:         user.cfRank,
            cfAvatar:       user.cfAvatar,
            lastSynced:     user.stats.lastSynced,
            totalSolved:    user.stats.totalSolved,
            totalAttempted: user.stats.totalAttempted,
        })
    } catch (e) {
        return sendError(res, 500, 'Could not load sync status.', e)
    }
}

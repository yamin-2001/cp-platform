import axios from "axios"
import userModel from "../models/userModel.js"
import problemModel from "../models/problemModel.js"
import practiceSetModel from "../models/practiceSetModel.js"

const CF_API = 'https://codeforces.com/api'

export const validateHandle = async (req, res) => {
    const { handle } = req.params
    try {
        const { data } = await axios.get(`${CF_API}/user.info?handles=${handle}`, { timeout: 8000 })
        if (data.status !== 'OK') {
            return res.json({ success: false, message: 'Handle not found on Codeforces.' })
        }
        const u = data.result[0]
        return res.json({
            success: true,
            cfUser: { handle: u.handle, rating: u.rating || 0, maxRating: u.maxRating || 0, rank: u.rank || 'unrated', avatar: u.avatar || '' }
        })
    } catch (e) {
        if (e.response?.status === 400) return res.json({ success: false, message: 'Handle not found on Codeforces.' })
        return res.json({ success: false, message: 'Could not reach Codeforces. Try again.' })
    }
}

export const syncWithCF = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId)
        if (!user.codeforcesHandle) {
            return res.json({ success: false, message: 'No Codeforces handle set. Update your profile first.' })
        }

        // Fetch CF user info (rating, rank)
        const infoRes = await axios.get(`${CF_API}/user.info?handles=${user.codeforcesHandle}`, { timeout: 8000 })
        if (infoRes.data.status === 'OK') {
            const u = infoRes.data.result[0]
            user.cfRating    = u.rating    || 0
            user.cfMaxRating = u.maxRating || 0
            user.cfRank      = u.rank      || ''
            user.cfAvatar    = u.avatar    || ''
        }

        // Fetch all submissions
        const subRes = await axios.get(`${CF_API}/user.status`, {
            params:  { handle: user.codeforcesHandle, from: 1, count: 10000 },
            timeout: 20000
        })
        if (subRes.data.status !== 'OK') {
            return res.json({ success: false, message: 'Codeforces API error fetching submissions.' })
        }

        const submissions = subRes.data.result
        const solvedKeys   = new Set()
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

        // Match against our problem bank
        const allKeys = [...solvedKeys, ...attemptedKeys]
        const matched = allKeys.length
            ? await problemModel.find({
                $or: allKeys.map(k => { const [c, i] = k.split('__'); return { contestId: Number(c), index: i } })
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
        user.solvedProblems        = solvedIds
        user.attemptedProblems     = attemptedIds
        user.stats.totalSolved     = solvedIds.length
        user.stats.totalAttempted  = attemptedIds.length
        user.stats.easyCount       = solvedDocs.filter(p => p.difficulty === 'easy').length
        user.stats.mediumCount     = solvedDocs.filter(p => p.difficulty === 'medium').length
        user.stats.hardCount       = solvedDocs.filter(p => p.difficulty === 'hard').length
        user.stats.lastSynced      = new Date()
        await user.save({ validateBeforeSave: false })

        // Auto-update practice set statuses
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
                solved:      solvedIds.length,
                attempted:   attemptedIds.length,
                easyCount:   user.stats.easyCount,
                mediumCount: user.stats.mediumCount,
                hardCount:   user.stats.hardCount,
                autoMarked,
                cfRating:    user.cfRating,
                cfRank:      user.cfRank,
            }
        })

    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

export const getSyncStatus = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select('codeforcesHandle cfRating cfRank cfAvatar stats')
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
        return res.json({ success: false, message: e.message })
    }
}

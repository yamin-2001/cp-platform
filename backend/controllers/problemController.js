import axios from "axios"
import userModel from "../models/userModel.js"
import problemModel from "../models/problemModel.js"

const getDifficulty = (rating) => {
    if (!rating) return 'unrated'
    if (rating <= 1200) return 'easy'
    if (rating <= 1900) return 'medium'
    return 'hard'
}

// Sync the full problem bank from Codeforces API
export const syncProblemBank = async (req, res) => {
    try {
        const { data } = await axios.get('https://codeforces.com/api/problemset.problems', { timeout: 20000 })
        if (data.status !== 'OK') return res.json({ success: false, message: 'CF API error.' })

        const { problems, problemStatistics } = data.result
        const statsMap = {}
        problemStatistics.forEach(s => { statsMap[`${s.contestId}__${s.index}`] = s.solvedCount })

        const ops = problems.filter(p => p.contestId && p.index && p.name).map(p => ({
            updateOne: {
                filter: { contestId: p.contestId, index: p.index },
                update: {
                    $set: {
                        name:        p.name,
                        type:        p.type || 'PROGRAMMING',
                        rating:      p.rating || 0,
                        tags:        p.tags || [],
                        solvedCount: statsMap[`${p.contestId}__${p.index}`] || 0,
                        url:         `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
                        difficulty:  getDifficulty(p.rating),
                    }
                },
                upsert: true
            }
        }))

        await problemModel.bulkWrite(ops)
        return res.json({ success: true, message: `Synced ${ops.length} problems.`, count: ops.length })

    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

// Get smart suggestions — only problems the user has never attempted
export const getSuggestions = async (req, res) => {
    try {
        const { strategy = 'smart', count = 20, tags, minRating, maxRating } = req.query

        const user = await userModel.findById(req.userId).select('solvedProblems attemptedProblems cfRating')
        const excludeIds = [...user.solvedProblems.map(String), ...user.attemptedProblems.map(String)]
        const userRating = user.cfRating || 1200

        let rMin, rMax, label
        if (minRating && maxRating) {
            rMin = Number(minRating); rMax = Number(maxRating); label = `${rMin}–${rMax}`
        } else {
            switch (strategy) {
                case 'upsolve': rMin = Math.max(800, userRating - 400); rMax = userRating - 1; label = 'Build confidence'; break
                case 'stretch': rMin = userRating + 200; rMax = userRating + 700;               label = 'Stretch goal';     break
                case 'random':  rMin = 800; rMax = 3500;                                        label = 'Random pick';      break
                default:        rMin = Math.max(800, userRating - 100); rMax = userRating + 300; label = 'At your level';
            }
        }

        const query = {
            _id:    { $nin: excludeIds },
            rating: { $gte: rMin, $lte: rMax, $gt: 0 },
            type:   'PROGRAMMING'
        }
        if (tags) {
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
            if (tagList.length) query.tags = { $in: tagList }
        }

        // $sample gives a random spread across the full rating range
        // prevents bias toward low-rated problems that have high solvedCount
        const pool = await problemModel.aggregate([
            { $match: query },
            { $sample: { size: Number(count) * 6 } }
        ])

        if (!pool.length) return res.json({ success: true, suggestions: [], meta: { userRating, rMin, rMax, label } })

        const sweetSpot = userRating + 100
        const suggestions = pool
            .map(p => {
                let score = 0

                // Rating proximity is the PRIMARY factor
                const dist = Math.abs(p.rating - sweetSpot)
                score += Math.max(0, 500 - dist) / 5

                // solvedCount is secondary quality signal (log scaled so it doesn't dominate)
                score += Math.log10(Math.max(p.solvedCount, 1)) * 3

                // Strategy bonuses
                if (strategy === 'stretch' && p.rating > userRating + 200) score += 30
                if (strategy === 'upsolve' && p.rating < userRating)       score += 20
                if (strategy === 'random') score += Math.random() * 50

                const reasons = [label]
                if (p.difficulty === 'easy')   reasons.push('Good for warmup')
                if (p.difficulty === 'medium') reasons.push('Right at your level')
                if (p.difficulty === 'hard')   reasons.push('Challenge yourself')

                return { ...p, _score: score, reasons: [...new Set(reasons)], userStatus: 'unsolved' }
            })
            .sort((a, b) => b._score - a._score)
            .slice(0, Number(count))
            .map(({ _score, ...p }) => p)

        return res.json({
            success: true,
            count: suggestions.length,
            meta:  { userRating, rMin, rMax, strategy, label, excluded: excludeIds.length },
            suggestions
        })

    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

// Search problems with CF status annotation
export const searchProblems = async (req, res) => {
    try {
        const { q, minRating = 800, maxRating = 3500, tags, difficulty, page = 1, limit = 25, hideSolved = 'false' } = req.query

        const user = await userModel.findById(req.userId).select('solvedProblems attemptedProblems')
        const solvedSet    = new Set(user.solvedProblems.map(String))
        const attemptedSet = new Set(user.attemptedProblems.map(String))

        const query = { rating: { $gte: Number(minRating), $lte: Number(maxRating) } }

        if (q?.trim()) {
            const esc = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            query.$or = [{ name: { $regex: esc, $options: 'i' } }]
            const cfId = q.trim().match(/^(\d+)([A-Za-z]\d*)$/)
            if (cfId) query.$or.push({ contestId: Number(cfId[1]), index: cfId[2].toUpperCase() })
        }

        if (tags) {
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
            if (tagList.length) query.tags = { $in: tagList }
        }
        if (difficulty && difficulty !== 'all') query.difficulty = difficulty
        if (hideSolved === 'true') query._id = { $nin: user.solvedProblems }

        const skip  = (Number(page) - 1) * Number(limit)
        const total = await problemModel.countDocuments(query)
        const problems = await problemModel.find(query).sort('-solvedCount').skip(skip).limit(Number(limit)).lean()

        const annotated = problems.map(p => ({
            ...p,
            userStatus: solvedSet.has(String(p._id))    ? 'solved'
                      : attemptedSet.has(String(p._id)) ? 'attempted'
                      : 'unsolved'
        }))

        return res.json({
            success: true, total,
            totalPages:  Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            problems:    annotated
        })

    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

export const getTags = async (req, res) => {
    try {
        const tags = await problemModel.distinct('tags')
        return res.json({ success: true, tags: tags.sort() })
    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}
import axios from "axios"
import mongoose from "mongoose"
import userModel from "../models/userModel.js"
import problemModel from "../models/problemModel.js"
import { clampInt, clampNumber, parseTags } from "../utils/validate.js"

/**
 * Build the list of problem ids to exclude from a query.
 * See the note in practiceSetController.js — `$nin` needs real ObjectIds.
 */
const toObjectIds = (ids = []) =>
    ids
        .map(id => (id instanceof mongoose.Types.ObjectId ? id : mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(String(id)) : null))
        .filter(Boolean)

const getDifficulty = (rating) => {
    if (!rating) return 'unrated'
    if (rating <= 1200) return 'easy'
    if (rating <= 1900) return 'medium'
    return 'hard'
}

/**
 * The rating window and the rating the score aims for, per strategy.
 *
 * Each strategy defines BOTH the window of acceptable problems and a target
 * rating inside that window. The previous code always scored against
 * `userRating + 100`, which sat *outside* the upsolve and stretch windows —
 * so the score collapsed to whichever single rating band was nearest the
 * target, and "upsolve" returned 20 problems all rated exactly 1400.
 *
 * `target` is expressed as an offset from the window's midpoint, so the
 * strategy survives any user rating:
 *   0    → the middle of the window
 *   -1   → the low end (easier problems)
 *   +1   → the high end (harder problems)
 */
const STRATEGIES = {
    // Just below to well above the user's level; aim slightly above it, since
    // problems a little harder than your current rating are where growth is.
    smart:   { span: [-100, 300], target: 0.35, label: 'At your level'    },
    // Below the user's rating, aiming at the harder end of the lower band —
    // the point of "upsolve" is to work just below your level, not to serve
    // the very easiest problems you could find.
    upsolve: { span: [-400, -1],   target: 0.75, label: 'Build confidence' },
    // Above the user's rating, aiming at the gentler end of the higher band.
    stretch: { span: [200, 700],   target: 0.25, label: 'Stretch goal'     },
    // The whole bank. `span` is unused: for "random" the rating must not
    // rank the results at all (see the scoring below).
    random:  { span: null,        target: 0,    label: 'Random pick'      },
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

        const user = await userModel.findById(req.userId).select('solvedProblems attemptedProblems cfRating estimatedRating')
        // The exclusion list must keep the raw ObjectIds. `map(String)`
        // turned them into hex strings, and `$nin` is type-strict: a string
        // never matches an ObjectId `_id`, so solved problems were still
        // being served. Mongoose casts the `$nin` array contents for us.
        const excludeIds = toObjectIds([...user.solvedProblems, ...user.attemptedProblems])
        // The user's level: their real Codeforces rating when they have
        // linked an account, otherwise their own estimate. Only if they have
        // neither do we fall back to 1200.
        const userRating = user.cfRating || user.estimatedRating || 1200

        const isRandom = strategy === 'random'
        const spec = STRATEGIES[strategy] || STRATEGIES.smart

        let rMin, rMax, label, targetRating
        if (minRating && maxRating) {
            rMin = clampNumber(minRating, { min: 0, max: 4000 })
            rMax = clampNumber(maxRating, { min: 0, max: 4000 })
            if (rMax < rMin) rMax = rMin
            label = `${rMin}–${rMax}`
            targetRating = (rMin + rMax) / 2
        } else if (isRandom) {
            rMin = 800; rMax = 3500
            label = spec.label
            targetRating = null
        } else {
            rMin = Math.max(800, userRating + spec.span[0])
            rMax = Math.min(3500, userRating + spec.span[1])
            if (rMax < rMin) rMax = rMin
            label = spec.label
            // The target sits `spec.target` of the way through the window.
            targetRating = rMin + (rMax - rMin) * spec.target
        }

        const query = {
            _id:    { $nin: excludeIds },
            rating: { $gte: rMin, $lte: rMax, $gt: 0 },
            type:   'PROGRAMMING'
        }
        const tagList = parseTags(tags)
        // `$all`, not `$in`: selecting "dp, greedy" means a problem must
        // carry BOTH tags. `$in` means "either", so the filter returned
        // every problem with one of them and silently dropped the other.
        if (tagList.length) query.tags = { $all: tagList }

        // `count` comes from the query string, so it must be clamped: an
        // unclamped value drove the `$sample` size (`count * 6`) straight
        // into Mongo, and a non-numeric one produced `NaN`.
        const safeCount = clampInt(count, { min: 1, max: 50, fallback: 20 })

        // $sample gives a random spread across the full rating range
        // prevents bias toward low-rated problems that have high solvedCount
        const pool = await problemModel.aggregate([
            { $match: query },
            { $sample: { size: safeCount * 6 } }
        ])

        if (!pool.length) {
            // `excluded` and `strategy` are included here too — the frontend
            // renders them unconditionally, and the empty branch used to
            // leave them undefined.
            return res.json({
                success: true,
                suggestions: [],
                meta: { userRating, rMin, rMax, strategy, label, excluded: excludeIds.length, targetRating },
            })
        }

        const decorate = (p) => {
            const reasons = [label]
            if (p.difficulty === 'easy')   reasons.push('Good for warmup')
            if (p.difficulty === 'medium') reasons.push('Right at your level')
            if (p.difficulty === 'hard')   reasons.push('Challenge yourself')
            return { ...p, reasons: [...new Set(reasons)], userStatus: 'unsolved' }
        }

        // "Random" must not rank by rating at all. The previous code added
        // `Math.random() * 50` on top of a rating term worth up to 100, so a
        // rating-850 problem could never beat a rating-1550 one — "Surprise
        // me" actually meant "near your level, shuffled". Here the rating
        // is removed from the decision entirely.
        if (isRandom) {
            const randomSuggestions = [...pool]
                .sort(() => Math.random() - 0.5)
                .slice(0, safeCount)
                .map(decorate)

            return res.json({
                success: true,
                count: randomSuggestions.length,
                meta:  { userRating, rMin, rMax, strategy, label, excluded: excludeIds.length, targetRating: null },
                suggestions: randomSuggestions
            })
        }

        // Codeforces publishes problems in 100-point rating steps, so each
        // rating level holds a few hundred problems. Scoring on rating
        // proximity alone therefore produced a tie across an entire
        // bucket, and the tie-break (popularity) filled the whole page
        // with problems of ONE rating — "upsolve" returned twenty 1400s.
        //
        // So rating is handled structurally rather than as a scalar: the
        // pool is grouped into rating levels, the levels are ordered by how
        // close they sit to the strategy's target, and the final list is
        // filled round-robin across those levels. Popularity orders
        // problems *within* a level, and the level closest to the target
        // simply contributes more rounds.
        const byLevel = new Map()
        for (const p of pool) {
            if (!byLevel.has(p.rating)) byLevel.set(p.rating, [])
            byLevel.get(p.rating).push(p)
        }

        // Within a level, the popular problems are the better-written,
        // more canonical ones — a weak signal, but a useful tie-break.
        for (const list of byLevel.values()) {
            list.sort((a, b) => (b.solvedCount || 0) - (a.solvedCount || 0))
        }

        const levels = [...byLevel.keys()].sort((a, b) => {
            const da = Math.abs(a - targetRating)
            const db = Math.abs(b - targetRating)
            return da === db ? a - b : da - db
        })

        // Round-robin the levels, closest to the target first. The level
        // nearest the target also plays on the odd rounds, because that is
        // the one the strategy is really aiming at.
        const ordered = []
        for (let round = 0; ordered.length < safeCount; round++) {
            let added = false
            for (const level of levels) {
                // Every level plays on even rounds; only the levels close
                // to the target play on odd rounds.
                if (round % 2 === 1 && Math.abs(level - targetRating) > 100) continue
                const list = byLevel.get(level)
                if (list.length > round) {
                    ordered.push(list[round])
                    added = true
                    if (ordered.length >= safeCount) break
                }
            }
            if (!added) break
        }

        const suggestions = ordered.slice(0, safeCount).map(decorate)

        return res.json({
            success: true,
            count: suggestions.length,
            meta:  { userRating, rMin, rMax, strategy, label, excluded: excludeIds.length, targetRating },
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

        const tagList = parseTags(tags)
        // `$all`, not `$in`: selecting "dp, greedy" means a problem must
        // carry BOTH tags. `$in` means "either", so the filter returned
        // every problem with one of them and silently dropped the other.
        if (tagList.length) query.tags = { $all: tagList }
        if (difficulty && difficulty !== 'all') query.difficulty = difficulty
        if (hideSolved === 'true') query._id = { $nin: toObjectIds(user.solvedProblems) }

        // `limit` and `page` come straight from the query string, so they
        // must be clamped before they reach Mongo. An unclamped limit let a
        // client ask for the entire problem bank in one request.
        const safeLimit = clampInt(limit, { min: 1, max: 100, fallback: 25 })
        const safePage  = clampInt(page,  { min: 1, max: 10000, fallback: 1 })

        const skip  = (safePage - 1) * safeLimit
        const total = await problemModel.countDocuments(query)
        const problems = await problemModel.find(query).sort('-solvedCount').skip(skip).limit(safeLimit).lean()

        const annotated = problems.map(p => ({
            ...p,
            userStatus: solvedSet.has(String(p._id))    ? 'solved'
                      : attemptedSet.has(String(p._id)) ? 'attempted'
                      : 'unsolved'
        }))

        return res.json({
            success: true, total,
            totalPages:  Math.ceil(total / safeLimit),
            currentPage: safePage,
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
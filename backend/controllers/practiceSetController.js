import mongoose from 'mongoose'
import userModel from '../models/userModel.js'
import problemModel from '../models/problemModel.js'
import practiceSetModel from '../models/practiceSetModel.js'
import { asString, clampInt, clampNumber, parseTags } from '../utils/validate.js'
import { sendError } from '../utils/httpError.js'

const VALID_STATUSES = ['unsolved', 'attempted', 'solved']

/**
 * Build the list of problem ids to exclude from a query.
 * See the note in problemController.js — `$nin` needs real ObjectIds.
 */
const toObjectIds = (ids = []) =>
    ids
        .map(id => (id instanceof mongoose.Types.ObjectId ? id : mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(String(id)) : null))
        .filter(Boolean)

export const getDashboardStats = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId)
        if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

        const sets = await practiceSetModel.find({ user: req.userId }).select('isCompleted')
        const thirtyAgo = new Date()
        thirtyAgo.setDate(thirtyAgo.getDate() - 30)
        const recentActivity = await practiceSetModel.aggregate([
            { $match: { user: user._id, updatedAt: { $gte: thirtyAgo } } },
            { $unwind: '$problems' },
            { $match: { 'problems.status': 'solved', 'problems.solvedAt': { $gte: thirtyAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$problems.solvedAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ])

        return res.json({
            success: true,
            stats: {
                ...user.stats.toObject(),
                totalSets:     sets.length,
                completedSets: sets.filter(s => s.isCompleted).length,
                cfRating:      user.cfRating,
                cfRank:        user.cfRank,
                recentActivity
            }
        })
    } catch (e) {
        return sendError(res, 500, 'Could not load dashboard stats.', e)
    }
}

export const createPracticeSet = async (req, res) => {
    try {
        const { title, description, filters = {}, problemIds } = req.body ?? {}
        const { minRating = 800, maxRating = 3500, tags = [], count = 10, strategy = 'smart' } = filters ?? {}

        const safeTitle = asString(title)
        if (!safeTitle) {
            return res.status(400).json({ success: false, message: 'Please give the practice set a title.' })
        }
        const safeDescription = asString(description) ?? ''

        const rMin = clampNumber(minRating, { min: 0, max: 4000, fallback: 800 })
        const rMax = clampNumber(maxRating, { min: 0, max: 4000, fallback: 3500 })
        const setCount = clampInt(count, { min: 1, max: 50, fallback: 10 })
        const tagList = parseTags(tags)

        let problems
        if (Array.isArray(problemIds) && problemIds.length) {
            // From suggestions — fetch by exact IDs to get proper Mongoose documents
            const ids = toObjectIds(problemIds)
            if (!ids.length) {
                return res.status(400).json({ success: false, message: 'No valid problems were selected.' })
            }
            problems = await problemModel.find({ _id: { $in: ids } }).lean()
        } else {
            const user = await userModel.findById(req.userId).select('solvedProblems attemptedProblems')
            if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

            // Real ObjectIds, or the exclusion silently does nothing.
            const excludeIds = toObjectIds([...user.solvedProblems, ...user.attemptedProblems])
            const q = {
                _id:    { $nin: excludeIds },
                rating: { $gte: rMin, $lte: rMax }
            }
            // `$all`, not `$in` — a multi-tag filter means the problem must
            // carry every requested tag. See the note in problemController.js.
            if (tagList.length) q.tags = { $all: tagList }
            problems = await problemModel.aggregate([{ $match: q }, { $sample: { size: setCount } }])
        }

        if (!problems.length) {
            return res.status(404).json({ success: false, message: 'No unsolved problems found. Sync your CF account first.' })
        }

        // Ensure _id values are proper ObjectIds (aggregate can return plain objects)
        const problemEntries = problems.map(p => ({
            problem: new mongoose.Types.ObjectId(p._id),
            status:  'unsolved'
        }))

        const ps = new practiceSetModel({
            title: safeTitle,
            description: safeDescription,
            user:     req.userId,
            problems: problemEntries,
            filters:  { minRating: rMin, maxRating: rMax, tags: tagList, strategy, count: setCount },
            progress: { solved: 0, attempted: 0, total: problems.length }
        })
        await ps.save()

        await userModel.findByIdAndUpdate(req.userId, { $push: { practiceSets: ps._id } })

        const populated = await practiceSetModel.findById(ps._id).populate('problems.problem')
        return res.status(201).json({ success: true, practiceSet: populated })

    } catch (e) {
        return sendError(res, 500, 'Could not create the practice set.', e)
    }
}

export const getPracticeSets = async (req, res) => {
    try {
        const page  = clampInt(req.query.page,  { min: 1, max: 10000, fallback: 1 })
        const limit = clampInt(req.query.limit, { min: 1, max: 100,   fallback: 9 })
        const { isCompleted } = req.query

        const query = { user: req.userId }
        if (isCompleted !== undefined) query.isCompleted = isCompleted === 'true'

        const skip  = (page - 1) * limit
        const total = await practiceSetModel.countDocuments(query)
        const sets  = await practiceSetModel.find(query)
            .sort('-createdAt').skip(skip).limit(limit)
            .populate('problems.problem', 'name contestId index rating tags difficulty url')

        return res.json({
            success: true, count: sets.length, total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            practiceSets: sets
        })
    } catch (e) {
        return sendError(res, 500, 'Could not load practice sets.', e)
    }
}

export const getPracticeSet = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Practice set not found.' })
        }
        const ps = await practiceSetModel.findOne({ _id: req.params.id, user: req.userId }).populate('problems.problem')
        if (!ps) return res.status(404).json({ success: false, message: 'Practice set not found.' })
        return res.json({ success: true, practiceSet: ps })
    } catch (e) {
        return sendError(res, 500, 'Could not load the practice set.', e)
    }
}

/**
 * Update the status of one problem inside a practice set.
 *
 * The status transitions are the interesting part: the counters on the user
 * document and the membership of `solvedProblems` / `attemptedProblems` must
 * stay in step with the entry's status, in both directions. The previous
 * implementation only ever incremented — resetting a problem to "unsolved"
 * left the user still credited with the solve, still listed in
 * `solvedProblems`, and still showing an inflated `stats.totalSolved`.
 */
export const updateProblemStatus = async (req, res) => {
    try {
        const { status, notes } = req.body ?? {}

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`,
            })
        }

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Practice set not found.' })
        }

        const ps = await practiceSetModel.findOne({ _id: req.params.id, user: req.userId })
        if (!ps) return res.status(404).json({ success: false, message: 'Practice set not found.' })

        const entry = ps.problems.id(req.params.problemId)
        if (!entry) return res.status(404).json({ success: false, message: 'Problem entry not found.' })

        const previousStatus = entry.status
        const problemId = entry.problem

        entry.status = status
        if (notes !== undefined) entry.notes = asString(notes) ?? ''
        if (status === 'attempted' && previousStatus !== 'attempted') entry.attempts += 1
        if (status === 'solved') entry.solvedAt = new Date()
        else entry.solvedAt = undefined

        await ps.save()

        // Apply the change to the user document only when the status actually
        // changed, so a repeated "mark solved" does not double-count.
        if (previousStatus !== status) {
            const problem  = await problemModel.findById(problemId).select('difficulty').lean()
            const diffKey  = problem?.difficulty === 'easy'   ? 'easyCount'
                           : problem?.difficulty === 'medium' ? 'mediumCount'
                           : 'hardCount'

            const inc = {}
            const addToSet = {}
            const pull = {}

            if (status === 'solved') {
                inc['stats.totalSolved'] = 1
                inc[`stats.${diffKey}`] = 1
                addToSet.solvedProblems = problemId
                pull.attemptedProblems = problemId
            } else if (previousStatus === 'solved') {
                // Reverting a solve must undo the credit it was given.
                inc['stats.totalSolved'] = -1
                inc[`stats.${diffKey}`] = -1
                pull.solvedProblems = problemId
            }

            if (status === 'attempted') {
                addToSet.attemptedProblems = problemId
                pull.solvedProblems = problemId
            } else if (previousStatus === 'attempted') {
                pull.attemptedProblems = problemId
            }

            const update = {}
            if (Object.keys(inc).length)    update.$inc = inc
            if (Object.keys(addToSet).length) update.$addToSet = addToSet
            if (Object.keys(pull).length)    update.$pull = pull

            if (Object.keys(update).length) {
                await userModel.findByIdAndUpdate(req.userId, update)
            }
        }

        // Re-fetch with populated problems so the frontend gets full problem data
        const populated = await practiceSetModel.findById(ps._id).populate('problems.problem')
        return res.json({ success: true, practiceSet: populated })

    } catch (e) {
        return sendError(res, 500, 'Could not update the problem status.', e)
    }
}

export const deletePracticeSet = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ success: false, message: 'Practice set not found.' })
        }
        const ps = await practiceSetModel.findOneAndDelete({ _id: req.params.id, user: req.userId })
        if (!ps) return res.status(404).json({ success: false, message: 'Practice set not found.' })
        await userModel.findByIdAndUpdate(req.userId, { $pull: { practiceSets: req.params.id } })
        return res.json({ success: true, message: 'Deleted.' })
    } catch (e) {
        return sendError(res, 500, 'Could not delete the practice set.', e)
    }
}

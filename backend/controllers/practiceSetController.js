import mongoose from "mongoose"
import userModel from "../models/userModel.js"
import problemModel from "../models/problemModel.js"
import practiceSetModel from "../models/practiceSetModel.js"

export const getDashboardStats = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId)
        const sets = await practiceSetModel.find({ user: req.userId })
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
    } catch (e) { return res.json({ success: false, message: e.message }) }
}

export const createPracticeSet = async (req, res) => {
    try {
        const { title, description, filters = {}, problemIds } = req.body
        const { minRating = 800, maxRating = 3500, tags = [], count = 10, strategy = 'smart' } = filters

        let problems
        if (problemIds?.length) {
            // From suggestions — fetch by exact IDs to get proper Mongoose documents
            problems = await problemModel.find({ _id: { $in: problemIds } }).lean()
        } else {
            const user = await userModel.findById(req.userId).select('solvedProblems attemptedProblems')
            const excludeIds = [...user.solvedProblems.map(String), ...user.attemptedProblems.map(String)]
            const q = {
                _id:    { $nin: excludeIds },
                rating: { $gte: Number(minRating), $lte: Number(maxRating) }
            }
            if (tags.length) q.tags = { $in: tags }
            problems = await problemModel.aggregate([{ $match: q }, { $sample: { size: Math.min(Number(count), 50) } }])
        }

        if (!problems.length) {
            return res.json({ success: false, message: 'No unsolved problems found. Sync your CF account first.' })
        }

        // Ensure _id values are proper ObjectIds (aggregate can return plain objects)
        const problemEntries = problems.map(p => ({
            problem: new mongoose.Types.ObjectId(p._id),
            status:  'unsolved'
        }))

        const ps = new practiceSetModel({
            title,
            description,
            user:     req.userId,
            problems: problemEntries,
            filters:  { minRating, maxRating, tags, strategy, count },
            progress: { solved: 0, attempted: 0, total: problems.length }
        })
        await ps.save()

        await userModel.findByIdAndUpdate(req.userId, { $push: { practiceSets: ps._id } })

        const populated = await practiceSetModel.findById(ps._id).populate('problems.problem')
        return res.json({ success: true, practiceSet: populated })

    } catch (e) { return res.json({ success: false, message: e.message }) }
}

export const getPracticeSets = async (req, res) => {
    try {
        const { page = 1, limit = 9, isCompleted } = req.query
        const query = { user: req.userId }
        if (isCompleted !== undefined) query.isCompleted = isCompleted === 'true'
        const skip  = (Number(page) - 1) * Number(limit)
        const total = await practiceSetModel.countDocuments(query)
        const sets  = await practiceSetModel.find(query)
            .sort('-createdAt').skip(skip).limit(Number(limit))
            .populate('problems.problem', 'name contestId index rating tags difficulty url')
        return res.json({ success: true, count: sets.length, total, totalPages: Math.ceil(total / Number(limit)), practiceSets: sets })
    } catch (e) { return res.json({ success: false, message: e.message }) }
}

export const getPracticeSet = async (req, res) => {
    try {
        const ps = await practiceSetModel.findOne({ _id: req.params.id, user: req.userId }).populate('problems.problem')
        if (!ps) return res.json({ success: false, message: 'Practice set not found.' })
        return res.json({ success: true, practiceSet: ps })
    } catch (e) { return res.json({ success: false, message: e.message }) }
}

export const updateProblemStatus = async (req, res) => {
    try {
        const { status, notes } = req.body
        const ps = await practiceSetModel.findOne({ _id: req.params.id, user: req.userId })
        if (!ps) return res.json({ success: false, message: 'Practice set not found.' })

        const entry = ps.problems.id(req.params.problemId)
        if (!entry) return res.json({ success: false, message: 'Problem entry not found.' })

        const wasSolved = entry.status === 'solved'
        entry.status = status
        if (notes !== undefined) entry.notes = notes
        if (status === 'attempted') entry.attempts += 1
        if (status === 'solved' && !wasSolved) {
            entry.solvedAt = new Date()
            const problem  = await problemModel.findById(entry.problem)
            const diffKey  = problem?.difficulty === 'easy'   ? 'easyCount'
                           : problem?.difficulty === 'medium' ? 'mediumCount'
                           : 'hardCount'
            await userModel.findByIdAndUpdate(req.userId, {
                $inc:      { 'stats.totalSolved': 1, [`stats.${diffKey}`]: 1 },
                $addToSet: { solvedProblems: entry.problem }
            })
        }
        await ps.save()
        // Re-fetch with populated problems so frontend gets full problem data
        const populated = await practiceSetModel.findById(ps._id).populate('problems.problem')
        return res.json({ success: true, practiceSet: populated })
    } catch (e) { return res.json({ success: false, message: e.message }) }
}

export const deletePracticeSet = async (req, res) => {
    try {
        const ps = await practiceSetModel.findOneAndDelete({ _id: req.params.id, user: req.userId })
        if (!ps) return res.json({ success: false, message: 'Practice set not found.' })
        await userModel.findByIdAndUpdate(req.userId, { $pull: { practiceSets: req.params.id } })
        return res.json({ success: true, message: 'Deleted.' })
    } catch (e) { return res.json({ success: false, message: e.message }) }
}
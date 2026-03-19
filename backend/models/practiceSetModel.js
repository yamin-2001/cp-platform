import mongoose from "mongoose"

const entrySchema = new mongoose.Schema({
    problem:  { type: mongoose.Schema.Types.ObjectId, ref: 'problem', required: true },
    status:   { type: String, enum: ['unsolved', 'attempted', 'solved'], default: 'unsolved' },
    solvedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    notes:    { type: String, default: '' },
})

const practiceSetSchema = new mongoose.Schema({
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    problems:    [entrySchema],
    filters: {
        minRating: { type: Number, default: 800 },
        maxRating: { type: Number, default: 3500 },
        tags:      [{ type: String }],
        strategy:  { type: String, default: 'smart' },
        count:     { type: Number, default: 10 },
    },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    progress: {
        solved:    { type: Number, default: 0 },
        attempted: { type: Number, default: 0 },
        total:     { type: Number, default: 0 },
    },
}, { timestamps: true })

// Mongoose v9 — use async, no next() callback needed
practiceSetSchema.pre('save', async function () {
    const solved    = this.problems.filter(p => p.status === 'solved').length
    const attempted = this.problems.filter(p => p.status === 'attempted').length
    this.progress   = { solved, attempted, total: this.problems.length }
    if (solved === this.problems.length && this.problems.length > 0) {
        this.isCompleted = true
        if (!this.completedAt) this.completedAt = new Date()
    }
})

const practiceSetModel = mongoose.models.practiceset || mongoose.model('practiceset', practiceSetSchema)
export default practiceSetModel
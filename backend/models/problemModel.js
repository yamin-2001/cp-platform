import mongoose from "mongoose"

const problemSchema = new mongoose.Schema({
    contestId:   { type: Number, required: true },
    index:       { type: String, required: true },
    name:        { type: String, required: true },
    type:        { type: String, default: 'PROGRAMMING' },
    rating:      { type: Number, default: 0 },
    tags:        [{ type: String }],
    solvedCount: { type: Number, default: 0 },
    url:         { type: String },
    difficulty:  { type: String, enum: ['easy', 'medium', 'hard', 'unrated'], default: 'unrated' },
}, { timestamps: true })

problemSchema.index({ contestId: 1, index: 1 }, { unique: true })
problemSchema.index({ rating: 1 })
problemSchema.index({ tags: 1 })

const problemModel = mongoose.models.problem || mongoose.model('problem', problemSchema);
export default problemModel;

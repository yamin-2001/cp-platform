import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name:              { type: String,  required: true, trim: true, maxlength: 100 },
    email:             { type: String,  required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    password:          { type: String,  required: true },
    codeforcesHandle:  { type: String,  default: '' },
    cfRating:          { type: Number,  default: 0 },
    cfMaxRating:       { type: Number,  default: 0 },
    cfRank:            { type: String,  default: '' },
    cfAvatar:          { type: String,  default: '' },
    // The user's own estimate of their level, used when they have not
    // linked a Codeforces account (so no real rating is available).
    estimatedRating:   { type: Number,  default: 0, min: 0, max: 4000 },
    solvedProblems:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'problem' }],
    attemptedProblems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'problem' }],
    stats: {
        totalSolved:    { type: Number, default: 0 },
        totalAttempted: { type: Number, default: 0 },
        easyCount:      { type: Number, default: 0 },
        mediumCount:    { type: Number, default: 0 },
        hardCount:      { type: Number, default: 0 },
        lastSynced:     { type: Date,   default: null },
    },
    practiceSets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'practiceset' }],
})

const userModel = mongoose.models.user || mongoose.model('user', userSchema);
export default userModel;

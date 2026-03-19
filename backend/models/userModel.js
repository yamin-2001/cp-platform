import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    name:              { type: String,  required: true },
    email:             { type: String,  required: true, unique: true },
    password:          { type: String,  required: true },
    codeforcesHandle:  { type: String,  default: '' },
    cfRating:          { type: Number,  default: 0 },
    cfMaxRating:       { type: Number,  default: 0 },
    cfRank:            { type: String,  default: '' },
    cfAvatar:          { type: String,  default: '' },
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
    isAccountVerified: { type: Boolean, default: false },
    verifyOtp:           { type: String,  default: '' },
    verifyOtpExpireAt:   { type: Number,  default: 0 },
    resetOtp:            { type: String,  default: '' },
    resetOtpExpireAt:    { type: Number,  default: 0 },
})

const userModel = mongoose.models.user || mongoose.model('user', userSchema);
export default userModel;

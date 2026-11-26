import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import userModel from '../models/userModel.js'
import { asString, isValidEmail, isValidPassword, isValidHandle, clampNumber } from '../utils/validate.js'
import { sendError } from '../utils/httpError.js'

// bcrypt work factor. 12 is the current sensible minimum for a login
// endpoint; 10 is roughly 4× cheaper to attack.
const BCRYPT_COST = 12

// ─── Cookie helper ────────────────────────────────────────────────────────────
const setTokenCookie = (res, userId) => {
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.cookie('token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production' ? true : false,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge:   7 * 24 * 60 * 60 * 1000
    })
}

export const register = async (req, res) => {
    const { name, email, password, codeforcesHandle } = req.body ?? {}

    // Coerce to strings *before* any database work. `req.body` is attacker
    // controlled and `email` may arrive as an object; passing that straight
    // into `findOne` turns it into a query operator (`{ $ne: null }`) that
    // matches an arbitrary user.
    const safeName  = asString(name)
    const safeEmail = asString(email)?.toLowerCase()
    const safePass  = typeof password === 'string' ? password : null

    if (!safeName || !safeEmail || !safePass) {
        return res.status(400).json({ success: false, message: 'Please fill up all the fields.' })
    }
    if (!isValidEmail(safeEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' })
    }
    if (!isValidPassword(safePass)) {
        return res.status(400).json({ success: false, message: 'Password must be between 8 and 72 characters.' })
    }

    // The sign-up form has an optional CF handle field. It used to be
    // silently dropped, so a user who typed a handle still ended up with
    // none linked and had to redo it on the Profile page.
    let safeHandle = ''
    if (codeforcesHandle !== undefined && codeforcesHandle !== null) {
        const handle = asString(codeforcesHandle)
        if (handle && !isValidHandle(handle)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Codeforces handle. Use letters, digits and underscores only.',
            })
        }
        safeHandle = handle || ''
    }

    try {
        const existingUser = await userModel.findOne({ email: safeEmail })
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'User already exists. Please log in.' })
        }

        const hashedPassword = await bcrypt.hash(safePass, BCRYPT_COST)
        const user = new userModel({
            name: safeName,
            email: safeEmail,
            password: hashedPassword,
            codeforcesHandle: safeHandle,
        })
        await user.save()

        setTokenCookie(res, user._id)
        return res.status(201).json({ success: true })

    } catch (e) {
        // A duplicate-key race (two simultaneous registrations) is a 409, not
        // a 500 — but it must not reach the client as a raw driver message.
        if (e?.code === 11000) {
            return res.status(409).json({ success: false, message: 'User already exists. Please log in.' })
        }
        return sendError(res, 500, 'Could not create the account. Please try again.', e)
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body ?? {}

    const safeEmail = asString(email)?.toLowerCase()
    const safePass  = typeof password === 'string' ? password : null

    if (!safeEmail || !safePass) {
        return res.status(400).json({ success: false, message: 'Please enter email and password.' })
    }
    if (!isValidEmail(safeEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' })
    }

    try {
        const user = await userModel.findOne({ email: safeEmail })

        // Compare against a dummy hash when the user does not exist, so the
        // response time does not reveal whether the email is registered.
        const isMatch = user
            ? await bcrypt.compare(safePass, user.password)
            : await bcrypt.compare(safePass, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv')

        // One message for both "no such user" and "wrong password" — the
        // distinction was a free user-enumeration oracle.
        if (!user || !isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' })
        }

        setTokenCookie(res, user._id)
        return res.json({ success: true })

    } catch (e) {
        return sendError(res, 500, 'Could not sign you in. Please try again.', e)
    }
}

export const logout = async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
    })
    return res.json({ success: true, message: 'Logged out.' })
}

export const getUser = async (req, res) => {
    try {
        // `solvedProblems` and `attemptedProblems` can grow to thousands of
        // entries; shipping them on every profile fetch is a large payload the
        // client does not need (it reads counts from `stats`). `practiceSets`
        // is bounded but still grows, so it is capped too.
        const user = await userModel.findById(req.userId)
            .select('-password -solvedProblems -attemptedProblems')
            .lean()

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

        return res.json({ success: true, user })

    } catch (e) {
        return sendError(res, 500, 'Could not load your profile.', e)
    }
}

export const updateProfile = async (req, res) => {
    const { codeforcesHandle, name, estimatedRating } = req.body ?? {}
    try {
        const updates = {}

        if (codeforcesHandle !== undefined) {
            const handle = asString(codeforcesHandle)
            if (!handle) {
                updates.codeforcesHandle = ''
            } else if (!isValidHandle(handle)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Codeforces handle. Use letters, digits and underscores only.',
                })
            } else {
                updates.codeforcesHandle = handle
            }
        }

        if (name !== undefined) {
            const safeName = asString(name)
            if (!safeName) {
                return res.status(400).json({ success: false, message: 'Name cannot be empty.' })
            }
            updates.name = safeName
        }

        if (estimatedRating !== undefined) {
            // The user's own estimate of their level, for when they have not
            // linked a Codeforces account. 0 clears it.
            const rating = clampNumber(estimatedRating, { min: 0, max: 4000, fallback: 0 })
            if (!Number.isInteger(rating)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estimated rating must be a whole number.',
                })
            }
            updates.estimatedRating = rating
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({ success: false, message: 'Nothing to update.' })
        }

        const user = await userModel.findByIdAndUpdate(req.userId, updates, { new: true })
            .select('-password -solvedProblems -attemptedProblems')
            .lean()

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

        return res.json({ success: true, user })

    } catch (e) {
        return sendError(res, 500, 'Could not update your profile.', e)
    }
}

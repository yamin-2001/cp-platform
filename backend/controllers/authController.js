import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import userModel from "../models/userModel.js"

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
    const { name, email, password } = req.body

    if (!name || !email || !password) {
        return res.json({ success: false, message: "Please fill up all the fields." })
    }

    try {
        const existingUser = await userModel.findOne({ email })
        if (existingUser) {
            return res.json({ success: false, message: "User already exists. Please log in." })
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const user = new userModel({ name, email, password: hashedPassword })
        await user.save()

        setTokenCookie(res, user._id)
        return res.json({ success: true })

    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.json({ success: false, message: "Please enter email and password." })
    }

    try {
        const user = await userModel.findOne({ email })
        if (!user) {
            return res.json({ success: false, message: "No account found with the provided email." })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.json({ success: false, message: "Wrong password." })
        }

        setTokenCookie(res, user._id)
        return res.json({ success: true })

    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        })
        return res.json({ success: true, message: "Logged out." })

    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

export const getUser = async (req, res) => {
    try {
        const user = await userModel.findById(req.userId).select('-password')
        return res.json({ success: true, user })
    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

export const updateProfile = async (req, res) => {
    const { codeforcesHandle, name } = req.body
    try {
        const updates = {}
        if (codeforcesHandle !== undefined) updates.codeforcesHandle = codeforcesHandle
        if (name)                           updates.name = name

        const user = await userModel.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password')
        return res.json({ success: true, user })
    } catch (e) {
        return res.json({ success: false, message: e.message })
    }
}

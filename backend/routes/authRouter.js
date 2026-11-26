import express from 'express'
import { register, login, logout, getUser, updateProfile } from '../controllers/authController.js'
import userAuth from '../middleware/userAuth.js'
import { rateLimit } from '../middleware/rateLimit.js'

const authRouter = express.Router()

// Login and register are unauthenticated and run a bcrypt comparison, so
// they are the endpoints that get throttled.
const loginLimiter = rateLimit({
    limit: 10, windowMs: 15 * 60 * 1000, key: 'login',
    message: 'Too many sign-in attempts. Please try again in a few minutes.',
})
const registerLimiter = rateLimit({
    limit: 5, windowMs: 60 * 60 * 1000, key: 'register',
    message: 'Too many accounts created from this address. Please try again later.',
})

authRouter.post('/register',       registerLimiter, register)
authRouter.post('/login',          loginLimiter,    login)
authRouter.post('/logout',         logout)
authRouter.get('/me',              userAuth, getUser)
authRouter.put('/update-profile',  userAuth, updateProfile)

export default authRouter

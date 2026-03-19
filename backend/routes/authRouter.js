import express from 'express'
import { register, login, logout, getUser, updateProfile } from '../controllers/authController.js'
import userAuth from '../middleware/userAuth.js'

const authRouter = express.Router()

authRouter.post('/register',       register)
authRouter.post('/login',          login)
authRouter.post('/logout',         logout)
authRouter.get('/me',              userAuth, getUser)
authRouter.put('/update-profile',  userAuth, updateProfile)

export default authRouter

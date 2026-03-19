import express from 'express'
import { syncProblemBank, getSuggestions, searchProblems, getTags } from '../controllers/problemController.js'
import userAuth from '../middleware/userAuth.js'

const problemRouter = express.Router()

problemRouter.get('/sync-bank',    userAuth, syncProblemBank)
problemRouter.get('/suggestions',  userAuth, getSuggestions)
problemRouter.get('/search',       userAuth, searchProblems)
problemRouter.get('/tags',         userAuth, getTags)

export default problemRouter

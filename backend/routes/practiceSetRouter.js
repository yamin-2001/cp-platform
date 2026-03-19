import express from 'express'
import { getDashboardStats, createPracticeSet, getPracticeSets, getPracticeSet, updateProblemStatus, deletePracticeSet } from '../controllers/practiceSetController.js'
import userAuth from '../middleware/userAuth.js'

const practiceSetRouter = express.Router()

practiceSetRouter.get('/stats',                    userAuth, getDashboardStats)
practiceSetRouter.post('/',                        userAuth, createPracticeSet)
practiceSetRouter.get('/',                         userAuth, getPracticeSets)
practiceSetRouter.get('/:id',                      userAuth, getPracticeSet)
practiceSetRouter.delete('/:id',                   userAuth, deletePracticeSet)
practiceSetRouter.put('/:id/problems/:problemId',  userAuth, updateProblemStatus)

export default practiceSetRouter

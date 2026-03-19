import express from 'express'
import { validateHandle, syncWithCF, getSyncStatus } from '../controllers/cfController.js'
import userAuth from '../middleware/userAuth.js'

const cfRouter = express.Router()

cfRouter.get('/validate/:handle',  userAuth, validateHandle)
cfRouter.post('/sync',             userAuth, syncWithCF)
cfRouter.get('/status',            userAuth, getSyncStatus)

export default cfRouter

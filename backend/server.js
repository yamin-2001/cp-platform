import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import cookieParser from 'cookie-parser'
import connectDB from './config/mongodb.js'
import authRouter        from './routes/authRouter.js'
import cfRouter          from './routes/cfRouter.js'
import problemRouter     from './routes/problemRouter.js'
import practiceSetRouter from './routes/practiceSetRouter.js'

const app = express()
const port = process.env.PORT || 4000

connectDB()

app.use(express.json())
app.use(cookieParser())
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }))

app.get('/', (req, res) => res.send('API Working fine'))

app.use('/api/auth',         authRouter)
app.use('/api/cf',           cfRouter)
app.use('/api/problems',     problemRouter)
app.use('/api/practicesets', practiceSetRouter)

app.listen(port, () => console.log(`Server started on PORT: ${port}`))

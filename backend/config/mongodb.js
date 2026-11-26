import mongoose from "mongoose"

/**
 * Connect to MongoDB.
 *
 * The database name is passed as a separate option rather than being
 * string-concatenated onto the URI. Concatenation breaks whenever the URI
 * already carries a database path (`mongodb://host/mydb` became
 * `mongodb://host/mydb/cp-platform`, which is a path, not a host).
 */
const connectDB = async () => {
    mongoose.connection.on('connected', () => console.log('Database connected'))
    mongoose.connection.on('error', (e) => console.error('Database error:', e.message))

    const uri = process.env.MONGODB_URI
    const dbName = process.env.MONGODB_DB_NAME || 'cp-platform'

    await mongoose.connect(uri, {
        dbName,
        // Fail fast instead of buffering commands for 30s when Mongo is down.
        serverSelectionTimeoutMS: 10000,
    })
}

export default connectDB

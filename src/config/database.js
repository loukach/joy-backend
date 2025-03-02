const mongoose = require('mongoose');
const { logger } = require('./logger');

// Get MongoDB URI from environment variable or use default
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/joy-from-giving';

// Function to connect to MongoDB
async function connectDatabase() {
    try {
        await mongoose.connect(MONGO_URI, {});
        logger.info('🔌 Connected to MongoDB');
        return mongoose.connection;
    } catch (error) {
        logger.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

// Export the connection function
module.exports = { connectDatabase };
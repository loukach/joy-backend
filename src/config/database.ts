import mongoose from 'mongoose';
import { logger } from './logger';

// We'll export this function to connect to MongoDB when our application starts
export async function connectDatabase(): Promise<void> {
    // Get the MongoDB URI and database name from environment variables
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/joy-db';
    const dbName = process.env.DB_NAME || 'joy-db-dev';
    
    try {
        // Configure Mongoose to use modern features and handle deprecation warnings
        mongoose.set('strictQuery', true);
        
        // Attempt to connect to MongoDB with explicit database name
        await mongoose.connect(mongoUri, {
            dbName: dbName // Force use of this database name regardless of URI
        });
        
        logger.info('Successfully connected to MongoDB');
        logger.info(`Database name: ${mongoose.connection.db.databaseName}`);
        
        // Set up error handling for after initial connection
        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

    } catch (error) {
        logger.error('Failed to connect to MongoDB:', error);
        // If we can't connect to the database, we should exit the application
        process.exit(1);
    }
}
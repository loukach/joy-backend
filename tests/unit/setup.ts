// tests/setup.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { TaskModel } from '../../src/models/task';
import dotenv from 'dotenv';

// Load environment variables at the start
dotenv.config();

// Validate required environment variables
if (!process.env.CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY must be defined in environment');
}

declare global {
    var __MONGOD__: MongoMemoryServer;
}

export async function setupTestDatabase() {
    try {
        // Close existing connections first
        await mongoose.disconnect();
        
        // Create MongoDB Memory Server
        const mongod = await MongoMemoryServer.create();
        global.__MONGOD__ = mongod;

        // Get the connection string
        const uri = mongod.getUri();

        // Connect to the in-memory database
        await mongoose.connect(uri);

        // Create indexes
        await TaskModel.createIndexes();

    } catch (error) {
        console.error('Setup database error:', error);
        throw error;
    }
}

export async function teardownTestDatabase() {
    try {
        // Disconnect from database
        await mongoose.disconnect();
        
        // Stop MongoDB Memory Server
        if (global.__MONGOD__) {
            await global.__MONGOD__.stop();
        }
    } catch (error) {
        console.error('Teardown database error:', error);
        throw error;
    }
}
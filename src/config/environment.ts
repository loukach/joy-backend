import { logger } from './logger';

// Define the required environment variables
const requiredEnvVars = [
    'MONGODB_URI',
    'CLAUDE_API_KEY',
    'PORT'
] as const;

// Optional environment variables
const optionalEnvVars = [
    'LANGSMITH_API_KEY',
    'LANGSMITH_PROJECT',
    'LANGCHAIN_TRACING_V2'
] as const;

// Create a type for our environment configuration
export interface EnvironmentConfig {
    mongodbUri: string;
    claudeApiKey: string;
    port: number;
    nodeEnv: string;
    langsmithApiKey?: string;
    langsmithProject?: string;
    langchainTracingV2?: string;
}

// Function to validate and load environment variables
export function loadEnvironmentConfig(): EnvironmentConfig {
    // Check for missing required variables
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        const error = `Missing required environment variables: ${missingVars.join(', ')}`;
        logger.error(error);
        throw new Error(error);
    }

    // Return typed configuration object
    return {
        mongodbUri: process.env.MONGODB_URI!,
        claudeApiKey: process.env.CLAUDE_API_KEY!,
        port: parseInt(process.env.PORT!, 10),
        nodeEnv: process.env.NODE_ENV || 'development',
        langsmithApiKey: process.env.LANGSMITH_API_KEY,
        langsmithProject: process.env.LANGSMITH_PROJECT || 'joy-volunteer-matching',
        langchainTracingV2: process.env.LANGCHAIN_TRACING_V2 || 'true'
    };
}

// Load and validate environment variables immediately
export const config = loadEnvironmentConfig();
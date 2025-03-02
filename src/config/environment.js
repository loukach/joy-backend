// Configuration and environment variable handling
const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/joy-from-giving',
    claudeApiKey: process.env.CLAUDE_API_KEY,
    langsmithProject: process.env.LANGCHAIN_PROJECT || 'joy-volunteer-matching',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
    isTest: process.env.NODE_ENV === 'test',
};

module.exports = { config };
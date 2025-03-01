import winston from 'winston';

// Create a custom format that combines timestamp, colorization, and proper error handling
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        // If we have a stack trace, include it in the log
        if (stack) {
            return `${timestamp} ${level}: ${message}\n${stack}`;
        }
        return `${timestamp} ${level}: ${message}`;
    })
);

// Create and configure our logger
export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        // Write logs to console
        new winston.transports.Console(),
        // Also write logs to a file
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            format: winston.format.uncolorize() // Remove colors for file output
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            format: winston.format.uncolorize() 
        })
    ]
});

// Add special handling for development environment
if (process.env.NODE_ENV !== 'production') {
    logger.debug('Running in development mode');
}
const winston = require('winston');
const { config } = require('./environment');

// Configure the Winston logger
const logger = winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'joy-backend' },
    transports: [
        // Write to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp, ...metadata }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    
                    // Add metadata if it exists and isn't empty
                    if (metadata && Object.keys(metadata).length > 0 && metadata.service) {
                        msg += ` ${JSON.stringify(metadata)}`;
                    }
                    
                    return msg;
                })
            )
        }),
        
        // Write to log file in non-test environment
        ...(config.isTest 
            ? [] 
            : [new winston.transports.File({ 
                filename: 'logs/error.log', 
                level: 'error' 
            }), 
            new winston.transports.File({ 
                filename: 'logs/combined.log' 
            })])
    ],
});

// Export the configured logger
module.exports = { logger };
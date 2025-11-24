import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;

    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }

    if (stack) {
      log += `\n${stack}`;
    }

    return log;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console output (colorized)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    // File output (errors only)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    // File output (all logs)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log')
    }),
  ],
});

export default logger;

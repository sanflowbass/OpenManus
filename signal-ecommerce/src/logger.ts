import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const consoleTransport = new winston.transports.Console({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp as string} ${level}: ${message}${metaString}`;
    })
  )
});

const fileRotateTransport = new DailyRotateFile({
  dirname: 'logs',
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [consoleTransport, fileRotateTransport]
});
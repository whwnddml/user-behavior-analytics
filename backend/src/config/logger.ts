import winston from 'winston';
import { config, isProduction } from './environment';

const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

// Production에서는 JSON 형식으로, 개발환경에서는 읽기 쉬운 형식으로 로그를 출력
const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

const developmentFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
);

// 환경에 따라 transports 설정
const transports: winston.transport[] = [new winston.transports.Console()];

// 개발환경에서만 파일 로깅 추가
if (!isProduction) {
    transports.push(
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log' 
        })
    );
}

export const logger = winston.createLogger({
    level: logLevel,
    format: isProduction ? productionFormat : developmentFormat,
    transports
}); 
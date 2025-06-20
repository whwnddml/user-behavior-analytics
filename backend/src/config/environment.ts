import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// 환경 설정
export const isProduction = process.env['NODE_ENV'] === 'production';
export const isDevelopment = !isProduction;

// 서버 설정
export const PORT = process.env['PORT'] || 3000;
export const HOST = process.env['HOST'] || 'localhost';

// CORS 설정
export const ALLOWED_ORIGINS = isProduction
    ? ['https://whwnddml.github.io']
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500'];

// 데이터베이스 설정
export const DATABASE_URL = process.env['DATABASE_URL'];

// 로깅 설정
export const LOG_LEVEL = process.env['LOG_LEVEL'] || 'info'; 
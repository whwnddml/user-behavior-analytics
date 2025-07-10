import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    database: {
        url: process.env.DATABASE_URL,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'analytics',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
    },
    cors: {
        allowedOrigins: isProduction
            ? ['https://whwnddml.github.io', 'https://*.github.io', 'https://*.brandiup.com']
            : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://localhost:8080', 'null']
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    },
    isProduction
}; 
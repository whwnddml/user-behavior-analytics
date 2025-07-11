import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

export const isProduction = process.env.NODE_ENV === 'production';
export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/analytics';

// CORS 허용 도메인 처리
const parseCorsOrigins = (originsStr?: string): string[] => {
    if (!originsStr) {
        return isProduction 
            ? ['https://whwnddml.github.io', 'https://*.brandiup.com'] 
            : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://localhost:8080', 'null'];
    }
    return originsStr.split(',').map(origin => origin.trim());
};

export const config = {
    port: process.env.PORT || 10000,  // Render uses port 10000
    host: process.env.HOST || 'localhost',
    database: {
        url: DATABASE_URL,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'analytics',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres'
    },
    cors: {
        allowedOrigins: parseCorsOrigins(process.env.CORS_ORIGIN)
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
}; 
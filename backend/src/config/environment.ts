import dotenv from 'dotenv';
import path from 'path';

// 환경 설정 로드
const loadEnv = () => {
  const NODE_ENV = process.env['NODE_ENV'] || 'development';
  const envPath = path.resolve(process.cwd(), `.env.${NODE_ENV}`);
  
  dotenv.config({ path: envPath });
  
  console.log(`🔧 ${NODE_ENV} 환경으로 설정이 로드되었습니다.`);
};

loadEnv();

// 환경 설정
export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

// 서버 설정
export const PORT = process.env.PORT || 3000;
export const HOST = process.env.HOST || '0.0.0.0';

// 데이터베이스 설정
export const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/analytics';

// 보안 설정
export const RATE_LIMIT = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15분
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 최대 요청 수
};

// CORS 설정
export const CORS_ORIGINS = isProduction
    ? ['https://whwnddml.github.io']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

export const config = {
  // 데이터베이스 설정
  database: {
    url: DATABASE_URL,
    host: process.env['DB_HOST'],
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    name: process.env['DB_NAME'],
    user: process.env['DB_USER'],
    password: process.env['DB_PASSWORD'],
    ssl: process.env['NODE_ENV'] === 'production',
  },
  
  // JWT 설정
  jwt: {
    secret: process.env['JWT_SECRET'] || 'development_secret',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '24h',
  },
  
  // 로그 설정
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    file: process.env['LOG_FILE'] || 'logs/app.log',
  },
  
  // 분석 설정
  analytics: {
    batchSize: parseInt(process.env['ANALYTICS_BATCH_SIZE'] || '100', 10),
    flushInterval: parseInt(process.env['ANALYTICS_FLUSH_INTERVAL'] || '10000', 10),
  },
}; 
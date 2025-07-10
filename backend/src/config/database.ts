import { Pool } from 'pg';
import { DATABASE_URL, isProduction } from './environment';
import { logger } from './logger';

// 데이터베이스 연결 풀 설정
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // 연결 풀 설정
  max: 20, // 최대 클라이언트 수
  min: 2,  // 최소 유지 연결 수
  idleTimeoutMillis: 30000, // 유휴 연결 타임아웃 (30초)
  connectionTimeoutMillis: 5000, // 연결 타임아웃 (5초)
  allowExitOnIdle: false // 유휴 상태에서 연결 유지
});

// 연결 이벤트 핸들러 등록
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  logger.info('New client connected to database');
});

pool.on('remove', () => {
  logger.info('Client removed from pool');
});

// 데이터베이스 연결 테스트
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection test successful', {
      timestamp: result.rows[0].now
    });
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
};

// 연결 풀 종료 함수
export const closePool = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}; 
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
  idleTimeoutMillis: 300000, // 유휴 연결 타임아웃 (5분)
  connectionTimeoutMillis: 60000, // 연결 타임아웃 증가 (1분)
  allowExitOnIdle: false, // 유휴 상태에서 연결 유지
  statement_timeout: 60000, // 쿼리 타임아웃 증가 (1분)
  query_timeout: 60000 // 쿼리 타임아웃 증가 (1분)
});

// 연결 이벤트 핸들러 등록
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', {
    error: err instanceof Error ? err.message : 'Unknown error',
    stack: err instanceof Error ? err.stack : undefined,
    clientPresent: !!client
  });
  
  // 오류 발생 시 자동으로 재연결 시도...
  setTimeout(() => {
    logger.info('Attempting to reconnect after error...');
    testConnection(3);
  }, 5000);
});

pool.on('connect', () => {
  logger.info('New client connected to database', {
    url: DATABASE_URL.replace(/:[^:]*@/, ':****@'), // 비밀번호 마스킹
    timestamp: new Date().toISOString()
  });
});

pool.on('remove', () => {
  logger.info('Client removed from pool');
});

// 데이터베이스 연결 테스트 (재시도 로직 포함)
export const testConnection = async (retries = 15): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW(), current_database() as db, version() as version');
      client.release();
      logger.info('Database connection test successful', {
        timestamp: result.rows[0].now,
        database: result.rows[0].db,
        version: result.rows[0].version,
        attempt: i + 1
      });
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        attempt: i + 1,
        remainingRetries: retries - i - 1,
        connectionString: DATABASE_URL.replace(/:[^:]*@/, ':****@') // 비밀번호 마스킹
      });
      
      if (i < retries - 1) {
        const delay = Math.min(1000 * Math.pow(2, i), 60000); // 지수 백오프, 최대 1분
        logger.info(`Retrying connection in ${delay/1000} seconds... (Attempt ${i + 2}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return false;
};

// 연결 풀 종료 함수
export const closePool = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

// 스크립트로 직접 실행될 때
if (require.main === module) {
  testConnection(5)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
} 
import { Pool } from 'pg';
import { DATABASE_URL, isProduction } from './environment';
import { logger } from './logger';

// 데이터베이스 연결 풀 설정
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false, // Render는 SSL 필수
  // 연결 풀 설정
  max: isProduction ? 5 : 20, // 프로덕션에서는 5개로 제한, 개발환경에서는 20개
  min: 0,  // 필요할 때만 연결 생성
  idleTimeoutMillis: 60000, // 유휴 연결 타임아웃 (1분으로 감소)
  connectionTimeoutMillis: 10000, // 연결 타임아웃 (10초로 감소)
  allowExitOnIdle: true, // 유휴 상태에서 연결 해제 허용
  statement_timeout: 30000, // 쿼리 타임아웃 (30초)
  query_timeout: 30000 // 쿼리 타임아웃 (30초)
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
  }, 1000); // 1초 후 재시도
});

pool.on('connect', async (client) => {
  try {
    await client.query('SET timezone = "Asia/Seoul"');
  } catch (error) {
    logger.error('Failed to set timezone:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  logger.info('New client connected to database', {
    url: DATABASE_URL.replace(/:[^:]*@/, ':****@'), // 비밀번호 마스킹
    timestamp: new Date().toISOString()
  });
});

pool.on('remove', () => {
  logger.info('Client removed from pool');
});

// 데이터베이스 연결 테스트 (재시도 로직 포함)
export const testConnection = async (retries = 3): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      logger.info('Database connection test successful', {
        timestamp: result.rows[0].now,
        attempt: i + 1
      });
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        attempt: i + 1,
        remainingRetries: retries - i - 1,
        connectionString: DATABASE_URL.replace(/:[^:]*@/, ':****@')
      });
      
      if (i < retries - 1) {
        const delay = 1000; // 항상 1초 후 재시도
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
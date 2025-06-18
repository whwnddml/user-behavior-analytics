import { Pool, PoolConfig } from 'pg';
import { config } from './environment';

const dbConfig: PoolConfig = config.database.url
  ? {
      // Render의 DATABASE_URL 사용
      connectionString: config.database.url,
      ssl: config.isProduction ? { rejectUnauthorized: false } : false,
      max: 10, // Render 무료 플랜 제한 고려
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      // 로컬 개발 환경
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

export const pool = new Pool(dbConfig);

// 연결 테스트
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ 데이터베이스 연결 성공');
    return true;
  } catch (error) {
    console.error('❌ 데이터베이스 연결 실패:', error);
    return false;
  }
};

// 연결 종료
export const closeConnection = async (): Promise<void> => {
  await pool.end();
  console.log('🔌 데이터베이스 연결 종료');
}; 
import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Render는 DATABASE_URL 환경변수를 제공
const databaseUrl = process.env['DATABASE_URL'];

const dbConfig: PoolConfig = databaseUrl
  ? {
      // Render의 DATABASE_URL 사용
      connectionString: databaseUrl,
      ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false,
      max: 10, // Render 무료 플랜 제한 고려
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      // 로컬 개발 환경
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5432'),
      database: process.env['DB_NAME'] || 'uba',
      user: process.env['DB_USER'] || 'postgres',
      password: process.env['DB_PASSWORD'],
      ssl: false,
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
  console.log('�� 데이터베이스 연결 종료');
}; 
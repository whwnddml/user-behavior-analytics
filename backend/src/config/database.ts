import { Pool } from 'pg';
import { DATABASE_URL, isProduction } from './environment';

// 데이터베이스 연결 풀 설정
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // 연결 풀 설정
  max: 20, // 최대 클라이언트 수
  idleTimeoutMillis: 30000, // 유휴 연결 타임아웃
  connectionTimeoutMillis: 2000, // 연결 타임아웃
});

// 데이터베이스 연결 테스트
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}; 
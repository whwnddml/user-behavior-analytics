import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';

export const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('🔄 데이터베이스 초기화 시작...');
    
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '../../database/init/01-create-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // SQL 실행
    await pool.query(sql);
    
    console.log('✅ 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  }
};

// 스크립트로 직접 실행될 때
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
} 
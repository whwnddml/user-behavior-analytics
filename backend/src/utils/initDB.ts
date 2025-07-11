import { DatabaseMigration } from './migration';
import { logger } from '../config/logger';

export const initializeDatabase = async (force: boolean = false): Promise<void> => {
  try {
    logger.info('🔄 데이터베이스 초기화 시작...');
    
    const migration = new DatabaseMigration();
    await migration.initializeDatabase(force);
    
    logger.info('✅ 데이터베이스 초기화 완료');
  } catch (error) {
    logger.error('❌ 데이터베이스 초기화 실패:', error);
    throw error;
  }
};

// 스크립트로 직접 실행될 때
if (require.main === module) {
  // FORCE_INIT 환경변수가 true일 때만 강제 초기화
  const force = process.env.FORCE_INIT === 'true';
  
  initializeDatabase(force)
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
} 
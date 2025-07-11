import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';
import { logger } from '../config/logger';

export class DatabaseMigration {
    private readonly migrationsPath: string;
    private readonly initPath: string;

    constructor() {
        // Check if we're in the Render environment
        const isRender = process.env.RENDER === 'true';
        
        // In Render, we're already in the backend directory
        const rootDir = isRender ? process.cwd() : path.resolve(process.cwd(), 'backend');
        this.migrationsPath = path.join(rootDir, 'database/migrations');
        this.initPath = path.join(rootDir, 'database/init');
        
        logger.info(`Database paths initialized - migrations: ${this.migrationsPath}, init: ${this.initPath}`);
    }

    /**
     * 현재 스키마 버전을 가져옵니다.
     */
    private async getCurrentVersion(): Promise<number> {
        try {
            const result = await pool.query(
                'SELECT MAX(version) as version FROM schema_versions'
            );
            return result.rows[0].version || 0;
        } catch (error) {
            // 테이블이 없는 경우
            return 0;
        }
    }

    /**
     * 파일 이름에서 버전 번호를 추출합니다.
     */
    private getVersionFromFilename(filename: string): number {
        const parts = filename.split('_');
        if (parts.length > 0) {
            const version = parseInt(parts[0], 10);
            return isNaN(version) ? 0 : version;
        }
        return 0;
    }

    /**
     * 마이그레이션 파일 목록을 가져옵니다.
     */
    private async getMigrationFiles(): Promise<string[]> {
        try {
            const files: string[] = await fs.promises.readdir(this.migrationsPath, { encoding: 'utf8' });
            return files
                .filter(f => f.endsWith('.sql'))
                .sort((a, b) => {
                    const versionA = this.getVersionFromFilename(a);
                    const versionB = this.getVersionFromFilename(b);
                    return versionA - versionB;
                });
        } catch (error) {
            logger.error('Failed to read migration files:', error);
            return [];
        }
    }

    /**
     * SQL 파일을 읽습니다.
     */
    private async readSqlFile(filepath: string): Promise<string> {
        try {
            return await fs.promises.readFile(filepath, { encoding: 'utf8' });
        } catch (error) {
            logger.error(`Failed to read SQL file ${filepath}:`, error);
            throw error;
        }
    }

    /**
     * 마이그레이션을 실행합니다.
     */
    public async migrate(): Promise<void> {
        const currentVersion = await this.getCurrentVersion();
        const files = await this.getMigrationFiles();

        for (const file of files) {
            const version = this.getVersionFromFilename(file);
            if (version > currentVersion) {
                logger.info(`Applying migration ${file}...`);
                const sqlPath = path.join(this.migrationsPath, file);
                
                try {
                    const sql = await this.readSqlFile(sqlPath);
                    
                    await pool.query('BEGIN');
                    await pool.query(sql);
                    await pool.query(
                        'INSERT INTO schema_versions (version, description) VALUES ($1, $2)',
                        [version, file]
                    );
                    await pool.query('COMMIT');
                    logger.info(`Migration ${file} applied successfully`);
                } catch (error) {
                    await pool.query('ROLLBACK');
                    logger.error(`Failed to apply migration ${file}:`, error);
                    throw error;
                }
            }
        }
    }

    /**
     * 데이터베이스를 초기화합니다.
     */
    public async initializeDatabase(force: boolean = false): Promise<void> {
        try {
            if (force) {
                logger.info('Forcing database reinitialization...');
                const dropSqlPath = path.join(this.initPath, '00-drop-tables.sql');
                const dropSql = await this.readSqlFile(dropSqlPath);
                await pool.query(dropSql);
            }

            const createSqlPath = path.join(this.initPath, '01-create-tables.sql');
            const createSql = await this.readSqlFile(createSqlPath);
            await pool.query(createSql);

            // 마이그레이션 실행
            await this.migrate();
            
            logger.info('Database initialization completed');
        } catch (error) {
            logger.error('Database initialization failed:', error);
            throw error;
        }
    }
} 
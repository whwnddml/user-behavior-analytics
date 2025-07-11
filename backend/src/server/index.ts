import express from 'express';
import cors from 'cors';
import { config } from '../config/environment';
import { createAnalyticsRoutes } from '../routes/analytics';
import { AnalyticsModel } from '../models/analytics';
import { pool, testConnection } from '../config/database';
import { logger } from '../config/logger';
import { errorHandler } from '../middlewares/error';

async function startServer() {
    try {
        // 데이터베이스 연결 테스트
        logger.info('Testing database connection...');
        const isConnected = await testConnection(5);
        if (!isConnected) {
            throw new Error('Failed to connect to database after multiple retries');
        }
        logger.info('Database connection successful');

        const app = express();

        // CORS 설정
        const corsOptions = {
            origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
                // origin이 undefined인 경우는 같은 도메인에서의 요청
                if (!origin) {
                    callback(null, true);
                    return;
                }

                // 허용된 도메인 확인
                const allowedOrigins = config.cors.allowedOrigins;
                const isAllowed = allowedOrigins.some(allowedOrigin => {
                    // 정확한 도메인 매칭
                    if (origin === allowedOrigin) return true;
                    
                    // brandiup.com 서브도메인 매칭
                    if (allowedOrigin.includes('brandiup.com') && 
                        origin.endsWith('brandiup.com') && 
                        origin.startsWith('https://')) {
                        return true;
                    }
                    
                    return false;
                });

                if (isAllowed) {
                    callback(null, true);
                } else {
                    logger.warn(`Blocked request from unauthorized domain: ${origin}`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        };
        app.use(cors(corsOptions));

        // JSON 파싱
        app.use(express.json({ limit: '10mb' }));

        // 라우트 설정
        const analyticsModel = new AnalyticsModel();
        app.use('/api/analytics', createAnalyticsRoutes(analyticsModel));

        // Health check endpoint
        app.get('/healthz', (req, res) => {
            res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // 에러 핸들러
        app.use(errorHandler);

        // 서버 시작
        const server = app.listen(config.port, () => {
            logger.info(`Server is running on port ${config.port} with CORS ${config.cors.allowedOrigins.length > 0 ? `allowed for ${config.cors.allowedOrigins.join(', ')}` : 'wide open'}`, {
                timestamp: new Date().toISOString()
            });
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('SIGTERM received. Starting graceful shutdown...');
            server.close(async () => {
                logger.info('HTTP server closed');
                await pool.end();
                logger.info('Database connections closed');
                process.exit(0);
            });
        });

        return server;
    } catch (error) {
        logger.error('Failed to start server:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    }
}

// 서버 시작
if (require.main === module) {
    startServer();
}

export { startServer };
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { testConnection } from '../config/database';
import { initializeDatabase } from '../utils/initDB';
import logger from '../config/logger';
import analyticsRoutes from '../routes/analytics';

const app = express();
const PORT = process.env['PORT'] || 3000;

// 미들웨어 설정
app.use(helmet()); // 보안 헤더
app.use(compression()); // 응답 압축

// CORS 설정
const corsOptions = {
  origin: process.env['CORS_ORIGIN']?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000'), // 15분
  max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'), // 최대 요청 수
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use(limiter);

// JSON 파싱
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 요청 로깅 미들웨어
app.use((req, _res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// 라우트 등록
app.use('/api/analytics', analyticsRoutes);

// 기본 라우트
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'User Behavior Analytics API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health Check
app.get('/api/health', async (_req, res) => {
  try {
    const dbConnected = await testConnection();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        database: dbConnected ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// 에러 핸들러
app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env['NODE_ENV'] === 'development' ? error.message : 'Something went wrong',
  });
});

// 서버 시작
const startServer = async () => {
  try {
    // 데이터베이스 연결 테스트
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    // 프로덕션 환경에서 DB 초기화 (Render 첫 배포 시)
    if (process.env['NODE_ENV'] === 'production') {
      try {
        await initializeDatabase();
      } catch (error) {
        logger.warn('Database initialization failed (tables might already exist):', error);
      }
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env['NODE_ENV'] || 'development'}`);
      logger.info(`🔗 API URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// 시작
startServer();

export default app; 
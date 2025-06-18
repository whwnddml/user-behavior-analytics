import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { testConnection } from '../config/database';
import { initializeDatabase } from '../utils/initDB';
import logger from '../config/logger';
import analyticsRoutes from '../routes/analytics';
import { errorHandler } from '../middlewares/error';
import { isProduction } from '../config/environment';

const app = express();
const PORT = process.env['PORT'] || 3000;

// 미들웨어 설정
app.use(helmet()); // 보안 헤더
app.use(compression()); // 응답 압축

// Render는 프록시를 사용하므로, X-Forwarded-* 헤더를 신뢰하도록 설정
app.set('trust proxy', 'uniquelocal');

// CORS 설정
const corsOptions = {
  origin: isProduction
    ? ['https://whwnddml.github.io']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: isProduction ? 100 : 1000, // 프로덕션에서는 IP당 100개, 개발환경에서는 1000개
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // IP 주소 결정을 위한 설정 추가
  keyGenerator: (req) => {
    const ip = req.ip;
    if (!ip) {
      throw new Error('IP address not found');
    }
    return ip;
  }
});
app.use('/api/', limiter);

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

// 에러 핸들러
app.use(errorHandler);

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
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Pool } from 'pg';
import { config, isProduction } from '../config/environment';
import { logger } from '../config/logger';
import { createAnalyticsRoutes } from '../routes/analytics';
import { AnalyticsModel } from '../models/analytics';

const app = express();
const port = process.env.PORT || 3000;

// 데이터베이스 연결
const pool = new Pool(config.database);

// CORS 설정
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://localhost:8080',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8080',
    'https://whwnddml.github.io'
];

// CORS 미들웨어 설정
app.use(cors({
    origin: function(origin, callback) {
        // origin이 undefined인 경우는 같은 출처의 요청
        if (!origin) {
            logger.info('Same origin request allowed');
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            logger.info(`Allowed origin: ${origin}`);
            return callback(null, true);
        }

        logger.warn(`Blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Preflight 결과를 24시간 캐시
}));

// Preflight 요청에 대한 명시적 처리
app.options('*', (req, res) => {
    logger.info('Received OPTIONS request', {
        origin: req.headers.origin,
        method: req.method,
        path: req.path
    });
    
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.status(204).end();
    } else {
        res.status(403).end();
    }
});

// 미들웨어 설정
app.use(helmet({
    crossOriginResourcePolicy: false // 리소스 공유 허용
}));
app.use(morgan(isProduction ? 'combined' : 'dev', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));
app.use(express.json());

// 모든 라우트에 CORS 헤더 추가
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
});

// 헬스체크 엔드포인트
app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 분석 모델 및 라우터 초기화
const analyticsModel = new AnalyticsModel(pool);
app.use('/api/analytics', createAnalyticsRoutes(analyticsModel));

// 서버 시작
app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    logger.info(`Allowed origins: ${JSON.stringify(allowedOrigins)}`);
});
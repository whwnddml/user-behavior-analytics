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

// 모든 요청에 대해 CORS 헤더 설정
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');

    // OPTIONS 요청에 대한 즉시 응답
    if (req.method === 'OPTIONS') {
        logger.info('Received OPTIONS request', {
            origin: req.headers.origin,
            path: req.path
        });
        return res.status(200).end();
    }
    next();
});

// 기본 미들웨어 설정
app.use(helmet({
    crossOriginResourcePolicy: false
}));
app.use(morgan(isProduction ? 'combined' : 'dev', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));
app.use(express.json());

// 헬스체크 엔드포인트
app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 분석 모델 및 라우터 초기화
const analyticsModel = new AnalyticsModel(pool);
app.use('/api/analytics', createAnalyticsRoutes(analyticsModel));

// 서버 시작
app.listen(port, () => {
    logger.info(`Server is running on port ${port} with CORS wide open`);
});
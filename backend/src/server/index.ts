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
const port = process.env.PORT || 3000;  // PORT 환경변수 사용

// CORS 설정
const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'https://whwnddml.github.io',
            'https://*.brandiup.com'
        ];
        // origin이 undefined인 경우는 같은 출처의 요청
        if (!origin || allowedOrigins.some(allowed => {
            if (allowed.includes('*')) {
                const pattern = new RegExp('^' + allowed.replace('*', '.*') + '$');
                return pattern.test(origin);
            }
            return allowed === origin;
        })) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// 데이터베이스 연결
const pool = new Pool(config.database);

// 미들웨어 설정
app.use(cors(corsOptions));
app.use(helmet());
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
    logger.info(`Server is running on port ${port}`);
});
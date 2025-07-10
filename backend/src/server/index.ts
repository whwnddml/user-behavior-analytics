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

// CORS 설정
const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = config.cors.allowedOrigins;
        
        logger.info(`Incoming request from origin: ${origin}`);
        
        // origin이 undefined인 경우는 같은 출처의 요청
        if (!origin) {
            logger.info('Same origin request allowed');
            callback(null, true);
            return;
        }

        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed.includes('*')) {
                const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
                return pattern.test(origin);
            }
            return allowed === origin;
        });

        if (isAllowed) {
            logger.info(`Origin ${origin} is allowed`);
            callback(null, true);
        } else {
            logger.warn(`Origin ${origin} is not allowed. Allowed origins:`, allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    preflightContinue: false,
    optionsSuccessStatus: 204
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

// OPTIONS 요청에 대한 명시적 처리
app.options('*', cors(corsOptions));

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
    logger.info(`Allowed origins: ${JSON.stringify(config.cors.allowedOrigins)}`);
});
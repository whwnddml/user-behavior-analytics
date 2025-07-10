import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Pool } from 'pg';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import { createAnalyticsRoutes } from '../routes/analytics';
import { AnalyticsModel } from '../models/analytics';

const app = express();
const port = config.port || 3000;

// 데이터베이스 연결
const pool = new Pool(config.database);

// 미들웨어 설정
app.use(cors());
app.use(helmet());
app.use(morgan(config.isProduction ? 'combined' : 'dev', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));
app.use(express.json());

// 분석 모델 및 라우터 초기화
const analyticsModel = new AnalyticsModel(pool);
app.use('/api/analytics', createAnalyticsRoutes(analyticsModel));

// 서버 시작
app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
});
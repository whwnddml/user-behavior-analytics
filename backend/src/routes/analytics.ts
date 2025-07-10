import express, { Router, Request, Response } from 'express';
import { AnalyticsModel } from '../models/analytics';
import { validateDateRange } from '../middlewares/validation';
import { logger } from '../config/logger';
import { testConnection } from '../config/database';

export function createAnalyticsRoutes(analyticsModel: AnalyticsModel): Router {
    const router = express.Router();

    // 헬스체크 엔드포인트 추가
    router.get('/health', async (_req, res) => {
        try {
            const dbConnected = await testConnection(3);
            const status = {
                service: 'user-behavior-analytics-api',
                status: 'ok',
                timestamp: new Date().toISOString(),
                database: {
                    connected: dbConnected,
                    status: dbConnected ? 'healthy' : 'unhealthy'
                }
            };
            
            if (!dbConnected) {
                logger.error('Health check failed: Database connection failed');
                return res.status(503).json({
                    ...status,
                    status: 'degraded',
                    message: 'Database connection failed'
                });
            }
            
            return res.json(status);
        } catch (error) {
            logger.error('Health check error:', error);
            return res.status(500).json({
                service: 'user-behavior-analytics-api',
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // 데이터베이스 연결 상태 체크
    router.get('/health/db', async (req: Request, res: Response): Promise<void> => {
        try {
            const isConnected = await testConnection(3);
            if (isConnected) {
                res.json({
                    status: 'healthy',
                    message: 'Database connection is successful'
                });
            } else {
                res.status(503).json({
                    status: 'unhealthy',
                    message: 'Database connection failed after multiple retries'
                });
            }
        } catch (error) {
            logger.error('Database health check failed:', error);
            res.status(503).json({
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown database error'
            });
        }
    });

    // 세션 생성
    router.post('/session', async (req: Request, res: Response): Promise<void> => {
        try {
            const { visitor_id } = req.body;
            const userAgent = req.headers['user-agent'];
            const ipAddress = req.ip || null;

            if (!visitor_id) {
                res.status(400).json({ error: 'visitor_id is required' });
                return;
            }

            const session = await analyticsModel.createSession(visitor_id, userAgent || null);
            res.json(session);
        } catch (error) {
            logger.error('Error creating session:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // 세션 종료
    router.post('/session/end', async (req: Request, res: Response): Promise<void> => {
        try {
            const { sessionId } = req.body;
            if (!sessionId) {
                res.status(400).json({ error: 'sessionId is required' });
                return;
            }

            const endTime = new Date();
            await analyticsModel.updateSession(sessionId, endTime);
            res.json({ message: 'Session ended successfully' });
        } catch (error) {
            logger.error('Error ending session:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // 분석 데이터 수집
    router.post('/collect', async (req: Request, res: Response): Promise<void> => {
        try {
            const analyticsData = req.body;
            logger.info('Received analytics data:', analyticsData);

            // 세션 정보 저장
            const sessionId = analyticsData.sessionId;
            const visitorId = analyticsData.visitorId;
            const userAgent = analyticsData.userAgent;
            const startTime = analyticsData.startTime ? new Date(analyticsData.startTime) : new Date();
            const endTime = analyticsData.endTime ? new Date(analyticsData.endTime) : null;

            // URL 처리 - pathname만 저장
            let pathname;
            try {
                // URL이 상대 경로인 경우에도 pathname 추출
                const url = new URL(analyticsData.pageUrl, 'http://localhost:8080');
                pathname = url.pathname;
            } catch (error) {
                logger.error('Error processing URL:', error);
                res.status(400).json({ error: 'Invalid URL format' });
                return;
            }

            // 세션 생성 또는 업데이트
            await analyticsModel.createOrUpdateSession(sessionId, visitorId, startTime, endTime, userAgent);

            // 페이지뷰 저장
            const pageviewId = await analyticsModel.createPageview({
                sessionId,
                pageUrl: pathname, // pathname만 저장
                pageTitle: analyticsData.pageTitle,
                loadTime: analyticsData.performance.loadTime,
                domContentLoaded: analyticsData.performance.domContentLoaded,
                firstPaint: analyticsData.performance.firstPaint,
                firstContentfulPaint: analyticsData.performance.firstContentfulPaint,
                startTime: new Date(analyticsData.startTime),
                endTime: analyticsData.endTime ? new Date(analyticsData.endTime) : null
            });

            // 영역 체류 시간 저장
            for (const area of analyticsData.areaEngagements) {
                await analyticsModel.createAreaEngagement({
                    pageviewId,
                    areaId: area.areaId,
                    areaName: area.areaName,
                    areaType: area.areaType,
                    timeSpent: area.timeSpent,
                    interactionCount: area.interactions,
                    firstEngagement: new Date(area.firstEngagement),
                    lastEngagement: new Date(area.lastEngagement),
                    visibleTime: area.visibility.visibleTime,
                    viewportPercent: area.visibility.viewportPercent
                });
            }

            // 스크롤 메트릭 저장
            await analyticsModel.createScrollMetrics({
                pageviewId,
                deepestScroll: analyticsData.scrollMetrics.deepestScroll,
                scrollBreakpoints: analyticsData.scrollMetrics.scrollDepthBreakpoints
            });

            // 인터랙션 저장
            for (const interaction of analyticsData.interactionMap) {
                await analyticsModel.createInteraction({
                    pageviewId,
                    areaId: interaction.areaId,
                    interactionType: interaction.type,
                    targetElement: interaction.target,
                    xCoordinate: interaction.x,
                    yCoordinate: interaction.y,
                    recordedAt: new Date(interaction.timestamp)
                });
            }

            // 폼 분석 데이터 저장
            for (const form of analyticsData.formAnalytics) {
                await analyticsModel.createFormAnalytics({
                    pageviewId,
                    formName: form.formName,
                    totalTimeSpent: form.totalTimeSpent,
                    completed: form.completed,
                    submittedAt: form.submittedAt ? new Date(form.submittedAt) : null
                });
            }

            res.json({
                message: 'Analytics data saved successfully',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error collecting analytics data:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // 대시보드 통계
    router.get('/dashboard/stats', validateDateRange, async (req: Request, res: Response): Promise<void> => {
        try {
            // 데이터베이스 연결 상태 확인
            const isConnected = await testConnection(3);
            if (!isConnected) {
                res.status(503).json({
                    success: false,
                    error: 'Service Unavailable',
                    message: 'Database connection is currently unavailable. Please try again later.'
                });
                return;
            }

            const { startDate, endDate, page } = req.query;
            logger.info('Executing queries with params:', {
                startDate,
                endDate,
                page,
                headers: req.headers,
                query: req.query
            });

            const parsedStartDate = startDate && typeof startDate === 'string' ? new Date(startDate) : undefined;
            const parsedEndDate = endDate && typeof endDate === 'string' ? new Date(endDate) : undefined;
            const pageFilter = page && typeof page === 'string' ? page : undefined;

            const stats = await analyticsModel.getSessionStats(parsedStartDate, parsedEndDate, pageFilter);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting dashboard stats:', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                query: req.query
            });

            // 데이터베이스 연결 오류 특별 처리
            if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
                res.status(503).json({
                    success: false,
                    error: 'Service Unavailable',
                    message: 'Database connection is currently unavailable. Please try again later.',
                    retryAfter: 30
                });
                return;
            }

            res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'An unexpected error occurred'
            });
        }
    });

    // 방문자별 세션 조회
    router.get('/visitor/:visitorId/sessions', async (req: Request, res: Response): Promise<void> => {
        try {
            const { visitorId } = req.params;
            if (!visitorId) {
                res.status(400).json({ error: 'visitorId is required' });
                return;
            }

            const sessions = await analyticsModel.getVisitorSessions(visitorId);
            res.json(sessions);
        } catch (error) {
            logger.error('Error getting visitor sessions:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
} 
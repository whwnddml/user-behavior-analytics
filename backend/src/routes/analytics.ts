import express, { Router, Request, Response } from 'express';
import { AnalyticsModel } from '../models/analytics';
import { validateDateRange } from '../middlewares/validation';
import { logger } from '../config/logger';

export function createAnalyticsRoutes(analyticsModel: AnalyticsModel): Router {
    const router = express.Router();

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
            const { startDate, endDate, page } = req.query;
            const parsedStartDate = startDate && typeof startDate === 'string' ? new Date(startDate) : undefined;
            const parsedEndDate = endDate && typeof endDate === 'string' ? new Date(endDate) : undefined;
            const pageFilter = page && typeof page === 'string' ? page : undefined;

            const stats = await analyticsModel.getSessionStats(parsedStartDate, parsedEndDate, pageFilter);
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting dashboard stats:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
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
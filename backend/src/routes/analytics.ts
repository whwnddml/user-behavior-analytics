import { Router, Request, Response, NextFunction } from 'express';
import { AnalyticsModel } from '../models/analytics';
import { 
  validateBody, 
  analyticsDataSchema, 
  getClientIP, 
  parseUserAgent 
} from '../middlewares/validation';
import { 
  ClientAnalyticsData, 
  SessionData, 
  PageviewData,
  AreaEngagementData,
  ScrollMetricsData,
  ScrollPatternData,
  InteractionData,
  FormAnalyticsData,
  FormFieldAnalyticsData,
  ApiResponse 
} from '../types';
import logger from '../config/logger';

const router = Router();

// 헬스체크 API
router.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    success: true, 
    message: 'Analytics API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 분석 데이터 수집 API
router.post('/collect', validateBody(analyticsDataSchema), async (req: Request, res: Response) => {
  try {
    const clientData: ClientAnalyticsData = req.body;
    const clientIP = getClientIP(req);
    const userAgentInfo = parseUserAgent(clientData.userAgent);
    
    logger.info('Analytics data received', {
      sessionId: clientData.sessionId,
      pageUrl: clientData.pageUrl,
      userAgent: clientData.userAgent,
      ip: clientIP
    });

    // 1. 세션 데이터 생성/업데이트
    const sessionData: SessionData = {
      sessionId: clientData.sessionId,
      startTime: new Date(),
      userAgent: clientData.userAgent,
      ipAddress: clientIP,
      landingPage: clientData.pageUrl,
      deviceType: userAgentInfo.deviceType as 'mobile' | 'tablet' | 'desktop',
      browserName: userAgentInfo.browserName || 'Unknown',
      browserVersion: userAgentInfo.browserVersion || 'Unknown',
      osName: userAgentInfo.osName || 'Unknown',
      osVersion: userAgentInfo.osVersion || 'Unknown',
      screenResolution: 'Unknown', // 클라이언트에서 전송되도록 수정 필요
      viewportSize: 'Unknown', // 클라이언트에서 전송되도록 수정 필요
      language: 'Unknown' // 클라이언트에서 전송되도록 수정 필요
    };

    await AnalyticsModel.createOrUpdateSession(sessionData);

    // 2. 페이지뷰 데이터 생성
    const pageviewData: PageviewData = {
      sessionId: clientData.sessionId,
      pageUrl: clientData.pageUrl,
      ...(clientData.pageTitle && { pageTitle: clientData.pageTitle }),
      ...(clientData.performance?.loadTime && { loadTime: clientData.performance.loadTime }),
      ...(clientData.performance?.domContentLoaded && { domContentLoaded: clientData.performance.domContentLoaded }),
      ...(clientData.performance?.firstPaint && { firstPaint: clientData.performance.firstPaint }),
      ...(clientData.performance?.firstContentfulPaint && { firstContentfulPaint: clientData.performance.firstContentfulPaint }),
      startTime: new Date()
    };

    const pageviewId = await AnalyticsModel.createPageview(pageviewData);

    // 3. 영역 상호작용 데이터 저장
    const areaEngagements: AreaEngagementData[] = clientData.areaEngagements.map(area => ({
      pageviewId,
      areaId: area.areaId,
      areaName: area.areaName,
      ...(area.areaType && { areaType: area.areaType }),
      timeSpent: area.timeSpent,
      interactionCount: area.interactions,
      ...(area.firstEngagement && { firstEngagement: area.firstEngagement }),
      ...(area.lastEngagement && { lastEngagement: area.lastEngagement }),
      visibleTime: area.visibility.visibleTime,
      viewportPercent: area.visibility.viewportPercent
    }));

    await AnalyticsModel.createAreaEngagements(areaEngagements);

    // 4. 스크롤 메트릭 저장
    const scrollData: ScrollMetricsData = {
      pageviewId,
      deepestScroll: clientData.scrollMetrics.deepestScroll,
      ...(clientData.scrollMetrics.scrollDepthBreakpoints[25] && { 
        scroll25Time: new Date(clientData.scrollMetrics.scrollDepthBreakpoints[25]) 
      }),
      ...(clientData.scrollMetrics.scrollDepthBreakpoints[50] && { 
        scroll50Time: new Date(clientData.scrollMetrics.scrollDepthBreakpoints[50]) 
      }),
      ...(clientData.scrollMetrics.scrollDepthBreakpoints[75] && { 
        scroll75Time: new Date(clientData.scrollMetrics.scrollDepthBreakpoints[75]) 
      }),
      ...(clientData.scrollMetrics.scrollDepthBreakpoints[100] && { 
        scroll100Time: new Date(clientData.scrollMetrics.scrollDepthBreakpoints[100]) 
      })
    };

    const scrollId = await AnalyticsModel.createScrollMetrics(scrollData);

    // 5. 스크롤 패턴 저장
    const scrollPatterns: ScrollPatternData[] = clientData.scrollMetrics.scrollPattern.map(pattern => ({
      scrollId,
      position: pattern.position,
      direction: pattern.direction,
      speed: pattern.speed,
      recordedAt: new Date(pattern.timestamp)
    }));

    await AnalyticsModel.createScrollPatterns(scrollPatterns);

    // 6. 인터랙션 데이터 저장
    const interactions: InteractionData[] = clientData.interactionMap.map(interaction => ({
      pageviewId,
      ...(interaction.areaId && { areaId: interaction.areaId }),
      interactionType: interaction.type,
      targetElement: interaction.targetElement,
      xCoordinate: interaction.x,
      yCoordinate: interaction.y,
      recordedAt: new Date(interaction.timestamp)
    }));

    await AnalyticsModel.createInteractions(interactions);

    // 7. 폼 분석 데이터 저장 (폼별로 그룹화)
    const formGroups = new Map<string, any[]>();
    clientData.formAnalytics.forEach(field => {
      if (!formGroups.has(field.formId)) {
        formGroups.set(field.formId, []);
      }
      formGroups.get(field.formId)?.push(field);
    });

    for (const [formId, fields] of formGroups) {
      const totalTimeSpent = fields.reduce((sum, field) => sum + field.timeSpent, 0);
      const completed = fields.every(field => field.completed);

      const formData: FormAnalyticsData = {
        pageviewId,
        formName: formId,
        totalTimeSpent,
        completed,
        ...(completed && { submittedAt: new Date() })
      };

      const formAnalyticsId = await AnalyticsModel.createFormAnalytics(formData);

      const fieldAnalytics: FormFieldAnalyticsData[] = fields.map(field => ({
        formId: formAnalyticsId,
        fieldName: field.fieldName,
        timeSpent: field.timeSpent,
        errorCount: field.errorCount,
        completed: field.completed
      }));

      await AnalyticsModel.createFormFieldAnalytics(fieldAnalytics);
    }

    const response: ApiResponse = {
      success: true,
      message: 'Analytics data processed successfully',
      data: {
        sessionId: clientData.sessionId,
        pageviewId,
        processedAt: new Date().toISOString()
      }
    };

    logger.info('Analytics data processed successfully', {
      sessionId: clientData.sessionId,
      pageviewId,
      areaEngagements: areaEngagements.length,
      interactions: interactions.length
    });

    res.status(201).json(response);

  } catch (error) {
    logger.error('Error processing analytics data:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to process analytics data',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

// 세션 종료 API
router.post('/session/end', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      const errorResponse: ApiResponse = {
        success: false,
        message: 'Session ID is required'
      };
      res.status(400).json(errorResponse);
      return;
    }

    // 세션 종료 시간 업데이트
    const sessionData: Partial<SessionData> = {
      sessionId,
      endTime: new Date()
    };

    await AnalyticsModel.createOrUpdateSession(sessionData as SessionData);

    const response: ApiResponse = {
      success: true,
      message: 'Session ended successfully',
      data: {
        sessionId,
        endedAt: new Date().toISOString()
      }
    };

    logger.info('Session ended', { sessionId });
    res.json(response);

  } catch (error) {
    logger.error('Error ending session:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to end session',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

// === 대시보드 API ===

// 대시보드 통계 API
router.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo, page } = req.query;
    
    const stats = await AnalyticsModel.getDashboardStats(
      dateFrom ? String(dateFrom) : undefined,
      dateTo ? String(dateTo) : undefined,
      page ? String(page) : undefined
    );

    const response: ApiResponse = {
      success: true,
      message: '대시보드 통계를 성공적으로 조회했습니다.',
      data: {
        stats,
        summary: {
          totalSessions: stats[0]?.total_sessions || 0,
          totalPageviews: stats[0]?.total_pageviews || 0,
          totalInteractions: stats[0]?.total_session_interactions || 0,
          avgSessionTime: {
            value: stats[0]?.avg_session_time || 0,
            unit: 'minutes'
          }
        }
      }
    };

    return res.json(response);
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    return res.status(500).json({
      success: false,
      message: '대시보드 통계 조회 실패',
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    });
  }
});

// 세션 목록 API
router.get('/dashboard/sessions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit)) || 50;
    const offset = parseInt(String(req.query.offset)) || 0;

    const sessions = await AnalyticsModel.getSessions(limit, offset);

    const response: ApiResponse = {
      success: true,
      message: 'Sessions retrieved successfully',
      data: sessions
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 세션 상세 정보 API
router.get('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const sessionDetail = await AnalyticsModel.getSessionDetail(sessionId);

    if (!sessionDetail) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
        error: `Session with ID ${sessionId} does not exist`
      });
    }

    return res.json({
      success: true,
      message: 'Session details retrieved successfully',
      data: sessionDetail
    });
  } catch (error) {
    logger.error('Error fetching session details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch session details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 영역별 통계 API
router.get('/area-stats', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await AnalyticsModel.getAreaStats(
      dateFrom ? String(dateFrom) : undefined,
      dateTo ? String(dateTo) : undefined
    );

    const response: ApiResponse = {
      success: true,
      message: 'Area statistics retrieved successfully',
      data: stats
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching area stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch area statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 시간대별 통계 API
router.get('/hourly-stats', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await AnalyticsModel.getHourlyStats(
      dateFrom ? String(dateFrom) : undefined,
      dateTo ? String(dateTo) : undefined
    );

    const response: ApiResponse = {
      success: true,
      message: 'Hourly statistics retrieved successfully',
      data: stats
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching hourly stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hourly statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 디바이스별 통계 API
router.get('/device-stats', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await AnalyticsModel.getDeviceStats(
      dateFrom ? String(dateFrom) : undefined,
      dateTo ? String(dateTo) : undefined
    );

    const response: ApiResponse = {
      success: true,
      message: 'Device statistics retrieved successfully',
      data: stats
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching device stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 성능 통계 API
router.get('/performance-stats', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const stats = await AnalyticsModel.getPerformanceStats(
      dateFrom ? String(dateFrom) : undefined,
      dateTo ? String(dateTo) : undefined
    );

    const response: ApiResponse = {
      success: true,
      message: 'Performance statistics retrieved successfully',
      data: stats
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching performance stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 
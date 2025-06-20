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

// 대시보드 전체 통계
router.get('/dashboard-stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, page } = req.query;
    const stats = await AnalyticsModel.getDashboardStats(
      dateFrom as string,
      dateTo as string,
      page as string
    );
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// 세션 목록 조회
router.get('/dashboard/sessions', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 50;
    const offset = parseInt(req.query['offset'] as string) || 0;
    
    const sessions = await AnalyticsModel.getSessions(limit, offset);

    const response: ApiResponse = {
      success: true,
      message: 'Sessions retrieved successfully',
      data: {
        sessions,
        pagination: {
          limit,
          offset,
          total: sessions.length
        }
      }
    };

    res.json(response);

  } catch (error) {
    logger.error('Error retrieving sessions:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to retrieve sessions',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

// 특정 세션 상세 정보
router.get('/dashboard/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params['sessionId'];
    
    if (!sessionId) {
      const errorResponse: ApiResponse = {
        success: false,
        message: 'Session ID is required'
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    const sessionDetail = await AnalyticsModel.getSessionDetail(sessionId);

    if (!sessionDetail.session) {
      const errorResponse: ApiResponse = {
        success: false,
        message: 'Session not found'
      };
      res.status(404).json(errorResponse);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'Session detail retrieved successfully',
      data: sessionDetail
    };

    res.json(response);

  } catch (error) {
    logger.error('Error retrieving session detail:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to retrieve session detail',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

// 영역별 통계
router.get('/dashboard/areas', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const areaStats = await AnalyticsModel.getAreaStats(
      dateFrom as string,
      dateTo as string
    );

    const response: ApiResponse = {
      success: true,
      message: 'Area stats retrieved successfully',
      data: areaStats
    };

    res.json(response);

  } catch (error) {
    logger.error('Error retrieving area stats:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to retrieve area stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

// 시간대별 통계
router.get('/dashboard/hourly', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const hourlyStats = await AnalyticsModel.getHourlyStats(
      dateFrom as string,
      dateTo as string
    );

    const response: ApiResponse = {
      success: true,
      message: 'Hourly stats retrieved successfully',
      data: hourlyStats
    };

    res.json(response);

  } catch (error) {
    logger.error('Error retrieving hourly stats:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to retrieve hourly stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

// 디바이스별 통계
router.get('/dashboard/devices', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const deviceStats = await AnalyticsModel.getDeviceStats(
      dateFrom as string,
      dateTo as string
    );

    const response: ApiResponse = {
      success: true,
      message: 'Device stats retrieved successfully',
      data: deviceStats
    };

    res.json(response);

  } catch (error) {
    logger.error('Error retrieving device stats:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to retrieve device stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

// 페이지 성능 통계
router.get('/dashboard/performance', async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const performanceStats = await AnalyticsModel.getPerformanceStats(
      dateFrom as string,
      dateTo as string
    );

    const response: ApiResponse = {
      success: true,
      message: 'Performance stats retrieved successfully',
      data: performanceStats
    };

    res.json(response);

  } catch (error) {
    logger.error('Error retrieving performance stats:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      message: 'Failed to retrieve performance stats',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    res.status(500).json(errorResponse);
  }
});

export default router; 
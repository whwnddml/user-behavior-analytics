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
      ip: clientIP,
      interactionSample: clientData.interactionMap[0],
      interactionCount: clientData.interactionMap.length
    });

    // 1. 세션 데이터 생성/업데이트
    const sessionData: Partial<SessionData> = {
      sessionId: clientData.sessionId,
      userAgent: clientData.userAgent,
      ipAddress: clientIP,
      landingPage: clientData.pageUrl.startsWith('/') ? clientData.pageUrl : `/${clientData.pageUrl}`,  // pathname 형식으로 저장
      deviceType: userAgentInfo.deviceType as 'mobile' | 'tablet' | 'desktop',
      browserName: userAgentInfo.browserName || 'Unknown',
      browserVersion: userAgentInfo.browserVersion || 'Unknown',
      osName: userAgentInfo.osName || 'Unknown',
      osVersion: userAgentInfo.osVersion || 'Unknown',
      screenResolution: 'Unknown', // 클라이언트에서 전송되도록 수정 필요
      viewportSize: 'Unknown', // 클라이언트에서 전송되도록 수정 필요
      language: 'Unknown' // 클라이언트에서 전송되도록 수정 필요
    };

    // 새 세션인 경우에만 시작 시간 설정
    const existingSession = await AnalyticsModel.getSessionDetails(clientData.sessionId);
    if (!existingSession) {
      sessionData.startTime = new Date();
    }

    await AnalyticsModel.createOrUpdateSession(sessionData as SessionData);

    // 2. 페이지뷰 데이터 생성
    // URL 정규화: pathname 형식으로 통일
    let normalizedPath = clientData.pageUrl;
    
    // 전체 URL인 경우 pathname 추출
    if (clientData.pageUrl.startsWith('http')) {
      try {
        const pageUrl = new URL(clientData.pageUrl);
        normalizedPath = pageUrl.pathname;
      } catch (error) {
        logger.error('Error parsing URL:', error);
        // URL 파싱 실패 시 원래 값 사용
      }
    }
    
    // pathname이 /로 시작하지 않으면 추가
    normalizedPath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

    const pageviewData: PageviewData = {
      sessionId: clientData.sessionId,
      pageUrl: normalizedPath,
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
    logger.error('Error creating pageview data:', error);
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
    const { dateFrom, dateTo, page } = req.query;
    
    try {
        logger.info('Dashboard stats requested', {
            dateFrom: dateFrom || 'not specified',
            dateTo: dateTo || 'not specified',
            page: page || 'all pages'
        });

        const stats = await AnalyticsModel.getDashboardStats(
            dateFrom as string,
            dateTo as string,
            page as string
        );

        // 데이터가 없는 경우 기본값 설정
        if (!stats) {
            logger.info('No stats data found', {
                dateFrom,
                dateTo,
                page
            });

            return res.json({
                success: true,
                data: {
                    overview: {
                        total_sessions: 0,
                        total_pageviews: 0,
                        total_interactions: 0,
                        avg_session_time: 0
                    },
                    areas: [],
                    devices: [],
                    browsers: [],
                    os: [],
                    locations: [],
                    hourly: []
                }
            });
        }

        // 상세 로깅
        logger.info('Stats data retrieved', {
            overview: {
                total_sessions: stats.overview?.total_sessions || 0,
                total_pageviews: stats.overview?.total_pageviews || 0,
                total_interactions: stats.overview?.total_interactions || 0,
                avg_session_time: stats.overview?.avg_session_time || 0
            },
            counts: {
                areas: stats.areas?.length || 0,
                devices: stats.devices?.length || 0,
                browsers: stats.browsers?.length || 0,
                os: stats.os?.length || 0,
                locations: stats.locations?.length || 0,
                hourly: stats.hourly?.length || 0
            }
        });

        return res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Error fetching dashboard stats:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            dateFrom: dateFrom || 'not specified',
            dateTo: dateTo || 'not specified',
            page: page || 'all pages'
        });
        
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error: error instanceof Error ? error.message : 'Unknown error'
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
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const sessionDetail = await AnalyticsModel.getSessionDetails(sessionId);

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
// 공통 타입 정의
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 분석 데이터 타입
export interface SessionData {
  sessionId: string;
  visitorId?: string;
  startTime: Date;
  endTime?: Date;
  userAgent: string;
  ipAddress: string;
  referrer?: string;
  landingPage: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  screenResolution: string;
  viewportSize: string;
  language: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
}

export interface PageviewData {
  pageviewId?: number;
  sessionId: string;
  pageUrl: string;
  pageTitle?: string;
  loadTime?: number;
  domContentLoaded?: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  startTime: Date;
  endTime?: Date;
}

export interface AreaEngagementData {
  engagementId?: number;
  pageviewId: number;
  areaId: string;
  areaName: string;
  areaType?: string;
  timeSpent: number;
  interactionCount: number;
  firstEngagement?: Date;
  lastEngagement?: Date;
  visibleTime?: number;
  viewportPercent?: number;
}

export interface ScrollMetricsData {
  scrollId?: number;
  pageviewId: number;
  deepestScroll: number;
  scroll25Time?: Date;
  scroll50Time?: Date;
  scroll75Time?: Date;
  scroll100Time?: Date;
}

export interface ScrollPatternData {
  patternId?: number;
  scrollId: number;
  position: number;
  direction: 'up' | 'down';
  speed: number;
  recordedAt: Date;
}

export interface InteractionData {
  interactionId?: number;
  pageviewId: number;
  areaId?: string;
  interactionType: 'click' | 'hover' | 'touch';
  targetElement: string;
  xCoordinate: number;
  yCoordinate: number;
  recordedAt: Date;
}

export interface FormAnalyticsData {
  formId?: number;
  pageviewId: number;
  formName: string;
  totalTimeSpent: number;
  completed: boolean;
  submittedAt?: Date;
}

export interface FormFieldAnalyticsData {
  fieldId?: number;
  formId: number;
  fieldName: string;
  timeSpent: number;
  errorCount: number;
  completed: boolean;
}

// 클라이언트로부터 받는 데이터 타입
export interface ClientAnalyticsData {
  sessionId: string;
  pageUrl: string;
  pageTitle?: string;
  userAgent: string;
  
  // 성능 메트릭
  performance?: {
    loadTime?: number;
    domContentLoaded?: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
  };

  // 영역 데이터
  areaEngagements: Array<{
    areaId: string;
    areaName: string;
    areaType?: string;
    timeSpent: number;
    interactions: number;
    firstEngagement?: Date;
    lastEngagement?: Date;
    visibility: {
      visibleTime: number;
      viewportPercent: number;
    };
  }>;

  // 스크롤 데이터
  scrollMetrics: {
    deepestScroll: number;
    scrollDepthBreakpoints: {
      25?: number;
      50?: number;
      75?: number;
      100?: number;
    };
    scrollPattern: Array<{
      position: number;
      timestamp: Date;
      direction: 'up' | 'down';
      speed: number;
    }>;
  };

  // 상호작용 데이터
  interactionMap: Array<{
    x: number;
    y: number;
    type: 'click' | 'hover' | 'touch';
    targetElement: string;
    timestamp: Date;
    areaId?: string;
  }>;

  // 폼 데이터
  formAnalytics: Array<{
    formId: string;
    fieldName: string;
    interactionType: string;
    timeSpent: number;
    errorCount: number;
    completed: boolean;
  }>;
}

// 통계 응답 타입
export interface RealtimeStats {
  activeUsers: number;
  pageviews: number;
  topPages: Array<{
    url: string;
    views: number;
  }>;
  deviceTypes: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
}

export interface PeriodStats {
  startDate: Date;
  endDate: Date;
  totalSessions: number;
  totalPageviews: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: Array<{
    url: string;
    views: number;
    averageTime: number;
  }>;
  deviceBreakdown: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  browserBreakdown: Record<string, number>;
} 
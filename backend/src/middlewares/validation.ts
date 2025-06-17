import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

// 클라이언트 분석 데이터 검증 스키마
export const analyticsDataSchema = Joi.object({
  sessionId: Joi.string().required(),
  pageUrl: Joi.string().uri().required(),
  pageTitle: Joi.string().optional(),
  userAgent: Joi.string().required(),
  
  // 성능 메트릭
  performance: Joi.object({
    loadTime: Joi.number().min(0).optional(),
    domContentLoaded: Joi.number().min(0).optional(),
    firstPaint: Joi.number().min(0).optional(),
    firstContentfulPaint: Joi.number().min(0).optional()
  }).optional(),

  // 영역 데이터
  areaEngagements: Joi.array().items(
    Joi.object({
      areaId: Joi.string().required(),
      areaName: Joi.string().required(),
      areaType: Joi.string().optional(),
      timeSpent: Joi.number().min(0).required(),
      interactions: Joi.number().min(0).required(),
      firstEngagement: Joi.date().optional(),
      lastEngagement: Joi.date().optional(),
      visibility: Joi.object({
        visibleTime: Joi.number().min(0).required(),
        viewportPercent: Joi.number().min(0).max(100).required()
      }).required()
    })
  ).required(),

  // 스크롤 데이터
  scrollMetrics: Joi.object({
    deepestScroll: Joi.number().min(0).max(100).required(),
    scrollDepthBreakpoints: Joi.object({
      25: Joi.number().min(0).optional(),
      50: Joi.number().min(0).optional(),
      75: Joi.number().min(0).optional(),
      100: Joi.number().min(0).optional()
    }).required(),
    scrollPattern: Joi.array().items(
      Joi.object({
        position: Joi.number().min(0).max(100).required(),
        timestamp: Joi.date().required(),
        direction: Joi.string().valid('up', 'down').required(),
        speed: Joi.number().min(0).required()
      })
    ).required()
  }).required(),

  // 상호작용 데이터
  interactionMap: Joi.array().items(
    Joi.object({
      x: Joi.number().min(0).required(),
      y: Joi.number().min(0).required(),
      type: Joi.string().valid('click', 'hover', 'touch').required(),
      targetElement: Joi.string().required(),
      timestamp: Joi.date().required(),
      areaId: Joi.string().optional()
    })
  ).required(),

  // 폼 데이터
  formAnalytics: Joi.array().items(
    Joi.object({
      formId: Joi.string().required(),
      fieldName: Joi.string().required(),
      interactionType: Joi.string().required(),
      timeSpent: Joi.number().min(0).required(),
      errorCount: Joi.number().min(0).required(),
      completed: Joi.boolean().required()
    })
  ).required()
});

// 검증 미들웨어 생성 함수
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorResponse: ApiResponse = {
        success: false,
        message: 'Validation failed',
        error: error.details.map(detail => detail.message).join(', ')
      };
      
      res.status(400).json(errorResponse);
      return;
    }

    // 검증된 데이터로 교체
    req.body = value;
    next();
  };
};

// IP 주소 추출 유틸리티
export const getClientIP = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  return ip || '127.0.0.1';
};

// User-Agent 파싱 유틸리티
export const parseUserAgent = (userAgent: string) => {
  // 간단한 User-Agent 파싱 (실제로는 ua-parser-js 등의 라이브러리 사용 권장)
  const deviceType = /Mobile|Android|iPhone|iPad/.test(userAgent) 
    ? (/iPad/.test(userAgent) ? 'tablet' : 'mobile')
    : 'desktop';
    
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/?([\d.]+)/);
  const browserName = browserMatch ? browserMatch[1] : 'Unknown';
  const browserVersion = browserMatch ? browserMatch[2] : 'Unknown';
  
  const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
  const osName = osMatch ? osMatch[1] : 'Unknown';
  
  return {
    deviceType,
    browserName,
    browserVersion,
    osName,
    osVersion: 'Unknown' // 더 정확한 파싱이 필요한 경우 별도 라이브러리 사용
  };
}; 
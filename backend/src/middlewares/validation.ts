import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';

// 클라이언트 분석 데이터 검증 스키마
export const analyticsDataSchema = Joi.object({
  sessionId: Joi.string().required(),
  pageUrl: Joi.string().required(),
  pageTitle: Joi.string().allow('').optional(),
  userAgent: Joi.string().required(),
  startTime: Joi.string().isoDate().required(),
  
  // 성능 메트릭
  performance: Joi.object({
    loadTime: Joi.number().min(0).default(0),
    domContentLoaded: Joi.number().min(0).default(0),
    firstPaint: Joi.number().min(0).default(0),
    firstContentfulPaint: Joi.number().min(0).default(0),
    navigationtype: Joi.number().default(0)
  }).default(),

  // 영역 데이터
  areaEngagements: Joi.array().items(
    Joi.object({
      areaId: Joi.string().required(),
      areaName: Joi.string().required(),
      areaType: Joi.string().default('default'),
      timeSpent: Joi.number().min(0).required(),
      interactions: Joi.number().min(0).required(),
      firstEngagement: Joi.string().isoDate().required(),
      lastEngagement: Joi.string().isoDate().required(),
      visibility: Joi.object({
        visibleTime: Joi.number().min(0).required(),
        viewportPercent: Joi.number().min(0).max(100).required()
      }).required()
    })
  ).required(),

  // 상호작용 데이터
  interactionMap: Joi.array().items(
    Joi.object({
      x: Joi.number().min(0).required(),
      y: Joi.number().min(0).required(),
      type: Joi.string().valid('click', 'touch').required(),
      targetElement: Joi.string().required(),
      timestamp: Joi.string().isoDate().required(),
      areaId: Joi.string().allow(null).default(null)
    })
  ).required(),

  // 폼 데이터
  formAnalytics: Joi.array().items(
    Joi.object({
      formId: Joi.string().required(),
      fieldName: Joi.string().required(),
      interactionType: Joi.string().required(),
      timeSpent: Joi.number().min(0).required(),
      errorCount: Joi.number().min(0).default(0),
      completed: Joi.boolean().required()
    })
  ).default([])
}).options({
  stripUnknown: true,
  abortEarly: false,
  presence: 'required'
});

// 검증 미들웨어 생성 함수
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);

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

export const validateDateRange = (req: Request, res: Response, next: NextFunction): void => {
    const { startDate, endDate } = req.query;

    if (startDate && typeof startDate === 'string' && !isValidDate(startDate)) {
        res.status(400).json({
            error: 'Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)'
        });
        return;
    }

    if (endDate && typeof endDate === 'string' && !isValidDate(endDate)) {
        res.status(400).json({
            error: 'Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)'
        });
        return;
    }

    if (startDate && endDate && 
        typeof startDate === 'string' && 
        typeof endDate === 'string' && 
        new Date(startDate) > new Date(endDate)) {
        res.status(400).json({
            error: 'startDate cannot be later than endDate'
        });
        return;
    }

    next();
};

function isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
} 
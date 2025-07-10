import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Error:', err);
  
  res.status(500).json({
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다.',
  });
}; 
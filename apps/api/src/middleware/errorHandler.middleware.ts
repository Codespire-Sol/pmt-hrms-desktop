import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { config } from '../config';

// Re-export ApiError as AppError for backward compatibility
export { ApiError as AppError } from '../utils/ApiError';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error = err;

  // Convert non-ApiError to ApiError
  if (!(error instanceof ApiError)) {
    const statusCode = 500;
    const message = error.message || 'Internal server error';
    error = new ApiError(statusCode, message, false);
  }

  const apiError = error as ApiError;
  const requestId = (req as any).requestId || req.headers['x-request-id'] || 'unknown';

  // Log error with request ID for correlation
  logger.error({
    message: apiError.message,
    statusCode: apiError.statusCode,
    stack: apiError.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    requestId,
    userId: req.user?.id,
    isOperational: apiError.isOperational,
  });

  // Send error response with request ID for client-side correlation
  res.status(apiError.statusCode).json({
    success: false,
    error: {
      message: apiError.message,
      code: apiError.code,
      requestId,
      ...(apiError.details && { details: apiError.details }),
      ...(config.env === 'development' && { stack: apiError.stack }),
    },
  });
};

// Handle 404 routes
export const notFound = (req: Request, _res: Response, next: NextFunction) => {
  const error = ApiError.notFound(`Route ${req.originalUrl} not found`);
  next(error);
};

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;
  public details?: any;

  constructor(
    statusCode: number,
    message: string,
    isOperational: boolean = true,
    code?: string,
    details?: any,
    stack: string = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string, code?: string, details?: any): ApiError {
    return new ApiError(400, message, true, code || 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string): ApiError {
    return new ApiError(401, message, true, code || 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden', code?: string, details?: any): ApiError {
    return new ApiError(403, message, true, code || 'FORBIDDEN', details);
  }

  static notFound(message: string = 'Resource not found', code?: string): ApiError {
    return new ApiError(404, message, true, code || 'NOT_FOUND');
  }

  static conflict(message: string, code?: string, details?: any): ApiError {
    return new ApiError(409, message, true, code || 'CONFLICT', details);
  }

  static internal(message: string = 'Internal server error', code?: string): ApiError {
    return new ApiError(500, message, false, code || 'INTERNAL_ERROR');
  }

  static unprocessable(message: string, code?: string, details?: any): ApiError {
    return new ApiError(422, message, true, code || 'UNPROCESSABLE_ENTITY', details);
  }
}

import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '@lma/shared';

/**
 * Send success response
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send success response with pagination
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const meta: PaginationMeta = {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    total_pages: totalPages,
    has_next: pagination.page < totalPages,
    has_prev: pagination.page > 1,
  };

  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta,
  };
  return res.status(200).json(response);
}

/**
 * Send created response
 */
export function sendCreated<T>(res: Response, data: T) {
  return sendSuccess(res, data, 201);
}

/**
 * Send no content response
 */
export function sendNoContent(res: Response) {
  return res.status(204).send();
}

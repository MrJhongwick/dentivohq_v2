import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500, public readonly code: string, message: string) {
    super(message);
  }
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return new AppError(400, 'VALIDATION_ERROR', 'The request contains invalid data.');
  if (typeof error === 'object' && error && 'code' in error) {
    const code = String(error.code);
    const constraint = 'constraint' in error ? String(error.constraint) : '';
    if (code === '23505' && constraint === 'clinics_slug_key') return new AppError(409, 'CLINIC_SLUG_TAKEN', 'That clinic URL is already in use. Choose another one.');
    if (code === '23P01' || code === '23505') return new AppError(409, 'APPOINTMENT_CONFLICT', 'The selected appointment time is no longer available.');
    if (code === '42501') return new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
    if (code === 'P0002') return new AppError(404, 'NOT_FOUND', 'The requested resource was not found.');
    if (code === 'P0003') return new AppError(409, 'INVALID_APPOINTMENT_TRANSITION', 'This appointment status change is not allowed.');
    if (code === 'P0004') return new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different request.');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}

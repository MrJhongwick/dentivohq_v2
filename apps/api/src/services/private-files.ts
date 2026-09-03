import { AppError } from '../errors';

export const maximumPrivateFileBytes = 10 * 1024 * 1024;
export const allowedPrivateFileTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export function validatePrivateUpload(file: unknown, contentLength: number) {
  if (contentLength > maximumPrivateFileBytes) throw new AppError(413, 'FILE_TOO_LARGE', 'Files must not exceed 10 MB.');
  if (!(file instanceof File)) throw new AppError(400, 'FILE_REQUIRED', 'A file is required.');
  if (file.size > maximumPrivateFileBytes) throw new AppError(413, 'FILE_TOO_LARGE', 'Files must not exceed 10 MB.');
  if (!allowedPrivateFileTypes.has(file.type)) throw new AppError(415, 'FILE_TYPE_NOT_ALLOWED', 'This file type is not allowed.');
  return file;
}

export function requirePrivateObject<T>(object: T | null): T {
  if (!object) throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
  return object;
}

export function privateFileHeaders(mimeType: string) {
  return { 'Content-Type': mimeType, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'attachment' };
}

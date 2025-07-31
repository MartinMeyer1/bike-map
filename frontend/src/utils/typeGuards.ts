import { Trail, User } from '../types';

/**
 * Type guard utilities for runtime type checking
 */

export function isTrail(obj: unknown): obj is Trail {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Trail).id === 'string' &&
    typeof (obj as Trail).name === 'string' &&
    typeof (obj as Trail).owner === 'string' &&
    Array.isArray((obj as Trail).tags)
  );
}

export function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as User).id === 'string' &&
    typeof (obj as User).email === 'string'
  );
}

export function isApiError(error: unknown): error is { status: number; message: string; data?: unknown } {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { status?: unknown; message?: unknown }).status === 'number' &&
    typeof (error as { status?: unknown; message?: unknown }).message === 'string'
  );
}
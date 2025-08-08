export interface ErrorInfo {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export function handleApiError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const apiError = error as {
      message?: string;
      status?: number;
      data?: { message?: string; data?: Record<string, unknown> };
      name?: string;
    };

    if (apiError.status) {
      switch (apiError.status) {
        case 400:
          return new AppError(
            apiError.data?.message || 'Invalid data. Please check your input and try again.',
            'INVALID_DATA',
            { status: apiError.status }
          );
        case 401:
          return new AppError('Authentication required. Please log in and try again.', 'AUTH_REQUIRED');
        case 403:
          return new AppError('You do not have permission to perform this action.', 'FORBIDDEN');
        case 404:
          return new AppError('The requested resource was not found.', 'NOT_FOUND');
        case 413:
          return new AppError('File too large. Please use a smaller file.', 'FILE_TOO_LARGE');
        case 415:
          return new AppError('Invalid file type. Please upload a valid file.', 'INVALID_FILE_TYPE');
        case 422: {
          const fieldErrors = apiError.data?.data 
            ? Object.entries(apiError.data.data)
                .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
                .join('; ')
            : 'Validation failed';
          return new AppError(`Validation errors: ${fieldErrors}`, 'VALIDATION_ERROR');
        }
        case 500:
          return new AppError('Server error. Please try again later.', 'SERVER_ERROR');
        default:
          return new AppError(
            `Request failed with status ${apiError.status}. Please try again.`,
            'UNKNOWN_API_ERROR',
            { status: apiError.status }
          );
      }
    }

    if (apiError.name === 'NetworkError' || !navigator.onLine) {
      return new AppError('Network error. Please check your connection and try again.', 'NETWORK_ERROR');
    }

    return new AppError(
      apiError.message || 'An unexpected error occurred. Please try again.',
      'UNKNOWN_ERROR'
    );
  }

  return new AppError('An unexpected error occurred. Please try again.', 'UNKNOWN_ERROR');
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred. Please try again.';
}
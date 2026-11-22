export interface HttpStatusDefault {
  code: string
  message: string
}

/**
 * Fallback envelope for statuses the backend answers without a body of its own.
 * The backend codes are reused so both clients speak one vocabulary.
 */
export const HTTP_STATUS_DEFAULTS: Record<number, HttpStatusDefault> = {
  400: { code: 'BAD_REQUEST', message: 'The request was rejected.' },
  401: { code: 'UNAUTHENTICATED', message: 'Sign in is required.' },
  403: { code: 'FORBIDDEN', message: 'This operation is not permitted.' },
  404: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  409: { code: 'CONFLICT', message: 'The request conflicts with the current state.' },
  422: { code: 'VALIDATION_ERROR', message: 'Some request fields are invalid.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  500: { code: 'INTERNAL_ERROR', message: 'The service failed to handle the request.' },
  502: { code: 'BAD_GATEWAY', message: 'The service is unreachable.' },
  503: { code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable.' },
  504: { code: 'GATEWAY_TIMEOUT', message: 'The service did not respond in time.' },
}

export function resolveStatusDefault(status: number): HttpStatusDefault {
  const known = HTTP_STATUS_DEFAULTS[status]
  if (known) return known
  return { code: 'HTTP_ERROR', message: `The request failed with status ${status}.` }
}

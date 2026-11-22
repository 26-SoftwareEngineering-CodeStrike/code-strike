import type { ApiErrorPayload } from '../types'

export type ApiErrorKind =
  | 'http'
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'config'

export interface ApiErrorInit {
  kind: ApiErrorKind
  status?: number | null
  code?: string
  details?: Record<string, unknown> | null
  requestId?: string | null
  reason?: unknown
}

/**
 * The single error type both clients raise. It carries the backend envelope
 * (`{code, message, details?}`) so a screen can render the server's own
 * wording, and the HTTP status so a screen can react to 401/403/404/409/422/503.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: string
  readonly details: Record<string, unknown> | null
  readonly requestId: string | null
  readonly reason: unknown

  constructor(message: string, init: ApiErrorInit) {
    super(message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? 'API_ERROR'
    this.details = init.details ?? null
    this.requestId = init.requestId ?? null
    this.reason = init.reason
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isConflict(): boolean {
    return this.status === 409
  }

  get isValidationError(): boolean {
    return this.status === 422
  }

  get isServiceUnavailable(): boolean {
    return this.status === 503
  }

  get isRetryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.status === 503
  }

  toPayload(): ApiErrorPayload {
    const payload: ApiErrorPayload = { code: this.code, message: this.message }
    if (this.details) payload.details = this.details
    if (this.requestId) payload.requestId = this.requestId
    return payload
  }
}

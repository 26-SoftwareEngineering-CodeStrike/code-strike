import type { ApiRequest, ApiTransport, HttpMethod } from '../transport'
import { ApiError } from './errors'
import { buildRequestHeaders, buildRequestUrl } from './request'
import { resolveStatusDefault } from './status'

export interface TransportAdapterRequest {
  url: string
  method: HttpMethod
  header: Record<string, string>
  data?: unknown
  timeout: number
}

export interface TransportAdapterResponse {
  statusCode: number
  data: unknown
  header?: Record<string, string>
}

/**
 * The platform seam. `uni.request` implements it on the student app and
 * `fetch` implements it on the admin console, so every rule below
 * (token, headers, JSON, status mapping, timeout) stays identical.
 */
export type TransportAdapter = (
  request: TransportAdapterRequest,
) => Promise<TransportAdapterResponse>

export interface HttpTransportOptions {
  baseUrl: string
  adapter: TransportAdapter
  getToken?: () => string | null | undefined
  onUnauthorized?: (error: ApiError) => void
  timeout?: number
  headers?: Record<string, string>
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 15000

export interface ErrorEnvelope {
  code: string
  message: string
  details?: Record<string, unknown>
}

export class HttpTransport implements ApiTransport {
  private readonly options: HttpTransportOptions

  constructor(options: HttpTransportOptions) {
    this.options = options
  }

  async request<T>(request: ApiRequest): Promise<T> {
    const token = this.options.getToken ? this.options.getToken() : null
    if (request.auth === 'required' && !token) {
      throw new ApiError('Sign in is required.', {
        kind: 'unauthorized',
        status: 401,
        code: 'UNAUTHENTICATED',
      })
    }

    const method = request.method ?? 'GET'
    const hasBody = method !== 'GET' && method !== 'DELETE' && request.body !== undefined
    const url = buildRequestUrl(this.options.baseUrl, request.path, request.query)
    const header = buildRequestHeaders({
      token,
      json: hasBody,
      extra: { ...(this.options.headers ?? {}), ...(request.headers ?? {}) },
    })

    let response: TransportAdapterResponse
    try {
      response = await this.options.adapter({
        url,
        method,
        header,
        data: hasBody ? request.body : undefined,
        timeout: request.timeout ?? this.options.timeout ?? DEFAULT_REQUEST_TIMEOUT_MS,
      })
    } catch (reason) {
      throw toTransportError(reason)
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.data as T
    }

    const error = toHttpError(response.statusCode, response.data, response.header)
    if (error.status === 401 && request.auth === 'required' && token && this.options.onUnauthorized) {
      this.options.onUnauthorized(error)
    }
    throw error
  }
}

/** Reads the backend envelope `{code, message, details?}`. */
export function readErrorEnvelope(data: unknown): ErrorEnvelope | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  const code = record.code
  const message = record.message
  if (typeof code !== 'string' || typeof message !== 'string') return null
  const details = record.details
  const envelope: ErrorEnvelope = { code, message }
  if (typeof details === 'object' && details !== null && !Array.isArray(details)) {
    envelope.details = details as Record<string, unknown>
  }
  return envelope
}

export function toHttpError(
  status: number,
  data: unknown,
  headers?: Record<string, string>,
): ApiError {
  const fallback = resolveStatusDefault(status)
  const envelope = readErrorEnvelope(data)
  return new ApiError(envelope?.message ?? fallback.message, {
    kind: 'http',
    status,
    code: envelope?.code ?? fallback.code,
    details: envelope?.details ?? null,
    requestId: readRequestId(headers),
  })
}

/** Maps a transport level failure (no status code) onto an ApiError. */
export function toTransportError(reason: unknown): ApiError {
  if (reason instanceof ApiError) return reason
  const text = readReasonText(reason)
  if (text && /timeout|timed out/i.test(text)) {
    return new ApiError('The request timed out. Check the connection and try again.', {
      kind: 'timeout',
      code: 'TIMEOUT',
      reason,
    })
  }
  return new ApiError('The service is unreachable. Check the connection and try again.', {
    kind: 'network',
    code: 'NETWORK_ERROR',
    reason,
  })
}

function readReasonText(reason: unknown): string | null {
  if (typeof reason === 'string') return reason
  if (typeof reason !== 'object' || reason === null) return null
  const record = reason as Record<string, unknown>
  for (const key of ['errMsg', 'message', 'error']) {
    const value = record[key]
    if (typeof value === 'string' && value) return value
  }
  return null
}

function readRequestId(headers?: Record<string, string>): string | null {
  if (!headers) return null
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'x-request-id') return headers[key]
  }
  return null
}

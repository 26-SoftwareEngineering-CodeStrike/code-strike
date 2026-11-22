export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type QueryValue = string | number | boolean | undefined | null

export interface ApiRequest {
  path: string
  method?: HttpMethod
  body?: unknown
  query?: Record<string, QueryValue>
  headers?: Record<string, string>
  timeout?: number
  /**
   * `required` — the request needs the current session. It is refused locally
   * when no bearer token is available, and a 401 means the session is no
   * longer valid, so the stored token is dropped.
   * `optional` — the request may carry the token, but a 401 answers the
   * request itself and must not end the session of the signed-in student.
   */
  auth?: 'required' | 'optional'
}

export interface ApiTransport {
  request<T>(request: ApiRequest): Promise<T>
}

/** Holds the bearer token between requests. */
export interface TokenStore {
  get(): string | null
  set(token: string): void
  clear(): void
}

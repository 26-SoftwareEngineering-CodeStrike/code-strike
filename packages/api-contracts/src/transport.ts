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
   * `required` rejects the request locally when no bearer token is available,
   * so an unauthenticated call never reaches the server.
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

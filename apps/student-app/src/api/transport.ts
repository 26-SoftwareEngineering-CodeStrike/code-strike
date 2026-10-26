export interface ApiRequest {
  path: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}
export interface ApiTransport { request<T>(request: ApiRequest): Promise<T> }

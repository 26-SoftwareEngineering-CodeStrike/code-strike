import type { ApiRequest, ApiTransport } from './transport'

export class HttpTransport implements ApiTransport {
  constructor(private readonly baseUrl: string) {}
  request<T>(request: ApiRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      uni.request({
        url: `${this.baseUrl}${request.path}`,
        method: request.method ?? 'GET',
        data: request.body as string | AnyObject | ArrayBuffer | undefined,
        success: (response) => {
          if (response.statusCode >= 200 && response.statusCode < 300) { resolve(response.data as T); return }
          reject(new Error(`API request failed with status ${response.statusCode}`))
        },
        fail: reject,
      })
    })
  }
}

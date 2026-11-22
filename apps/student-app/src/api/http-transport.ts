import type { ApiTransport, TokenStore } from '@codestrike/contracts'
import { HttpTransport } from '@codestrike/contracts/http'
import type { ApiError, TransportAdapter, TransportAdapterResponse } from '@codestrike/contracts/http'

export interface StudentHttpTransportOptions {
  baseUrl: string
  timeout?: number
  tokenStore?: TokenStore
  getToken?: () => string | null | undefined
  onUnauthorized?: (error: ApiError) => void
  adapter?: TransportAdapter
}

type UniRequestMethod = NonNullable<UniApp.RequestOptions['method']>

/**
 * Bridges `uni.request` onto the shared transport adapter. The uni method
 * union omits PATCH although XHR and the mini program network stack accept it.
 */
function toUniMethod(method: string): UniRequestMethod {
  return method as UniRequestMethod
}

export function createUniRequestAdapter(): TransportAdapter {
  return (request) =>
    new Promise<TransportAdapterResponse>((resolve, reject) => {
      uni.request({
        url: request.url,
        method: toUniMethod(request.method),
        header: request.header,
        data: request.data as string | AnyObject | ArrayBuffer | undefined,
        timeout: request.timeout,
        success: (response) => {
          resolve({
            statusCode: response.statusCode,
            data: response.data,
            header: response.header as Record<string, string>,
          })
        },
        fail: (error) => reject(error),
      })
    })
}

export function createStudentHttpTransport(options: StudentHttpTransportOptions): ApiTransport {
  const tokenStore = options.tokenStore
  const getToken = options.getToken ?? (tokenStore ? () => tokenStore.get() : () => null)
  return new HttpTransport({
    baseUrl: options.baseUrl,
    adapter: options.adapter ?? createUniRequestAdapter(),
    getToken,
    timeout: options.timeout,
    onUnauthorized:
      options.onUnauthorized ?? (tokenStore ? () => tokenStore.clear() : undefined),
  })
}

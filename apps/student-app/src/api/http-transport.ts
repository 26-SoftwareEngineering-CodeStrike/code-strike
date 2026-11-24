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
 * Bridges `uni.request` onto the shared transport adapter.
 *
 * The uni method union omits PATCH, and the WeChat mini program network API
 * documents the same list, so PATCH is outside the documented set. Whether the
 * mini program actually refuses it has not been tested on a simulator or a
 * device, so the cast below is a plain widening and not a claim that the
 * platform supports the method. `scripts/verify-t9-weixin-compatibility.mjs`
 * reports every method the client sends that is outside the documented set.
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
        ...(request.header.Accept === 'image/png, image/jpeg'
          ? { responseType: 'arraybuffer' as const, dataType: 'other' }
          : {}),
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

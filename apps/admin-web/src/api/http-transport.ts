import type { ApiTransport, TokenStore } from '@codestrike/contracts'
import { HttpTransport } from '@codestrike/contracts/http'
import type { ApiError, TransportAdapter, TransportAdapterResponse } from '@codestrike/contracts/http'
import { parseJsonPayload } from '@codestrike/contracts/http'

export interface AdminHttpTransportOptions {
  baseUrl: string
  timeout?: number
  tokenStore?: TokenStore
  getToken?: () => string | null | undefined
  onUnauthorized?: (error: ApiError) => void
  adapter?: TransportAdapter
}

function readHeaders(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {}
  headers.forEach((value, key) => {
    record[key] = value
  })
  return record
}

export function createFetchAdapter(): TransportAdapter {
  return async (request) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), request.timeout)
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.header,
        body: request.data === undefined ? undefined : JSON.stringify(request.data),
        signal: controller.signal,
      })
      const text = await response.text()
      const data: TransportAdapterResponse['data'] = parseJsonPayload(text)
      return { statusCode: response.status, data, header: readHeaders(response.headers) }
    } catch (reason) {
      if (controller.signal.aborted) {
        throw new Error('request:fail timeout')
      }
      throw reason
    } finally {
      clearTimeout(timer)
    }
  }
}

export function createAdminHttpTransport(options: AdminHttpTransportOptions): ApiTransport {
  const tokenStore = options.tokenStore
  const getToken = options.getToken ?? (tokenStore ? () => tokenStore.get() : () => null)
  return new HttpTransport({
    baseUrl: options.baseUrl,
    adapter: options.adapter ?? createFetchAdapter(),
    getToken,
    timeout: options.timeout,
    onUnauthorized:
      options.onUnauthorized ?? (tokenStore ? () => tokenStore.clear() : undefined),
  })
}

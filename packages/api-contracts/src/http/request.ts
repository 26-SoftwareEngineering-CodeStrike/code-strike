import type { QueryValue } from '../transport'

export function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) return ''
  const parts: string[] = []
  for (const key of Object.keys(query)) {
    const value = query[key]
    if (value === undefined || value === null) continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  return parts.join('&')
}

export function buildRequestUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): string {
  const base = baseUrl.replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  const search = buildQueryString(query)
  return search ? `${base}${suffix}?${search}` : `${base}${suffix}`
}

export function buildRequestHeaders(options: {
  token?: string | null
  json: boolean
  extra?: Record<string, string>
}): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.json) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.extra) {
    for (const key of Object.keys(options.extra)) {
      headers[key] = options.extra[key]
    }
  }
  return headers
}

/** Parses a JSON body, keeping the raw text when the payload is not JSON. */
export function parseJsonPayload(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return text
  }
}

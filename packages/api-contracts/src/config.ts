import { DEFAULT_REQUEST_TIMEOUT_MS } from './http/transport'

export type TransportMode = 'mock' | 'api'

export interface TransportConfig {
  mode: TransportMode
  baseUrl: string
  timeout: number
}

export type EnvRecord = Record<string, string | boolean | undefined>

export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api/v1'

export function readBooleanEnv(value: string | boolean | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  return undefined
}

/**
 * `VITE_USE_MOCK` decides the mode; mock stays the default so the prototype
 * keeps working without a running backend.
 */
export function resolveTransportConfig(env: EnvRecord): TransportConfig {
  const useMock = readBooleanEnv(env.VITE_USE_MOCK)
  const baseUrl =
    typeof env.VITE_API_BASE_URL === 'string' && env.VITE_API_BASE_URL.trim().length > 0
      ? env.VITE_API_BASE_URL.trim()
      : DEFAULT_API_BASE_URL
  return {
    mode: useMock === false ? 'api' : 'mock',
    baseUrl,
    timeout: readPositiveInteger(env.VITE_API_TIMEOUT) ?? DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

export function currentTransportConfig(): TransportConfig {
  return resolveTransportConfig(readRuntimeEnv())
}

function readRuntimeEnv(): EnvRecord {
  // The literal member expression is what the bundler replaces at build time.
  // Reaching the value through an alias leaves it unresolved at runtime.
  const env = import.meta.env
  return {
    VITE_USE_MOCK: env?.VITE_USE_MOCK,
    VITE_API_BASE_URL: env?.VITE_API_BASE_URL,
    VITE_API_TIMEOUT: env?.VITE_API_TIMEOUT,
  }
}

function readPositiveInteger(value: string | boolean | undefined): number | undefined {
  if (typeof value !== 'string') return undefined
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

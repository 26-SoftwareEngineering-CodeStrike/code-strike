import { ApiError } from '@codestrike/contracts/http'

export interface ElementFeedback {
  type: 'success' | 'warning' | 'error' | 'info'
  message: string
}

const TITLES: Record<number, string> = {
  401: 'Sign in required',
  403: 'Not permitted',
  404: 'Not found',
  409: 'Conflict',
  422: 'Check the details',
  503: 'Service unavailable',
}

/**
 * Maps a transport failure onto the Element Plus feedback shown to an
 * administrator. The backend message is kept whenever it exists.
 */
export function toElementFeedback(error: unknown): ElementFeedback {
  if (error instanceof ApiError) {
    if (error.kind === 'timeout') {
      return { type: 'warning', message: `Request timed out. ${error.message}` }
    }
    if (error.kind === 'network') {
      return { type: 'error', message: `Service unreachable. ${error.message}` }
    }
    const title = error.status ? TITLES[error.status] : undefined
    return { type: 'error', message: title ? `${title}. ${error.message}` : error.message }
  }
  return {
    type: 'error',
    message: error instanceof Error ? error.message : 'Unable to load the administration data.',
  }
}

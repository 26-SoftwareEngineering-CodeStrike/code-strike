import { ApiError } from '@codestrike/contracts/http'

export interface StatePanelPresentation {
  title: string
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
 * Maps a transport failure onto the two values `StatePanel` renders. The
 * backend message is kept whenever it exists so the screen explains the cause
 * in the server's own wording.
 */
export function toStatePanel(error: unknown): StatePanelPresentation {
  if (error instanceof ApiError) {
    if (error.kind === 'timeout') {
      return { title: 'Request timed out', message: error.message }
    }
    if (error.kind === 'network') {
      return { title: 'Service unreachable', message: error.message }
    }
    const title = error.status ? TITLES[error.status] : undefined
    return { title: title ?? 'Something went wrong', message: error.message }
  }
  return {
    title: 'Something went wrong',
    message: error instanceof Error ? error.message : 'Unable to load the data.',
  }
}

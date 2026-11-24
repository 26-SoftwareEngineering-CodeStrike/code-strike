import type { TokenStore } from '@codestrike/contracts'

export const ADMIN_TOKEN_KEY = 'codestrike:admin-access-token'

/** The admin console is a browser application, so it keeps the bearer token in localStorage. */
export function createAdminTokenStore(): TokenStore {
  let memory: string | null = null
  let storageAvailable = true
  return {
    get() {
      try {
        if (!storageAvailable || !globalThis.localStorage) return memory
        return globalThis.localStorage.getItem(ADMIN_TOKEN_KEY) || null
      } catch {
        return memory
      }
    },
    set(token) {
      memory = token
      try {
        globalThis.localStorage?.setItem(ADMIN_TOKEN_KEY, token)
      } catch {
        storageAvailable = false
      }
    },
    clear() {
      memory = null
      try {
        globalThis.localStorage?.removeItem(ADMIN_TOKEN_KEY)
      } catch {
        storageAvailable = false
      }
    },
  }
}

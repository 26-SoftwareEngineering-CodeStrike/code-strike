import type { TokenStore } from '@codestrike/contracts'

const ADMIN_TOKEN_KEY = 'codestrike:admin-access-token'

/** The admin console is a browser application, so it keeps the bearer token in localStorage. */
export function createAdminTokenStore(): TokenStore {
  return {
    get() {
      try {
        const value = globalThis.localStorage?.getItem(ADMIN_TOKEN_KEY)
        return value && value.length > 0 ? value : null
      } catch {
        return null
      }
    },
    set(token) {
      try {
        globalThis.localStorage?.setItem(ADMIN_TOKEN_KEY, token)
      } catch {
        // Storage can be blocked by the browser; the token then lives for this session only.
      }
    },
    clear() {
      try {
        globalThis.localStorage?.removeItem(ADMIN_TOKEN_KEY)
      } catch {
        // A failed removal leaves no usable token behind either way.
      }
    },
  }
}

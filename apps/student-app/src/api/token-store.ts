import type { TokenStore } from '@codestrike/contracts'

const ACCESS_TOKEN_KEY = 'codestrike:access-token'

/**
 * The student app keeps the bearer token in uni-app storage, which is
 * localStorage on H5 and the mini program key/value store on mp-weixin.
 */
export function createUniTokenStore(): TokenStore {
  return {
    get() {
      if (typeof uni === 'undefined') return null
      try {
        const value = uni.getStorageSync(ACCESS_TOKEN_KEY)
        return typeof value === 'string' && value.length > 0 ? value : null
      } catch {
        return null
      }
    },
    set(token) {
      if (typeof uni === 'undefined') return
      try {
        uni.setStorageSync(ACCESS_TOKEN_KEY, token)
      } catch {
        // Storage can be unavailable; the token then stays in memory for this session only.
      }
    },
    clear() {
      if (typeof uni === 'undefined') return
      try {
        uni.removeStorageSync(ACCESS_TOKEN_KEY)
      } catch {
        // A failed removal leaves no usable token behind either way.
      }
    },
  }
}

/** One store for the whole app, so every screen reads the same session. */
export const appTokenStore = createUniTokenStore()

import { ref } from 'vue'
import type { TokenDto, UserDto } from '@codestrike/contracts'
import { appTokenStore } from './token-store'

export type SessionStatus = 'anonymous' | 'authenticated'

/**
 * The signed-in student. The raw bearer token is never exposed here: it stays
 * in the platform storage and is only read by the transport when it builds a
 * request, so no screen can render or log it.
 */
export const sessionUser = ref<UserDto | null>(null)
export const sessionStatus = ref<SessionStatus>('anonymous')

export function hasStoredToken(): boolean {
  return appTokenStore.get() !== null
}

export function applySession(token: TokenDto): void {
  appTokenStore.set(token.accessToken)
  sessionUser.value = token.user
  sessionStatus.value = 'authenticated'
}

export function applySessionUser(user: UserDto): void {
  sessionUser.value = user
  sessionStatus.value = 'authenticated'
}

export function clearSession(): void {
  appTokenStore.clear()
  sessionUser.value = null
  sessionStatus.value = 'anonymous'
}

export function isAuthenticated(): boolean {
  return sessionStatus.value === 'authenticated' && sessionUser.value !== null
}

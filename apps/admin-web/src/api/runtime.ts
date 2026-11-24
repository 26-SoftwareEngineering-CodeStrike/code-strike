import { shallowRef } from 'vue'
import type { UserDto } from '@codestrike/contracts'
import { createAdminApiClient } from './client'

export const sessionUser = shallowRef<UserDto | null>(null)
export const api = createAdminApiClient({ onSessionChange: user => { sessionUser.value = user } })
export const live = api.mode === 'api'

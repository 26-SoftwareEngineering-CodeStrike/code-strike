import { onMounted, onScopeDispose, ref, shallowRef } from 'vue'
import { toElementFeedback } from '../api/error-feedback'

export interface ListPage<T> {
  items: T[]
  nextOffset: number | null
}

export function usePage<T>(load: (offset: number) => Promise<ListPage<T>>) {
  const items = shallowRef<T[]>([])
  const offsets = ref([0])
  const nextOffset = ref<number | null>(null)
  const loading = ref(false)
  const error = ref('')
  let generation = 0

  async function refresh() {
    const request = ++generation
    loading.value = true
    error.value = ''
    items.value = []
    nextOffset.value = null
    try {
      const page = await load(offsets.value.at(-1) ?? 0)
      if (request !== generation) return
      if (!page.items.length && offsets.value.length > 1) {
        offsets.value.pop()
        await refresh()
        return
      }
      items.value = page.items
      nextOffset.value = page.nextOffset
    } catch (failure) {
      if (request === generation) error.value = toElementFeedback(failure).message
    } finally {
      if (request === generation) loading.value = false
    }
  }

  function reset() { offsets.value = [0]; return refresh() }
  function next() {
    if (nextOffset.value === null || loading.value) return
    offsets.value.push(nextOffset.value)
    return refresh()
  }
  function previous() {
    if (offsets.value.length === 1 || loading.value) return
    offsets.value.pop()
    return refresh()
  }
  onMounted(refresh)
  onScopeDispose(() => { generation++ })
  return { items, offsets, nextOffset, loading, error, refresh, reset, previous, next }
}

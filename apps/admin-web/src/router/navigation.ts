export function adminReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  const path = value.split(/[?#]/, 1)[0]
  return path === '/' || path === '/competitions' || path === '/moderation' ? value : '/'
}

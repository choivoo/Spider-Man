/**
 * Logging (spec §57): pretty console output in development, structured JSON lines in production.
 * Errors are also beaconed to /api/log (rate-limited, PII-free) so they show up in the host's log stream.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'
const dev = import.meta.env.DEV
const seen = new Map<string, number>()

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  if (dev) {
    ;(console[level === 'debug' ? 'log' : level] as (...a: unknown[]) => void)(`[spider-ai] ${event}`, data ?? '')
    return
  }
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...data, ua: navigator.userAgent.slice(0, 80) })
  ;(console[level === 'debug' ? 'log' : level] as (...a: unknown[]) => void)(line)
  if (level === 'error') {
    const key = event + String(data?.message ?? '')
    const n = (seen.get(key) ?? 0) + 1; seen.set(key, n)
    if (n <= 3) { try { navigator.sendBeacon?.('/api/log', new Blob([line], { type: 'application/json' })) } catch { /* ignore */ } }
  }
}

export const log = {
  debug: (e: string, d?: Record<string, unknown>) => emit('debug', e, d),
  info: (e: string, d?: Record<string, unknown>) => emit('info', e, d),
  warn: (e: string, d?: Record<string, unknown>) => emit('warn', e, d),
  error: (e: string, d?: Record<string, unknown>) => emit('error', e, d),
}

export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => log.error('window.error', { message: e.message, src: e.filename?.split('/').pop(), line: e.lineno }))
  window.addEventListener('unhandledrejection', (e) => log.error('unhandledrejection', { message: String((e.reason as Error)?.message ?? e.reason).slice(0, 200) }))
}

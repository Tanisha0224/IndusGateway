function defaultApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:8000'
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

function normalizeApiBase(value: string | undefined) {
  if (!value) return defaultApiBase()
  if (typeof window === 'undefined') return value
  try {
    const url = new URL(value)
    const browserHost = window.location.hostname
    const configuredLoopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    const browserLoopback = browserHost === 'localhost' || browserHost === '127.0.0.1'
    if (configuredLoopback && browserLoopback) {
      url.hostname = browserHost
      url.protocol = window.location.protocol
      return url.toString().replace(/\/$/, '')
    }
  } catch {
    return value
  }
  return value
}

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL)

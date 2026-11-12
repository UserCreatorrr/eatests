// Cliente HTTP del frontend. Entiende el sobre de error del servidor
// ({ error: { code, message, details } }) y lo convierte en una excepción
// con mensaje legible, para que cada pantalla no repita el mismo parseo.
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details: Record<string, unknown> = {}) {
    super(message)
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { /* respuesta no JSON */ }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    const e = json?.error
    throw new ApiError(res.status, e?.code ?? 'HTTP_' + res.status, e?.message ?? (typeof json?.error === 'string' ? json.error : `Error ${res.status}`), e?.details ?? {})
  }
  return json as T
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  patch: <T = any>(url: string, body?: unknown) => request<T>('PATCH', url, body ?? {}),
  del: <T = any>(url: string, body?: unknown) => request<T>('DELETE', url, body),
}

/** Mensaje de un error cualquiera, para pintarlo en pantalla. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Error inesperado'
}

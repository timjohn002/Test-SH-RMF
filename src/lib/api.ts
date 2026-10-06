export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Fired when an API call reports the session is gone (expired, or the user was deleted). */
export const UNAUTHORIZED_EVENT = 'api:unauthorized'

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  })

  const data = res.headers.get('content-type')?.includes('application/json')
    ? await res.json().catch(() => null)
    : null

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`)
  }
  if (data === null && res.status !== 204) {
    throw new ApiError(res.status, 'The API did not return JSON. Is the app running with `npm run dev`?')
  }
  return data as T
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Dispatched when the API rejects the session. The app listens for this and
 * performs a soft redirect to the login screen, preserving the React tree
 * instead of forcing a full page reload.
 */
export const UNAUTHORIZED_EVENT = 'cplab:unauthorized'

/**
 * Endpoints where a 401 means "these credentials are wrong", not "your
 * session expired". Firing the unauthorized event on a failed sign-in would
 * redirect the user away from the login form — and back to it — with the
 * error message swallowed.
 */
const AUTH_ENTRY_PATHS = new Set(['/auth/login', '/auth/register'])

const request = async (method, path, body) => {
  const options = {
    method,
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
  }
  if (body) options.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, options)

  // Guard against empty responses
  const text = await res.text()
  if (!text) return { success: false, message: 'No response from server' }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { success: false, message: 'Invalid response from server' }
  }

  if (res.status === 401 && !AUTH_ENTRY_PATHS.has(path)) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    return { success: false, message: data?.message || 'Session expired' }
  }

  return data
}

const toQuery = (params = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
  ).toString()
  return qs ? `?${qs}` : ''
}

const client = {
  get:    (path, params) => request('GET',    path + toQuery(params)),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path)         => request('DELETE', path),
}

export default client

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

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

  if (res.status === 401) {
    window.location.href = '/login'
    return
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
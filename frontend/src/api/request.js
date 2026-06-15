import { ElMessage } from 'element-plus'

export const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

export function pathId(value, name = 'id') {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) throw new Error(`${name} 参数无效`)
  return encodeURIComponent(text)
}

function safeDownloadName(filename) {
  const fallback = 'download'
  const value = String(filename || fallback)
    .replace(/[\\/:*?"<>|\r\n]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
  return value || fallback
}

function authHeaders(headers = {}) {
  const token = localStorage.getItem('token')
  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

function normalizeMessage(message, fallback) {
  const value = message || fallback
  return Array.isArray(value) ? value.join('；') : value
}

async function parseJson(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function handleResponse(response, fallbackMessage = '请求失败') {
  const data = await parseJson(response)
  if (!response.ok) {
    const message = normalizeMessage(data?.message || data?.detail, fallbackMessage)
    ElMessage.error(message)
    throw new Error(Array.isArray(data?.message) ? data.message.join('; ') : message)
  }
  return data
}

async function request(path, options = {}) {
  const headers = authHeaders({
    'Content-Type': 'application/json',
    ...(options.headers || {})
  })
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })
  return handleResponse(response)
}

request.get = (path) => request(path)
request.post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })
request.put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) })
request.patch = (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) })
request.delete = (path) => request(path, { method: 'DELETE' })

request.upload = async (path, body) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body
  })
  return handleResponse(response)
}

request.download = async (path, filename) => {
  const response = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!response.ok) {
    let data = null
    try {
      data = await parseJson(response)
    } catch {
      data = null
    }
    const message = normalizeMessage(data?.message || data?.detail, '下载失败')
    ElMessage.error(message)
    throw new Error(Array.isArray(data?.message) ? data.message.join('; ') : message)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeDownloadName(filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default request

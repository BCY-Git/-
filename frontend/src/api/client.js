import { ElMessage } from 'element-plus'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

export async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.message || data?.detail || '请求失败'
    ElMessage.error(Array.isArray(message) ? message.join('；') : message)
    throw new Error(Array.isArray(message) ? message.join('; ') : message)
  }
  return data
}

export const postJson = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) })
export const putJson = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) })
export const patchJson = (path, body) => api(path, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteJson = (path) => api(path, { method: 'DELETE' })

export async function uploadForm(path, body) {
  const token = localStorage.getItem('token')
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.message || data?.detail || '请求失败'
    ElMessage.error(Array.isArray(message) ? message.join('；') : message)
    throw new Error(Array.isArray(message) ? message.join('; ') : message)
  }
  return data
}

export async function downloadFile(path, filename) {
  const token = localStorage.getItem('token')
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE}${path}`, { headers })
  if (!response.ok) {
    const text = await response.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    const message = data?.message || data?.detail || '下载失败'
    ElMessage.error(Array.isArray(message) ? message.join('；') : message)
    throw new Error(Array.isArray(message) ? message.join('; ') : message)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

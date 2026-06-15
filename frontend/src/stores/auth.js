import { defineStore } from 'pinia'
import { authApi } from '../api/auth'

const USER_ROLES = new Set(['user', 'admin', 'super_admin'])

function toSessionUser(user) {
  if (!user || typeof user !== 'object') return null
  const id = Number(user.id)
  const username = typeof user.username === 'string' ? user.username : ''
  const role = typeof user.role === 'string' ? user.role : ''
  if (!Number.isInteger(id) || !username || !USER_ROLES.has(role)) return null
  return {
    id,
    username,
    role,
    display_name: typeof user.display_name === 'string' ? user.display_name : ''
  }
}

function readStoredUser() {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const user = toSessionUser(JSON.parse(localStorage.getItem('user') || 'null'))
    if (user) return user
  } catch {
    // localStorage 可能被手工污染，下面统一清理登录态。
  }
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  return null
}

function readStoredSession() {
  const user = readStoredUser()
  return {
    token: user ? localStorage.getItem('token') : null,
    user
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => readStoredSession(),
  getters: {
    isLoggedIn: (state) => Boolean(state.token && state.user),
    isAdmin: (state) => ['admin', 'super_admin'].includes(state.user?.role),
    isSuperAdmin: (state) => state.user?.role === 'super_admin'
  },
  actions: {
    setSession(token, user) {
      const sessionUser = toSessionUser(user)
      if (typeof token !== 'string' || !token.trim() || !sessionUser) {
        this.logout()
        return
      }
      this.token = token
      this.user = sessionUser
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(sessionUser))
    },
    async login(payload) {
      const data = await authApi.login(payload)
      this.setSession(data.access_token, data.user)
    },
    async refreshMe() {
      if (!this.token) return
      const user = toSessionUser(await authApi.me())
      if (!user) {
        this.logout()
        return
      }
      this.user = user
      localStorage.setItem('user', JSON.stringify(this.user))
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
  }
})

import { defineStore } from 'pinia'
import { api, postJson } from '../api/client'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token'),
    user: JSON.parse(localStorage.getItem('user') || 'null')
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token && state.user),
    isAdmin: (state) => ['admin', 'super_admin'].includes(state.user?.role),
    isSuperAdmin: (state) => state.user?.role === 'super_admin'
  },
  actions: {
    async login(payload) {
      const data = await postJson('/auth/login', payload)
      this.setSession(data.access_token, data.user)
    },
    setSession(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('token', this.token)
      localStorage.setItem('user', JSON.stringify(this.user))
    },
    async refreshMe() {
      if (!this.token) return
      this.user = await api('/auth/me')
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

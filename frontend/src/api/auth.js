import request from './request'

export const authApi = {
  login: (payload) => request.post('/auth/login', payload),
  me: () => request.get('/auth/me'),
  changePassword: (payload) => request.put('/auth/password', payload),
  consumeSsoTicket: (ticket) => request.post('/sso/ticket', { ticket })
}

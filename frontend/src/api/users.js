import request, { pathId } from './request'

export const usersApi = {
  list: () => request.get('/users'),
  create: (payload) => request.post('/users', payload),
  updateRole: (id, payload) => request.put(`/users/${pathId(id, 'userId')}/role`, payload),
  updateActive: (id, payload) => request.patch(`/users/${pathId(id, 'userId')}/active`, payload)
}

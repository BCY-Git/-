import request, { pathId } from './request'

export const suppliersApi = {
  list: () => request.get('/suppliers'),
  create: (payload) => request.post('/suppliers', payload),
  update: (id, payload) => request.put(`/suppliers/${pathId(id, 'supplierId')}`, payload),
  remove: (id) => request.delete(`/suppliers/${pathId(id, 'supplierId')}`)
}

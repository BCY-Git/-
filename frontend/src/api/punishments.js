import request, { pathId } from './request'

export const punishmentsApi = {
  list: () => request.get('/punishments'),
  create: (payload) => request.post('/punishments', payload),
  update: (id, payload) => request.put(`/punishments/${pathId(id, 'punishmentId')}`, payload),
  remove: (id) => request.delete(`/punishments/${pathId(id, 'punishmentId')}`),
  lift: (id) => request.patch(`/punishments/${pathId(id, 'punishmentId')}/lift`, {})
}

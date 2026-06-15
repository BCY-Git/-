import request from './request'

export const notificationsApi = {
  list: () => request.get('/notifications'),
  readAll: () => request.put('/notifications/read-all', {})
}

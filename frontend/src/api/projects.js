import request, { pathId } from './request'

export const projectsApi = {
  list: (filters = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value))
    })
    const query = params.toString()
    return request.get(`/projects${query ? `?${query}` : ''}`)
  },
  mine: () => request.get('/projects/mine'),
  create: (payload) => request.post('/projects', payload),
  uploadRerunRequest: (projectId, body) => request.upload(`/projects/${pathId(projectId, 'projectId')}/rerun-requests`, body),
  rerun: (projectId) => request.post(`/projects/${pathId(projectId, 'projectId')}/rerun`, {}),
  downloadRerunAttachment: (requestId, fileId, filename) =>
    request.download(`/rerun-requests/${pathId(requestId, 'requestId')}/files/${pathId(fileId, 'fileId')}`, filename),
  lotteryRecords: () => request.get('/lottery-records')
}

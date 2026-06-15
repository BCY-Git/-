import request, { API_BASE } from './request'

export { API_BASE }
export const api = request
export const postJson = request.post
export const putJson = request.put
export const patchJson = request.patch
export const deleteJson = request.delete
export const uploadForm = request.upload
export const downloadFile = request.download

import { apiClient } from './client';

export const configApi = {
  getAll() {
    return apiClient.get('/config');
  },

  get(key: string) {
    return apiClient.get(`/config/${key}`);
  },

  set(key: string, value: any, reason?: string) {
    return apiClient.put(`/config/${key}`, { value, reason });
  },

  delete(key: string) {
    return apiClient.delete(`/config/${key}`);
  },

  getHistory(key: string, page = 1, limit = 20) {
    return apiClient.get(`/config/${key}/history`, { params: { page, limit } });
  },

  rollback(key: string, version: number) {
    return apiClient.post(`/config/${key}/rollback`, { version });
  },

  uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/config/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getPublicConfig() {
    return apiClient.get('/config/public/site');
  },
};

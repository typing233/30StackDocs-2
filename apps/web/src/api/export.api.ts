import { apiClient } from './client';

export const exportApi = {
  create(data: { format: string; entityType: string; entityId: string; options?: Record<string, any> }) {
    return apiClient.post('/exports', data);
  },

  list(page = 1, limit = 20) {
    return apiClient.get('/exports', { params: { page, limit } });
  },

  getStatus(id: string) {
    return apiClient.get(`/exports/${id}`);
  },

  download(id: string) {
    return apiClient.get(`/exports/${id}/download`, { responseType: 'blob' });
  },

  cancel(id: string) {
    return apiClient.delete(`/exports/${id}`);
  },
};

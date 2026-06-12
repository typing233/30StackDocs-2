import { apiClient } from './client';

export const searchApi = {
  search(params: { q: string; page?: number; limit?: number; types?: string; bookId?: string }) {
    return apiClient.get('/search', { params });
  },

  reindex() {
    return apiClient.post('/search/reindex');
  },
};

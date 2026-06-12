import { apiClient } from './client';

export const tokensApi = {
  list() {
    return apiClient.get('/tokens');
  },

  create(data: { name: string; scopes: string[]; expiresAt?: string; rateLimit?: number }) {
    return apiClient.post('/tokens', data);
  },

  revoke(id: string) {
    return apiClient.delete(`/tokens/${id}`);
  },
};

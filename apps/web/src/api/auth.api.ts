import client from './client';
import type { AuthTokens } from '@/types';

export const authApi = {
  register(data: { email: string; password: string; name: string; tenantName: string }) {
    return client.post<{ data: AuthTokens }>('/auth/register', data);
  },

  login(data: { email: string; password: string }) {
    return client.post<{ data: AuthTokens }>('/auth/login', data);
  },

  refresh(refreshToken: string) {
    return client.post<{ data: AuthTokens }>('/auth/refresh', { refreshToken });
  },

  logout(refreshToken: string) {
    return client.post('/auth/logout', { refreshToken });
  },
};

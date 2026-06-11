import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const authStore = useAuthStore();
      try {
        await authStore.refreshTokens();
        originalRequest.headers.Authorization = `Bearer ${authStore.accessToken}`;
        return client(originalRequest);
      } catch {
        authStore.logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default client;

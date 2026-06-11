import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth.api';
import type { User } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<User | null>(null);

  const isAuthenticated = computed(() => !!accessToken.value);

  async function login(email: string, password: string) {
    const { data } = await authApi.login({ email, password });
    setTokens(data.data.accessToken, data.data.refreshToken);
  }

  async function register(email: string, password: string, name: string, tenantName: string) {
    const { data } = await authApi.register({ email, password, name, tenantName });
    setTokens(data.data.accessToken, data.data.refreshToken);
  }

  async function refreshTokens() {
    if (!refreshToken.value) throw new Error('No refresh token');
    const { data } = await authApi.refresh(refreshToken.value);
    setTokens(data.data.accessToken, data.data.refreshToken);
  }

  function setTokens(access: string, refresh: string) {
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  function logout() {
    if (refreshToken.value) {
      authApi.logout(refreshToken.value).catch(() => {});
    }
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  return {
    accessToken,
    refreshToken,
    user,
    isAuthenticated,
    login,
    register,
    refreshTokens,
    logout,
  };
});

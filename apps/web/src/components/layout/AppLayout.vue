<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-left">
        <router-link to="/books" class="logo">StackDocs</router-link>
      </div>
      <div class="header-right">
        <span class="user-name">{{ authStore.user?.name || 'User' }}</span>
        <button class="btn-logout" @click="handleLogout">Logout</button>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: #1a1a2e;
  color: #fff;
}
.logo {
  font-size: 1.25rem;
  font-weight: bold;
  color: #fff;
  text-decoration: none;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.user-name {
  font-size: 0.875rem;
}
.btn-logout {
  padding: 0.375rem 0.75rem;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  background: transparent;
  color: #fff;
  cursor: pointer;
}
.btn-logout:hover {
  background: rgba(255,255,255,0.1);
}
.app-main {
  flex: 1;
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}
</style>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-left">
        <router-link to="/books" class="logo">StackDocs</router-link>
        <nav class="main-nav">
          <router-link to="/books">书籍</router-link>
          <router-link to="/search">搜索</router-link>
          <template v-if="isAdmin">
            <router-link to="/admin/config">配置</router-link>
            <router-link to="/admin/permissions">权限</router-link>
            <router-link to="/admin/tokens">令牌</router-link>
          </template>
        </nav>
      </div>
      <div class="header-right">
        <span class="user-name">{{ authStore.user?.name || 'User' }}</span>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>
    </header>
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

const isAdmin = computed(() => authStore.user?.roles?.includes('admin'));

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
.header-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}
.logo {
  font-size: 1.25rem;
  font-weight: bold;
  color: #fff;
  text-decoration: none;
}
.main-nav {
  display: flex;
  gap: 1rem;
}
.main-nav a {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}
.main-nav a:hover,
.main-nav a.router-link-active {
  color: #fff;
  background: rgba(255,255,255,0.1);
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

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/components/layout/AppLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          redirect: '/books',
        },
        {
          path: 'books',
          name: 'books',
          component: () => import('@/views/books/BookListView.vue'),
        },
        {
          path: 'books/:slug',
          name: 'book-detail',
          component: () => import('@/views/books/BookDetailView.vue'),
        },
        {
          path: 'chapters/:id',
          name: 'chapter',
          component: () => import('@/views/chapters/ChapterView.vue'),
        },
        {
          path: 'pages/:slug',
          name: 'page-read',
          component: () => import('@/views/pages/PageReadView.vue'),
        },
        {
          path: 'pages/:slug/edit',
          name: 'page-edit',
          component: () => import('@/views/pages/PageEditView.vue'),
        },
        {
          path: 'pages/:id/history',
          name: 'page-history',
          component: () => import('@/views/pages/PageHistoryView.vue'),
        },
        {
          path: 'search',
          name: 'search',
          component: () => import('@/views/search/SearchView.vue'),
        },
        {
          path: 'admin',
          name: 'admin',
          redirect: '/admin/config',
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/config',
          name: 'admin-config',
          component: () => import('@/views/admin/ConfigView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/permissions',
          name: 'admin-permissions',
          component: () => import('@/views/admin/PermissionsView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/tokens',
          name: 'admin-tokens',
          component: () => import('@/views/admin/TokensView.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { name: 'login' };
  }
  if (to.meta.requiresAdmin && !authStore.user?.roles?.includes('admin')) {
    return { name: 'home' };
  }
});

export default router;

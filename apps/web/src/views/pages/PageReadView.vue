<template>
  <div class="page-read" v-if="pageStore.currentPage">
    <div class="page-header">
      <h1>{{ pageStore.currentPage.name }}</h1>
      <div class="actions">
        <button class="btn" @click="$router.push(`/pages/${pageStore.currentPage!.slug}/edit`)">Edit</button>
        <button class="btn" @click="$router.push(`/pages/${pageStore.currentPage!.id}/history`)">History</button>
      </div>
    </div>
    <div class="page-content" v-html="pageStore.currentPage.contentHtml"></div>
    <div class="page-meta">
      <span>Last updated: {{ formatDate(pageStore.currentPage.updatedAt) }}</span>
      <span v-if="pageStore.currentPage.isDraft" class="draft-badge">Draft</span>
    </div>
  </div>
  <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { usePageStore } from '@/stores/page.store';

const route = useRoute();
const pageStore = usePageStore();

onMounted(() => {
  pageStore.fetchPage(route.params.slug as string);
});

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.page-content {
  line-height: 1.7;
  font-size: 1rem;
}
.page-content :deep(h1) { font-size: 1.75rem; margin: 1.5rem 0 0.75rem; }
.page-content :deep(h2) { font-size: 1.5rem; margin: 1.25rem 0 0.5rem; }
.page-content :deep(h3) { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
.page-content :deep(img) { max-width: 100%; border-radius: 4px; }
.page-content :deep(pre) { background: #f4f4f4; padding: 1rem; border-radius: 4px; overflow-x: auto; }
.page-content :deep(blockquote) { border-left: 3px solid #ddd; padding-left: 1rem; color: #666; }
.page-content :deep(table) { border-collapse: collapse; width: 100%; }
.page-content :deep(td), .page-content :deep(th) { border: 1px solid #ddd; padding: 0.5rem; }
.page-meta {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
  font-size: 0.8125rem;
  color: #666;
  display: flex;
  gap: 1rem;
  align-items: center;
}
.draft-badge {
  font-size: 0.625rem;
  background: #ffc107;
  color: #333;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}
.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}
</style>

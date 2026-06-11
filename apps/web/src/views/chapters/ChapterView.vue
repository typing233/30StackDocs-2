<template>
  <div class="chapter-view" v-if="chapter">
    <div class="page-header">
      <h1>{{ chapter.name }}</h1>
      <button class="btn" @click="$router.back()">← Back</button>
    </div>

    <div class="pages-list">
      <div
        v-for="page in chapter.pages"
        :key="page.id"
        class="page-item"
        @click="$router.push(`/pages/${page.slug}`)"
      >
        <span>📄 {{ page.name }}</span>
        <span v-if="page.isDraft" class="draft-badge">Draft</span>
      </div>
      <div v-if="!chapter.pages?.length" class="empty">
        No pages in this chapter yet.
      </div>
    </div>
  </div>
  <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { chaptersApi } from '@/api/chapters.api';
import type { Chapter } from '@/types';

const route = useRoute();
const chapter = ref<Chapter | null>(null);

onMounted(async () => {
  const { data } = await chaptersApi.getById(route.params.id as string);
  chapter.value = data.data;
});
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.pages-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.page-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
}
.page-item:hover {
  background: #f8f9fa;
}
.draft-badge {
  font-size: 0.625rem;
  background: #ffc107;
  color: #333;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}
.loading, .empty {
  text-align: center;
  padding: 2rem;
  color: #666;
}
</style>

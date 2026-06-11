import { defineStore } from 'pinia';
import { ref } from 'vue';
import { pagesApi } from '@/api/pages.api';
import type { Page, PageRevision } from '@/types';

export const usePageStore = defineStore('page', () => {
  const currentPage = ref<Page | null>(null);
  const revisions = ref<PageRevision[]>([]);
  const loading = ref(false);

  async function fetchPage(slug: string) {
    loading.value = true;
    try {
      const { data } = await pagesApi.getBySlug(slug);
      currentPage.value = data.data;
    } finally {
      loading.value = false;
    }
  }

  async function savePage(id: string, updates: {
    name?: string;
    contentHtml?: string;
    contentMarkdown?: string;
    version: number;
  }) {
    const { data } = await pagesApi.update(id, updates);
    currentPage.value = data.data;
    return data.data;
  }

  async function saveDraft(id: string, content: { contentHtml?: string; contentMarkdown?: string }) {
    await pagesApi.saveDraft(id, content);
  }

  async function fetchRevisions(pageId: string) {
    const { data } = await pagesApi.getRevisions(pageId);
    revisions.value = data.data;
  }

  async function rollback(pageId: string, revisionId: string) {
    const { data } = await pagesApi.rollback(pageId, revisionId);
    currentPage.value = data.data;
    return data.data;
  }

  return {
    currentPage,
    revisions,
    loading,
    fetchPage,
    savePage,
    saveDraft,
    fetchRevisions,
    rollback,
  };
});

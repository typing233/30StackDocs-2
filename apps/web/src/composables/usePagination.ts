import { ref, computed, type Ref } from 'vue';

export function usePagination(fetchFn: (page: number) => Promise<void>, totalPages: Ref<number>) {
  const currentPage = ref(1);
  const loading = ref(false);

  const hasNext = computed(() => currentPage.value < totalPages.value);
  const hasPrev = computed(() => currentPage.value > 1);

  async function goToPage(page: number) {
    if (page < 1 || page > totalPages.value) return;
    loading.value = true;
    currentPage.value = page;
    try {
      await fetchFn(page);
    } finally {
      loading.value = false;
    }
  }

  async function next() {
    if (hasNext.value) await goToPage(currentPage.value + 1);
  }

  async function prev() {
    if (hasPrev.value) await goToPage(currentPage.value - 1);
  }

  return { currentPage, loading, hasNext, hasPrev, goToPage, next, prev };
}

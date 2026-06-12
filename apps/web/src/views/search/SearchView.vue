<template>
  <div class="search-view">
    <header class="search-header">
      <div class="search-box">
        <input
          v-model="query"
          type="text"
          placeholder="搜索页面、书籍..."
          @input="debouncedSearch"
          @keydown.enter="doSearch"
          autofocus
        />
        <button @click="doSearch" :disabled="searching">搜索</button>
      </div>
      <div class="search-filters">
        <label>
          <input type="checkbox" value="page" v-model="typeFilters" @change="doSearch" /> 页面
        </label>
        <label>
          <input type="checkbox" value="book" v-model="typeFilters" @change="doSearch" /> 书籍
        </label>
      </div>
    </header>

    <div v-if="searching" class="loading">搜索中...</div>

    <div v-else-if="results.length > 0" class="results">
      <p class="results-meta">找到 {{ total }} 条结果</p>
      <div v-for="result in results" :key="result.id" class="result-item" @click="navigateTo(result)">
        <div class="result-type">{{ result.type === 'page' ? '页面' : '书籍' }}</div>
        <div class="result-content">
          <h3 v-html="result.highlights[0] || result.title"></h3>
          <p v-if="result.snippet" class="snippet" v-html="result.snippet"></p>
          <div class="result-path" v-if="result.bookName">
            {{ result.bookName }}
            <span v-if="result.chapterName"> / {{ result.chapterName }}</span>
          </div>
        </div>
      </div>

      <div v-if="total > results.length" class="pagination">
        <button :disabled="page <= 1" @click="page--; doSearch()">上一页</button>
        <span>{{ page }} / {{ Math.ceil(total / limit) }}</span>
        <button :disabled="page * limit >= total" @click="page++; doSearch()">下一页</button>
      </div>
    </div>

    <div v-else-if="hasSearched" class="empty">
      未找到匹配的结果
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { searchApi } from '@/api/search.api';

const router = useRouter();
const query = ref('');
const results = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const searching = ref(false);
const hasSearched = ref(false);
const typeFilters = ref<string[]>(['page', 'book']);

let debounceTimer: ReturnType<typeof setTimeout>;

function debouncedSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page.value = 1;
    doSearch();
  }, 300);
}

async function doSearch() {
  if (!query.value.trim()) {
    results.value = [];
    total.value = 0;
    hasSearched.value = false;
    return;
  }

  searching.value = true;
  try {
    const res = await searchApi.search({
      q: query.value,
      page: page.value,
      limit,
      types: typeFilters.value.join(','),
    });
    results.value = res.data.data;
    total.value = res.data.meta.total;
    hasSearched.value = true;
  } catch {
    results.value = [];
  } finally {
    searching.value = false;
  }
}

function navigateTo(result: any) {
  if (result.type === 'page') {
    router.push({ name: 'page-read', params: { slug: result.slug } });
  } else {
    router.push({ name: 'book-detail', params: { slug: result.slug } });
  }
}
</script>

<style scoped>
.search-view { padding: 2rem; max-width: 800px; margin: 0 auto; }

.search-header { margin-bottom: 1.5rem; }
.search-box { display: flex; gap: 0.5rem; }
.search-box input { flex: 1; padding: 0.75rem 1rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 1rem; outline: none; transition: border-color 0.2s; }
.search-box input:focus { border-color: #2563eb; }
.search-box button { padding: 0.75rem 1.5rem; background: #2563eb; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
.search-box button:disabled { opacity: 0.6; }

.search-filters { display: flex; gap: 1rem; margin-top: 0.75rem; }
.search-filters label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #6b7280; cursor: pointer; }

.loading { text-align: center; padding: 2rem; color: #6b7280; }
.empty { text-align: center; padding: 3rem; color: #9ca3af; }

.results-meta { font-size: 0.85rem; color: #6b7280; margin-bottom: 1rem; }

.result-item { padding: 1rem 1.25rem; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; transition: background 0.15s, border-color 0.15s; display: flex; gap: 1rem; }
.result-item:hover { background: #f9fafb; border-color: #2563eb; }

.result-type { font-size: 0.7rem; text-transform: uppercase; font-weight: 600; color: #6b7280; background: #f3f4f6; padding: 0.2rem 0.5rem; border-radius: 3px; align-self: flex-start; margin-top: 0.2rem; }

.result-content { flex: 1; }
.result-content h3 { margin: 0; font-size: 1rem; font-weight: 600; }
.result-content h3 :deep(mark) { background: #fef08a; padding: 0 2px; border-radius: 2px; }
.snippet { margin: 0.4rem 0; font-size: 0.85rem; color: #4b5563; line-height: 1.5; }
.snippet :deep(mark) { background: #fef08a; padding: 0 2px; border-radius: 2px; }
.result-path { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1.5rem; }
.pagination button { padding: 0.4rem 1rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.pagination button:disabled { opacity: 0.4; cursor: default; }
</style>

<template>
  <div class="book-detail" v-if="bookStore.currentBook">
    <div class="page-header">
      <div>
        <h1>{{ bookStore.currentBook.name }}</h1>
        <p class="description">{{ bookStore.currentBook.description }}</p>
      </div>
      <div class="actions">
        <button class="btn" @click="showAddChapter = true">+ Chapter</button>
        <button class="btn" @click="showAddPage = true">+ Page</button>
      </div>
    </div>

    <div class="content-tree">
      <div
        v-for="chapter in bookStore.currentBook.chapters"
        :key="chapter.id"
        class="chapter-item"
      >
        <div class="chapter-header" @click="$router.push(`/chapters/${chapter.id}`)">
          <span class="icon">📁</span>
          <span>{{ chapter.name }}</span>
        </div>
        <div class="chapter-pages" v-if="chapter.pages?.length">
          <div
            v-for="page in chapter.pages"
            :key="page.id"
            class="page-item"
            @click="$router.push(`/pages/${page.slug}`)"
          >
            <span class="icon">📄</span>
            <span>{{ page.name }}</span>
            <span v-if="page.isDraft" class="draft-badge">Draft</span>
          </div>
        </div>
      </div>

      <div v-if="bookStore.currentBook.directPages?.length" class="direct-pages">
        <h3>Pages</h3>
        <div
          v-for="page in bookStore.currentBook.directPages"
          :key="page.id"
          class="page-item"
          @click="$router.push(`/pages/${page.slug}`)"
        >
          <span class="icon">📄</span>
          <span>{{ page.name }}</span>
          <span v-if="page.isDraft" class="draft-badge">Draft</span>
        </div>
      </div>
    </div>

    <!-- Add Chapter Modal -->
    <div v-if="showAddChapter" class="modal-overlay" @click.self="showAddChapter = false">
      <div class="modal">
        <h2>Add Chapter</h2>
        <form @submit.prevent="handleAddChapter">
          <div class="form-group">
            <label>Chapter Name</label>
            <input v-model="chapterName" required />
          </div>
          <div class="modal-actions">
            <button type="button" @click="showAddChapter = false">Cancel</button>
            <button type="submit" class="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Add Page Modal -->
    <div v-if="showAddPage" class="modal-overlay" @click.self="showAddPage = false">
      <div class="modal">
        <h2>Add Page</h2>
        <form @submit.prevent="handleAddPage">
          <div class="form-group">
            <label>Page Name</label>
            <input v-model="pageName" required />
          </div>
          <div class="modal-actions">
            <button type="button" @click="showAddPage = false">Cancel</button>
            <button type="submit" class="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  </div>
  <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBookStore } from '@/stores/book.store';
import { chaptersApi } from '@/api/chapters.api';
import { pagesApi } from '@/api/pages.api';

const route = useRoute();
const router = useRouter();
const bookStore = useBookStore();

const showAddChapter = ref(false);
const showAddPage = ref(false);
const chapterName = ref('');
const pageName = ref('');

onMounted(() => {
  bookStore.fetchBook(route.params.slug as string);
});

async function handleAddChapter() {
  if (!bookStore.currentBook) return;
  await chaptersApi.create(bookStore.currentBook.id, { name: chapterName.value });
  showAddChapter.value = false;
  chapterName.value = '';
  bookStore.fetchBook(route.params.slug as string);
}

async function handleAddPage() {
  if (!bookStore.currentBook) return;
  const { data } = await pagesApi.create({
    name: pageName.value,
    bookId: bookStore.currentBook.id,
  });
  showAddPage.value = false;
  pageName.value = '';
  router.push(`/pages/${data.data.slug}/edit`);
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}
.description {
  color: #666;
  margin-top: 0.5rem;
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
  font-size: 0.8125rem;
}
.btn-primary {
  padding: 0.5rem 1rem;
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.content-tree {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.chapter-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
}
.chapter-header {
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}
.chapter-header:hover {
  background: #e9ecef;
}
.chapter-pages {
  padding: 0.25rem 0;
}
.page-item {
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.page-item:hover {
  background: #f0f0f0;
}
.icon {
  font-size: 0.875rem;
}
.draft-badge {
  font-size: 0.625rem;
  background: #ffc107;
  color: #333;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  margin-left: auto;
}
.direct-pages {
  margin-top: 1rem;
}
.direct-pages h3 {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}
.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}
.modal {
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
}
.modal h2 {
  margin-bottom: 1rem;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}
.form-group input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>

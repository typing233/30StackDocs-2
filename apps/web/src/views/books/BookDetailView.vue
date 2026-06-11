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

    <!-- Chapters with drag-and-drop reorder -->
    <div class="content-tree">
      <div
        v-for="(chapter, idx) in chapters"
        :key="chapter.id"
        class="chapter-item"
        :class="{ 'drag-over': dragOverIndex === idx }"
        draggable="true"
        @dragstart="onChapterDragStart(idx)"
        @dragover.prevent="onChapterDragOver(idx)"
        @dragleave="onChapterDragLeave"
        @drop="onChapterDrop(idx)"
        @dragend="onChapterDragEnd"
      >
        <div class="chapter-header">
          <span class="drag-handle" title="Drag to reorder">⠿</span>
          <span class="icon">📁</span>
          <span class="chapter-name" @click="$router.push(`/chapters/${chapter.id}`)">{{ chapter.name }}</span>
        </div>
        <div class="chapter-pages" v-if="chapter.pages?.length">
          <div
            v-for="page in chapter.pages"
            :key="page.id"
            class="page-item"
          >
            <span class="icon" @click="$router.push(`/pages/${page.slug}`)">📄</span>
            <span class="page-name" @click="$router.push(`/pages/${page.slug}`)">{{ page.name }}</span>
            <span v-if="page.isDraft" class="draft-badge">Draft</span>
            <button class="btn-move" @click="openMovePage(page)" title="Move to another chapter">↔</button>
          </div>
        </div>
      </div>

      <div v-if="bookStore.currentBook.directPages?.length" class="direct-pages">
        <h3>Pages (no chapter)</h3>
        <div
          v-for="page in bookStore.currentBook.directPages"
          :key="page.id"
          class="page-item"
        >
          <span class="icon" @click="$router.push(`/pages/${page.slug}`)">📄</span>
          <span class="page-name" @click="$router.push(`/pages/${page.slug}`)">{{ page.name }}</span>
          <span v-if="page.isDraft" class="draft-badge">Draft</span>
          <button class="btn-move" @click="openMovePage(page)" title="Move to a chapter">↔</button>
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
          <div class="form-group">
            <label>In Chapter (optional)</label>
            <select v-model="pageChapterId">
              <option value="">No chapter (direct page)</option>
              <option v-for="ch in chapters" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showAddPage = false">Cancel</button>
            <button type="submit" class="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Move Page Modal -->
    <div v-if="showMovePage" class="modal-overlay" @click.self="showMovePage = false">
      <div class="modal">
        <h2>Move Page: {{ moveTargetPage?.name }}</h2>
        <div class="form-group">
          <label>Move to chapter</label>
          <select v-model="moveTargetChapterId">
            <option value="">No chapter (direct page)</option>
            <option v-for="ch in chapters" :key="ch.id" :value="ch.id">{{ ch.name }}</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" @click="showMovePage = false">Cancel</button>
          <button class="btn-primary" @click="handleMovePage">Move</button>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBookStore } from '@/stores/book.store';
import { chaptersApi } from '@/api/chapters.api';
import { pagesApi } from '@/api/pages.api';
import type { Chapter, Page } from '@/types';

const route = useRoute();
const router = useRouter();
const bookStore = useBookStore();

const showAddChapter = ref(false);
const showAddPage = ref(false);
const showMovePage = ref(false);
const chapterName = ref('');
const pageName = ref('');
const pageChapterId = ref('');

// Drag-and-drop state
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

// Move page state
const moveTargetPage = ref<Page | null>(null);
const moveTargetChapterId = ref('');

const chapters = computed(() => {
  return bookStore.currentBook?.chapters
    ? [...bookStore.currentBook.chapters].sort((a, b) => a.priority - b.priority)
    : [];
});

onMounted(() => {
  bookStore.fetchBook(route.params.slug as string);
});

// --- Chapter drag-and-drop reorder ---
function onChapterDragStart(idx: number) {
  dragIndex.value = idx;
}

function onChapterDragOver(idx: number) {
  dragOverIndex.value = idx;
}

function onChapterDragLeave() {
  dragOverIndex.value = null;
}

function onChapterDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}

async function onChapterDrop(targetIdx: number) {
  dragOverIndex.value = null;
  if (dragIndex.value === null || dragIndex.value === targetIdx) return;
  if (!bookStore.currentBook) return;

  const reordered = [...chapters.value];
  const [moved] = reordered.splice(dragIndex.value, 1);
  reordered.splice(targetIdx, 0, moved);
  dragIndex.value = null;

  const orderedIds = reordered.map((ch) => ch.id);
  await chaptersApi.reorder(bookStore.currentBook.id, orderedIds);
  bookStore.fetchBook(route.params.slug as string);
}

// --- Page move ---
function openMovePage(page: Page) {
  moveTargetPage.value = page;
  moveTargetChapterId.value = page.chapterId || '';
  showMovePage.value = true;
}

async function handleMovePage() {
  if (!moveTargetPage.value || !bookStore.currentBook) return;

  await pagesApi.move(moveTargetPage.value.id, {
    targetChapterId: moveTargetChapterId.value || undefined,
    targetBookId: moveTargetChapterId.value ? undefined : bookStore.currentBook.id,
    priority: moveTargetPage.value.priority,
  });

  showMovePage.value = false;
  moveTargetPage.value = null;
  bookStore.fetchBook(route.params.slug as string);
}

// --- Add chapter/page ---
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
    chapterId: pageChapterId.value || undefined,
  });
  showAddPage.value = false;
  pageName.value = '';
  pageChapterId.value = '';
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
  transition: border-color 0.15s;
}
.chapter-item.drag-over {
  border-color: #2196f3;
  background: #e3f2fd;
}
.chapter-header {
  padding: 0.75rem 1rem;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}
.chapter-header:hover {
  background: #e9ecef;
}
.drag-handle {
  cursor: grab;
  color: #999;
  font-size: 1.125rem;
  user-select: none;
}
.drag-handle:active {
  cursor: grabbing;
}
.chapter-name {
  cursor: pointer;
  flex: 1;
}
.chapter-pages {
  padding: 0.25rem 0;
}
.page-item {
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.page-item:hover {
  background: #f0f0f0;
}
.page-name {
  cursor: pointer;
  flex: 1;
}
.icon {
  font-size: 0.875rem;
  cursor: pointer;
}
.draft-badge {
  font-size: 0.625rem;
  background: #ffc107;
  color: #333;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}
.btn-move {
  padding: 0.125rem 0.375rem;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 0.75rem;
  color: #666;
}
.btn-move:hover {
  background: #e9ecef;
  color: #333;
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
.form-group input,
.form-group select {
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

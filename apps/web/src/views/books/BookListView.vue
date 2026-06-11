<template>
  <div class="book-list">
    <div class="page-header">
      <h1>Books</h1>
      <button class="btn-primary" @click="showCreateModal = true">+ New Book</button>
    </div>

    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search books..."
        @input="debouncedSearch"
      />
    </div>

    <div v-if="bookStore.loading" class="loading">Loading...</div>

    <div v-else class="books-grid">
      <div
        v-for="book in bookStore.books"
        :key="book.id"
        class="book-card"
        @click="$router.push(`/books/${book.slug}`)"
      >
        <h3>{{ book.name }}</h3>
        <p>{{ book.description || 'No description' }}</p>
        <span class="book-date">{{ formatDate(book.updatedAt) }}</span>
      </div>
    </div>

    <div v-if="!bookStore.loading && bookStore.books.length === 0" class="empty">
      No books found. Create your first book to get started.
    </div>

    <div v-if="bookStore.total > 20" class="pagination">
      <button :disabled="page <= 1" @click="changePage(page - 1)">Prev</button>
      <span>Page {{ page }}</span>
      <button :disabled="page * 20 >= bookStore.total" @click="changePage(page + 1)">Next</button>
    </div>

    <!-- Create modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h2>Create Book</h2>
        <form @submit.prevent="handleCreate">
          <div class="form-group">
            <label>Name</label>
            <input v-model="newBook.name" required />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="newBook.description" rows="3"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showCreateModal = false">Cancel</button>
            <button type="submit" class="btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBookStore } from '@/stores/book.store';

const bookStore = useBookStore();
const page = ref(1);
const searchQuery = ref('');
const showCreateModal = ref(false);
const newBook = ref({ name: '', description: '' });
let searchTimer: ReturnType<typeof setTimeout>;

onMounted(() => {
  bookStore.fetchBooks();
});

function debouncedSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    bookStore.fetchBooks({ search: searchQuery.value });
  }, 300);
}

function changePage(p: number) {
  page.value = p;
  bookStore.fetchBooks({ page: p, search: searchQuery.value });
}

async function handleCreate() {
  await bookStore.createBook(newBook.value.name, newBook.value.description);
  showCreateModal.value = false;
  newBook.value = { name: '', description: '' };
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.search-bar {
  margin-bottom: 1.5rem;
}
.search-bar input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}
.book-card {
  padding: 1.25rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}
.book-card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.book-card h3 {
  margin-bottom: 0.5rem;
}
.book-card p {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}
.book-date {
  font-size: 0.75rem;
  color: #999;
}
.btn-primary {
  padding: 0.5rem 1rem;
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.loading, .empty {
  text-align: center;
  padding: 3rem;
  color: #666;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}
.pagination button {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  max-width: 480px;
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
  font-weight: 500;
}
.form-group input,
.form-group textarea {
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

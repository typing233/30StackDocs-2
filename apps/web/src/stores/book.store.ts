import { defineStore } from 'pinia';
import { ref } from 'vue';
import { booksApi } from '@/api/books.api';
import type { Book } from '@/types';

export const useBookStore = defineStore('book', () => {
  const books = ref<Book[]>([]);
  const currentBook = ref<Book | null>(null);
  const total = ref(0);
  const loading = ref(false);

  async function fetchBooks(params?: { page?: number; search?: string }) {
    loading.value = true;
    try {
      const { data } = await booksApi.list(params);
      books.value = data.data;
      total.value = data.meta.total;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBook(slug: string) {
    loading.value = true;
    try {
      const { data } = await booksApi.getBySlug(slug);
      currentBook.value = data.data;
    } finally {
      loading.value = false;
    }
  }

  async function createBook(name: string, description?: string) {
    const { data } = await booksApi.create({ name, description });
    books.value.unshift(data.data);
    return data.data;
  }

  async function updateBook(id: string, updates: { name?: string; description?: string; version: number }) {
    const { data } = await booksApi.update(id, updates);
    const idx = books.value.findIndex((b) => b.id === id);
    if (idx !== -1) books.value[idx] = data.data;
    if (currentBook.value?.id === id) currentBook.value = data.data;
    return data.data;
  }

  async function deleteBook(id: string) {
    await booksApi.remove(id);
    books.value = books.value.filter((b) => b.id !== id);
  }

  return {
    books,
    currentBook,
    total,
    loading,
    fetchBooks,
    fetchBook,
    createBook,
    updateBook,
    deleteBook,
  };
});

import client from './client';
import type { Book, PaginatedResult } from '@/types';

export const booksApi = {
  list(params?: { page?: number; limit?: number; search?: string }) {
    return client.get<PaginatedResult<Book>>('/books', { params });
  },

  getBySlug(slug: string) {
    return client.get<{ data: Book }>(`/books/${slug}`);
  },

  create(data: { name: string; description?: string }) {
    return client.post<{ data: Book }>('/books', data);
  },

  update(id: string, data: { name?: string; description?: string; version: number }) {
    return client.put<{ data: Book }>(`/books/${id}`, data);
  },

  remove(id: string) {
    return client.delete(`/books/${id}`);
  },

  restore(id: string) {
    return client.post(`/books/${id}/restore`);
  },
};

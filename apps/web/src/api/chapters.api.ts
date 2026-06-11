import client from './client';
import type { Chapter } from '@/types';

export const chaptersApi = {
  listByBook(bookId: string) {
    return client.get<{ data: Chapter[] }>(`/books/${bookId}/chapters`);
  },

  getById(id: string) {
    return client.get<{ data: Chapter }>(`/chapters/${id}`);
  },

  create(bookId: string, data: { name: string }) {
    return client.post<{ data: Chapter }>(`/books/${bookId}/chapters`, data);
  },

  update(id: string, data: { name?: string; version: number }) {
    return client.put<{ data: Chapter }>(`/chapters/${id}`, data);
  },

  reorder(bookId: string, orderedIds: string[]) {
    return client.put(`/books/${bookId}/chapters/reorder`, { orderedIds });
  },

  remove(id: string) {
    return client.delete(`/chapters/${id}`);
  },

  restore(id: string) {
    return client.post(`/chapters/${id}/restore`);
  },
};

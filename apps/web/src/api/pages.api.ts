import client from './client';
import type { Page, PageRevision } from '@/types';

export const pagesApi = {
  getBySlug(slug: string) {
    return client.get<{ data: Page }>(`/pages/${slug}`);
  },

  create(data: {
    name: string;
    bookId: string;
    chapterId?: string;
    contentHtml?: string;
    contentMarkdown?: string;
  }) {
    return client.post<{ data: Page }>('/pages', data);
  },

  update(id: string, data: {
    name?: string;
    contentHtml?: string;
    contentMarkdown?: string;
    version: number;
  }) {
    return client.put<{ data: Page }>(`/pages/${id}`, data);
  },

  saveDraft(id: string, data: { contentHtml?: string; contentMarkdown?: string }) {
    return client.patch(`/pages/${id}/draft`, data);
  },

  move(id: string, data: { targetChapterId?: string; targetBookId?: string; priority: number }) {
    return client.put(`/pages/${id}/move`, data);
  },

  getRevisions(pageId: string) {
    return client.get<{ data: PageRevision[] }>(`/pages/${pageId}/revisions`);
  },

  getRevision(pageId: string, revisionId: string) {
    return client.get<{ data: PageRevision }>(`/pages/${pageId}/revisions/${revisionId}`);
  },

  getDiff(pageId: string, from: number, to: number) {
    return client.get(`/pages/${pageId}/diff`, { params: { from, to } });
  },

  rollback(pageId: string, revisionId: string) {
    return client.post<{ data: Page }>(`/pages/${pageId}/rollback/${revisionId}`);
  },

  remove(id: string) {
    return client.delete(`/pages/${id}`);
  },

  restore(id: string) {
    return client.post(`/pages/${id}/restore`);
  },
};

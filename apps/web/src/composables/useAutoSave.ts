import { ref, type Ref } from 'vue';
import { pagesApi } from '@/api/pages.api';

export function useAutoSave(pageId: Ref<string>, getContent: () => { contentHtml?: string; contentMarkdown?: string }) {
  const DEBOUNCE_MS = 3000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const lastSaved = ref<Date | null>(null);
  const isSaving = ref(false);
  const error = ref<string | null>(null);

  function debouncedSave() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      isSaving.value = true;
      error.value = null;
      try {
        const content = getContent();
        await pagesApi.saveDraft(pageId.value, content);
        lastSaved.value = new Date();
        localStorage.setItem(`draft-${pageId.value}`, JSON.stringify(content));
      } catch (e) {
        error.value = 'Auto-save failed, draft preserved locally';
        const content = getContent();
        localStorage.setItem(`draft-${pageId.value}`, JSON.stringify(content));
      } finally {
        isSaving.value = false;
      }
    }, DEBOUNCE_MS);
  }

  function clearDraft() {
    localStorage.removeItem(`draft-${pageId.value}`);
  }

  function destroy() {
    if (timer) clearTimeout(timer);
  }

  return { debouncedSave, lastSaved, isSaving, error, clearDraft, destroy };
}

import { ref, watch, type Ref } from 'vue';
import { pagesApi } from '@/api/pages.api';

/**
 * Auto-save composable. Uses pageSlug as localStorage key (available immediately from route).
 * Waits for pageId to be non-empty before making API calls.
 */
export function useAutoSave(
  pageId: Ref<string>,
  pageSlug: Ref<string>,
  getContent: () => { contentHtml?: string; contentMarkdown?: string },
) {
  const DEBOUNCE_MS = 3000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const lastSaved = ref<Date | null>(null);
  const isSaving = ref(false);
  const error = ref<string | null>(null);

  function debouncedSave() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const id = pageId.value;
      const slug = pageSlug.value;
      if (!id || !slug) return;

      isSaving.value = true;
      error.value = null;
      try {
        const content = getContent();
        await pagesApi.saveDraft(id, content);
        lastSaved.value = new Date();
        localStorage.setItem(`draft-${slug}`, JSON.stringify(content));
      } catch (e) {
        error.value = 'Auto-save failed, draft preserved locally';
        const content = getContent();
        localStorage.setItem(`draft-${slug}`, JSON.stringify(content));
      } finally {
        isSaving.value = false;
      }
    }, DEBOUNCE_MS);
  }

  function clearDraft() {
    const slug = pageSlug.value;
    if (slug) {
      localStorage.removeItem(`draft-${slug}`);
    }
  }

  function destroy() {
    if (timer) clearTimeout(timer);
  }

  return { debouncedSave, lastSaved, isSaving, error, clearDraft, destroy };
}

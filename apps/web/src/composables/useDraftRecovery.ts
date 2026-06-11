import { ref, watch, type Ref } from 'vue';

/**
 * Draft recovery composable.
 * Uses pageSlug (available immediately from route params) as the localStorage key.
 * Watches the slug and triggers check once it has a value.
 */
export function useDraftRecovery(pageSlug: Ref<string>) {
  const hasDraft = ref(false);
  const draftContent = ref<{ contentHtml?: string; contentMarkdown?: string } | null>(null);

  function checkForDraft(slug: string) {
    if (!slug) return;
    const key = `draft-${slug}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        draftContent.value = JSON.parse(saved);
        hasDraft.value = true;
      } catch {
        localStorage.removeItem(key);
      }
    }
  }

  // Check immediately if slug already has a value, otherwise watch for it
  watch(pageSlug, (slug) => {
    if (slug && !hasDraft.value) {
      checkForDraft(slug);
    }
  }, { immediate: true });

  function acceptDraft() {
    hasDraft.value = false;
    return draftContent.value;
  }

  function discardDraft() {
    const slug = pageSlug.value;
    if (slug) {
      localStorage.removeItem(`draft-${slug}`);
    }
    hasDraft.value = false;
    draftContent.value = null;
  }

  return { hasDraft, draftContent, acceptDraft, discardDraft };
}

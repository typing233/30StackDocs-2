import { ref, onMounted, type Ref } from 'vue';

export function useDraftRecovery(pageId: Ref<string>) {
  const hasDraft = ref(false);
  const draftContent = ref<{ contentHtml?: string; contentMarkdown?: string } | null>(null);

  onMounted(() => {
    const key = `draft-${pageId.value}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        draftContent.value = JSON.parse(saved);
        hasDraft.value = true;
      } catch {
        localStorage.removeItem(key);
      }
    }
  });

  function acceptDraft() {
    hasDraft.value = false;
    return draftContent.value;
  }

  function discardDraft() {
    localStorage.removeItem(`draft-${pageId.value}`);
    hasDraft.value = false;
    draftContent.value = null;
  }

  return { hasDraft, draftContent, acceptDraft, discardDraft };
}

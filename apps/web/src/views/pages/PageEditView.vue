<template>
  <div class="page-edit" v-if="pageStore.currentPage">
    <!-- Draft recovery banner -->
    <div v-if="hasDraft" class="draft-banner">
      <span>A local draft was found for this page. Restore it?</span>
      <button @click="restoreDraft">Restore</button>
      <button @click="discardDraft">Discard</button>
    </div>

    <div class="edit-header">
      <input
        v-model="pageName"
        class="title-input"
        placeholder="Page title..."
      />
      <div class="edit-actions">
        <span v-if="autoSave.isSaving.value" class="save-status">Saving...</span>
        <span v-else-if="autoSave.lastSaved.value" class="save-status">
          Saved {{ formatTime(autoSave.lastSaved.value) }}
        </span>
        <span v-if="autoSave.error.value" class="save-error">{{ autoSave.error.value }}</span>
        <button class="btn" @click="$router.back()">Cancel</button>
        <button class="btn-primary" @click="handleSave" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>

    <TiptapEditor
      v-model="content"
      placeholder="Start writing your page content..."
      @update:modelValue="onContentChange"
    />
  </div>
  <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePageStore } from '@/stores/page.store';
import { useAutoSave } from '@/composables/useAutoSave';
import { useDraftRecovery } from '@/composables/useDraftRecovery';
import TiptapEditor from '@/components/editor/TiptapEditor.vue';

const route = useRoute();
const router = useRouter();
const pageStore = usePageStore();

const pageName = ref('');
const content = ref('');
const saving = ref(false);

// Use slug from route params — always available immediately, no async dependency
const pageSlug = computed(() => route.params.slug as string);
const pageId = computed(() => pageStore.currentPage?.id || '');

const autoSave = useAutoSave(pageId, pageSlug, () => ({
  contentHtml: content.value,
}));

// Draft recovery keyed by slug so it works before page data loads
const { hasDraft, acceptDraft, discardDraft } = useDraftRecovery(pageSlug);

onMounted(async () => {
  await pageStore.fetchPage(pageSlug.value);
  if (pageStore.currentPage) {
    pageName.value = pageStore.currentPage.name;
    // Only load server content if no local draft is pending
    if (!hasDraft.value) {
      content.value = pageStore.currentPage.contentHtml || '';
    }
  }
});

onBeforeUnmount(() => {
  autoSave.destroy();
});

function onContentChange() {
  autoSave.debouncedSave();
}

function restoreDraft() {
  const draft = acceptDraft();
  if (draft?.contentHtml) {
    content.value = draft.contentHtml;
  }
}

async function handleSave() {
  if (!pageStore.currentPage) return;
  saving.value = true;
  try {
    await pageStore.savePage(pageStore.currentPage.id, {
      name: pageName.value,
      contentHtml: content.value,
      version: pageStore.currentPage.version,
    });
    autoSave.clearDraft();
    router.push(`/pages/${pageStore.currentPage.slug}`);
  } catch (e: any) {
    if (e.response?.status === 409) {
      alert('Conflict: this page was modified by another user. Please reload and try again.');
    }
  } finally {
    saving.value = false;
  }
}

function formatTime(d: Date) {
  return d.toLocaleTimeString();
}
</script>

<style scoped>
.draft-banner {
  padding: 0.75rem 1rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
}
.draft-banner button {
  padding: 0.25rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 0.75rem;
}
.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}
.title-input {
  flex: 1;
  padding: 0.5rem 0;
  border: none;
  border-bottom: 2px solid #e0e0e0;
  font-size: 1.5rem;
  font-weight: 600;
  outline: none;
}
.title-input:focus {
  border-bottom-color: #1a1a2e;
}
.edit-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.save-status {
  font-size: 0.75rem;
  color: #666;
}
.save-error {
  font-size: 0.75rem;
  color: #dc3545;
}
.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.btn-primary {
  padding: 0.375rem 0.75rem;
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.btn-primary:disabled {
  opacity: 0.6;
}
.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}
</style>

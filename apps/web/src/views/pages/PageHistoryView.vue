<template>
  <div class="page-history">
    <div class="page-header">
      <h1>Version History</h1>
      <button class="btn" @click="$router.back()">← Back</button>
    </div>

    <div class="revisions-list" v-if="revisions.length">
      <div
        v-for="rev in revisions"
        :key="rev.id"
        class="revision-item"
        :class="{ selected: selectedRevisions.includes(rev.id) }"
        @click="toggleRevision(rev)"
      >
        <div class="revision-info">
          <span class="version">v{{ rev.versionNumber }}</span>
          <span class="date">{{ formatDate(rev.createdAt) }}</span>
          <span v-if="rev.summary" class="summary">{{ rev.summary }}</span>
        </div>
        <div class="revision-actions">
          <button class="btn-small" @click.stop="handleRollback(rev.id)">Rollback</button>
        </div>
      </div>
    </div>
    <div v-else class="empty">No revision history yet.</div>

    <div v-if="showDiff" class="diff-section">
      <h2>Comparing v{{ diffFrom }} → v{{ diffTo }}</h2>
      <DiffViewer
        :from="diffFrom"
        :to="diffTo"
        :old-content="diffOldContent"
        :new-content="diffNewContent"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { pagesApi } from '@/api/pages.api';
import { usePageStore } from '@/stores/page.store';
import DiffViewer from '@/components/editor/DiffViewer.vue';
import type { PageRevision } from '@/types';

const route = useRoute();
const pageStore = usePageStore();
const pageId = route.params.id as string;

const revisions = ref<PageRevision[]>([]);
const selectedRevisions = ref<string[]>([]);
const showDiff = ref(false);
const diffFrom = ref(0);
const diffTo = ref(0);
const diffOldContent = ref('');
const diffNewContent = ref('');

onMounted(async () => {
  await pageStore.fetchRevisions(pageId);
  revisions.value = pageStore.revisions;
});

function toggleRevision(rev: PageRevision) {
  const idx = selectedRevisions.value.indexOf(rev.id);
  if (idx >= 0) {
    selectedRevisions.value.splice(idx, 1);
  } else {
    selectedRevisions.value.push(rev.id);
    if (selectedRevisions.value.length > 2) {
      selectedRevisions.value.shift();
    }
  }

  if (selectedRevisions.value.length === 2) {
    compareTwoRevisions();
  } else {
    showDiff.value = false;
  }
}

async function compareTwoRevisions() {
  const rev1 = revisions.value.find((r) => r.id === selectedRevisions.value[0])!;
  const rev2 = revisions.value.find((r) => r.id === selectedRevisions.value[1])!;
  const from = Math.min(rev1.versionNumber, rev2.versionNumber);
  const to = Math.max(rev1.versionNumber, rev2.versionNumber);

  const { data } = await pagesApi.getDiff(pageId, from, to);
  diffFrom.value = from;
  diffTo.value = to;
  diffOldContent.value = (data as any).data.from.contentMarkdown || '';
  diffNewContent.value = (data as any).data.to.contentMarkdown || '';
  showDiff.value = true;
}

async function handleRollback(revisionId: string) {
  if (!confirm('Are you sure you want to rollback to this version?')) return;
  await pageStore.rollback(pageId, revisionId);
  await pageStore.fetchRevisions(pageId);
  revisions.value = pageStore.revisions;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString();
}
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}
.btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.revisions-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 2rem;
}
.revision-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
}
.revision-item:hover {
  background: #f8f9fa;
}
.revision-item.selected {
  background: #e3f2fd;
  border-color: #2196f3;
}
.revision-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.version {
  font-weight: 700;
  font-size: 0.875rem;
}
.date {
  font-size: 0.8125rem;
  color: #666;
}
.summary {
  font-size: 0.8125rem;
  color: #999;
  font-style: italic;
}
.btn-small {
  padding: 0.25rem 0.5rem;
  border: 1px solid #dc3545;
  border-radius: 3px;
  background: #fff;
  color: #dc3545;
  cursor: pointer;
  font-size: 0.75rem;
}
.btn-small:hover {
  background: #dc3545;
  color: #fff;
}
.diff-section {
  margin-top: 2rem;
}
.diff-section h2 {
  margin-bottom: 1rem;
  font-size: 1.125rem;
}
.empty {
  text-align: center;
  padding: 2rem;
  color: #666;
}
</style>

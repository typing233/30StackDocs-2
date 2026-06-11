<template>
  <div class="diff-viewer">
    <div class="diff-header">
      <span>Version {{ from }} → Version {{ to }}</span>
    </div>
    <div class="diff-content">
      <div
        v-for="(part, i) in diffParts"
        :key="i"
        :class="{
          'diff-added': part.added,
          'diff-removed': part.removed,
          'diff-unchanged': !part.added && !part.removed,
        }"
      >
        <pre>{{ part.value }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { diffLines } from 'diff';

const props = defineProps<{
  from: number;
  to: number;
  oldContent: string;
  newContent: string;
}>();

const diffParts = computed(() => {
  return diffLines(props.oldContent || '', props.newContent || '');
});
</script>

<style scoped>
.diff-viewer {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}
.diff-header {
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
  font-size: 0.875rem;
}
.diff-content {
  font-family: monospace;
  font-size: 0.8125rem;
  overflow-x: auto;
}
.diff-content pre {
  margin: 0;
  padding: 0.125rem 1rem;
  white-space: pre-wrap;
}
.diff-added {
  background: #d4edda;
}
.diff-removed {
  background: #f8d7da;
}
.diff-unchanged {
  background: #fff;
}
</style>

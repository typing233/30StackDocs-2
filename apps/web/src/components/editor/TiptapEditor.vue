<template>
  <div class="tiptap-editor">
    <EditorToolbar :editor="editor" />
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import EditorToolbar from './EditorToolbar.vue';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Underline,
    Link.configure({ openOnClick: false }),
    Image,
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Placeholder.configure({ placeholder: props.placeholder || 'Start writing...' }),
  ],
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML());
  },
});

watch(() => props.modelValue, (newVal) => {
  if (editor.value && editor.value.getHTML() !== newVal) {
    editor.value.commands.setContent(newVal, false);
  }
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});

defineExpose({ editor });
</script>

<style scoped>
.tiptap-editor {
  border: 1px solid #ddd;
  border-radius: 4px;
}
.editor-content {
  min-height: 400px;
  padding: 1rem;
}
.editor-content :deep(.tiptap) {
  outline: none;
  min-height: 380px;
}
.editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  color: #adb5bd;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
.editor-content :deep(.tiptap table) {
  border-collapse: collapse;
  width: 100%;
}
.editor-content :deep(.tiptap td),
.editor-content :deep(.tiptap th) {
  border: 1px solid #ddd;
  padding: 0.5rem;
}
.editor-content :deep(.tiptap blockquote) {
  border-left: 3px solid #ddd;
  padding-left: 1rem;
  color: #666;
}
.editor-content :deep(.tiptap pre) {
  background: #f4f4f4;
  padding: 0.75rem;
  border-radius: 4px;
  overflow-x: auto;
}
</style>

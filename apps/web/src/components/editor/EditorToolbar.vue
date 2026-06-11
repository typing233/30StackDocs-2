<template>
  <div class="editor-toolbar" v-if="editor">
    <button @click="editor.chain().focus().toggleBold().run()" :class="{ active: editor.isActive('bold') }">B</button>
    <button @click="editor.chain().focus().toggleItalic().run()" :class="{ active: editor.isActive('italic') }">I</button>
    <button @click="editor.chain().focus().toggleUnderline().run()" :class="{ active: editor.isActive('underline') }">U</button>
    <button @click="editor.chain().focus().toggleStrike().run()" :class="{ active: editor.isActive('strike') }">S</button>
    <span class="separator">|</span>
    <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ active: editor.isActive('heading', { level: 1 }) }">H1</button>
    <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ active: editor.isActive('heading', { level: 2 }) }">H2</button>
    <button @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ active: editor.isActive('heading', { level: 3 }) }">H3</button>
    <span class="separator">|</span>
    <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ active: editor.isActive('bulletList') }">UL</button>
    <button @click="editor.chain().focus().toggleOrderedList().run()" :class="{ active: editor.isActive('orderedList') }">OL</button>
    <button @click="editor.chain().focus().toggleTaskList().run()" :class="{ active: editor.isActive('taskList') }">Task</button>
    <span class="separator">|</span>
    <button @click="editor.chain().focus().toggleBlockquote().run()" :class="{ active: editor.isActive('blockquote') }">Quote</button>
    <button @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ active: editor.isActive('codeBlock') }">Code</button>
    <button @click="editor.chain().focus().setHorizontalRule().run()">HR</button>
    <span class="separator">|</span>
    <button @click="insertLink">Link</button>
    <button @click="insertImage">Image</button>
    <button @click="editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()">Table</button>
    <span class="separator">|</span>
    <button @click="editor.chain().focus().undo().run()">Undo</button>
    <button @click="editor.chain().focus().redo().run()">Redo</button>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3';

const props = defineProps<{ editor: Editor | undefined }>();

function insertLink() {
  if (!props.editor) return;
  const url = window.prompt('Enter URL:');
  if (url) {
    props.editor.chain().focus().setLink({ href: url }).run();
  }
}

function insertImage() {
  if (!props.editor) return;
  const url = window.prompt('Enter image URL:');
  if (url) {
    props.editor.chain().focus().setImage({ src: url }).run();
  }
}
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: #f8f9fa;
}
.editor-toolbar button {
  padding: 0.25rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}
.editor-toolbar button:hover {
  background: #e9ecef;
}
.editor-toolbar button.active {
  background: #dee2e6;
  border-color: #adb5bd;
}
.separator {
  color: #ccc;
  margin: 0 0.25rem;
  line-height: 1.75rem;
}
</style>

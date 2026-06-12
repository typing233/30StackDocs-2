<template>
  <div class="config-view">
    <header class="view-header">
      <h1>系统配置</h1>
      <p class="subtitle">管理站点设置、注册选项与外观配置</p>
    </header>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="config-sections">
      <!-- Site Settings -->
      <section class="config-section">
        <h2>站点设置</h2>
        <div class="config-grid">
          <div class="config-item">
            <label>站点名称</label>
            <input v-model="configs['site.name']" type="text" @change="updateConfig('site.name')" />
          </div>
          <div class="config-item">
            <label>站点语言</label>
            <select v-model="configs['site.language']" @change="updateConfig('site.language')">
              <option value="zh-CN">中文</option>
              <option value="en">English</option>
            </select>
          </div>
          <div class="config-item">
            <label>站点主题</label>
            <select v-model="configs['site.theme']" @change="updateConfig('site.theme')">
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="auto">跟随系统</option>
            </select>
          </div>
          <div class="config-item">
            <label>Logo</label>
            <div class="logo-upload">
              <img v-if="configs['site.logo']" :src="configs['site.logo']" class="logo-preview" alt="Logo" />
              <input type="file" accept="image/*" @change="uploadLogo" />
            </div>
          </div>
        </div>
      </section>

      <!-- Access Settings -->
      <section class="config-section">
        <h2>访问控制</h2>
        <div class="config-grid">
          <div class="config-item toggle">
            <label>公开站点</label>
            <p class="hint">允许未登录用户浏览内容</p>
            <input type="checkbox" v-model="configs['site.public']" @change="updateConfig('site.public')" />
          </div>
          <div class="config-item toggle">
            <label>开放注册</label>
            <p class="hint">允许新用户自行注册账号</p>
            <input type="checkbox" v-model="configs['site.registration.enabled']" @change="updateConfig('site.registration.enabled')" />
          </div>
          <div class="config-item">
            <label>默认角色</label>
            <select v-model="configs['site.registration.defaultRole']" @change="updateConfig('site.registration.defaultRole')">
              <option value="viewer">查看者</option>
              <option value="editor">编辑者</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Security Settings -->
      <section class="config-section">
        <h2>安全设置</h2>
        <div class="config-grid">
          <div class="config-item">
            <label>会话超时 (秒)</label>
            <input v-model.number="configs['auth.sessionTimeout']" type="number" min="300" @change="updateConfig('auth.sessionTimeout')" />
          </div>
          <div class="config-item">
            <label>最大登录尝试次数</label>
            <input v-model.number="configs['auth.maxLoginAttempts']" type="number" min="3" @change="updateConfig('auth.maxLoginAttempts')" />
          </div>
        </div>
      </section>

      <!-- Export & Search Settings -->
      <section class="config-section">
        <h2>导出与搜索</h2>
        <div class="config-grid">
          <div class="config-item">
            <label>最大并发导出数</label>
            <input v-model.number="configs['export.maxConcurrent']" type="number" min="1" max="10" @change="updateConfig('export.maxConcurrent')" />
          </div>
          <div class="config-item toggle">
            <label>启用搜索</label>
            <input type="checkbox" v-model="configs['search.enabled']" @change="updateConfig('search.enabled')" />
          </div>
          <div class="config-item">
            <label>最小搜索字符数</label>
            <input v-model.number="configs['search.minQueryLength']" type="number" min="1" max="5" @change="updateConfig('search.minQueryLength')" />
          </div>
        </div>
      </section>

      <!-- Config History -->
      <section class="config-section">
        <h2>变更历史</h2>
        <div class="history-selector">
          <select v-model="selectedHistoryKey" @change="loadHistory">
            <option value="">选择配置项查看历史</option>
            <option v-for="key in Object.keys(configs)" :key="key" :value="key">{{ key }}</option>
          </select>
        </div>
        <div v-if="history.length > 0" class="history-list">
          <div v-for="entry in history" :key="entry.id" class="history-item">
            <div class="history-meta">
              <span class="version">v{{ entry.version }}</span>
              <span class="time">{{ new Date(entry.createdAt).toLocaleString() }}</span>
              <span v-if="entry.changeReason" class="reason">{{ entry.changeReason }}</span>
            </div>
            <div class="history-value">
              <code>{{ JSON.stringify(entry.value) }}</code>
            </div>
            <button class="btn-rollback" @click="rollbackTo(entry)">回滚</button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="message" class="toast" :class="messageType">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { configApi } from '@/api/config.api';

const loading = ref(true);
const configs = ref<Record<string, any>>({});
const selectedHistoryKey = ref('');
const history = ref<any[]>([]);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

onMounted(async () => {
  try {
    const res = await configApi.getAll();
    configs.value = res.data.data;
  } catch (e: any) {
    showMessage('加载配置失败', 'error');
  } finally {
    loading.value = false;
  }
});

async function updateConfig(key: string) {
  try {
    await configApi.set(key, configs.value[key]);
    showMessage(`${key} 已更新`, 'success');
  } catch (e: any) {
    showMessage(`更新失败: ${e.message}`, 'error');
  }
}

async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const res = await configApi.uploadLogo(file);
    configs.value['site.logo'] = res.data.data.url;
    showMessage('Logo 已上传', 'success');
  } catch (e: any) {
    showMessage('上传失败', 'error');
  }
}

async function loadHistory() {
  if (!selectedHistoryKey.value) {
    history.value = [];
    return;
  }
  try {
    const res = await configApi.getHistory(selectedHistoryKey.value);
    history.value = res.data.data;
  } catch {
    history.value = [];
  }
}

async function rollbackTo(entry: any) {
  if (!confirm(`确认回滚 ${selectedHistoryKey.value} 到版本 ${entry.version}?`)) return;
  try {
    await configApi.rollback(selectedHistoryKey.value, entry.version);
    configs.value[selectedHistoryKey.value] = entry.value;
    showMessage('回滚成功', 'success');
    await loadHistory();
  } catch (e: any) {
    showMessage('回滚失败', 'error');
  }
}

function showMessage(msg: string, type: 'success' | 'error') {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => { message.value = ''; }, 3000);
}
</script>

<style scoped>
.config-view { padding: 2rem; max-width: 960px; margin: 0 auto; }
.view-header h1 { margin: 0; font-size: 1.5rem; }
.subtitle { color: #666; margin-top: 0.25rem; }
.loading { text-align: center; padding: 2rem; color: #666; }

.config-section { margin: 2rem 0; padding: 1.5rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
.config-section h2 { font-size: 1.1rem; margin: 0 0 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #f0f0f0; }

.config-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
.config-item { display: flex; flex-direction: column; gap: 0.25rem; }
.config-item label { font-weight: 500; font-size: 0.875rem; color: #374151; }
.config-item .hint { font-size: 0.75rem; color: #9ca3af; margin: 0; }
.config-item input[type="text"],
.config-item input[type="number"],
.config-item select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.875rem; }
.config-item.toggle { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.config-item.toggle input[type="checkbox"] { width: 1.25rem; height: 1.25rem; }

.logo-upload { display: flex; align-items: center; gap: 1rem; }
.logo-preview { width: 48px; height: 48px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; }

.history-selector { margin-bottom: 1rem; }
.history-selector select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; min-width: 200px; }
.history-list { display: flex; flex-direction: column; gap: 0.75rem; }
.history-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: #f9fafb; border-radius: 4px; }
.history-meta { display: flex; gap: 0.75rem; font-size: 0.8rem; color: #6b7280; }
.version { font-weight: 600; color: #2563eb; }
.history-value { flex: 1; }
.history-value code { font-size: 0.75rem; background: #e5e7eb; padding: 0.2rem 0.5rem; border-radius: 3px; }
.btn-rollback { padding: 0.25rem 0.75rem; font-size: 0.75rem; background: #f59e0b; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.btn-rollback:hover { background: #d97706; }

.toast { position: fixed; bottom: 2rem; right: 2rem; padding: 0.75rem 1.5rem; border-radius: 6px; font-size: 0.875rem; z-index: 1000; }
.toast.success { background: #10b981; color: #fff; }
.toast.error { background: #ef4444; color: #fff; }
</style>

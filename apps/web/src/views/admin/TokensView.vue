<template>
  <div class="tokens-view">
    <header class="view-header">
      <h1>API令牌管理</h1>
      <button class="btn-primary" @click="showCreate = true">创建令牌</button>
    </header>

    <div class="tokens-list">
      <div v-if="tokens.length === 0" class="empty">暂无API令牌</div>
      <div v-for="token in tokens" :key="token.id" class="token-card">
        <div class="token-info">
          <h3>{{ token.name }}</h3>
          <div class="token-meta">
            <span class="prefix">{{ token.tokenPrefix }}...</span>
            <span class="scopes">{{ token.scopes.join(', ') }}</span>
            <span v-if="token.expiresAt" class="expires">过期: {{ new Date(token.expiresAt).toLocaleDateString() }}</span>
            <span v-if="token.lastUsedAt" class="used">最后使用: {{ new Date(token.lastUsedAt).toLocaleString() }}</span>
          </div>
        </div>
        <div class="token-actions">
          <span v-if="token.revokedAt" class="badge revoked">已撤销</span>
          <button v-else class="btn-sm btn-danger" @click="revokeToken(token.id)">撤销</button>
        </div>
      </div>
    </div>

    <!-- New token revealed -->
    <div v-if="createdToken" class="created-token">
      <p><strong>新令牌已创建！请立即复制，此令牌不会再次显示。</strong></p>
      <div class="token-display">
        <code>{{ createdToken }}</code>
        <button @click="copyToken">复制</button>
      </div>
      <button class="btn-secondary" @click="createdToken = ''">知道了</button>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h3>创建API令牌</h3>
        <div class="form-group">
          <label>名称</label>
          <input v-model="form.name" type="text" placeholder="我的应用" />
        </div>
        <div class="form-group">
          <label>作用域</label>
          <div class="scope-checkboxes">
            <label v-for="scope in availableScopes" :key="scope">
              <input type="checkbox" :value="scope" v-model="form.scopes" />
              {{ scope }}
            </label>
          </div>
        </div>
        <div class="form-group">
          <label>速率限制 (每分钟请求数)</label>
          <input v-model.number="form.rateLimit" type="number" min="1" max="1000" />
        </div>
        <div class="form-group">
          <label>过期日期 (可选)</label>
          <input v-model="form.expiresAt" type="date" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showCreate = false">取消</button>
          <button class="btn-primary" @click="createToken">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { tokensApi } from '@/api/tokens.api';

const tokens = ref<any[]>([]);
const showCreate = ref(false);
const createdToken = ref('');

const availableScopes = [
  'books:read', 'books:write',
  'chapters:read', 'chapters:write',
  'pages:read', 'pages:write',
  'export', 'search', 'admin',
];

const form = ref({
  name: '',
  scopes: [] as string[],
  rateLimit: 60,
  expiresAt: '',
});

onMounted(async () => {
  await loadTokens();
});

async function loadTokens() {
  const res = await tokensApi.list();
  tokens.value = res.data.data;
}

async function createToken() {
  const res = await tokensApi.create({
    name: form.value.name,
    scopes: form.value.scopes,
    rateLimit: form.value.rateLimit,
    expiresAt: form.value.expiresAt || undefined,
  });
  createdToken.value = res.data.data.token;
  showCreate.value = false;
  form.value = { name: '', scopes: [], rateLimit: 60, expiresAt: '' };
  await loadTokens();
}

async function revokeToken(id: string) {
  if (!confirm('确认撤销此令牌? 撤销后将无法恢复。')) return;
  await tokensApi.revoke(id);
  await loadTokens();
}

function copyToken() {
  navigator.clipboard.writeText(createdToken.value);
}
</script>

<style scoped>
.tokens-view { padding: 2rem; max-width: 900px; margin: 0 auto; }
.view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.view-header h1 { margin: 0; font-size: 1.5rem; }

.empty { text-align: center; color: #9ca3af; padding: 3rem; }
.token-card { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.75rem; }
.token-info h3 { margin: 0; font-size: 1rem; }
.token-meta { display: flex; gap: 1rem; margin-top: 0.25rem; font-size: 0.8rem; color: #6b7280; }
.prefix { font-family: monospace; background: #f3f4f6; padding: 0.1rem 0.4rem; border-radius: 3px; }

.created-token { margin: 1.5rem 0; padding: 1.5rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; }
.created-token p { margin: 0 0 0.75rem; color: #92400e; }
.token-display { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
.token-display code { flex: 1; padding: 0.5rem; background: #fff; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.8rem; word-break: break-all; }
.token-display button { padding: 0.5rem 1rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; }

.badge.revoked { background: #fee2e2; color: #991b1b; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; }

.scope-checkboxes { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.5rem; }
.scope-checkboxes label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }

.btn-primary { padding: 0.5rem 1rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary { padding: 0.5rem 1rem; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; }
.btn-danger { color: #dc2626; border-color: #fca5a5; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; padding: 2rem; border-radius: 12px; width: 90%; max-width: 520px; }
.modal h3 { margin: 0 0 1.5rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500; }
.form-group input[type="text"],
.form-group input[type="number"],
.form-group input[type="date"] { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }
</style>

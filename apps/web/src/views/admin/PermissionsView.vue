<template>
  <div class="permissions-view">
    <header class="view-header">
      <h1>权限管理</h1>
      <div class="tabs">
        <button :class="{ active: tab === 'roles' }" @click="tab = 'roles'">角色</button>
        <button :class="{ active: tab === 'policies' }" @click="tab = 'policies'">ABAC策略</button>
      </div>
    </header>

    <!-- Roles Tab -->
    <section v-if="tab === 'roles'" class="section">
      <div class="section-header">
        <h2>角色列表</h2>
        <button class="btn-primary" @click="showNewRole = true">创建角色</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>描述</th>
              <th>系统角色</th>
              <th>权限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role.id">
              <td><strong>{{ role.name }}</strong></td>
              <td>{{ role.description || '-' }}</td>
              <td>{{ role.isSystem ? '是' : '否' }}</td>
              <td><code>{{ (role.permissions || []).join(', ') }}</code></td>
              <td>
                <button v-if="!role.isSystem" class="btn-sm btn-danger" @click="deleteRole(role.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- New Role Modal -->
      <div v-if="showNewRole" class="modal-overlay" @click.self="showNewRole = false">
        <div class="modal">
          <h3>创建角色</h3>
          <div class="form-group">
            <label>名称</label>
            <input v-model="newRole.name" type="text" placeholder="角色名称" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <input v-model="newRole.description" type="text" placeholder="角色描述" />
          </div>
          <div class="form-group">
            <label>权限 (逗号分隔)</label>
            <input v-model="newRole.permissionsStr" type="text" placeholder="view, edit, create" />
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" @click="showNewRole = false">取消</button>
            <button class="btn-primary" @click="createRole">创建</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ABAC Policies Tab -->
    <section v-if="tab === 'policies'" class="section">
      <div class="section-header">
        <h2>ABAC策略</h2>
        <button class="btn-primary" @click="showNewPolicy = true">创建策略</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>实体类型</th>
              <th>操作</th>
              <th>效果</th>
              <th>优先级</th>
              <th>状态</th>
              <th>管理</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="policy in policies" :key="policy.id">
              <td><strong>{{ policy.name }}</strong></td>
              <td>{{ policy.entityType }}</td>
              <td>{{ policy.action }}</td>
              <td><span :class="['badge', policy.effect]">{{ policy.effect }}</span></td>
              <td>{{ policy.priority }}</td>
              <td>{{ policy.enabled ? '启用' : '禁用' }}</td>
              <td>
                <button class="btn-sm" @click="togglePolicy(policy)">{{ policy.enabled ? '禁用' : '启用' }}</button>
                <button class="btn-sm btn-danger" @click="deletePolicy(policy.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- New Policy Modal -->
      <div v-if="showNewPolicy" class="modal-overlay" @click.self="showNewPolicy = false">
        <div class="modal">
          <h3>创建ABAC策略</h3>
          <div class="form-group">
            <label>名称</label>
            <input v-model="newPolicy.name" type="text" />
          </div>
          <div class="form-group">
            <label>实体类型</label>
            <select v-model="newPolicy.entityType">
              <option value="book">Book</option>
              <option value="chapter">Chapter</option>
              <option value="page">Page</option>
            </select>
          </div>
          <div class="form-group">
            <label>操作</label>
            <select v-model="newPolicy.action">
              <option value="view">View</option>
              <option value="edit">Edit</option>
              <option value="delete">Delete</option>
              <option value="create">Create</option>
            </select>
          </div>
          <div class="form-group">
            <label>效果</label>
            <select v-model="newPolicy.effect">
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </div>
          <div class="form-group">
            <label>优先级</label>
            <input v-model.number="newPolicy.priority" type="number" min="0" />
          </div>
          <div class="form-group">
            <label>条件 (JSON)</label>
            <textarea v-model="newPolicy.conditionsStr" rows="4" placeholder='{"user.roles": {"$in": ["editor"]}}'></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" @click="showNewPolicy = false">取消</button>
            <button class="btn-primary" @click="createPolicy">创建</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { permissionsApi } from '@/api/permissions.api';

const tab = ref<'roles' | 'policies'>('roles');
const roles = ref<any[]>([]);
const policies = ref<any[]>([]);
const showNewRole = ref(false);
const showNewPolicy = ref(false);

const newRole = ref({ name: '', description: '', permissionsStr: '' });
const newPolicy = ref({ name: '', entityType: 'page', action: 'view', effect: 'allow', priority: 0, conditionsStr: '{}' });

onMounted(async () => {
  await Promise.all([loadRoles(), loadPolicies()]);
});

async function loadRoles() {
  const res = await permissionsApi.listRoles();
  roles.value = res.data.data;
}

async function loadPolicies() {
  const res = await permissionsApi.listPolicies();
  policies.value = res.data.data;
}

async function createRole() {
  await permissionsApi.createRole({
    name: newRole.value.name,
    description: newRole.value.description,
    permissions: newRole.value.permissionsStr.split(',').map((s: string) => s.trim()).filter(Boolean),
  });
  showNewRole.value = false;
  newRole.value = { name: '', description: '', permissionsStr: '' };
  await loadRoles();
}

async function deleteRole(id: string) {
  if (!confirm('确认删除此角色?')) return;
  await permissionsApi.deleteRole(id);
  await loadRoles();
}

async function createPolicy() {
  let conditions: Record<string, any>;
  try {
    conditions = JSON.parse(newPolicy.value.conditionsStr);
  } catch {
    alert('条件JSON格式错误');
    return;
  }
  await permissionsApi.createPolicy({
    name: newPolicy.value.name,
    entityType: newPolicy.value.entityType,
    action: newPolicy.value.action,
    effect: newPolicy.value.effect,
    priority: newPolicy.value.priority,
    conditions,
  });
  showNewPolicy.value = false;
  newPolicy.value = { name: '', entityType: 'page', action: 'view', effect: 'allow', priority: 0, conditionsStr: '{}' };
  await loadPolicies();
}

async function togglePolicy(policy: any) {
  await permissionsApi.updatePolicy(policy.id, { enabled: !policy.enabled });
  await loadPolicies();
}

async function deletePolicy(id: string) {
  if (!confirm('确认删除此策略?')) return;
  await permissionsApi.deletePolicy(id);
  await loadPolicies();
}
</script>

<style scoped>
.permissions-view { padding: 2rem; max-width: 1100px; margin: 0 auto; }
.view-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.view-header h1 { margin: 0; font-size: 1.5rem; }
.tabs { display: flex; gap: 0.5rem; }
.tabs button { padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.875rem; }
.tabs button.active { background: #2563eb; color: #fff; border-color: #2563eb; }

.section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.section-header h2 { margin: 0; font-size: 1.1rem; }

.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #f0f0f0; }
th { font-weight: 600; color: #6b7280; font-size: 0.8rem; text-transform: uppercase; }

.badge { padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.75rem; font-weight: 500; }
.badge.allow { background: #d1fae5; color: #065f46; }
.badge.deny { background: #fee2e2; color: #991b1b; }

.btn-primary { padding: 0.5rem 1rem; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
.btn-primary:hover { background: #1d4ed8; }
.btn-secondary { padding: 0.5rem 1rem; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; margin-right: 0.25rem; }
.btn-danger { color: #dc2626; border-color: #fca5a5; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; padding: 2rem; border-radius: 12px; width: 90%; max-width: 480px; }
.modal h3 { margin: 0 0 1.5rem; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; font-weight: 500; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.875rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }
</style>

import { apiClient } from './client';

export const permissionsApi = {
  listRoles() {
    return apiClient.get('/permissions/roles');
  },

  createRole(data: { name: string; description?: string; permissions?: string[] }) {
    return apiClient.post('/permissions/roles', data);
  },

  updateRole(id: string, data: { name?: string; description?: string; permissions?: string[] }) {
    return apiClient.put(`/permissions/roles/${id}`, data);
  },

  deleteRole(id: string) {
    return apiClient.delete(`/permissions/roles/${id}`);
  },

  grantPermission(data: {
    entityType: string;
    entityId: string;
    action: string;
    userId?: string;
    roleId?: string;
    effect?: string;
    priority?: number;
  }) {
    return apiClient.post('/permissions/entity', data);
  },

  getEntityPermissions(entityType: string, entityId: string) {
    return apiClient.get(`/permissions/entity/${entityType}/${entityId}`);
  },

  revokePermission(id: string) {
    return apiClient.delete(`/permissions/entity/${id}`);
  },

  listPolicies() {
    return apiClient.get('/permissions/policies');
  },

  createPolicy(data: {
    name: string;
    description?: string;
    entityType: string;
    action: string;
    effect: string;
    priority?: number;
    conditions: Record<string, any>;
  }) {
    return apiClient.post('/permissions/policies', data);
  },

  updatePolicy(id: string, data: Partial<{
    name: string;
    description: string;
    effect: string;
    priority: number;
    conditions: Record<string, any>;
    enabled: boolean;
  }>) {
    return apiClient.put(`/permissions/policies/${id}`, data);
  },

  deletePolicy(id: string) {
    return apiClient.delete(`/permissions/policies/${id}`);
  },
};

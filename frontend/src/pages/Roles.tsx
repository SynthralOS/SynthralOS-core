import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

interface Permission {
  id: string;
  resourceType: string;
  action: string;
  name: string;
  description?: string;
}

interface Role {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

interface GroupedPermissions {
  [resourceType: string]: Permission[];
}

export default function Roles() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [roleDetail, setRoleDetail] = useState<Role | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [assigningRole, setAssigningRole] = useState<Role | null>(null);
  const [organizationMembers, setOrganizationMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissionIds: [] as string[],
  });

  const { data: roles = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.roles.all,
    queryFn: async () => {
      const response = await api.get('/roles');
      return response.data;
    },
  });

  const { data: permissions = {} } = useQuery({
    queryKey: queryKeys.roles.permissions,
    queryFn: async () => {
      const response = await api.get('/roles/permissions/all');
      return response.data;
    },
    staleTime: 300000, // 5 minutes for permissions (rarely change)
  });

  const handleCreate = () => {
    setFormData({ name: '', description: '', permissionIds: [] });
    setEditingRole(null);
    setShowCreateModal(true);
  };

  const handleEdit = (role: Role) => {
    setFormData({
      name: role.name,
      description: role.description || '',
      permissionIds: role.permissions.map((p) => p.id),
    });
    setEditingRole(role);
    setShowCreateModal(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await api.delete(`/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Error deleting role');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { id?: string; formData: typeof formData }) => {
      if (data.id) {
        await api.put(`/roles/${data.id}`, data.formData);
      } else {
        await api.post('/roles', data.formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Error saving role');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ roleId, organizationMemberId }: { roleId: string; organizationMemberId: string }) => {
      await api.post(`/roles/${roleId}/assign`, { organizationMemberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      alert('Role assigned successfully!');
      setShowAssign(false);
      setAssigningRole(null);
      setSelectedMemberId('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to assign role');
    },
  });

  const handleDelete = (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    deleteMutation.mutate(roleId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ id: editingRole?.id, formData });
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="ml-3 text-gray-600 dark:text-gray-400">Loading roles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
            Roles & Permissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Manage user roles and permissions</p>
        </div>
        <button
          onClick={handleCreate}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
        >
          + Create Role
        </button>
      </div>

      {roles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">No roles found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Create your first role to get started</p>
            <button
              onClick={handleCreate}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
            >
              Create Role
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-50/50 dark:from-gray-800 dark:to-gray-800/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Permissions
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {roles.map((role, index) => (
                <tr 
                  key={role.id}
                  className="hover:bg-gradient-to-r hover:from-indigo-50/30 dark:hover:from-indigo-900/20 hover:to-transparent transition-all duration-200 animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 dark:from-indigo-900/50 to-indigo-50 dark:to-indigo-900/30 flex items-center justify-center">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{role.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">{role.description || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role.isSystem ? (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        System
                      </span>
                    ) : (
                      <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const response = await api.get(`/roles/${role.id}`);
                            setRoleDetail(response.data);
                            setShowDetail(true);
                          } catch (error) {
                            console.error('Failed to load role details:', error);
                          }
                        }}
                        className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all duration-200 font-medium"
                      >
                        View
                      </button>
                      <button
                        onClick={async () => {
                          setAssigningRole(role);
                          setShowAssign(true);
                        }}
                        className="px-3 py-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all duration-200 font-medium"
                      >
                        Assign
                      </button>
                      <button
                        onClick={() => handleEdit(role)}
                        className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all duration-200 font-medium"
                      >
                        Edit
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDelete(role.id)}
                          className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingRole ? 'Edit Role' : 'Create Role'}
              </h3>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Workflow Manager"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Describe what this role can do..."
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions
                  </label>
                  <div className="border border-gray-300 rounded-md p-4 max-h-96 overflow-y-auto">
                    {Object.entries(permissions).map(([resourceType, perms]) => (
                      <div key={resourceType} className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2 capitalize">
                          {resourceType}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={formData.permissionIds.includes(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">
                                {perm.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingRole ? 'Update' : 'Create'} Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Role Detail Modal */}
      {showDetail && roleDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Role Details</h2>
                <button
                  onClick={() => {
                    setShowDetail(false);
                    setRoleDetail(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Name</h3>
                <p className="text-gray-900 dark:text-gray-100 text-lg">{roleDetail.name}</p>
              </div>
              {roleDetail.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
                  <p className="text-gray-700 dark:text-gray-300">{roleDetail.description}</p>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Type</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  roleDetail.isSystem 
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-400'
                }`}>
                  {roleDetail.isSystem ? 'System Role' : 'Custom Role'}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Permissions ({roleDetail.permissions.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {roleDetail.permissions.map((permission) => (
                    <div key={permission.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">{permission.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{permission.resourceType}.{permission.action}</p>
                      {permission.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{permission.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setShowDetail(false);
                  setRoleDetail(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {showAssign && assigningRole && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Assign Role: {assigningRole.name}</h3>
                <button
                  onClick={() => {
                    setShowAssign(false);
                    setAssigningRole(null);
                    setSelectedMemberId('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedMemberId) {
                    alert('Please select a member');
                    return;
                  }
                  assignMutation.mutate({
                    roleId: assigningRole.id,
                    organizationMemberId: selectedMemberId,
                  });
                }}
              >
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization Member ID
                  </label>
                  <input
                    type="text"
                    required
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter organization member ID"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Note: You can find member IDs in the Teams page or organization settings
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssign(false);
                      setAssigningRole(null);
                      setSelectedMemberId('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Assign Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


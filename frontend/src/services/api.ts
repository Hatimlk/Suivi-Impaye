const API_BASE = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    // Tentative de refresh
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken && !url.includes('/auth/')) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem('accessToken', data.accessToken);
          headers['Authorization'] = `Bearer ${data.accessToken}`;
          const retryRes = await fetch(`${API_BASE}${url}`, { ...options, headers });
          if (!retryRes.ok) {
            const err = await retryRes.json().catch(() => ({ error: 'Erreur serveur' }));
            throw new Error(err.error || `Erreur ${retryRes.status}`);
          }
          return retryRes.json();
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        throw new Error('Session expiree');
      }
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
    throw new Error('Non autorise');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
    throw new Error(err.error || `Erreur ${res.status}`);
  }

  // Pour les exports binaires
  const ct = res.headers.get('content-type');
  if (ct && (ct.includes('spreadsheet') || ct.includes('pdf') || ct.includes('octet-stream'))) {
    return res.blob() as T;
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request<any>('/auth/me'),
  logout: () =>
    request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
    }),

  // Dossiers
  getDossiers: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/dossiers?${qs}`);
  },
  getDossier: (id: string) => request<any>(`/dossiers/${id}`),
  createDossier: (data: any) => request<any>('/dossiers', { method: 'POST', body: JSON.stringify(data) }),
  updateDossier: (id: string, data: any) =>
    request<any>(`/dossiers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatut: (id: string, statut: string) =>
    request<any>(`/dossiers/${id}/statut`, { method: 'PATCH', body: JSON.stringify({ statut }) }),
  reaffecter: (id: string, commercial_id: string) =>
    request<any>(`/dossiers/${id}/reaffecter`, { method: 'PATCH', body: JSON.stringify({ commercial_id }) }),
  deleteDossier: (id: string) => request<any>(`/dossiers/${id}`, { method: 'DELETE' }),

  // Actions
  addAction: (dossierId: string, data: { contenu: string; type_action?: string }) =>
    request<any>(`/dossiers/${dossierId}/actions`, { method: 'POST', body: JSON.stringify(data) }),

  // Stats & Alerts
  getStats: () => request<any>('/dossiers/stats'),
  getAlerts: () => request<any>('/dossiers/alerts'),

  // Admin
  getUsers: () => request<any[]>('/admin/users'),
  createUser: (data: any) => request<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    request<any>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleUser: (id: string) => request<any>(`/admin/users/${id}/toggle`, { method: 'PATCH' }),

  getBanques: () => request<any[]>('/admin/banques'),
  createBanque: (nom: string) =>
    request<any>('/admin/banques', { method: 'POST', body: JSON.stringify({ nom }) }),
  deleteBanque: (id: number) => request<any>(`/admin/banques/${id}`, { method: 'DELETE' }),

  getStatuts: () => request<any[]>('/admin/statuts'),
  createStatut: (data: any) =>
    request<any>('/admin/statuts', { method: 'POST', body: JSON.stringify(data) }),
  updateStatutRef: (id: number, data: any) =>
    request<any>(`/admin/statuts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStatut: (id: number) => request<any>(`/admin/statuts/${id}`, { method: 'DELETE' }),

  getRelations: () => request<any[]>('/admin/relations'),
  createRelation: (data: any) =>
    request<any>('/admin/relations', { method: 'POST', body: JSON.stringify(data) }),
  deleteRelation: (id: number) => request<any>(`/admin/relations/${id}`, { method: 'DELETE' }),

  getAuditLogs: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<any>(`/admin/audit-logs?${qs}`);
  },

  // Import
  importExcel: (file: File) => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/dossiers/import', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  },

  // Export
  exportExcel: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<Blob>(`/export/excel?${qs}`);
  },
};

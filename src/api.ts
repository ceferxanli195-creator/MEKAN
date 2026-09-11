import { User, Customer, Driver, AuditLog, DashboardStats, Delivery, NotificationItem, Order, ExecutorType } from './types';

const TOKEN_KEY = 'mustari_gps_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (response.status === 401) {
    // Only clear token and dispatch unauthorized event if NOT the login request itself
    if (!path.includes('/auth/login')) {
      setStoredToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const message = (data && data.error) ? data.error : 'İstifadəçi ID və ya Şifrə yanlışdır.';
    throw new Error(message);
  }

  if (!response.ok) {
    const message = (data && data.error) ? data.error : 'Əməliyyat zamanı xəta baş verdi.';
    throw new Error(message);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (loginId: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ loginId, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getCurrentUser: () =>
    request<{ user: User }>('/api/auth/me'),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  // Dashboard
  getStats: () =>
    request<DashboardStats>('/api/dashboard/stats'),

  // Customers
  getCustomers: (params?: { search?: string; ownerId?: string; driverId?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.ownerId) q.set('ownerId', params.ownerId);
    if (params?.driverId) q.set('driverId', params.driverId);
    return request<{ customers: Customer[] }>(`/api/customers?${q.toString()}`);
  },

  getCustomerById: (id: string) =>
    request<{ customer: Customer }>(`/api/customers/${id}`),

  createCustomer: (data: Partial<Customer> & { assignedDriverId?: string | null }) =>
    request<{ customer: Customer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCustomer: (id: string, data: Partial<Customer> & { assignedDriverId?: string | null }) =>
    request<{ customer: Customer }>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  assignDriverToCustomer: (customerId: string, driverId: string | null) =>
    request<{ customer: Customer }>(`/api/customers/${customerId}/assign-driver`, {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    }),

  sendLocationToDriver: (customerId: string, driverId?: string) =>
    request<{ success: boolean; message: string }>(`/api/customers/${customerId}/send-location-to-driver`, {
      method: 'POST',
      body: JSON.stringify({ driverId }),
    }),

  sendLocationToCustomer: (customerId: string) =>
    request<{ success: boolean; message: string }>(`/api/customers/${customerId}/send-location-to-customer`, {
      method: 'POST',
    }),

  deliverCustomer: (customerId: string, note?: string) =>
    request<{ success: boolean; customer: Customer; delivery: Delivery; message: string }>(`/api/customers/${customerId}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  deleteCustomer: (id: string) =>
    request<{ success: boolean; customer: Customer }>(`/api/customers/${id}`, {
      method: 'DELETE',
    }),

  // Trash
  getTrash: () =>
    request<{ trash: Customer[] }>('/api/trash'),

  restoreCustomer: (id: string) =>
    request<{ success: boolean; customer: Customer }>(`/api/customers/${id}/restore`, {
      method: 'POST',
    }),

  permanentDeleteCustomer: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/customers/${id}/permanent`, {
      method: 'DELETE',
    }),

  // Users (Admin only)
  getUsers: () =>
    request<{ users: User[] }>('/api/users'),

  createUser: (userData: any) =>
    request<{ user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUser: (id: string, userData: any) =>
    request<{ user: User }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  deleteUser: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    }),

  // Drivers
  getDrivers: () =>
    request<{ drivers: Driver[] }>('/api/drivers'),

  createDriver: (driverData: any) =>
    request<{ driver: Driver }>('/api/drivers', {
      method: 'POST',
      body: JSON.stringify(driverData),
    }),

  updateDriver: (id: string, driverData: any) =>
    request<{ driver: Driver }>(`/api/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(driverData),
    }),

  deleteDriver: (id: string) =>
    request<{ success: boolean }>(`/api/drivers/${id}`, {
      method: 'DELETE',
    }),

  // Audit Logs
  getLogs: (params?: { search?: string; action?: string; entityType?: string; date?: string; userId?: string; customerId?: string; driverId?: string; actionType?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.action) q.set('action', params.action);
    if (params?.actionType) q.set('actionType', params.actionType);
    if (params?.entityType) q.set('entityType', params.entityType);
    if (params?.date) q.set('date', params.date);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.driverId) q.set('driverId', params.driverId);
    return request<{ logs: AuditLog[] }>(`/api/logs?${q.toString()}`);
  },

  // Business Operations (excluding auth/session logs)
  getOperations: (params?: { search?: string; date?: string; user?: string; customer?: string; driver?: string; actionType?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.date) q.set('date', params.date);
    if (params?.user) q.set('user', params.user);
    if (params?.customer) q.set('customer', params.customer);
    if (params?.driver) q.set('driver', params.driver);
    if (params?.actionType) q.set('actionType', params.actionType);
    if (params?.limit) q.set('limit', params.limit.toString());
    return request<{ operations: AuditLog[] }>(`/api/operations?${q.toString()}`);
  },

  deleteLogs: (logIds: string[], all: boolean = false) =>
    request<{ success: boolean; count?: number; message?: string }>('/api/logs', {
      method: 'DELETE',
      body: JSON.stringify({ logIds, all }),
    }),

  // Backup & Restore
  exportBackup: async () => {
    const token = getStoredToken();
    const response = await fetch('/api/backup/export', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Backup yüklənərkən xəta baş verdi.');
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mustari_gps_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  restoreBackup: (backupData: any) =>
    request<{ success: boolean; count: number; message: string }>('/api/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData }),
    }),

  // Deliveries API
  getDeliveries: (params?: { driverId?: string; customerId?: string; ownerId?: string; status?: string; date?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.driverId) q.set('driverId', params.driverId);
    if (params?.customerId) q.set('customerId', params.customerId);
    if (params?.ownerId) q.set('ownerId', params.ownerId);
    if (params?.status) q.set('status', params.status);
    if (params?.date) q.set('date', params.date);
    if (params?.search) q.set('search', params.search);
    return request<{
      deliveries: Delivery[];
      driverStats: Array<{ driverId: string; driverName: string; count: number; deliveredCount: number }>;
    }>(`/api/deliveries?${q.toString()}`);
  },

  createDelivery: (data: { customerId: string; driverId: string; notes?: string; status?: string }) =>
    request<{ delivery: Delivery }>('/api/deliveries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  startDelivery: (id: string) =>
    request<{ delivery: Delivery }>(`/api/deliveries/${id}/start`, {
      method: 'POST',
    }),

  deliverDelivery: (id: string, note?: string) =>
    request<{ delivery: Delivery }>(`/api/deliveries/${id}/deliver`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),

  getDriverDeliveryStats: (driverId?: string) => {
    const q = new URLSearchParams();
    if (driverId) q.set('driverId', driverId);
    return request<{ stats: any }>(`/api/deliveries/driver-stats?${q.toString()}`);
  },

  // Notifications API
  getNotifications: () =>
    request<{ notifications: NotificationItem[]; unreadCount: number }>('/api/notifications'),

  getUnreadNotificationCount: () =>
    request<{ unreadCount: number }>('/api/notifications/unread-count'),

  markNotificationAsRead: (id: string) =>
    request<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'POST',
    }),

  markAllNotificationsAsRead: () =>
    request<{ success: boolean; count: number }>('/api/notifications/read-all', {
      method: 'POST',
    }),

  // ==========================================
  // --- ORDERS API (SİFARİŞLƏR SİSTEMİ) ---
  // ==========================================
  getOrders: (params?: {
    status?: string;
    search?: string;
    date?: string;
    driverId?: string;
    creatorId?: string;
    ownerId?: string;
    filterMode?: 'all' | 'open' | 'my_orders';
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.date) q.set('date', params.date);
    if (params?.driverId) q.set('driverId', params.driverId);
    if (params?.creatorId) q.set('creatorId', params.creatorId);
    if (params?.ownerId) q.set('ownerId', params.ownerId);
    if (params?.filterMode) q.set('filterMode', params.filterMode);
    return request<{ orders: Order[] }>(`/api/orders?${q.toString()}`);
  },

  getOrderById: (id: string) =>
    request<{ order: Order }>(`/api/orders/${id}`),

  createOrder: (data: { customerId: string; notes?: string; dispatchType?: ExecutorType | null }) =>
    request<{ order: Order; message: string }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  dispatchOrder: (id: string, dispatchType: ExecutorType) =>
    request<{ order: Order; message: string }>(`/api/orders/${id}/dispatch`, {
      method: 'POST',
      body: JSON.stringify({ dispatchType }),
    }),

  claimOrder: (id: string) =>
    request<{ order: Order; message: string }>(`/api/orders/${id}/claim`, {
      method: 'POST',
    }),

  startOrder: (id: string) =>
    request<{ order: Order; message: string }>(`/api/orders/${id}/start`, {
      method: 'POST',
    }),

  updateOrderLocation: (
    id: string,
    location: {
      latitude: number;
      longitude: number;
      speed?: number | null;
      accuracy?: number | null;
      heading?: number | null;
    }
  ) =>
    request<{ success: boolean; location: any; trajectory: any }>(`/api/orders/${id}/location`, {
      method: 'POST',
      body: JSON.stringify(location),
    }),

  deliverOrder: (
    id: string,
    data?: {
      note?: string;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      heading?: number | null;
    }
  ) =>
    request<{ order: Order; message: string }>(`/api/orders/${id}/deliver`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  getOrderDashboardStats: () =>
    request<{ stats: any }>('/api/orders/dashboard/stats'),
};

export type UserRole = 'ADMIN' | 'USER' | 'DRIVER';
export type UserStatus = 'active' | 'inactive';

export interface UserPermissions {
  view_customers: boolean;
  create_customer: boolean;
  edit_customer: boolean;
  delete_customer: boolean;
  use_gps: boolean;
  view_map: boolean;
  backup_data: boolean;
  restore_data: boolean;
  view_drivers: boolean;
}

export interface User {
  id: string;
  loginId: string;
  name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  permissions: UserPermissions;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
  lastActivity?: string;
  customerCount?: number;
}

export interface Customer {
  id: string;
  ownerId: string;
  ownerName?: string;
  createdBy: string;
  updatedBy: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  phoneNormalized: string;
  address: string;
  notes?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  photoUrl?: string;
  status: 'active' | 'inactive';
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deletedByName?: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  currentDeliveryStatus?: DeliveryStatus | 'none';
  createdAt: string;
  updatedAt: string;
}

export type DeliveryStatus = 'assigned' | 'in_transit' | 'delivered';

export type OrderStatus = 'new' | 'pending_driver' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';
export type ExecutorType = 'USER' | 'DRIVER';

export interface OrderHistoryEvent {
  step: 'CREATED' | 'DISPATCH_SELECTED' | 'CLAIMED' | 'DEPARTED' | 'LOCATION_UPDATE' | 'DELIVERED';
  title: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: string;
  dateStr: string;
  timeStr: string;
  details?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface TrajectoryPoint {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLatitude: number;
  customerLongitude: number;
  customerNotes?: string;
  ownerId: string;
  ownerName: string;
  creatorId: string;
  creatorName: string;
  creatorRole: UserRole;
  status: OrderStatus;
  dispatchType?: ExecutorType | null;
  executorType?: ExecutorType | null;
  executorId?: string | null;
  executorName?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  notes?: string;
  createdAt: string;
  createdDateStr: string;
  createdTimeStr: string;
  claimedAt?: string | null;
  departedAt?: string | null;
  deliveredAt?: string | null;
  deliveredBy?: string | null;
  deliveredByName?: string | null;
  deliveredLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  currentLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number | null;
    heading?: number | null;
    updatedAt: string;
  } | null;
  trajectory?: TrajectoryPoint[];
  history: OrderHistoryEvent[];
  updatedAt: string;
}

export interface OrderDashboardStats {
  openOrdersCount: number;
  myActiveOrdersCount: number;
  todayDeliveredCount: number;
  totalOrdersCount: number;
}

export interface Delivery {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerNotes?: string;
  customerLatitude: number;
  customerLongitude: number;
  ownerId: string;
  ownerName: string;
  driverId: string;
  driverName: string;
  assignedBy: string;
  assignedByName: string;
  status: DeliveryStatus;
  notes?: string;
  assignedAt: string;
  deliveredAt: string | null;
  deliveredBy: string | null;
  deliveredByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order_new' | 'order_claimed' | 'order_departed' | 'order_delivered' | 'delivery_delivered' | 'delivery_assigned' | 'system';
  orderId?: string;
  orderNumber?: number;
  deliveryId?: string;
  customerId?: string;
  customerName?: string;
  driverId?: string;
  driverName?: string;
  status?: string;
  deliveredAt?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Driver {
  id: string;
  loginId: string;
  name: string;
  phone: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: string;
  actionType?: string;
  entityType: string;
  entityId?: string;
  customerId?: string;
  customerName?: string;
  driverId?: string;
  driverName?: string;
  details: string;
  oldData?: any;
  newData?: any;
  createdAt: string;
}

export interface DashboardStats {
  totalUsers?: number;
  activeUsers?: number;
  totalCustomers: number;
  activeCustomers?: number;
  deletedCustomers?: number;
  totalDrivers?: number;
  activeDrivers?: number;
  todayCustomers?: number;
  todayDrivers?: number;
  todayOperations?: number;
  pendingAssignments?: number;
  // Delivery stats
  totalDeliveries?: number;
  todayDelivered?: number;
  inTransitDeliveries?: number;
  deliveredDeliveries?: number;
  pendingDeliveries?: number;
  myCustomers?: number;
  assignedDeliveries?: number;
  todayAssignedDeliveries?: number;
  driverAssignedCustomers?: number;
  lastDelivery?: Delivery | null;
  recentCustomers?: Customer[];
  recentDrivers?: Driver[];
  recentAssignments?: Array<{
    id: string;
    customerName: string;
    driverName: string;
    assignedAt: string;
  }>;
  recentActivities?: AuditLog[];
  userGroups?: Array<{
    userId: string;
    userName: string;
    customerCount: number;
  }>;
}

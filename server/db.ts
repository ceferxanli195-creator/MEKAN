import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  UserRecord,
  CustomerRecord,
  DriverRecord,
  AuditLogRecord,
  UserPermissions,
  DeliveryRecord,
  NotificationRecord,
  DeliveryStatus,
  UserRole,
  OrderRecord,
  OrderStatus,
  ExecutorType,
  OrderHistoryEvent,
  DriverStop,
  DriverCurrentLocation,
  DriverActiveOrderInfo,
  TrajectoryPoint,
} from './types';
import {
  syncCustomerToFirestore,
  deleteCustomerFromFirestore,
  syncUserToFirestore,
  deleteUserFromFirestore,
  syncDriverToFirestore,
  deleteDriverFromFirestore,
  syncLogToFirestore,
  syncDeliveryToFirestore,
  deleteDeliveryFromFirestore,
  syncNotificationToFirestore,
  deleteNotificationFromFirestore,
  syncOrderToFirestore,
  deleteOrderFromFirestore,
  loadInitialDataFromFirestore,
} from './firestore';

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const DRIVERS_FILE = path.join(DATA_DIR, 'drivers.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const DELIVERIES_FILE = path.join(DATA_DIR, 'deliveries.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonFile(filePath, defaultValue);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function hashPassword(password: string): string {
  const salt = 'mustari_gps_secure_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!password || !hash) return false;
  // 1. Check primary PBKDF2 hash
  if (hashPassword(password) === hash) return true;
  // 2. Check plain text (for unmigrated legacy entries or initial seed)
  if (password === hash) return true;
  // 3. Check SHA-256 fallback
  try {
    const sha256 = crypto.createHash('sha256').update(password).digest('hex');
    if (sha256 === hash) return true;
  } catch {}
  return false;
}

export function normalizePhone(raw: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('994') && digits.length >= 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return '994' + digits.substring(1);
  }
  if (digits.length === 9) {
    return '994' + digits;
  }
  return digits;
}

export function getBakuDateTime(date: Date = new Date()): { dateStr: string; timeStr: string } {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const azTime = new Date(date.getTime() + (4 * 60 + date.getTimezoneOffset()) * 60000);
  const day = pad(azTime.getDate());
  const month = pad(azTime.getMonth() + 1);
  const year = azTime.getFullYear();
  const hours = pad(azTime.getHours());
  const minutes = pad(azTime.getMinutes());
  return {
    dateStr: `${day}.${month}.${year}`,
    timeStr: `${hours}:${minutes}`,
  };
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.cos((lon2 - lon1) * (Math.PI / 180));
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  view_customers: true,
  create_customer: true,
  edit_customer: true,
  delete_customer: true,
  use_gps: true,
  view_map: true,
  backup_data: true,
  restore_data: true,
  view_drivers: true,
};

class Database {
  private users: UserRecord[] = [];
  private customers: CustomerRecord[] = [];
  private drivers: DriverRecord[] = [];
  private logs: AuditLogRecord[] = [];
  private deliveries: DeliveryRecord[] = [];
  private notifications: NotificationRecord[] = [];
  private orders: OrderRecord[] = [];

  constructor() {
    this.reload();
    this.ensureInitialAdmin();
    this.ensureInitialDrivers();
    this.initFirestoreSync();
  }

  private async initFirestoreSync() {
    try {
      const cloudData = await loadInitialDataFromFirestore();
      if (cloudData.customers && cloudData.customers.length > 0) {
        const idMap = new Map(this.customers.map(c => [c.id, c]));
        for (const c of cloudData.customers) {
          idMap.set(c.id, c);
        }
        this.customers = Array.from(idMap.values());
        this.saveCustomers();
      }
      if (cloudData.users && cloudData.users.length > 0) {
        const idMap = new Map(this.users.map(u => [u.id, u]));
        for (const u of cloudData.users) {
          idMap.set(u.id, u);
        }
        this.users = Array.from(idMap.values());
        this.ensureInitialAdmin();
        this.saveUsers();
      }
      if (cloudData.drivers && cloudData.drivers.length > 0) {
        const idMap = new Map(this.drivers.map(d => [d.id, d]));
        for (const d of cloudData.drivers) {
          idMap.set(d.id, d);
        }
        this.drivers = Array.from(idMap.values());
        this.ensureInitialDrivers();
        this.saveDrivers();
      }
      if (cloudData.deliveries && cloudData.deliveries.length > 0) {
        const idMap = new Map(this.deliveries.map(d => [d.id, d]));
        for (const d of cloudData.deliveries) {
          idMap.set(d.id, d);
        }
        this.deliveries = Array.from(idMap.values());
        this.saveDeliveries();
      }
      if (cloudData.orders && cloudData.orders.length > 0) {
        const idMap = new Map(this.orders.map(o => [o.id, o]));
        for (const o of cloudData.orders) {
          idMap.set(o.id, o);
        }
        this.orders = Array.from(idMap.values());
        this.saveOrders();
      }
      if (cloudData.notifications && cloudData.notifications.length > 0) {
        const idMap = new Map(this.notifications.map(n => [n.id, n]));
        for (const n of cloudData.notifications) {
          idMap.set(n.id, n);
        }
        this.notifications = Array.from(idMap.values());
        this.saveNotifications();
      }
      for (const u of this.users) {
        syncUserToFirestore(u);
      }
      for (const c of this.customers) {
        syncCustomerToFirestore(c);
      }
      for (const d of this.drivers) {
        syncDriverToFirestore(d);
      }
      for (const del of this.deliveries) {
        syncDeliveryToFirestore(del);
      }
      for (const ord of this.orders) {
        syncOrderToFirestore(ord);
      }
      for (const notif of this.notifications) {
        syncNotificationToFirestore(notif);
      }
    } catch (err) {
      console.warn('Firestore initial sync notice:', err);
    }
  }

  public reload() {
    this.users = readJsonFile<UserRecord[]>(USERS_FILE, []);
    this.customers = readJsonFile<CustomerRecord[]>(CUSTOMERS_FILE, []);
    this.drivers = readJsonFile<DriverRecord[]>(DRIVERS_FILE, []);
    this.logs = readJsonFile<AuditLogRecord[]>(LOGS_FILE, []);
    this.deliveries = readJsonFile<DeliveryRecord[]>(DELIVERIES_FILE, []);
    this.notifications = readJsonFile<NotificationRecord[]>(NOTIFICATIONS_FILE, []);
    this.orders = readJsonFile<OrderRecord[]>(ORDERS_FILE, []);
  }

  private saveUsers() {
    writeJsonFile(USERS_FILE, this.users);
  }

  private saveCustomers() {
    writeJsonFile(CUSTOMERS_FILE, this.customers);
  }

  private saveDrivers() {
    writeJsonFile(DRIVERS_FILE, this.drivers);
  }

  private saveLogs() {
    writeJsonFile(LOGS_FILE, this.logs);
  }

  private saveDeliveries() {
    writeJsonFile(DELIVERIES_FILE, this.deliveries);
  }

  private saveNotifications() {
    writeJsonFile(NOTIFICATIONS_FILE, this.notifications);
  }

  private saveOrders() {
    writeJsonFile(ORDERS_FILE, this.orders);
  }

  public ensureInitialAdmin(): UserRecord {
    const now = new Date().toISOString();
    let admin = this.users.find(u => u.loginId.toLowerCase() === 'admin');

    if (!admin) {
      admin = {
        id: 'usr_admin_master',
        loginId: 'admin',
        name: 'Sistem Admini',
        passwordHash: hashPassword('010193'),
        role: 'ADMIN',
        status: 'active',
        permissions: { ...DEFAULT_PERMISSIONS },
        createdAt: now,
        updatedAt: now,
      };
      this.users.unshift(admin);
      this.saveUsers();
      syncUserToFirestore(admin);
      console.log('Master admin account initialized with loginId: admin');
    } else {
      let changed = false;
      if (admin.role !== 'ADMIN') {
        admin.role = 'ADMIN';
        changed = true;
      }
      if (admin.status !== 'active') {
        admin.status = 'active';
        changed = true;
      }
      // Ensure all permissions are true for admin
      if (!admin.permissions || Object.values(DEFAULT_PERMISSIONS).some((_, idx) => Object.values(admin!.permissions || {})[idx] !== true)) {
        admin.permissions = { ...DEFAULT_PERMISSIONS };
        changed = true;
      }
      // Ensure password is set to 010193
      if (!admin.passwordHash || !verifyPassword('010193', admin.passwordHash)) {
        admin.passwordHash = hashPassword('010193');
        changed = true;
      }
      if (changed) {
        admin.updatedAt = now;
        this.saveUsers();
        syncUserToFirestore(admin);
        console.log('Master admin account verified and synced with updated credentials.');
      }
    }
    return admin;
  }

  public ensureAdminExists(id?: string, loginId: string = 'admin', name: string = 'Sistem Admini'): UserRecord {
    let admin = this.users.find(u => u.loginId.toLowerCase() === 'admin' || (id && u.id === id));
    if (!admin) {
      return this.ensureInitialAdmin();
    }
    return admin;
  }

  public ensureDriverExists(id: string, loginId?: string, name?: string): DriverRecord {
    const effectiveLoginId = (loginId || id || 'driver').trim();
    let drv = this.drivers.find(d => (id && d.id === id) || (effectiveLoginId && d.loginId.toLowerCase() === effectiveLoginId.toLowerCase()));
    if (!drv) {
      const now = new Date().toISOString();
      drv = {
        id: id || `drv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        loginId: effectiveLoginId,
        name: name || 'Sürücü',
        passwordHash: hashPassword('1'),
        phone: '',
        status: 'active',
        isLive: true,
        createdAt: now,
        updatedAt: now,
      };
      this.drivers.push(drv);
      this.saveDrivers();
      syncDriverToFirestore(drv);
    }
    return drv;
  }

  public ensureUserExists(id: string, loginId: string, name: string, role: UserRole = 'USER', permissions?: UserPermissions): UserRecord {
    const effectiveLoginId = (loginId || id || 'user').trim();
    let usr = this.users.find(u => (id && u.id === id) || (effectiveLoginId && u.loginId.toLowerCase() === effectiveLoginId.toLowerCase()));
    if (!usr) {
      const now = new Date().toISOString();
      usr = {
        id: id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        loginId: effectiveLoginId,
        name: name || 'İstifadəçi',
        passwordHash: hashPassword('123456'),
        role: role || 'USER',
        status: 'active',
        permissions: permissions || { ...DEFAULT_PERMISSIONS },
        createdAt: now,
        updatedAt: now,
      };
      this.users.push(usr);
      this.saveUsers();
      syncUserToFirestore(usr);
    }
    return usr;
  }

  private ensureInitialDrivers() {
    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);

    let drv = this.drivers[0];
    if (!drv) {
      drv = {
        id: 'drv_sample_1',
        loginId: '1',
        passwordHash: hashPassword('1'),
        name: 'Elmir Sürücü',
        phone: '994501234567',
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      this.drivers.push(drv);
    }

    // Ensure sample live location in Baku center so the map is instantly active and verifiable
    if (!drv.currentLocation || !drv.currentLocation.latitude) {
      drv.isLive = true;
      drv.lastSeen = nowIso;
      drv.currentLocation = {
        latitude: 40.4093,
        longitude: 49.8671,
        speed: 48,
        heading: 80,
        accuracy: 6,
        batteryLevel: 92,
        updatedAt: nowIso,
        isMoving: true,
        address: 'Nizami küçəsi, Bakı',
      };
      drv.trajectory = [
        { latitude: 40.3950, longitude: 49.8450, speed: 42, heading: 60, timestamp: new Date(Date.now() - 3600000).toISOString() },
        { latitude: 40.4000, longitude: 49.8520, speed: 50, heading: 65, timestamp: new Date(Date.now() - 2400000).toISOString() },
        { latitude: 40.4050, longitude: 49.8600, speed: 48, heading: 70, timestamp: new Date(Date.now() - 1200000).toISOString() },
        { latitude: 40.4093, longitude: 49.8671, speed: 48, heading: 80, timestamp: nowIso },
      ];
      drv.stops = [
        {
          id: 'stop_1',
          latitude: 40.4000,
          longitude: 49.8520,
          address: '28 May m/st yaxınlığı',
          startTime: new Date(Date.now() - 2700000).toISOString(),
          startTimeStr: `${dateStr} 11:15`,
          endTime: new Date(Date.now() - 2400000).toISOString(),
          endTimeStr: '11:20',
          durationMinutes: 5,
          isCurrent: false,
        },
        {
          id: 'stop_2',
          latitude: 40.4050,
          longitude: 49.8600,
          address: 'Nərimanov, Təbriz küç.',
          startTime: new Date(Date.now() - 1800000).toISOString(),
          startTimeStr: `${dateStr} 11:30`,
          endTime: new Date(Date.now() - 1200000).toISOString(),
          endTimeStr: '11:40',
          durationMinutes: 10,
          isCurrent: false,
        },
      ];
      this.saveDrivers();
    }
  }

  // --- Users ---
  public getUsers(): UserRecord[] {
    return this.users;
  }

  public getUserById(id: string): UserRecord | undefined {
    return this.users.find(u => u.id === id);
  }

  public getUserByLoginId(loginId: string): UserRecord | undefined {
    return this.users.find(u => u.loginId.toLowerCase() === loginId.toLowerCase().trim());
  }

  public createUser(userData: {
    loginId: string;
    password: string;
    name: string;
    phone?: string;
    role: 'ADMIN' | 'USER' | 'DRIVER';
    status: 'active' | 'inactive';
    permissions?: Partial<UserPermissions>;
  }): UserRecord {
    const cleanLoginId = userData.loginId.toLowerCase().trim();
    if (this.getUserByLoginId(cleanLoginId)) {
      throw new Error('Bu ID ilə istifadəçi artıq mövcuddur.');
    }
    const now = new Date().toISOString();
    const newUser: UserRecord = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      loginId: cleanLoginId,
      passwordHash: hashPassword(userData.password),
      name: userData.name.trim(),
      phone: userData.phone?.trim() || '',
      role: userData.role,
      status: userData.status,
      permissions: {
        ...DEFAULT_PERMISSIONS,
        ...(userData.permissions || {})
      },
      createdAt: now,
      updatedAt: now,
    };
    this.users.push(newUser);
    this.saveUsers();
    syncUserToFirestore(newUser);

    // If created as DRIVER, also add to drivers list so they appear in driver lookups
    if (newUser.role === 'DRIVER' && !this.getDriverByLoginId(cleanLoginId)) {
      const driver: DriverRecord = {
        id: newUser.id,
        loginId: cleanLoginId,
        passwordHash: newUser.passwordHash,
        name: newUser.name,
        phone: newUser.phone || '',
        status: newUser.status,
        createdAt: now,
        updatedAt: now,
      };
      this.drivers.push(driver);
      this.saveDrivers();
      syncDriverToFirestore(driver);
    }

    return newUser;
  }

  public updateUser(id: string, updates: {
    name?: string;
    phone?: string;
    password?: string;
    role?: 'ADMIN' | 'USER' | 'DRIVER';
    status?: 'active' | 'inactive';
    permissions?: UserPermissions;
    lastLogin?: string;
    lastActivity?: string;
  }): UserRecord {
    const user = this.getUserById(id);
    if (!user) throw new Error('İstifadəçi tapılmadı.');

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.phone !== undefined) user.phone = updates.phone.trim();
    if (updates.password) user.passwordHash = hashPassword(updates.password);
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.status !== undefined) user.status = updates.status;
    if (updates.permissions !== undefined) user.permissions = updates.permissions;
    if (updates.lastLogin !== undefined) user.lastLogin = updates.lastLogin;
    if (updates.lastActivity !== undefined) user.lastActivity = updates.lastActivity;
    user.updatedAt = new Date().toISOString();

    this.saveUsers();
    syncUserToFirestore(user);

    // Sync corresponding driver if role is DRIVER
    const driver = this.getDriverById(id);
    if (driver) {
      if (updates.name !== undefined) driver.name = updates.name.trim();
      if (updates.phone !== undefined) driver.phone = updates.phone.trim();
      if (updates.status !== undefined) driver.status = updates.status;
      if (updates.password) driver.passwordHash = hashPassword(updates.password);
      driver.updatedAt = new Date().toISOString();
      this.saveDrivers();
      syncDriverToFirestore(driver);
    }

    return user;
  }

  public deleteUser(id: string): void {
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) throw new Error('İstifadəçi tapılmadı.');
    if (this.users[index].role === 'ADMIN' && this.users.filter(u => u.role === 'ADMIN').length <= 1) {
      throw new Error('Sistemdəki yeganə Admin silinə bilməz.');
    }
    this.users.splice(index, 1);
    this.saveUsers();
    deleteUserFromFirestore(id);
  }

  // --- Customers ---
  public getCustomers(includeDeleted: boolean = false): CustomerRecord[] {
    if (includeDeleted) return this.customers;
    return this.customers.filter(c => !c.isDeleted);
  }

  public getCustomerById(id: string): CustomerRecord | undefined {
    return this.customers.find(c => c.id === id);
  }

  public createCustomer(data: {
    ownerId: string;
    createdBy: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    notes?: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    photoUrl?: string;
    assignedDriverId?: string | null;
    assignedDriverName?: string | null;
  }): CustomerRecord {
    const now = new Date().toISOString();
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`.trim();
    const customer: CustomerRecord = {
      id: 'cst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      ownerId: data.ownerId,
      createdBy: data.createdBy,
      updatedBy: data.createdBy,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      fullName,
      phone: data.phone.trim(),
      phoneNormalized: normalizePhone(data.phone),
      address: data.address.trim(),
      notes: data.notes?.trim() || '',
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
      accuracy: Number(data.accuracy) || 0,
      photoUrl: data.photoUrl || '',
      status: 'active',
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      assignedDriverId: data.assignedDriverId || null,
      assignedDriverName: data.assignedDriverName || null,
      assignedAt: data.assignedDriverId ? now : null,
      assignedBy: data.assignedDriverId ? data.createdBy : null,
      createdAt: now,
      updatedAt: now,
    };
    this.customers.push(customer);
    this.saveCustomers();
    syncCustomerToFirestore(customer);
    return customer;
  }

  public updateCustomer(id: string, updates: Partial<CustomerRecord> & { updatedBy: string }): CustomerRecord {
    const customer = this.getCustomerById(id);
    if (!customer) throw new Error('Müştəri tapılmadı.');

    if (updates.firstName !== undefined) customer.firstName = updates.firstName.trim();
    if (updates.lastName !== undefined) customer.lastName = updates.lastName.trim();
    customer.fullName = `${customer.firstName} ${customer.lastName}`.trim();

    if (updates.phone !== undefined) {
      customer.phone = updates.phone.trim();
      customer.phoneNormalized = normalizePhone(updates.phone);
    }
    if (updates.address !== undefined) customer.address = updates.address.trim();
    if (updates.notes !== undefined) customer.notes = updates.notes.trim();
    if (updates.latitude !== undefined) customer.latitude = Number(updates.latitude);
    if (updates.longitude !== undefined) customer.longitude = Number(updates.longitude);
    if (updates.accuracy !== undefined) customer.accuracy = Number(updates.accuracy);
    if (updates.photoUrl !== undefined) customer.photoUrl = updates.photoUrl;
    if (updates.ownerId !== undefined) customer.ownerId = updates.ownerId;
    if (updates.status !== undefined) customer.status = updates.status;
    if (updates.assignedDriverId !== undefined) customer.assignedDriverId = updates.assignedDriverId;
    if (updates.assignedDriverName !== undefined) customer.assignedDriverName = updates.assignedDriverName;
    if (updates.assignedAt !== undefined) customer.assignedAt = updates.assignedAt;
    if (updates.assignedBy !== undefined) customer.assignedBy = updates.assignedBy;

    customer.updatedBy = updates.updatedBy;
    customer.updatedAt = new Date().toISOString();

    this.saveCustomers();
    syncCustomerToFirestore(customer);
    return customer;
  }

  public assignDriver(customerId: string, driverId: string | null, assignedBy: string): CustomerRecord {
    const customer = this.getCustomerById(customerId);
    if (!customer) throw new Error('Müştəri tapılmadı.');

    const now = new Date().toISOString();
    if (driverId) {
      const driver = this.getDriverById(driverId);
      if (!driver) throw new Error('Seçilmiş sürücü tapılmadı.');
      customer.assignedDriverId = driver.id;
      customer.assignedDriverName = driver.name;
      customer.assignedAt = now;
      customer.assignedBy = assignedBy;
    } else {
      customer.assignedDriverId = null;
      customer.assignedDriverName = null;
      customer.assignedAt = null;
      customer.assignedBy = null;
    }

    customer.updatedBy = assignedBy;
    customer.updatedAt = now;
    this.saveCustomers();
    syncCustomerToFirestore(customer);
    return customer;
  }

  public softDeleteCustomer(id: string, deletedBy: string): CustomerRecord {
    const customer = this.getCustomerById(id);
    if (!customer) throw new Error('Müştəri tapılmadı.');
    customer.isDeleted = true;
    customer.deletedAt = new Date().toISOString();
    customer.deletedBy = deletedBy;
    customer.updatedAt = new Date().toISOString();
    this.saveCustomers();
    syncCustomerToFirestore(customer);
    return customer;
  }

  public restoreCustomer(id: string, restoredBy: string): CustomerRecord {
    const customer = this.getCustomerById(id);
    if (!customer) throw new Error('Müştəri tapılmadı.');
    customer.isDeleted = false;
    customer.deletedAt = null;
    customer.deletedBy = null;
    customer.updatedBy = restoredBy;
    customer.updatedAt = new Date().toISOString();
    this.saveCustomers();
    syncCustomerToFirestore(customer);
    return customer;
  }

  public permanentDeleteCustomer(id: string): void {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Müştəri tapılmadı.');
    this.customers.splice(index, 1);
    this.saveCustomers();
    deleteCustomerFromFirestore(id);
  }

  // --- Drivers ---
  public getDrivers(): DriverRecord[] {
    const list = [...this.drivers];
    const existingIds = new Set(list.map(d => d.id));
    const existingLogins = new Set(list.map(d => d.loginId.toLowerCase()));
    for (const u of this.users) {
      if (u.role === 'DRIVER' && !existingIds.has(u.id) && !existingLogins.has(u.loginId.toLowerCase())) {
        list.push({
          id: u.id,
          loginId: u.loginId,
          passwordHash: u.passwordHash,
          name: u.name,
          phone: u.phone || '',
          status: u.status,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        });
      }
    }
    return list;
  }

  public getDriverById(id: string): DriverRecord | undefined {
    const d = this.drivers.find(d => d.id === id);
    if (d) return d;
    const u = this.users.find(u => u.id === id && u.role === 'DRIVER');
    if (u) {
      return {
        id: u.id,
        loginId: u.loginId,
        passwordHash: u.passwordHash,
        name: u.name,
        phone: u.phone || '',
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    }
    return undefined;
  }

  public getDriverByLoginId(loginId: string): DriverRecord | undefined {
    const clean = loginId.toLowerCase().trim();
    const d = this.drivers.find(d => d.loginId.toLowerCase() === clean);
    if (d) return d;
    const u = this.users.find(u => u.loginId.toLowerCase() === clean && u.role === 'DRIVER');
    if (u) {
      return {
        id: u.id,
        loginId: u.loginId,
        passwordHash: u.passwordHash,
        name: u.name,
        phone: u.phone || '',
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      };
    }
    return undefined;
  }

  public createDriver(data: {
    loginId: string;
    password: string;
    name: string;
    phone: string;
    status: 'active' | 'inactive';
  }): DriverRecord {
    const cleanLoginId = data.loginId.toLowerCase().trim();
    if (this.getDriverByLoginId(cleanLoginId) || this.getUserByLoginId(cleanLoginId)) {
      throw new Error('Bu ID artıq başqa istifadəçi və ya sürücü tərəfindən istifadə olunur.');
    }
    const now = new Date().toISOString();
    const driver: DriverRecord = {
      id: 'drv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      loginId: cleanLoginId,
      passwordHash: hashPassword(data.password),
      name: data.name.trim(),
      phone: data.phone.trim(),
      status: data.status,
      createdAt: now,
      updatedAt: now,
    };
    this.drivers.push(driver);
    this.saveDrivers();
    syncDriverToFirestore(driver);
    return driver;
  }

  public updateDriver(id: string, data: {
    name?: string;
    phone?: string;
    password?: string;
    status?: 'active' | 'inactive';
  }): DriverRecord {
    const driver = this.getDriverById(id);
    if (!driver) throw new Error('Sürücü tapılmadı.');
    if (data.name !== undefined) driver.name = data.name.trim();
    if (data.phone !== undefined) driver.phone = data.phone.trim();
    if (data.status !== undefined) driver.status = data.status;
    if (data.password) driver.passwordHash = hashPassword(data.password);
    driver.updatedAt = new Date().toISOString();
    this.saveDrivers();
    syncDriverToFirestore(driver);
    return driver;
  }

  public deleteDriver(id: string): void {
    const index = this.drivers.findIndex(d => d.id === id);
    if (index === -1) throw new Error('Sürücü tapılmadı.');
    this.drivers.splice(index, 1);
    this.saveDrivers();
    deleteDriverFromFirestore(id);
  }

  // --- Live Driver Tracking, Speed, Route & Stops ---
  public updateDriverLocation(
    driverId: string,
    coords: {
      latitude: number;
      longitude: number;
      speed?: number | null;
      heading?: number | null;
      accuracy?: number | null;
      batteryLevel?: number | null;
      address?: string;
    }
  ): DriverRecord {
    const cleanTargetId = (driverId || '').trim();
    let driver = this.drivers.find(
      d => d.id === cleanTargetId || d.loginId.toLowerCase() === cleanTargetId.toLowerCase()
    );
    if (!driver) {
      const u = this.users.find(
        u => (u.id === cleanTargetId || u.loginId.toLowerCase() === cleanTargetId.toLowerCase()) && u.role === 'DRIVER'
      );
      if (u) {
        driver = {
          id: u.id,
          loginId: u.loginId,
          passwordHash: u.passwordHash,
          name: u.name,
          phone: u.phone || '',
          status: u.status,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        };
        this.drivers.push(driver);
      }
    }
    if (!driver) {
      driver = this.ensureDriverExists(cleanTargetId, cleanTargetId, 'Sürücü');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);

    let speedKmH = 0;
    if (coords.speed !== undefined && coords.speed !== null && !isNaN(coords.speed) && coords.speed > 0) {
      speedKmH = coords.speed;
    }
    speedKmH = Math.max(0, Math.round(speedKmH));
    const isMoving = speedKmH >= 3;

    // Calculate heading direction
    let heading = coords.heading ?? null;
    if (driver.currentLocation && (!heading || heading === 0)) {
      const dist = calculateDistanceMeters(
        driver.currentLocation.latitude,
        driver.currentLocation.longitude,
        coords.latitude,
        coords.longitude
      );
      if (dist > 3) {
        heading = Math.round(
          calculateBearing(
            driver.currentLocation.latitude,
            driver.currentLocation.longitude,
            coords.latitude,
            coords.longitude
          )
        );
      } else {
        heading = driver.currentLocation.heading ?? 0;
      }
    }

    driver.isLive = true;
    driver.lastSeen = nowIso;
    driver.currentLocation = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: speedKmH,
      heading: heading ?? null,
      accuracy: coords.accuracy ?? null,
      batteryLevel: coords.batteryLevel ?? null,
      updatedAt: nowIso,
      isMoving,
      address: coords.address || undefined,
    };

    if (!driver.trajectory) {
      driver.trajectory = [];
    }

    const lastPoint = driver.trajectory[driver.trajectory.length - 1];
    const distFromLast = lastPoint
      ? calculateDistanceMeters(lastPoint.latitude, lastPoint.longitude, coords.latitude, coords.longitude)
      : 999;

    if (!lastPoint || distFromLast >= 6 || (lastPoint && (now.getTime() - new Date(lastPoint.timestamp).getTime()) > 15000)) {
      driver.trajectory.push({
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: speedKmH,
        accuracy: coords.accuracy ?? null,
        heading: heading ?? null,
        timestamp: nowIso,
      });
      if (driver.trajectory.length > 4000) {
        driver.trajectory = driver.trajectory.slice(-4000);
      }
    }

    // Stop Detection ("harda nə qədər dayanıb")
    if (!driver.stops) {
      driver.stops = [];
    }

    const activeStop = driver.stops.find(s => s.isCurrent);

    if (!isMoving) {
      if (activeStop) {
        const distFromStop = calculateDistanceMeters(
          activeStop.latitude,
          activeStop.longitude,
          coords.latitude,
          coords.longitude
        );
        if (distFromStop <= 60) {
          const startMs = new Date(activeStop.startTime).getTime();
          activeStop.durationMinutes = Math.max(1, Math.round((now.getTime() - startMs) / 60000));
          activeStop.endTime = nowIso;
          activeStop.endTimeStr = timeStr;
        } else {
          activeStop.isCurrent = false;
          activeStop.endTime = nowIso;
          activeStop.endTimeStr = timeStr;
          driver.stops.push({
            id: `stop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            latitude: coords.latitude,
            longitude: coords.longitude,
            address: coords.address,
            startTime: nowIso,
            startTimeStr: `${dateStr} ${timeStr}`,
            endTime: nowIso,
            endTimeStr: timeStr,
            durationMinutes: 1,
            isCurrent: true,
          });
        }
      } else {
        driver.stops.push({
          id: `stop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          address: coords.address,
          startTime: nowIso,
          startTimeStr: `${dateStr} ${timeStr}`,
          endTime: nowIso,
          endTimeStr: timeStr,
          durationMinutes: 1,
          isCurrent: true,
        });
      }
    } else {
      if (activeStop) {
        const distFromStop = calculateDistanceMeters(
          activeStop.latitude,
          activeStop.longitude,
          coords.latitude,
          coords.longitude
        );
        if (distFromStop > 50) {
          activeStop.isCurrent = false;
          activeStop.endTime = nowIso;
          activeStop.endTimeStr = timeStr;
          const startMs = new Date(activeStop.startTime).getTime();
          activeStop.durationMinutes = Math.max(1, Math.round((now.getTime() - startMs) / 60000));
        }
      }
    }

    // Auto-sync in-transit orders carried by this driver
    const inTransitOrders = this.orders.filter(
      o => (o.status === 'in_transit' || o.status === 'assigned') && (o.driverId === driver.id || o.executorId === driver.id)
    );

    let ordersUpdated = false;
    for (const order of inTransitOrders) {
      order.currentLocation = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: speedKmH,
        accuracy: coords.accuracy ?? null,
        heading: heading ?? null,
        updatedAt: nowIso,
      };
      if (!order.trajectory) order.trajectory = [];
      order.trajectory.push({
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: speedKmH,
        accuracy: coords.accuracy ?? null,
        heading: heading ?? null,
        timestamp: nowIso,
      });
      if (order.trajectory.length > 2500) {
        order.trajectory = order.trajectory.slice(-2500);
      }
      order.updatedAt = nowIso;
      syncOrderToFirestore(order);
      ordersUpdated = true;
    }
    if (ordersUpdated) {
      this.saveOrders();
    }

    const idx = this.drivers.findIndex(d => d.id === driver.id);
    if (idx >= 0) {
      this.drivers[idx] = driver;
    } else {
      this.drivers.push(driver);
    }
    this.saveDrivers();
    syncDriverToFirestore(driver);

    return driver;
  }

  public getLiveDrivers(requester: { id: string; role: string }): DriverRecord[] {
    const allDrivers = this.getDrivers();
    const now = Date.now();

    // Active orders in transit or assigned
    const activeOrders = this.orders.filter(
      o => o.status === 'in_transit' || o.status === 'assigned'
    );

    const enriched = allDrivers.map(drv => {
      const lastUpdateMs = drv.currentLocation?.updatedAt
        ? new Date(drv.currentLocation.updatedAt).getTime()
        : 0;
      const isRecentlyActive = (now - lastUpdateMs) < 600000; // 10 minutes

      const carryingOrders: DriverActiveOrderInfo[] = activeOrders
        .filter(o => o.driverId === drv.id || o.executorId === drv.id)
        .map(o => {
          let distKm: number | undefined = undefined;
          if (drv.currentLocation && o.customerLatitude && o.customerLongitude) {
            distKm = Math.round(
              (calculateDistanceMeters(
                drv.currentLocation.latitude,
                drv.currentLocation.longitude,
                o.customerLatitude,
                o.customerLongitude
              ) / 1000) * 10
            ) / 10;
          }
          return {
            orderId: o.id,
            orderNumber: o.orderNumber,
            customerId: o.customerId,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            customerAddress: o.customerAddress,
            customerLatitude: o.customerLatitude,
            customerLongitude: o.customerLongitude,
            ownerId: o.ownerId,
            ownerName: o.ownerName,
            creatorId: o.creatorId,
            creatorName: o.creatorName,
            status: o.status,
            destinationDistanceKm: distKm,
          };
        });

      return {
        ...drv,
        isLive: Boolean(drv.isLive && isRecentlyActive),
        activeOrders: carryingOrders,
      };
    });

    if (requester.role === 'ADMIN') {
      return enriched;
    }

    if (requester.role === 'DRIVER') {
      return enriched.filter(d => d.id === requester.id);
    }

    // USER sees ONLY drivers carrying their goods
    return enriched.filter(d =>
      d.activeOrders && d.activeOrders.some(
        ao => ao.creatorId === requester.id || ao.ownerId === requester.id
      )
    );
  }

  public getDriverTrajectoryAndStops(driverId: string): {
    driver: DriverRecord | null;
    currentLocation: DriverCurrentLocation | null;
    trajectory: TrajectoryPoint[];
    stops: DriverStop[];
  } {
    const driver = this.getDriverById(driverId);
    if (!driver) {
      return { driver: null, currentLocation: null, trajectory: [], stops: [] };
    }
    return {
      driver,
      currentLocation: driver.currentLocation || null,
      trajectory: driver.trajectory || [],
      stops: driver.stops || [],
    };
  }

  // --- Audit Logs & Business Operations ---
  public getLogs(): AuditLogRecord[] {
    return this.logs;
  }

  public getOperations(options: {
    userRole: 'ADMIN' | 'USER' | 'DRIVER';
    userId: string;
    date?: string;
    userFilter?: string;
    customerFilter?: string;
    driverFilter?: string;
    actionType?: string;
    search?: string;
  }): AuditLogRecord[] {
    // Strictly exclude authentication/session actions
    let list = this.logs.filter(l => 
      l.entityType !== 'AUTH' && 
      !l.action.toUpperCase().includes('LOGIN') && 
      !l.action.toUpperCase().includes('LOGOUT') &&
      !l.action.toUpperCase().includes('SESSION')
    );

    // Scoping: USER sees only own actions, DRIVER sees actions relevant to themselves
    if (options.userRole === 'USER') {
      list = list.filter(l => l.userId === options.userId);
    } else if (options.userRole === 'DRIVER') {
      list = list.filter(l => l.driverId === options.userId || l.userId === options.userId);
    }

    if (options.date) {
      list = list.filter(l => l.createdAt.startsWith(options.date!));
    }
    if (options.userFilter) {
      const q = options.userFilter.toLowerCase();
      list = list.filter(l => l.userId === options.userFilter || l.userName.toLowerCase().includes(q));
    }
    if (options.customerFilter) {
      const q = options.customerFilter.toLowerCase();
      list = list.filter(l => l.customerId === options.customerFilter || (l.customerName && l.customerName.toLowerCase().includes(q)));
    }
    if (options.driverFilter) {
      const q = options.driverFilter.toLowerCase();
      list = list.filter(l => l.driverId === options.driverFilter || (l.driverName && l.driverName.toLowerCase().includes(q)));
    }
    if (options.actionType) {
      list = list.filter(l => l.actionType === options.actionType || l.action === options.actionType);
    }
    if (options.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(l => 
        l.details.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        (l.customerName && l.customerName.toLowerCase().includes(q)) ||
        (l.driverName && l.driverName.toLowerCase().includes(q)) ||
        l.userName.toLowerCase().includes(q)
      );
    }

    return list;
  }

  public addLog(entry: {
    userId: string;
    userName: string;
    role: 'ADMIN' | 'USER' | 'DRIVER';
    action: string;
    actionType?: string;
    entityType: 'CUSTOMER' | 'USER' | 'DRIVER' | 'PERMISSION' | 'AUTH' | 'BACKUP' | 'LOG' | 'ASSIGNMENT' | 'DELIVERY';
    entityId?: string;
    customerId?: string;
    customerName?: string;
    driverId?: string;
    driverName?: string;
    details: string;
    oldData?: any;
    newData?: any;
  }): AuditLogRecord {
    const record: AuditLogRecord = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      ...entry,
      createdAt: new Date().toISOString(),
    };
    this.logs.unshift(record); // newest first
    // keep up to 5000 logs
    if (this.logs.length > 5000) {
      this.logs = this.logs.slice(0, 5000);
    }
    this.saveLogs();
    syncLogToFirestore(record);
    return record;
  }

  public deleteLogs(logIds: string[]): number {
    const idSet = new Set(logIds);
    const prevCount = this.logs.length;
    this.logs = this.logs.filter(l => !idSet.has(l.id));
    this.saveLogs();
    return prevCount - this.logs.length;
  }

  public clearAllLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  // --- Deliveries ---
  public getDeliveries(options?: {
    driverId?: string;
    customerId?: string;
    ownerId?: string;
    status?: DeliveryStatus;
    date?: string;
    search?: string;
  }): DeliveryRecord[] {
    let list = [...this.deliveries];

    if (options?.driverId) {
      list = list.filter(d => d.driverId === options.driverId);
    }
    if (options?.customerId) {
      list = list.filter(d => d.customerId === options.customerId);
    }
    if (options?.ownerId) {
      list = list.filter(d => d.ownerId === options.ownerId);
    }
    if (options?.status) {
      list = list.filter(d => d.status === options.status);
    }
    if (options?.date) {
      list = list.filter(d => {
        const assignedDate = d.assignedAt?.substring(0, 10);
        const deliveredDate = d.deliveredAt?.substring(0, 10);
        return assignedDate === options.date || deliveredDate === options.date;
      });
    }
    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(d =>
        d.customerName.toLowerCase().includes(q) ||
        d.customerAddress.toLowerCase().includes(q) ||
        d.driverName.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q) ||
        (d.notes && d.notes.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => new Date(b.assignedAt || b.createdAt).getTime() - new Date(a.assignedAt || a.createdAt).getTime());
    return list;
  }

  public getDeliveryById(id: string): DeliveryRecord | undefined {
    return this.deliveries.find(d => d.id === id);
  }

  public createDelivery(params: {
    customerId: string;
    driverId: string;
    assignedBy: string;
    notes?: string;
    status?: DeliveryStatus;
  }): DeliveryRecord {
    const customer = this.getCustomerById(params.customerId);
    if (!customer) throw new Error('Müştəri tapılmadı.');

    const driver = this.getDriverById(params.driverId);
    if (!driver) throw new Error('Sürücü tapılmadı.');

    const assigner = this.getUserById(params.assignedBy);
    const owner = this.getUserById(customer.ownerId);

    const now = new Date().toISOString();
    const initialStatus = params.status || 'assigned';

    const delivery: DeliveryRecord = {
      id: 'del_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerNotes: customer.notes || '',
      customerLatitude: customer.latitude,
      customerLongitude: customer.longitude,
      ownerId: customer.ownerId,
      ownerName: owner?.name || 'Məsul İstifadəçi',
      driverId: driver.id,
      driverName: driver.name,
      assignedBy: params.assignedBy,
      assignedByName: assigner?.name || 'Admin',
      status: initialStatus,
      notes: params.notes || '',
      assignedAt: now,
      deliveredAt: null,
      deliveredBy: null,
      deliveredByName: null,
      createdAt: now,
      updatedAt: now,
    };

    this.deliveries.unshift(delivery);
    this.saveDeliveries();
    syncDeliveryToFirestore(delivery);

    // Update customer with assigned driver and current delivery status
    customer.assignedDriverId = driver.id;
    customer.assignedDriverName = driver.name;
    customer.assignedAt = now;
    customer.assignedBy = params.assignedBy;
    customer.currentDeliveryStatus = initialStatus;
    customer.updatedAt = now;
    customer.updatedBy = params.assignedBy;
    this.saveCustomers();
    syncCustomerToFirestore(customer);

    return delivery;
  }

  public startDelivery(id: string, actorId: string, actorName: string): DeliveryRecord {
    const delivery = this.getDeliveryById(id);
    if (!delivery) throw new Error('Çatdırılma tapılmadı.');

    if (delivery.status === 'delivered') {
      throw new Error('Bu çatdırılma artıq təhvil verilib.');
    }

    const now = new Date().toISOString();
    delivery.status = 'in_transit';
    delivery.updatedAt = now;
    this.saveDeliveries();
    syncDeliveryToFirestore(delivery);

    const customer = this.getCustomerById(delivery.customerId);
    if (customer) {
      customer.currentDeliveryStatus = 'in_transit';
      customer.updatedAt = now;
      this.saveCustomers();
      syncCustomerToFirestore(customer);
    }

    return delivery;
  }

  public deliverDelivery(id: string, deliveredBy: string, deliveredByName: string, note?: string): DeliveryRecord {
    const delivery = this.getDeliveryById(id);
    if (!delivery) throw new Error('Çatdırılma tapılmadı.');

    // Prevent double delivery! (Requirement 11)
    if (delivery.status === 'delivered') {
      throw new Error('Bu çatdırılma artıq təhvil verilib.');
    }

    const now = new Date().toISOString();
    delivery.status = 'delivered';
    delivery.deliveredAt = now;
    delivery.deliveredBy = deliveredBy;
    delivery.deliveredByName = deliveredByName;
    delivery.updatedAt = now;
    if (note) {
      delivery.notes = delivery.notes ? `${delivery.notes} | ${note}` : note;
    }

    this.saveDeliveries();
    syncDeliveryToFirestore(delivery);

    // Update customer status
    const customer = this.getCustomerById(delivery.customerId);
    if (customer) {
      customer.currentDeliveryStatus = 'delivered';
      customer.updatedAt = now;
      this.saveCustomers();
      syncCustomerToFirestore(customer);
    }

    // Auto-create notification for the responsible User (Requirement 7)
    if (delivery.ownerId) {
      this.createNotification({
        userId: delivery.ownerId,
        title: 'Mal təhvil verildi',
        message: `🚚 ${deliveredByName} ${delivery.customerName} müştərisinin malını təhvil verdi.`,
        type: 'delivery_delivered',
        deliveryId: delivery.id,
        customerId: delivery.customerId,
        customerName: delivery.customerName,
        driverId: delivery.driverId,
        driverName: delivery.driverName,
        status: 'Təhvil verildi',
        deliveredAt: now,
      });
    }

    return delivery;
  }

  public getDriverLastDelivery(driverId: string): DeliveryRecord | undefined {
    const driverDeliveries = this.deliveries
      .filter(d => d.driverId === driverId)
      .sort((a, b) => new Date(b.deliveredAt || b.assignedAt || b.createdAt).getTime() - new Date(a.deliveredAt || a.assignedAt || a.createdAt).getTime());

    const delivered = driverDeliveries.find(d => d.status === 'delivered');
    return delivered || driverDeliveries[0];
  }

  public getDriverStats(driverId: string) {
    const list = this.deliveries.filter(d => d.driverId === driverId);
    const today = new Date().toISOString().substring(0, 10);

    const pending = list.filter(d => d.status === 'assigned' || d.status === 'in_transit').length;
    const delivered = list.filter(d => d.status === 'delivered').length;
    const todayAssigned = list.filter(d => d.assignedAt?.substring(0, 10) === today).length;
    const todayDelivered = list.filter(d => d.deliveredAt?.substring(0, 10) === today).length;
    const lastDelivery = this.getDriverLastDelivery(driverId);

    return {
      totalAssigned: list.length,
      pending,
      delivered,
      todayAssigned,
      todayDelivered,
      lastDelivery: lastDelivery || null,
    };
  }

  // --- Notifications ---
  public getNotifications(userId: string): NotificationRecord[] {
    return this.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getUnreadNotificationCount(userId: string): number {
    return this.notifications.filter(n => n.userId === userId && !n.isRead).length;
  }

  public createNotification(params: {
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
  }): NotificationRecord {
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      ...params,
      isRead: false,
      createdAt: now,
    };
    this.notifications.unshift(record);
    if (this.notifications.length > 2000) {
      this.notifications = this.notifications.slice(0, 2000);
    }
    this.saveNotifications();
    syncNotificationToFirestore(record);
    return record;
  }

  public markNotificationAsRead(id: string, userId: string): boolean {
    const notif = this.notifications.find(n => n.id === id && n.userId === userId);
    if (notif) {
      notif.isRead = true;
      this.saveNotifications();
      syncNotificationToFirestore(notif);
      return true;
    }
    return false;
  }

  public markAllNotificationsAsRead(userId: string): number {
    let count = 0;
    for (const notif of this.notifications) {
      if (notif.userId === userId && !notif.isRead) {
        notif.isRead = true;
        count++;
        syncNotificationToFirestore(notif);
      }
    }
    if (count > 0) {
      this.saveNotifications();
    }
    return count;
  }

  // ==========================================
  // --- ORDER MANAGEMENT (SİFARİŞ VƏ ÇATDIRILMA) ---
  // ==========================================

  public getOrders(params?: {
    status?: string;
    creatorId?: string;
    ownerId?: string;
    driverId?: string;
    executorId?: string;
    search?: string;
    date?: string;
  }): OrderRecord[] {
    let list = [...this.orders];

    if (params?.status) {
      if (params.status === 'active') {
        list = list.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
      } else if (params.status === 'open_for_drivers') {
        list = list.filter(o => o.status === 'pending_driver');
      } else {
        list = list.filter(o => o.status === params.status);
      }
    }

    if (params?.creatorId) {
      list = list.filter(o => o.creatorId === params.creatorId);
    }

    if (params?.ownerId) {
      list = list.filter(o => o.ownerId === params.ownerId);
    }

    if (params?.driverId) {
      list = list.filter(o => o.driverId === params.driverId || o.executorId === params.driverId);
    }

    if (params?.executorId) {
      list = list.filter(o => o.executorId === params.executorId);
    }

    if (params?.date) {
      list = list.filter(o => o.createdDateStr === params.date || o.createdAt.startsWith(params.date));
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(o =>
        o.orderNumber.toString().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.customerAddress.toLowerCase().includes(q) ||
        o.creatorName.toLowerCase().includes(q) ||
        (o.executorName && o.executorName.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getOrderById(id: string): OrderRecord | undefined {
    return this.orders.find(o => o.id === id);
  }

  public getNextOrderNumber(): number {
    if (this.orders.length === 0) return 1058;
    const maxNumber = this.orders.reduce((max, o) => (o.orderNumber > max ? o.orderNumber : max), 1057);
    return maxNumber + 1;
  }

  public notifyActiveDrivers(order: OrderRecord) {
    const activeDrivers = this.drivers.filter(d => d.status === 'active');
    for (const driver of activeDrivers) {
      this.createNotification({
        userId: driver.id,
        title: '🚚 Yeni sifariş var',
        message: `${order.customerName} üçün yeni sifariş yaradıldı. (#${order.orderNumber})`,
        type: 'order_new',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        status: 'Yeni sifariş',
      });
    }
  }

  public createOrder(params: {
    customerId: string;
    creatorId: string;
    creatorName: string;
    creatorRole: UserRole;
    notes?: string;
    dispatchType?: ExecutorType | null;
  }): OrderRecord {
    const customer = this.getCustomerById(params.customerId);
    if (!customer) {
      throw new Error('Müştəri tapılmadı.');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);
    const orderNumber = this.getNextOrderNumber();

    let initialStatus: OrderStatus = 'new';
    let executorType: ExecutorType | null = null;
    let executorId: string | null = null;
    let executorName: string | null = null;
    let driverId: string | null = null;
    let driverName: string | null = null;
    let claimedAt: string | null = null;

    if (params.dispatchType === 'USER') {
      initialStatus = 'assigned';
      executorType = 'USER';
      executorId = params.creatorId;
      executorName = params.creatorName;
      claimedAt = nowIso;
    } else if (params.dispatchType === 'DRIVER') {
      initialStatus = 'pending_driver';
      executorType = null;
    }

    const history: OrderHistoryEvent[] = [
      {
        step: 'CREATED',
        title: 'Sifariş yaradıldı',
        actorId: params.creatorId,
        actorName: params.creatorName,
        actorRole: params.creatorRole,
        timestamp: nowIso,
        dateStr,
        timeStr,
        details: params.dispatchType === 'USER'
          ? `User ${params.creatorName} sifarişi yaratdı və özü aparmağı seçdi.`
          : params.dispatchType === 'DRIVER'
          ? `User ${params.creatorName} sifarişi yaratdı və sürücülərə yönləndirdi.`
          : `User ${params.creatorName} sifarişi yaratdı.`,
      },
    ];

    const order: OrderRecord = {
      id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      orderNumber,
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      customerLatitude: customer.latitude,
      customerLongitude: customer.longitude,
      customerNotes: customer.notes,
      ownerId: customer.ownerId,
      ownerName: this.users.find((u) => u.id === customer.ownerId)?.name || customer.ownerId || 'Bilinməyən',
      creatorId: params.creatorId,
      creatorName: params.creatorName,
      creatorRole: params.creatorRole,
      status: initialStatus,
      dispatchType: params.dispatchType || null,
      executorType,
      executorId,
      executorName,
      driverId,
      driverName,
      notes: params.notes || '',
      createdAt: nowIso,
      createdDateStr: dateStr,
      createdTimeStr: timeStr,
      claimedAt,
      departedAt: null,
      deliveredAt: null,
      deliveredBy: null,
      deliveredByName: null,
      deliveredLocation: null,
      currentLocation: null,
      history,
      updatedAt: nowIso,
    };

    this.orders.unshift(order);
    this.saveOrders();
    syncOrderToFirestore(order);

    // If driver dispatch selected, notify drivers immediately (Requirement 4)
    if (params.dispatchType === 'DRIVER') {
      this.notifyActiveDrivers(order);
    }

    // Also update customer's currentDeliveryStatus for backward compatibility
    customer.currentDeliveryStatus = initialStatus === 'assigned' ? 'assigned' : null;
    customer.updatedAt = nowIso;
    this.saveCustomers();
    syncCustomerToFirestore(customer);

    this.addLog({
      userId: params.creatorId,
      userName: params.creatorName,
      role: params.creatorRole,
      action: 'Sifariş yaradıldı',
      actionType: 'ORDER_CREATED',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      details: `${customer.fullName} üçün #${order.orderNumber} nömrəli yeni sifariş qeydə alındı.`,
      newData: { orderNumber: order.orderNumber, status: order.status },
    });

    return order;
  }

  public dispatchOrder(
    orderId: string,
    dispatchType: ExecutorType,
    actorId: string,
    actorName: string,
    actorRole: UserRole
  ): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Sifariş tapılmadı.');

    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);

    if (dispatchType === 'USER') {
      order.dispatchType = 'USER';
      order.executorType = 'USER';
      order.executorId = actorId;
      order.executorName = actorName;
      order.status = 'assigned';
      order.claimedAt = nowIso;
      order.updatedAt = nowIso;

      order.history.push({
        step: 'DISPATCH_SELECTED',
        title: 'User özü aparır',
        actorId,
        actorName,
        actorRole,
        timestamp: nowIso,
        dateStr,
        timeStr,
        details: `User ${actorName} sifarişi özü çatdırmağı seçdi.`,
      });

      this.saveOrders();
      syncOrderToFirestore(order);
    } else {
      order.dispatchType = 'DRIVER';
      order.status = 'pending_driver';
      order.executorType = null;
      order.executorId = null;
      order.executorName = null;
      order.driverId = null;
      order.driverName = null;
      order.updatedAt = nowIso;

      order.history.push({
        step: 'DISPATCH_SELECTED',
        title: 'Sürücülərə yönləndirildi',
        actorId,
        actorName,
        actorRole,
        timestamp: nowIso,
        dateStr,
        timeStr,
        details: `Sifariş bütün aktiv sürücülərə açıq elan edildi.`,
      });

      this.saveOrders();
      syncOrderToFirestore(order);

      // Notify active drivers (Requirement 4 & 12)
      this.notifyActiveDrivers(order);
    }

    return order;
  }

  // ATOMIC claim order - Race condition protection (Requirement 6)
  public claimOrder(orderId: string, driverId: string, driverName: string): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error('Sifariş tapılmadı.');
    }

    // Atomic race-condition check
    if (order.status !== 'pending_driver' && order.status !== 'new') {
      throw new Error('Bu sifariş artıq başqa sürücü tərəfindən götürülüb və ya icradadır.');
    }
    if (order.executorId && order.executorId !== driverId) {
      throw new Error(`Bu sifariş artıq ${order.executorName || 'başqa sürücü'} tərəfindən götürülüb.`);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);

    order.status = 'assigned';
    order.dispatchType = 'DRIVER';
    order.executorType = 'DRIVER';
    order.executorId = driverId;
    order.executorName = driverName;
    order.driverId = driverId;
    order.driverName = driverName;
    order.claimedAt = nowIso;
    order.updatedAt = nowIso;

    order.history.push({
      step: 'CLAIMED',
      title: 'Sürücü sifarişi götürdü',
      actorId: driverId,
      actorName: driverName,
      actorRole: 'DRIVER',
      timestamp: nowIso,
      dateStr,
      timeStr,
      details: `Sürücü ${driverName} sifarişi qəbul etdi.`,
    });

    this.saveOrders();
    syncOrderToFirestore(order);

    // Notify the User who created the order (Requirement 7)
    if (order.creatorId) {
      this.createNotification({
        userId: order.creatorId,
        title: 'Sifariş götürüldü',
        message: `🚚 ${driverName} ${order.customerName} sifarişini götürdü. (#${order.orderNumber})`,
        type: 'order_claimed',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        driverId,
        driverName,
        status: 'Götürüldü',
      });
    }

    return order;
  }

  public startOrder(
    orderId: string,
    actorId: string,
    actorName: string,
    actorRole: UserRole
  ): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Sifariş tapılmadı.');

    if (order.status === 'delivered') {
      throw new Error('Bu sifariş artıq təhvil verilib.');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);

    order.status = 'in_transit';
    order.departedAt = nowIso;
    order.updatedAt = nowIso;

    order.history.push({
      step: 'DEPARTED',
      title: 'Yola çıxdı',
      actorId,
      actorName,
      actorRole,
      timestamp: nowIso,
      dateStr,
      timeStr,
      details: `${actorName} müştəriyə doğru yola çıxdı.`,
    });

    this.saveOrders();
    syncOrderToFirestore(order);

    // Notify User if driver departed (Requirement 8)
    if (order.executorType === 'DRIVER' && order.creatorId && order.creatorId !== actorId) {
      this.createNotification({
        userId: order.creatorId,
        title: 'Sürücü yola çıxdı',
        message: `🚚 ${actorName} ${order.customerName} üçün yola çıxdı. (#${order.orderNumber})`,
        type: 'order_departed',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        driverId: actorId,
        driverName: actorName,
        status: 'Yoldadır',
      });
    }

    return order;
  }

  public updateOrderLocation(
    orderId: string,
    location: {
      latitude: number;
      longitude: number;
      speed?: number | null;
      accuracy?: number | null;
      heading?: number | null;
    }
  ): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Sifariş tapılmadı.');

    const nowIso = new Date().toISOString();

    // Auto-compute directional heading (azimuth) if not supplied by device
    let computedHeading: number | null = location.heading !== undefined && location.heading !== null && !isNaN(location.heading)
      ? Math.round(location.heading)
      : null;

    if (computedHeading === null && order.currentLocation) {
      const prevLat = order.currentLocation.latitude;
      const prevLng = order.currentLocation.longitude;
      if (Math.abs(prevLat - location.latitude) > 0.00002 || Math.abs(prevLng - location.longitude) > 0.00002) {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const toDeg = (rad: number) => (rad * 180) / Math.PI;
        const φ1 = toRad(prevLat);
        const φ2 = toRad(location.latitude);
        const Δλ = toRad(location.longitude - prevLng);
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        const θ = Math.atan2(y, x);
        computedHeading = Math.round((toDeg(θ) + 360) % 360);
      } else if (order.currentLocation.heading !== undefined && order.currentLocation.heading !== null) {
        computedHeading = order.currentLocation.heading;
      }
    }

    order.currentLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed ?? null,
      accuracy: location.accuracy ?? null,
      heading: computedHeading,
      updatedAt: nowIso,
    };

    if (!order.trajectory) {
      order.trajectory = [];
    }

    // Append to trajectory breadcrumbs history
    const lastPoint = order.trajectory[order.trajectory.length - 1];
    const isNewLocation =
      !lastPoint ||
      Math.abs(lastPoint.latitude - location.latitude) > 0.00002 ||
      Math.abs(lastPoint.longitude - location.longitude) > 0.00002;

    if (isNewLocation) {
      order.trajectory.push({
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed ?? null,
        accuracy: location.accuracy ?? null,
        heading: computedHeading,
        timestamp: nowIso,
      });

      // Keep trajectory size optimal (max 2500 points)
      if (order.trajectory.length > 2500) {
        order.trajectory = order.trajectory.slice(-2500);
      }
    }

    order.updatedAt = nowIso;

    this.saveOrders();
    syncOrderToFirestore(order);
    return order;
  }

  public deliverOrder(
    orderId: string,
    deliveredBy: string,
    deliveredByName: string,
    location?: { latitude: number; longitude: number; accuracy?: number; heading?: number | null } | null,
    note?: string
  ): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Sifariş tapılmadı.');

    // Double delivery check (Requirement 13)
    if (order.status === 'delivered') {
      throw new Error('Bu sifariş artıq təhvil verilib.');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);

    order.status = 'delivered';
    order.deliveredAt = nowIso;
    order.deliveredBy = deliveredBy;
    order.deliveredByName = deliveredByName;
    order.deliveredLocation = location || null;

    // Append final delivery location to trajectory history so route is complete
    if (location && location.latitude && location.longitude) {
      if (!order.trajectory) {
        order.trajectory = [];
      }
      order.trajectory.push({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy ?? null,
        heading: location.heading ?? null,
        speed: 0,
        timestamp: nowIso,
      });
      order.currentLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy ?? null,
        speed: 0,
        heading: location.heading ?? null,
        updatedAt: nowIso,
      };
    }
    if (note) {
      order.notes = order.notes ? `${order.notes} | ${note}` : note;
    }
    order.updatedAt = nowIso;

    order.history.push({
      step: 'DELIVERED',
      title: 'Təhvil verildi',
      actorId: deliveredBy,
      actorName: deliveredByName,
      actorRole: order.executorType === 'DRIVER' ? 'DRIVER' : 'USER',
      timestamp: nowIso,
      dateStr,
      timeStr,
      details: `${deliveredByName} sifarişi müştəriyə təhvil verdi.${note ? ` Qeyd: ${note}` : ''}`,
      location: location || undefined,
    });

    this.saveOrders();
    syncOrderToFirestore(order);

    // Notify User who created the order (Requirement 15)
    if (order.creatorId) {
      const isSelf = order.creatorId === deliveredBy;
      this.createNotification({
        userId: order.creatorId,
        title: 'Sifariş təhvil verildi',
        message: isSelf
          ? `✅ Siz ${order.customerName} sifarişini təhvil verdiniz. (#${order.orderNumber})`
          : `✅ ${deliveredByName} ${order.customerName} sifarişini təhvil verdi. (#${order.orderNumber})`,
        type: 'order_delivered',
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        driverId: order.driverId || undefined,
        driverName: deliveredByName,
        status: 'Təhvil verildi',
        deliveredAt: nowIso,
      });
    }

    return order;
  }

  public updateOrder(
    orderId: string,
    updates: {
      customerName?: string;
      customerPhone?: string;
      customerAddress?: string;
      customerLatitude?: number;
      customerLongitude?: number;
      notes?: string;
      status?: OrderStatus;
      dispatchType?: ExecutorType | null;
      executorType?: ExecutorType | null;
      executorId?: string | null;
      executorName?: string | null;
    },
    actor: { id: string; name: string; role: UserRole }
  ): OrderRecord {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Sifariş tapılmadı.');

    const now = new Date();
    const nowIso = now.toISOString();
    const { dateStr, timeStr } = getBakuDateTime(now);
    const oldStatus = order.status;
    const changeNotes: string[] = [];

    if (updates.customerName !== undefined && updates.customerName.trim() !== order.customerName) {
      changeNotes.push(`Müştəri: ${order.customerName} -> ${updates.customerName.trim()}`);
      order.customerName = updates.customerName.trim();
    }
    if (updates.customerPhone !== undefined && updates.customerPhone.trim() !== order.customerPhone) {
      changeNotes.push(`Telefon: ${order.customerPhone} -> ${updates.customerPhone.trim()}`);
      order.customerPhone = normalizePhone(updates.customerPhone.trim());
    }
    if (updates.customerAddress !== undefined && updates.customerAddress.trim() !== order.customerAddress) {
      changeNotes.push(`Ünvan: ${order.customerAddress} -> ${updates.customerAddress.trim()}`);
      order.customerAddress = updates.customerAddress.trim();
    }
    if (updates.customerLatitude !== undefined && !isNaN(Number(updates.customerLatitude))) {
      order.customerLatitude = Number(updates.customerLatitude);
    }
    if (updates.customerLongitude !== undefined && !isNaN(Number(updates.customerLongitude))) {
      order.customerLongitude = Number(updates.customerLongitude);
    }
    if (updates.notes !== undefined) {
      order.notes = updates.notes;
    }

    if (updates.dispatchType !== undefined) {
      order.dispatchType = updates.dispatchType;
    }

    // Assign / update executor
    if (updates.executorId !== undefined) {
      if (!updates.executorId) {
        order.executorId = null;
        order.executorName = null;
        order.executorType = null;
        order.driverId = null;
        order.driverName = null;
        changeNotes.push('İcraçı təyinatı silindi');
      } else {
        const execType = updates.executorType || 'DRIVER';
        let execName = updates.executorName || '';
        if (!execName) {
          if (execType === 'DRIVER') {
            const drv = this.getDriverById(updates.executorId);
            execName = drv?.name || 'Sürücü';
          } else {
            const usr = this.getUserById(updates.executorId);
            execName = usr?.name || 'İstifadəçi';
          }
        }
        order.executorId = updates.executorId;
        order.executorType = execType;
        order.executorName = execName;
        if (execType === 'DRIVER') {
          order.driverId = updates.executorId;
          order.driverName = execName;
        } else {
          order.driverId = null;
          order.driverName = null;
        }
        changeNotes.push(`İcraçı: ${execName} (${execType === 'DRIVER' ? 'Sürücü' : 'User'})`);
      }
    }

    // Status change
    if (updates.status !== undefined && updates.status !== order.status) {
      changeNotes.push(`Status: ${oldStatus} -> ${updates.status}`);
      order.status = updates.status;
      if (updates.status === 'delivered' && !order.deliveredAt) {
        order.deliveredAt = nowIso;
        order.deliveredBy = actor.id;
        order.deliveredByName = actor.name;
      }
      if (updates.status === 'in_transit' && !order.departedAt) {
        order.departedAt = nowIso;
      }
      if (updates.status === 'assigned' && !order.claimedAt) {
        order.claimedAt = nowIso;
      }
    }

    order.updatedAt = nowIso;

    order.history.push({
      step: 'EDITED',
      title: 'Sifariş redaktə edildi',
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: nowIso,
      dateStr,
      timeStr,
      details: changeNotes.length > 0
        ? `Dəyişikliklər: ${changeNotes.join('; ')}`
        : `${actor.name} tərəfindən redaktə edildi.`,
    });

    this.saveOrders();
    syncOrderToFirestore(order);

    this.addLog({
      userId: actor.id,
      userName: actor.name,
      role: actor.role,
      action: 'Sifariş redaktə edildi',
      actionType: 'ORDER_UPDATED',
      entityType: 'DELIVERY',
      entityId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      details: `Admin ${actor.name} #${order.orderNumber} nömrəli sifarişi redaktə etdi. ${changeNotes.join(', ')}`,
      newData: order,
    });

    return order;
  }

  public deleteOrder(orderId: string, actor: { id: string; name: string; role: UserRole }): boolean {
    const idx = this.orders.findIndex(o => o.id === orderId);
    if (idx === -1) throw new Error('Sifariş tapılmadı.');

    const deleted = this.orders[idx];
    this.orders.splice(idx, 1);
    this.saveOrders();
    deleteOrderFromFirestore(orderId);

    this.addLog({
      userId: actor.id,
      userName: actor.name,
      role: actor.role,
      action: 'Sifariş silindi',
      actionType: 'ORDER_DELETED',
      entityType: 'DELIVERY',
      entityId: deleted.id,
      customerId: deleted.customerId,
      customerName: deleted.customerName,
      details: `Admin ${actor.name} #${deleted.orderNumber} nömrəli sifarişi sistemdən sildi.`,
      oldData: deleted,
    });

    return true;
  }

  // Dashboard Stats matching Requirement 21 for User, Driver, Admin
  public getOrderDashboardStats(currentUser: { id: string; role: UserRole; name: string }) {
    const todayStr = getBakuDateTime().dateStr;
    const allOrders = this.orders;

    if (currentUser.role === 'DRIVER') {
      const driverOrders = allOrders.filter(o => o.driverId === currentUser.id || o.executorId === currentUser.id);
      const openOrders = allOrders.filter(o => o.status === 'pending_driver');
      const assignedToMe = driverOrders.filter(o => o.status === 'assigned');
      const inTransit = driverOrders.filter(o => o.status === 'in_transit');
      const deliveredByMe = driverOrders.filter(o => o.status === 'delivered');
      const todayDelivered = deliveredByMe.filter(o => {
        if (!o.deliveredAt) return false;
        const { dateStr } = getBakuDateTime(new Date(o.deliveredAt));
        return dateStr === todayStr;
      });

      const lastDelivery = deliveredByMe.sort((a, b) => new Date(b.deliveredAt || 0).getTime() - new Date(a.deliveredAt || 0).getTime())[0] || null;

      return {
        role: 'DRIVER',
        openOrdersCount: openOrders.length,
        assignedCount: assignedToMe.length,
        inTransitCount: inTransit.length,
        deliveredCount: deliveredByMe.length,
        todayDeliveredCount: todayDelivered.length,
        lastDelivery,
        openOrders: openOrders.slice(0, 10),
        activeOrders: [...inTransit, ...assignedToMe],
        recentDelivered: deliveredByMe.slice(0, 5),
      };
    }

    if (currentUser.role === 'USER') {
      const myOrders = allOrders.filter(o => o.creatorId === currentUser.id || o.ownerId === currentUser.id);
      const newOrders = myOrders.filter(o => o.status === 'new');
      const waitingDrivers = myOrders.filter(o => o.status === 'pending_driver');
      const pendingTotal = myOrders.filter(o => o.status === 'new' || o.status === 'pending_driver' || o.status === 'assigned');
      const inTransit = myOrders.filter(o => o.status === 'in_transit');
      const delivered = myOrders.filter(o => o.status === 'delivered');
      const activeLive = inTransit; // Live tracking available

      return {
        role: 'USER',
        newOrdersCount: newOrders.length,
        pendingDriversCount: waitingDrivers.length,
        pendingTotalCount: pendingTotal.length,
        inTransitCount: inTransit.length,
        deliveredCount: delivered.length,
        activeLiveCount: activeLive.length,
        recentOrders: myOrders.slice(0, 10),
        activeLiveOrders: activeLive,
      };
    }

    // ADMIN
    const totalOrders = allOrders.length;
    const newOrders = allOrders.filter(o => o.status === 'new' || o.status === 'pending_driver');
    const inTransit = allOrders.filter(o => o.status === 'in_transit');
    const delivered = allOrders.filter(o => o.status === 'delivered');
    const activeDrivers = this.drivers.filter(d => d.status === 'active').length;

    return {
      role: 'ADMIN',
      totalOrders,
      newOrdersCount: newOrders.length,
      inTransitCount: inTransit.length,
      deliveredCount: delivered.length,
      activeDriversCount: activeDrivers,
      activeDeliveriesCount: inTransit.length,
      recentOrders: allOrders.slice(0, 15),
      inTransitOrders: inTransit,
    };
  }
}

export const db = new Database();

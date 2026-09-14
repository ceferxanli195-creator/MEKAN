import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  Firestore,
} from 'firebase/firestore';
import { CustomerRecord, UserRecord, DriverRecord, AuditLogRecord, DeliveryRecord, NotificationRecord, OrderRecord } from './types';

let db: Firestore | null = null;

export function getFirestoreDb(): Firestore | null {
  if (db) return db;

  try {
    let config: any = null;
    if (process.env.FIREBASE_CONFIG) {
      try {
        config = typeof process.env.FIREBASE_CONFIG === 'string'
          ? JSON.parse(process.env.FIREBASE_CONFIG)
          : process.env.FIREBASE_CONFIG;
      } catch (e) {
        console.warn('Could not parse FIREBASE_CONFIG env var:', e);
      }
    }

    if (!config) {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(raw);
      }
    }

    if (!config) {
      console.warn('Firebase config not found (checked FIREBASE_CONFIG env and firebase-applet-config.json), running with local persistence.');
      return null;
    }

    const existingApps = getApps();
    const app = (!existingApps || existingApps.length === 0) ? initializeApp(config) : getApp();
    db = getFirestore(app, config.firestoreDatabaseId);
    console.log('Server connected to Firestore database:', config.firestoreDatabaseId);
    return db;
  } catch (err) {
    console.error('Failed to initialize Firestore on server:', err);
    return null;
  }
}

// Quota circuit breaker to prevent stream crash when daily write quota is exceeded
const QUOTA_STATE_FILE = path.join(process.cwd(), 'data', '.firestore_quota_state.json');

function getNextQuotaResetTime(): number {
  const now = new Date();
  const reset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  reset.setUTCHours(8, 0, 0, 0); // 8 AM UTC safely covers midnight Pacific Time
  return reset.getTime();
}

function loadQuotaState(): { isExhausted: boolean; exhaustedUntil: number } {
  try {
    if (fs.existsSync(QUOTA_STATE_FILE)) {
      const raw = fs.readFileSync(QUOTA_STATE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (data && data.isExhausted && (typeof data.exhaustedUntil !== 'number' || data.exhaustedUntil > Date.now())) {
        return { isExhausted: true, exhaustedUntil: data.exhaustedUntil || (Date.now() + 12 * 3600 * 1000) };
      }
    }
  } catch {}
  return { isExhausted: false, exhaustedUntil: 0 };
}

function saveQuotaState(isExhausted: boolean, exhaustedUntil: number, reason: string = 'RESOURCE_EXHAUSTED') {
  try {
    const dir = path.dirname(QUOTA_STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      QUOTA_STATE_FILE,
      JSON.stringify({ isExhausted, exhaustedUntil, reason, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch {}
}

const initialQuota = loadQuotaState();
let isQuotaExhausted = initialQuota.isExhausted;
let quotaExhaustedUntil = initialQuota.exhaustedUntil;
let lastQuotaLogTime = 0;

export function isFirestoreQuotaExceeded(): boolean {
  if (!isQuotaExhausted) return false;
  if (quotaExhaustedUntil > 0 && Date.now() > quotaExhaustedUntil) {
    // Quota reset period elapsed, allow writes again
    isQuotaExhausted = false;
    quotaExhaustedUntil = 0;
    saveQuotaState(false, 0, 'RESET');
    return false;
  }
  return true;
}

function handleFirestoreWriteError(operation: string, targetId: string, err: any) {
  const errMsg = err?.message || String(err);
  const isQuota =
    errMsg.includes('RESOURCE_EXHAUSTED') ||
    errMsg.includes('Quota limit exceeded') ||
    errMsg.includes('resource-exhausted') ||
    err?.code === 8 ||
    err?.code === 'resource-exhausted';

  if (isQuota) {
    isQuotaExhausted = true;
    quotaExhaustedUntil = getNextQuotaResetTime();
    saveQuotaState(true, quotaExhaustedUntil, errMsg);
    const now = Date.now();
    if (now - lastQuotaLogTime > 10 * 60 * 1000) {
      lastQuotaLogTime = now;
      console.warn(
        '[Firestore Guard] Firebase pulsuz gündəlik yazma limiti (20,000) doldu. ' +
        'Tətbiq fasiləsiz olaraq yerli JSON fayl bazasında (data/*.json) işləyir. ' +
        'Bütün məlumatlar itkisiz saxlanılır.'
      );
    }
    return;
  }

  console.error(`Failed to ${operation} ${targetId} to Firestore:`, errMsg);
}

function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) return null;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeForFirestore);
  
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data as Record<string, any>)) {
    if (v !== undefined) {
      clean[k] = sanitizeForFirestore(v);
    }
  }
  return clean;
}

// Save customer to Firestore
export async function syncCustomerToFirestore(customer: CustomerRecord): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'customers', customer.id);
    await setDoc(docRef, sanitizeForFirestore(customer), { merge: true });
  } catch (err) {
    handleFirestoreWriteError('sync customer', customer.id, err);
  }
}

// Delete customer from Firestore
export async function deleteCustomerFromFirestore(customerId: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'customers', customerId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreWriteError('delete customer', customerId, err);
  }
}

// Save user to Firestore
export async function syncUserToFirestore(user: UserRecord): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'users', user.id);
    await setDoc(docRef, sanitizeForFirestore(user), { merge: true });
  } catch (err) {
    handleFirestoreWriteError('sync user', user.id, err);
  }
}

// Delete user from Firestore
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'users', userId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreWriteError('delete user', userId, err);
  }
}

// Save driver to Firestore
export async function syncDriverToFirestore(driver: DriverRecord): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'drivers', driver.id);
    await setDoc(docRef, sanitizeForFirestore(driver), { merge: true });
  } catch (err) {
    handleFirestoreWriteError('sync driver', driver.id, err);
  }
}

// Delete driver from Firestore
export async function deleteDriverFromFirestore(driverId: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'drivers', driverId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreWriteError('delete driver', driverId, err);
  }
}

// Save log to Firestore (Reserved: Audit logs are stored in data/logs.json to protect free cloud write quota)
export async function syncLogToFirestore(_log: AuditLogRecord): Promise<void> {
  // Deliberately no-op to preserve Firestore write quota for critical entities
  return;
}

// Save order to Firestore
export async function syncOrderToFirestore(order: OrderRecord): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'orders', order.id);
    await setDoc(docRef, sanitizeForFirestore(order), { merge: true });
  } catch (err) {
    handleFirestoreWriteError('sync order', order.id, err);
  }
}

export async function deleteOrderFromFirestore(id: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    await deleteDoc(doc(fdb, 'orders', id));
  } catch (err) {
    handleFirestoreWriteError('delete order', id, err);
  }
}

// Save delivery to Firestore
export async function syncDeliveryToFirestore(delivery: DeliveryRecord): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'deliveries', delivery.id);
    await setDoc(docRef, sanitizeForFirestore(delivery), { merge: true });
  } catch (err) {
    handleFirestoreWriteError('sync delivery', delivery.id, err);
  }
}

export async function deleteDeliveryFromFirestore(id: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    await deleteDoc(doc(fdb, 'deliveries', id));
  } catch (err) {
    handleFirestoreWriteError('delete delivery', id, err);
  }
}

// Save notification to Firestore
export async function syncNotificationToFirestore(notification: NotificationRecord): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'notifications', notification.id);
    await setDoc(docRef, sanitizeForFirestore(notification), { merge: true });
  } catch (err) {
    handleFirestoreWriteError('sync notification', notification.id, err);
  }
}

export async function deleteNotificationFromFirestore(id: string): Promise<void> {
  if (isFirestoreQuotaExceeded()) return;
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    await deleteDoc(doc(fdb, 'notifications', id));
  } catch (err) {
    handleFirestoreWriteError('delete notification', id, err);
  }
}

// Initial Sync from Firestore (Load cloud records on startup if cloud has existing records)
export async function loadInitialDataFromFirestore(): Promise<{
  customers?: CustomerRecord[];
  users?: UserRecord[];
  drivers?: DriverRecord[];
  logs?: AuditLogRecord[];
  deliveries?: DeliveryRecord[];
  notifications?: NotificationRecord[];
  orders?: OrderRecord[];
}> {
  const fdb = getFirestoreDb();
  if (!fdb) return {};

  const result: {
    customers?: CustomerRecord[];
    users?: UserRecord[];
    drivers?: DriverRecord[];
    logs?: AuditLogRecord[];
    deliveries?: DeliveryRecord[];
    notifications?: NotificationRecord[];
    orders?: OrderRecord[];
  } = {};

  try {
    // Customers
    const custSnap = await getDocs(collection(fdb, 'customers'));
    if (!custSnap.empty) {
      result.customers = custSnap.docs.map(d => d.data() as CustomerRecord);
    }

    // Users
    const userSnap = await getDocs(collection(fdb, 'users'));
    if (!userSnap.empty) {
      result.users = userSnap.docs.map(d => d.data() as UserRecord);
    }

    // Drivers
    const driverSnap = await getDocs(collection(fdb, 'drivers'));
    if (!driverSnap.empty) {
      result.drivers = driverSnap.docs.map(d => d.data() as DriverRecord);
    }

    // Logs
    const logSnap = await getDocs(collection(fdb, 'logs'));
    if (!logSnap.empty) {
      result.logs = logSnap.docs.map(d => d.data() as AuditLogRecord);
    }

    // Deliveries
    const deliverySnap = await getDocs(collection(fdb, 'deliveries'));
    if (!deliverySnap.empty) {
      result.deliveries = deliverySnap.docs.map(d => d.data() as DeliveryRecord);
    }

    // Orders
    const orderSnap = await getDocs(collection(fdb, 'orders'));
    if (!orderSnap.empty) {
      result.orders = orderSnap.docs.map(d => d.data() as OrderRecord);
    }

    // Notifications
    const notifSnap = await getDocs(collection(fdb, 'notifications'));
    if (!notifSnap.empty) {
      result.notifications = notifSnap.docs.map(d => d.data() as NotificationRecord);
    }
  } catch (err) {
    console.error('Error fetching initial records from Firestore:', err);
  }

  return result;
}

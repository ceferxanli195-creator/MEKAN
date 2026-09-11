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
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'customers', customer.id);
    await setDoc(docRef, sanitizeForFirestore(customer), { merge: true });
  } catch (err) {
    console.error(`Failed to sync customer ${customer.id} to Firestore:`, err);
  }
}

// Delete customer from Firestore
export async function deleteCustomerFromFirestore(customerId: string): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'customers', customerId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Failed to delete customer ${customerId} from Firestore:`, err);
  }
}

// Save user to Firestore
export async function syncUserToFirestore(user: UserRecord): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'users', user.id);
    await setDoc(docRef, sanitizeForFirestore(user), { merge: true });
  } catch (err) {
    console.error(`Failed to sync user ${user.id} to Firestore:`, err);
  }
}

// Delete user from Firestore
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'users', userId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Failed to delete user ${userId} from Firestore:`, err);
  }
}

// Save driver to Firestore
export async function syncDriverToFirestore(driver: DriverRecord): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'drivers', driver.id);
    await setDoc(docRef, sanitizeForFirestore(driver), { merge: true });
  } catch (err) {
    console.error(`Failed to sync driver ${driver.id} to Firestore:`, err);
  }
}

// Delete driver from Firestore
export async function deleteDriverFromFirestore(driverId: string): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'drivers', driverId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Failed to delete driver ${driverId} from Firestore:`, err);
  }
}

// Save log to Firestore
export async function syncLogToFirestore(log: AuditLogRecord): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'logs', log.id);
    await setDoc(docRef, sanitizeForFirestore(log));
  } catch (err) {
    console.error(`Failed to sync log ${log.id} to Firestore:`, err);
  }
}

// Save order to Firestore
export async function syncOrderToFirestore(order: OrderRecord): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'orders', order.id);
    await setDoc(docRef, sanitizeForFirestore(order), { merge: true });
  } catch (err) {
    console.error(`Failed to sync order ${order.id} to Firestore:`, err);
  }
}

export async function deleteOrderFromFirestore(id: string): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    await deleteDoc(doc(fdb, 'orders', id));
  } catch (err) {
    console.error(`Failed to delete order ${id} from Firestore:`, err);
  }
}

// Save delivery to Firestore
export async function syncDeliveryToFirestore(delivery: DeliveryRecord): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'deliveries', delivery.id);
    await setDoc(docRef, sanitizeForFirestore(delivery), { merge: true });
  } catch (err) {
    console.error(`Failed to sync delivery ${delivery.id} to Firestore:`, err);
  }
}

export async function deleteDeliveryFromFirestore(id: string): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    await deleteDoc(doc(fdb, 'deliveries', id));
  } catch (err) {
    console.error(`Failed to delete delivery ${id} from Firestore:`, err);
  }
}

// Save notification to Firestore
export async function syncNotificationToFirestore(notification: NotificationRecord): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    const docRef = doc(fdb, 'notifications', notification.id);
    await setDoc(docRef, sanitizeForFirestore(notification), { merge: true });
  } catch (err) {
    console.error(`Failed to sync notification ${notification.id} to Firestore:`, err);
  }
}

export async function deleteNotificationFromFirestore(id: string): Promise<void> {
  const fdb = getFirestoreDb();
  if (!fdb) return;
  try {
    await deleteDoc(doc(fdb, 'notifications', id));
  } catch (err) {
    console.error(`Failed to delete notification ${id} from Firestore:`, err);
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

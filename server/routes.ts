import { Router, Response } from 'express';
import { db, verifyPassword, normalizePhone } from './db';
import { authMiddleware, createToken, requireRole, requirePermission, AuthRequest } from './auth';
import { CustomerRecord, UserPermissions } from './types';

export const router = Router();

// Azerbaijani lowercase helper for case-insensitive search
function azNormalize(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ə/g, 'ə')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ö/g, 'ö')
    .replace(/Ş/g, 'ş')
    .replace(/Ü/g, 'ü')
    .replace(/Ç/g, 'ç');
}

// -------------------------------------------------------------
// 1. AUTHENTICATION (ID + Password only, no email, no phone)
// -------------------------------------------------------------

router.post('/auth/login', (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ error: 'İstifadəçi ID və Şifrə tələb olunur.' });
    }

    const cleanId = loginId.trim().toLowerCase();

    // Check Users first
    const user = db.getUserByLoginId(cleanId);
    if (user) {
      if (!verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Daxil edilən ID və ya Şifrə yanlışdır.' });
      }
      if (user.status === 'inactive') {
        return res.status(403).json({ error: 'Hesabınız deaktiv edilib. Zəhmət olmasa adminlə əlaqə saxlayın.' });
      }

      const now = new Date().toISOString();
      user.lastLogin = now;
      user.lastActivity = now;

      const token = createToken({
        id: user.id,
        loginId: user.loginId,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      });

      db.addLog({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: 'LOGIN',
        entityType: 'AUTH',
        details: `${user.name} (${user.loginId}) sistemə daxil oldu.`,
      });

      return res.json({
        token,
        user: {
          id: user.id,
          loginId: user.loginId,
          name: user.name,
          role: user.role,
          status: user.status,
          permissions: user.permissions,
        },
      });
    }

    // Check Drivers
    const driver = db.getDriverByLoginId(cleanId);
    if (driver) {
      if (!verifyPassword(password, driver.passwordHash)) {
        return res.status(401).json({ error: 'Daxil edilən ID və ya Şifrə yanlışdır.' });
      }
      if (driver.status === 'inactive') {
        return res.status(403).json({ error: 'Sürücü hesabı deaktiv edilib.' });
      }

      const driverPermissions: UserPermissions = {
        view_customers: true,
        create_customer: false,
        edit_customer: false,
        delete_customer: false,
        use_gps: true,
        view_map: true,
        backup_data: false,
        restore_data: false,
        view_drivers: false,
      };

      const token = createToken({
        id: driver.id,
        loginId: driver.loginId,
        name: driver.name,
        role: 'DRIVER',
        permissions: driverPermissions,
      });

      db.addLog({
        userId: driver.id,
        userName: driver.name,
        role: 'DRIVER',
        action: 'LOGIN',
        entityType: 'AUTH',
        details: `Sürücü ${driver.name} (${driver.loginId}) sistemə daxil oldu.`,
      });

      return res.json({
        token,
        user: {
          id: driver.id,
          loginId: driver.loginId,
          name: driver.name,
          role: 'DRIVER',
          status: driver.status,
          permissions: driverPermissions,
        },
      });
    }

    return res.status(401).json({ error: 'Daxil edilən ID və ya Şifrə yanlışdır.' });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Giriş zamanı xəta baş verdi. Yenidən cəhd edin.' });
  }
});

router.post('/auth/logout', authMiddleware, (req: AuthRequest, res) => {
  if (req.user) {
    db.addLog({
      userId: req.user.id,
      userName: req.user.name,
      role: req.user.role,
      action: 'LOGOUT',
      entityType: 'AUTH',
      details: `${req.user.name} sistemdən çıxış etdi.`,
    });
  }
  return res.json({ success: true });
});

router.get('/auth/me', authMiddleware, (req: AuthRequest, res) => {
  return res.json({ user: req.user });
});

router.put('/auth/change-password', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Yeni şifrə ən azı 4 simvol olmalıdır.' });
    }

    if (req.user?.role === 'DRIVER') {
      const driver = db.getDriverById(req.user.id);
      if (!driver || !verifyPassword(oldPassword, driver.passwordHash)) {
        return res.status(400).json({ error: 'Cari şifrə yanlışdır.' });
      }
      db.updateDriver(driver.id, { password: newPassword });
    } else if (req.user) {
      const user = db.getUserById(req.user.id);
      if (!user || !verifyPassword(oldPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Cari şifrə yanlışdır.' });
      }
      db.updateUser(user.id, { password: newPassword });
    }

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'UPDATE_PASSWORD',
      entityType: 'USER',
      details: `${req.user!.name} öz şifrəsini yenilədi.`,
    });

    return res.json({ success: true, message: 'Şifrə uğurla dəyişdirildi.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Xəta baş verdi.' });
  }
});

// -------------------------------------------------------------
// 2. DASHBOARD STATS
// -------------------------------------------------------------

router.get('/dashboard/stats', authMiddleware, (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    const userId = req.user!.id;
    const todayStr = new Date().toISOString().slice(0, 10);

    const allCustomers = db.getCustomers(true);
    const activeCustomers = allCustomers.filter(c => !c.isDeleted);
    const deletedCustomers = allCustomers.filter(c => c.isDeleted);
    const users = db.getUsers();
    const drivers = db.getDrivers();

    // Business operations (no auth logs)
    const businessOps = db.getOperations({ userRole: role, userId });
    const todayOperations = businessOps.filter(o => o.createdAt.startsWith(todayStr)).length;

    const allDeliveries = db.getDeliveries();

    if (role === 'ADMIN') {
      const todayCustomers = activeCustomers.filter(c => c.createdAt.startsWith(todayStr)).length;
      const todayDrivers = drivers.filter(d => d.createdAt.startsWith(todayStr)).length;
      const pendingAssignments = activeCustomers.filter(c => !c.assignedDriverId).length;

      const recentCustomers = activeCustomers.slice(0, 6);
      const recentDrivers = drivers.slice(0, 6);
      const recentAssignments = activeCustomers
        .filter(c => c.assignedDriverId && c.assignedDriverName)
        .slice(0, 6)
        .map(c => ({
          id: c.id,
          customerName: c.fullName,
          driverName: c.assignedDriverName || 'Sürücü',
          assignedAt: c.assignedAt || c.updatedAt,
        }));
      const recentActivities = businessOps.slice(0, 10);

      const todayDelivered = allDeliveries.filter(d => d.status === 'delivered' && d.deliveredAt?.startsWith(todayStr)).length;
      const inTransitDeliveries = allDeliveries.filter(d => d.status === 'in_transit').length;
      const deliveredDeliveries = allDeliveries.filter(d => d.status === 'delivered').length;
      const pendingDeliveries = allDeliveries.filter(d => d.status === 'assigned').length;

      return res.json({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === 'active').length,
        totalCustomers: activeCustomers.length,
        activeCustomers: activeCustomers.length,
        deletedCustomers: deletedCustomers.length,
        totalDrivers: drivers.length,
        activeDrivers: drivers.filter(d => d.status === 'active').length,
        todayCustomers,
        todayDrivers,
        todayOperations,
        pendingAssignments,
        // Delivery stats (Requirement 14)
        totalDeliveries: allDeliveries.length,
        todayDelivered,
        inTransitDeliveries,
        deliveredDeliveries,
        pendingDeliveries,
        recentCustomers,
        recentDrivers,
        recentAssignments,
        recentActivities,
      });
    }

    if (role === 'USER') {
      const userActive = activeCustomers.filter(c => c.ownerId === userId);
      const userDeleted = deletedCustomers.filter(c => c.ownerId === userId);
      const todayCustomers = userActive.filter(c => c.createdAt.startsWith(todayStr)).length;
      const pendingAssignments = userActive.filter(c => !c.assignedDriverId).length;
      const recentActivities = businessOps.slice(0, 10);

      const userDeliveries = allDeliveries.filter(d => d.ownerId === userId);
      const inTransitDeliveries = userDeliveries.filter(d => d.status === 'in_transit').length;
      const deliveredDeliveries = userDeliveries.filter(d => d.status === 'delivered').length;
      const pendingDeliveries = userDeliveries.filter(d => d.status === 'assigned').length;
      const todayDelivered = userDeliveries.filter(d => d.status === 'delivered' && d.deliveredAt?.startsWith(todayStr)).length;

      return res.json({
        totalCustomers: userActive.length,
        activeCustomers: userActive.length,
        deletedCustomers: userDeleted.length,
        totalDrivers: drivers.length,
        activeDrivers: drivers.filter(d => d.status === 'active').length,
        todayCustomers,
        todayOperations,
        pendingAssignments,
        // User delivery stats (Requirement 14)
        myCustomers: userActive.length,
        totalDeliveries: userDeliveries.length,
        inTransitDeliveries,
        deliveredDeliveries,
        pendingDeliveries,
        todayDelivered,
        recentCustomers: userActive.slice(0, 6),
        recentActivities,
      });
    }

    // DRIVER view
    const driverAssigned = activeCustomers.filter(c => c.assignedDriverId === userId);
    const recentActivities = businessOps.slice(0, 10);
    const driverDeliveries = allDeliveries.filter(d => d.driverId === userId);
    const assignedDeliveries = driverDeliveries.filter(d => d.status === 'assigned').length;
    const inTransitDeliveries = driverDeliveries.filter(d => d.status === 'in_transit').length;
    const todayAssignedDeliveries = driverDeliveries.filter(d => d.assignedAt?.startsWith(todayStr)).length;
    const todayDelivered = driverDeliveries.filter(d => d.status === 'delivered' && d.deliveredAt?.startsWith(todayStr)).length;
    const deliveredDeliveries = driverDeliveries.filter(d => d.status === 'delivered').length;
    const lastDelivery = db.getDriverLastDelivery(userId) || null;

    return res.json({
      totalCustomers: activeCustomers.length,
      activeCustomers: activeCustomers.length,
      driverAssignedCustomers: driverAssigned.length,
      todayOperations,
      // Driver delivery stats (Requirement 4 & 14)
      assignedDeliveries,
      inTransitDeliveries,
      todayAssignedDeliveries,
      todayDelivered,
      deliveredDeliveries,
      totalDeliveries: driverDeliveries.length,
      lastDelivery,
      recentCustomers: driverAssigned.slice(0, 6),
      recentActivities,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Statistika yüklənərkən xəta baş verdi.' });
  }
});

// -------------------------------------------------------------
// 3. CUSTOMERS (Strict data isolation & search)
// -------------------------------------------------------------

router.get('/customers', authMiddleware, requirePermission('view_customers'), (req: AuthRequest, res) => {
  try {
    const { search, ownerId, driverId } = req.query;
    const role = req.user!.role;
    const currentUserId = req.user!.id;

    let list = db.getCustomers(false); // active only

    // STRICT ISOLATION:
    // Regular USER can only see their own customers.
    // SÜRÜCÜ (DRIVER) can see ALL customers according to Requirement 2!
    if (role === 'USER') {
      list = list.filter(c => c.ownerId === currentUserId);
    } else if (ownerId && typeof ownerId === 'string') {
      list = list.filter(c => c.ownerId === ownerId);
    }

    if (driverId && typeof driverId === 'string') {
      if (driverId === 'me' && role === 'DRIVER') {
        list = list.filter(c => c.assignedDriverId === currentUserId);
      } else {
        list = list.filter(c => c.assignedDriverId === driverId);
      }
    }

    // Search query
    if (search && typeof search === 'string' && search.trim()) {
      const q = azNormalize(search);
      const qDigits = search.replace(/\D/g, '');

      list = list.filter(c => {
        const nameMatch = azNormalize(c.fullName).includes(q);
        const addressMatch = azNormalize(c.address).includes(q);
        const notesMatch = azNormalize(c.notes || '').includes(q);
        const driverMatch = azNormalize(c.assignedDriverName || '').includes(q);
        const rawPhoneMatch = c.phone.includes(search.trim());
        const normPhoneMatch = qDigits.length >= 3 && (
          c.phoneNormalized.includes(qDigits) ||
          normalizePhone(c.phone).includes(qDigits)
        );

        return nameMatch || addressMatch || notesMatch || driverMatch || rawPhoneMatch || normPhoneMatch;
      });
    }

    // Enrich with owner info
    const usersMap = new Map(db.getUsers().map(u => [u.id, u.name]));
    const enriched = list.map(c => ({
      ...c,
      ownerName: usersMap.get(c.ownerId) || 'Bilinməyən',
    }));

    return res.json({ customers: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: 'Müştərilər yüklənərkən xəta baş verdi.' });
  }
});

router.get('/customers/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    // Strict check: if USER, customer must belong to them
    if (req.user!.role === 'USER' && customer.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Bu müştərini görmək icazəniz yoxdur.' });
    }

    const owner = db.getUserById(customer.ownerId);
    return res.json({
      customer: {
        ...customer,
        ownerName: owner?.name || 'Bilinməyən',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Müştəri məlumatı yüklənmədi.' });
  }
});

router.post('/customers', authMiddleware, requirePermission('create_customer'), (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, phone, address, notes, latitude, longitude, accuracy, photoUrl, ownerId, assignedDriverId } = req.body;

    if (!firstName || !phone || !address) {
      return res.status(400).json({ error: 'Ad, telefon və ünvan vacib sahələrdir.' });
    }

    // User is forced to be the owner; Admin can assign to someone else
    let assignedOwnerId = req.user!.id;
    if (req.user!.role === 'ADMIN' && ownerId) {
      const targetUser = db.getUserById(ownerId);
      if (!targetUser) {
        return res.status(400).json({ error: 'Təyin edilən sahib istifadəçi tapılmadı.' });
      }
      assignedOwnerId = targetUser.id;
    }

    let driverName: string | null = null;
    if (assignedDriverId) {
      const drv = db.getDriverById(assignedDriverId);
      if (drv) driverName = drv.name;
    }

    const customer = db.createCustomer({
      ownerId: assignedOwnerId,
      createdBy: req.user!.id,
      firstName,
      lastName: lastName || '',
      phone,
      address,
      notes,
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      accuracy: Number(accuracy) || 0,
      photoUrl,
      assignedDriverId: assignedDriverId || null,
      assignedDriverName: driverName,
    });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'CUSTOMER_CREATE',
      action: `Yeni müştəri əlavə edildi: ${customer.fullName}`,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      driverId: customer.assignedDriverId || undefined,
      driverName: customer.assignedDriverName || undefined,
      details: `Yeni müştəri əlavə edildi: ${customer.fullName} (${customer.phone})`,
      newData: customer,
    });

    return res.status(201).json({ customer });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Müştəri əlavə edilərkən xəta baş verdi.' });
  }
});

router.put('/customers/:id', authMiddleware, requirePermission('edit_customer'), (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    // Strict ownership: USER cannot edit someone else's customer
    if (req.user!.role === 'USER' && customer.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Bu müştərini redaktə etmək icazəniz yoxdur.' });
    }

    const { firstName, lastName, phone, address, notes, latitude, longitude, accuracy, photoUrl, ownerId, status, assignedDriverId } = req.body;

    const oldData = { ...customer };
    const updates: Partial<CustomerRecord> & { updatedBy: string } = {
      updatedBy: req.user!.id,
    };

    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (notes !== undefined) updates.notes = notes;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;
    if (accuracy !== undefined) updates.accuracy = accuracy;
    if (photoUrl !== undefined) updates.photoUrl = photoUrl;
    if (status !== undefined) updates.status = status;

    let driverChanged = false;
    let oldDriverName = customer.assignedDriverName || 'Təyin edilməyib';
    let newDriverName = 'Təyin edilməyib';

    if (assignedDriverId !== undefined && assignedDriverId !== customer.assignedDriverId) {
      if (assignedDriverId) {
        const d = db.getDriverById(assignedDriverId);
        if (!d) return res.status(400).json({ error: 'Seçilmiş sürücü tapılmadı.' });
        updates.assignedDriverId = d.id;
        updates.assignedDriverName = d.name;
        updates.assignedAt = new Date().toISOString();
        updates.assignedBy = req.user!.id;
        newDriverName = d.name;
      } else {
        updates.assignedDriverId = null;
        updates.assignedDriverName = null;
        updates.assignedAt = null;
        updates.assignedBy = null;
      }
      driverChanged = true;
    }

    // OWNER CHANGE: Only ADMIN can change owner!
    let ownerChanged = false;
    let oldOwnerName = '';
    let newOwnerName = '';

    if (ownerId && ownerId !== customer.ownerId) {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Yalnız Admin müştərinin sahibini dəyişə bilər.' });
      }
      const newOwner = db.getUserById(ownerId);
      if (!newOwner) {
        return res.status(400).json({ error: 'Yeni sahib istifadəçi tapılmadı.' });
      }
      const oldOwner = db.getUserById(customer.ownerId);
      oldOwnerName = oldOwner?.name || customer.ownerId;
      newOwnerName = newOwner.name;
      updates.ownerId = ownerId;
      ownerChanged = true;
    }

    const updated = db.updateCustomer(customer.id, updates);

    if (driverChanged) {
      db.addLog({
        userId: req.user!.id,
        userName: req.user!.name,
        role: req.user!.role,
        actionType: 'DRIVER_ASSIGN',
        action: updated.assignedDriverId 
          ? `${updated.fullName} müştərisi sürücü ${newDriverName}-ə təyin edildi`
          : `${updated.fullName} müştərisindən sürücü təyinatı silindi`,
        entityType: 'ASSIGNMENT',
        entityId: customer.id,
        customerId: customer.id,
        customerName: updated.fullName,
        driverId: updated.assignedDriverId || undefined,
        driverName: updated.assignedDriverName || undefined,
        details: updated.assignedDriverId 
          ? `${req.user!.name} tərəfindən ${updated.fullName} müştərisi sürücü ${newDriverName}-ə təyin edildi.`
          : `${req.user!.name} tərəfindən ${updated.fullName} müştərisinin sürücü təyinatı ləğv edildi.`,
        oldData: { driver: oldDriverName },
        newData: { driver: newDriverName },
      });
    }

    if (ownerChanged) {
      db.addLog({
        userId: req.user!.id,
        userName: req.user!.name,
        role: req.user!.role,
        actionType: 'CHANGE_OWNER',
        action: `Müştərinin sahibi dəyişdirildi: ${updated.fullName}`,
        entityType: 'CUSTOMER',
        entityId: customer.id,
        customerId: customer.id,
        customerName: updated.fullName,
        details: `Admin müştərinin sahibini dəyişdi: "${updated.fullName}" (${oldOwnerName} -> ${newOwnerName})`,
        oldData: { ownerId: oldData.ownerId, ownerName: oldOwnerName },
        newData: { ownerId: updated.ownerId, ownerName: newOwnerName },
      });
    } else if (!driverChanged) {
      db.addLog({
        userId: req.user!.id,
        userName: req.user!.name,
        role: req.user!.role,
        actionType: 'CUSTOMER_UPDATE',
        action: `Müştəri məlumatı yeniləndi: ${updated.fullName}`,
        entityType: 'CUSTOMER',
        entityId: customer.id,
        customerId: customer.id,
        customerName: updated.fullName,
        driverId: updated.assignedDriverId || undefined,
        driverName: updated.assignedDriverName || undefined,
        details: `${req.user!.name} müştəri məlumatlarını yenilədi: ${updated.fullName}`,
        oldData,
        newData: updated,
      });
    }

    return res.json({ customer: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Müştəri yenilənərkən xəta baş verdi.' });
  }
});

// Quick Driver Assignment
router.post('/customers/:id/assign-driver', authMiddleware, requirePermission('edit_customer'), (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    if (req.user!.role === 'USER' && customer.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Bu müştərini idarə etmək icazəniz yoxdur.' });
    }

    const { driverId, notes } = req.body;
    let updated = db.assignDriver(customer.id, driverId || null, req.user!.id);
    const driver = driverId ? db.getDriverById(driverId) : null;

    let deliveryRecord = null;
    if (driverId && driver) {
      deliveryRecord = db.createDelivery({
        customerId: customer.id,
        driverId: driver.id,
        assignedBy: req.user!.id,
        notes: notes || undefined,
        status: 'assigned',
      });
      // reload updated customer
      updated = db.getCustomerById(customer.id) || updated;
    }

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'DRIVER_ASSIGN',
      action: driver 
        ? `${updated.fullName} müştərisi sürücü ${driver.name}-ə təyin edildi`
        : `${updated.fullName} müştərisindən sürücü təyinatı silindi`,
      entityType: 'ASSIGNMENT',
      entityId: customer.id,
      customerId: customer.id,
      customerName: updated.fullName,
      driverId: driver?.id,
      driverName: driver?.name,
      details: driver 
        ? `${req.user!.name} tərəfindən ${updated.fullName} müştərisi sürücü ${driver.name}-ə təyin edildi.`
        : `${req.user!.name} tərəfindən ${updated.fullName} müştərisindən sürücü təyinatı silindi.`,
    });

    return res.json({ customer: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Sürücü təyin edilə bilmədi.' });
  }
});

// Send Location to Driver
router.post('/customers/:id/send-location-to-driver', authMiddleware, (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Müştəri tapılmadı.' });

    const targetDriverId = req.body.driverId || customer.assignedDriverId;
    if (!targetDriverId) {
      return res.status(400).json({ error: 'Müştəriyə təyin olunmuş və ya seçilmiş sürücü yoxdur.' });
    }

    const driver = db.getDriverById(targetDriverId);
    if (!driver) return res.status(404).json({ error: 'Sürücü tapılmadı.' });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'LOCATION_SENT_DRIVER',
      action: `${customer.fullName} müştərisinin konumu sürücü ${driver.name}-ə göndərildi`,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      driverId: driver.id,
      driverName: driver.name,
      details: `${customer.fullName} (${customer.address || 'Ünvan qeyd edilməyib'}) müştərisinin konumu sürücü ${driver.name}-ə göndərildi.`,
    });

    return res.json({
      success: true,
      message: `${customer.fullName} müştərisinin konumu sürücü ${driver.name}-ə göndərildi.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Konum göndərilərkən xəta baş verdi.' });
  }
});

// Send Location to Customer
router.post('/customers/:id/send-location-to-customer', authMiddleware, (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Müştəri tapılmadı.' });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'LOCATION_SENT_CUSTOMER',
      action: `Müştəriyə konum göndərildi: ${customer.fullName}`,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      details: `${customer.fullName} (${customer.phone}) adlı müştəriyə konum məlumatı göndərildi.`,
    });

    return res.json({
      success: true,
      message: `Müştəriyə konum göndərildi: ${customer.fullName}`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Xəta baş verdi.' });
  }
});

// Direct "Təhvil verdim" from customer card
router.post('/customers/:id/deliver', authMiddleware, (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    const { note } = req.body;
    const isDriver = req.user!.role === 'DRIVER';
    const isAdmin = req.user!.role === 'ADMIN';

    if (!isDriver && !isAdmin) {
      return res.status(403).json({ error: 'Yalnız sürücü və ya admin təhvil verə bilər.' });
    }

    // Check existing deliveries for customer
    const existing = db.getDeliveries({ customerId: customer.id });
    const activeDelivery = existing.find(d => d.status !== 'delivered');

    if (!activeDelivery && customer.currentDeliveryStatus === 'delivered') {
      return res.status(400).json({ error: 'Bu müştərinin malı artıq təhvil verilib.' });
    }

    let updatedDelivery;
    if (activeDelivery) {
      if (isDriver && activeDelivery.driverId !== req.user!.id) {
        return res.status(403).json({ error: 'Bu çatdırılma başqa sürücüyə təyin olunub.' });
      }
      updatedDelivery = db.deliverDelivery(activeDelivery.id, req.user!.id, req.user!.name, note);
    } else {
      // Create new delivery and immediately deliver
      const driverId = isDriver ? req.user!.id : (customer.assignedDriverId || req.user!.id);
      const newD = db.createDelivery({
        customerId: customer.id,
        driverId,
        assignedBy: req.user!.id,
        notes: note,
        status: 'assigned',
      });
      updatedDelivery = db.deliverDelivery(newD.id, req.user!.id, req.user!.name, note);
    }

    const freshCustomer = db.getCustomerById(customer.id);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'DELIVERY',
      action: `Mal təhvil verildi: ${customer.fullName} (${updatedDelivery.driverName})`,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      driverId: updatedDelivery.driverId,
      driverName: updatedDelivery.driverName,
      details: `Sürücü ${req.user!.name} ${customer.fullName} müştərisinin malını təhvil verdi.${note ? ` Qeyd: ${note}` : ''}`,
      newData: updatedDelivery,
    });

    return res.json({
      success: true,
      customer: freshCustomer,
      delivery: updatedDelivery,
      message: `${customer.fullName} üçün mal təhvil verildi olaraq qeyd edildi.`,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Təhvil vermə zamanı xəta baş verdi.' });
  }
});

router.delete('/customers/:id', authMiddleware, requirePermission('delete_customer'), (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    // Strict ownership: USER cannot delete someone else's customer
    if (req.user!.role === 'USER' && customer.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Bu müştərini silmək icazəniz yoxdur.' });
    }

    const deleted = db.softDeleteCustomer(customer.id, req.user!.id);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'CUSTOMER_DELETE',
      action: `Müştəri silindi: ${customer.fullName}`,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      driverId: customer.assignedDriverId || undefined,
      driverName: customer.assignedDriverName || undefined,
      details: `${req.user!.name} müştərini sildi (Zibil qutusuna köçürüldü): ${customer.fullName}`,
    });

    return res.json({ success: true, customer: deleted });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Müştəri silinərkən xəta baş verdi.' });
  }
});

// -------------------------------------------------------------
// 4. TRASH & RESTORE (Strictly ADMIN ONLY per Requirement 5)
// -------------------------------------------------------------

router.get('/trash', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const all = db.getCustomers(true).filter(c => c.isDeleted);
    const usersMap = new Map(db.getUsers().map(u => [u.id, u.name]));

    const enriched = all.map(c => ({
      ...c,
      ownerName: usersMap.get(c.ownerId) || 'Bilinməyən',
      deletedByName: c.deletedBy ? usersMap.get(c.deletedBy) || 'İstifadəçi' : 'Naməlum',
    }));

    return res.json({ trash: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: 'Zibil qutusu yüklənmədi.' });
  }
});

router.post('/customers/:id/restore', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    const restored = db.restoreCustomer(customer.id, req.user!.id);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'CUSTOMER_RESTORE',
      action: `Müştəri bərpa edildi: ${customer.fullName}`,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      details: `Admin müştərini bərpa etdi: ${customer.fullName}`,
    });

    return res.json({ success: true, customer: restored });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Müştəri bərpa edilərkən xəta baş verdi.' });
  }
});

router.delete('/customers/:id/permanent', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const customer = db.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    db.permanentDeleteCustomer(customer.id);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: 'ADMIN',
      actionType: 'PERMANENT_DELETE_CUSTOMER',
      action: `Müştəri həmişəlik silindi: ${customer.fullName}`,
      entityType: 'CUSTOMER',
      entityId: customer.id,
      customerId: customer.id,
      customerName: customer.fullName,
      details: `Admin müştərini həmişəlik sildi: ${customer.fullName}`,
    });

    return res.json({ success: true, message: 'Müştəri həmişəlik silindi.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Müştəri həmişəlik silinmədi.' });
  }
});

// -------------------------------------------------------------
// 5. USERS MANAGEMENT (ADMIN ONLY)
// -------------------------------------------------------------

router.get('/users', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const users = db.getUsers();
    const customers = db.getCustomers(false);

    const enriched = users.map(u => ({
      id: u.id,
      loginId: u.loginId,
      name: u.name,
      role: u.role,
      status: u.status,
      permissions: u.permissions,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastLogin: u.lastLogin,
      lastActivity: u.lastActivity,
      customerCount: customers.filter(c => c.ownerId === u.id).length,
    }));

    return res.json({ users: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: 'İstifadəçilər yüklənmədi.' });
  }
});

router.post('/users', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { loginId, password, name, phone, role, status, permissions } = req.body;
    if (!loginId || !password || !name) {
      return res.status(400).json({ error: 'İstifadəçi ID, şifrə və ad tələb olunur.' });
    }

    const newUser = db.createUser({
      loginId,
      password,
      name,
      phone,
      role: role || 'USER',
      status: status || 'active',
      permissions,
    });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: 'ADMIN',
      actionType: 'CREATE_USER',
      action: `Yeni istifadəçi yaradıldı: ${newUser.name}`,
      entityType: 'USER',
      entityId: newUser.id,
      details: `Admin yeni istifadəçi yaratdı: ${newUser.name} (${newUser.loginId}) [Rol: ${newUser.role}]`,
    });

    return res.status(201).json({
      user: {
        id: newUser.id,
        loginId: newUser.loginId,
        name: newUser.name,
        phone: newUser.phone,
        role: newUser.role,
        status: newUser.status,
        permissions: newUser.permissions,
        createdAt: newUser.createdAt,
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'İstifadəçi yaradıla bilmədi.' });
  }
});

router.put('/users/:id', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { name, phone, password, role, status, permissions } = req.body;
    const user = db.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı.' });
    }

    const updated = db.updateUser(user.id, {
      name,
      phone,
      password: password && password.trim().length > 0 ? password.trim() : undefined,
      role,
      status,
      permissions,
    });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: 'ADMIN',
      actionType: 'UPDATE_USER',
      action: `İstifadəçi redaktə edildi: ${updated.name}`,
      entityType: 'USER',
      entityId: updated.id,
      details: `Admin istifadəçini redaktə etdi: ${updated.name} (${updated.loginId})`,
    });

    return res.json({
      user: {
        id: updated.id,
        loginId: updated.loginId,
        name: updated.name,
        phone: updated.phone,
        role: updated.role,
        status: updated.status,
        permissions: updated.permissions,
        updatedAt: updated.updatedAt,
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'İstifadəçi yenilənmədi.' });
  }
});

router.delete('/users/:id', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const user = db.getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'İstifadəçi tapılmadı.' });
    }

    db.deleteUser(user.id);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: 'ADMIN',
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: user.id,
      details: `Admin istifadəçini sildi: ${user.name} (${user.loginId})`,
    });

    return res.json({ success: true, message: 'İstifadəçi silindi.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'İstifadəçi silinmədi.' });
  }
});

// -------------------------------------------------------------
// 6. DRIVERS MANAGEMENT & LIVE FLEET TRACKING
// -------------------------------------------------------------

router.get('/drivers', authMiddleware, (req: AuthRequest, res) => {
  try {
    const drivers = db.getDrivers().map(d => ({
      id: d.id,
      loginId: d.loginId,
      name: d.name,
      phone: d.phone,
      status: d.status,
      isLive: d.isLive,
      lastSeen: d.lastSeen,
      currentLocation: d.currentLocation,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
    return res.json({ drivers });
  } catch (err: any) {
    return res.status(500).json({ error: 'Sürücülər yüklənmədi.' });
  }
});

// Live Fleet Drivers with Speed, Active Orders & Locations
router.get('/drivers/live', authMiddleware, (req: AuthRequest, res) => {
  try {
    const drivers = db.getLiveDrivers({
      id: req.user!.id,
      role: req.user!.role,
    });
    return res.json({ drivers });
  } catch (err: any) {
    return res.status(500).json({ error: 'Canlı sürücülər yüklənmədi.' });
  }
});

// Driver Broadcast Location & Speed (Called from Mobile PWA / Web / App)
router.post('/driver/location', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { latitude, longitude, speed, heading, accuracy, batteryLevel, address, driverId } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'Düzgün koordinatlar (latitude, longitude) tələb olunur.' });
    }

    let targetDriverId = req.user!.id;
    if (req.user!.role === 'ADMIN' && driverId) {
      targetDriverId = driverId;
    } else if (req.user!.role !== 'DRIVER' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yalnız sürücülər və ya admin canlı məkan yayımlaya bilər.' });
    }

    const updated = db.updateDriverLocation(targetDriverId, {
      latitude,
      longitude,
      speed: typeof speed === 'number' ? speed : undefined,
      heading: typeof heading === 'number' ? heading : undefined,
      accuracy: typeof accuracy === 'number' ? accuracy : undefined,
      batteryLevel: typeof batteryLevel === 'number' ? batteryLevel : undefined,
      address: typeof address === 'string' ? address : undefined,
    });

    return res.json({
      success: true,
      driver: {
        id: updated.id,
        name: updated.name,
        currentLocation: updated.currentLocation,
        isLive: updated.isLive,
        lastSeen: updated.lastSeen,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Məkan yenilənmədi.' });
  }
});

// Get Driver Trajectory & Stops History
router.get('/drivers/:id/trajectory', authMiddleware, (req: AuthRequest, res) => {
  try {
    const data = db.getDriverTrajectoryAndStops(req.params.id);
    if (!data.driver) {
      return res.status(404).json({ error: 'Sürücü tapılmadı.' });
    }
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Traektoriya məlumatı yüklənə bilmədi.' });
  }
});

router.post('/drivers', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { loginId, password, name, phone, status } = req.body;
    if (!loginId || !password || !name || !phone) {
      return res.status(400).json({ error: 'Bütün sahələr doldurulmalıdır.' });
    }

    const driver = db.createDriver({
      loginId,
      password,
      name,
      phone,
      status: status || 'active',
    });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: 'ADMIN',
      action: 'CREATE_DRIVER',
      entityType: 'DRIVER',
      entityId: driver.id,
      details: `Admin yeni sürücü əlavə etdi: ${driver.name} (${driver.phone})`,
    });

    return res.status(201).json({ driver });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Sürücü yaradıla bilmədi.' });
  }
});

router.put('/drivers/:id', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { name, phone, password, status } = req.body;
    const updated = db.updateDriver(req.params.id, {
      name,
      phone,
      password: password && password.trim().length > 0 ? password.trim() : undefined,
      status,
    });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: 'ADMIN',
      action: 'UPDATE_DRIVER',
      entityType: 'DRIVER',
      entityId: updated.id,
      details: `Admin sürücünü redaktə etdi: ${updated.name}`,
    });

    return res.json({ driver: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Sürücü yenilənmədi.' });
  }
});

router.delete('/drivers/:id', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const driver = db.getDriverById(req.params.id);
    if (!driver) return res.status(404).json({ error: 'Sürücü tapılmadı.' });

    db.deleteDriver(driver.id);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: 'ADMIN',
      action: 'DELETE_DRIVER',
      entityType: 'DRIVER',
      entityId: driver.id,
      details: `Admin sürücünü sildi: ${driver.name}`,
    });

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Sürücü silinmədi.' });
  }
});

// -------------------------------------------------------------
// 7. AUDIT LOGS & BUSINESS OPERATIONS
// -------------------------------------------------------------

router.get('/logs', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { search, action, entityType, date, userId, customerId, driverId, actionType } = req.query;
    let logs = db.getLogs();

    // Normal USER can only see own logs
    if (req.user!.role === 'USER') {
      logs = logs.filter(l => l.userId === req.user!.id);
    } else if (req.user!.role === 'DRIVER') {
      return res.status(403).json({ error: 'Sürücünün tarixçəyə giriş hüququ yoxdur.' });
    }

    if (action && typeof action === 'string') {
      logs = logs.filter(l => l.action === action);
    }
    if (actionType && typeof actionType === 'string') {
      logs = logs.filter(l => l.actionType === actionType);
    }
    if (entityType && typeof entityType === 'string') {
      logs = logs.filter(l => l.entityType === entityType);
    }
    if (date && typeof date === 'string') {
      logs = logs.filter(l => l.createdAt.startsWith(date));
    }
    if (userId && typeof userId === 'string') {
      logs = logs.filter(l => l.userId === userId);
    }
    if (customerId && typeof customerId === 'string') {
      logs = logs.filter(l => l.customerId === customerId);
    }
    if (driverId && typeof driverId === 'string') {
      logs = logs.filter(l => l.driverId === driverId);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = azNormalize(search);
      logs = logs.filter(l =>
        azNormalize(l.details).includes(q) ||
        azNormalize(l.userName).includes(q) ||
        azNormalize(l.action).includes(q) ||
        azNormalize(l.customerName || '').includes(q) ||
        azNormalize(l.driverName || '').includes(q)
      );
    }

    return res.json({ logs });
  } catch (err: any) {
    return res.status(500).json({ error: 'Tarixçə yüklənmədi.' });
  }
});

// Business Operations endpoint (NO AUTH / SESSION logs included)
router.get('/operations', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { search, date, user, customer, driver, actionType } = req.query;
    const operations = db.getOperations({
      userRole: req.user!.role,
      userId: req.user!.id,
      date: typeof date === 'string' ? date : undefined,
      userFilter: typeof user === 'string' ? user : undefined,
      customerFilter: typeof customer === 'string' ? customer : undefined,
      driverFilter: typeof driver === 'string' ? driver : undefined,
      actionType: typeof actionType === 'string' ? actionType : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    return res.json({ operations });
  } catch (err: any) {
    return res.status(500).json({ error: 'Əməliyyatlar yüklənərkən xəta baş verdi.' });
  }
});

router.delete('/logs', authMiddleware, requireRole('ADMIN'), (req: AuthRequest, res) => {
  try {
    const { logIds, all } = req.body;
    if (all === true) {
      db.clearAllLogs();
      db.addLog({
        userId: req.user!.id,
        userName: req.user!.name,
        role: 'ADMIN',
        action: 'DELETE_LOGS',
        entityType: 'LOG',
        details: `Admin bütün audit tarixçəsini təmizlədi.`,
      });
      return res.json({ success: true, message: 'Bütün tarixçə silindi.' });
    }

    if (Array.isArray(logIds) && logIds.length > 0) {
      const deletedCount = db.deleteLogs(logIds);
      db.addLog({
        userId: req.user!.id,
        userName: req.user!.name,
        role: 'ADMIN',
        action: 'DELETE_LOGS',
        entityType: 'LOG',
        details: `Admin ${deletedCount} ədəd tarixçə qeydini sildi.`,
      });
      return res.json({ success: true, count: deletedCount });
    }

    return res.status(400).json({ error: 'Silinəcək loglar seçilməyib.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Tarixçə silinərkən xəta baş verdi.' });
  }
});

// -------------------------------------------------------------
// 8. BACKUP & RESTORE
// -------------------------------------------------------------

router.get('/backup/export', authMiddleware, requirePermission('backup_data'), (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    let customers = db.getCustomers(false);

    if (role === 'USER') {
      customers = customers.filter(c => c.ownerId === req.user!.id);
    }

    const backupPayload = {
      system: 'Məkan',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: req.user!.id,
        loginId: req.user!.loginId,
        name: req.user!.name,
        role: req.user!.role,
      },
      customersCount: customers.length,
      customers,
    };

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'BACKUP',
      entityType: 'BACKUP',
      details: `${req.user!.name} tərəfindən ${customers.length} müştəri backup olaraq export edildi.`,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=mustari_gps_backup_${Date.now()}.json`);
    return res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err: any) {
    return res.status(500).json({ error: 'Backup yaradılarkən xəta baş verdi.' });
  }
});

router.post('/backup/restore', authMiddleware, requirePermission('restore_data'), (req: AuthRequest, res) => {
  try {
    const { backupData } = req.body;
    if (!backupData || !Array.isArray(backupData.customers)) {
      return res.status(400).json({ error: 'Keçərsiz backup faylı formatı. JSON daxilində "customers" massivi tapılmadı.' });
    }

    const incomingCustomers = backupData.customers;
    let restoredCount = 0;

    for (const item of incomingCustomers) {
      if (!item.firstName || !item.phone) continue;

      // CRITICAL SECURITY RULE: USER restore ALWAYS forces ownerId to be the current user
      const targetOwnerId = req.user!.role === 'ADMIN' && item.ownerId ? item.ownerId : req.user!.id;

      db.createCustomer({
        ownerId: targetOwnerId,
        createdBy: req.user!.id,
        firstName: item.firstName,
        lastName: item.lastName || '',
        phone: item.phone,
        address: item.address || 'Ünvan qeyd edilməyib',
        notes: item.notes || '',
        latitude: Number(item.latitude) || 0,
        longitude: Number(item.longitude) || 0,
        accuracy: Number(item.accuracy) || 0,
        photoUrl: item.photoUrl || '',
      });
      restoredCount++;
    }

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      action: 'RESTORE',
      entityType: 'BACKUP',
      details: `${req.user!.name} backup vasitəsilə ${restoredCount} müştərini bərpa etdi.`,
    });

    return res.json({ success: true, count: restoredCount, message: `${restoredCount} müştəri uğurla bərpa olundu.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Restore zamanı xəta baş verdi.' });
  }
});

// -------------------------------------------------------------
// 10. DELIVERIES API (Task redirection, status flow, delivery history)
// -------------------------------------------------------------

router.get('/deliveries', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { driverId, customerId, ownerId, status, date, search } = req.query;
    const role = req.user!.role;
    const currentUserId = req.user!.id;

    const filterOptions: any = {};
    if (search && typeof search === 'string') filterOptions.search = search;
    if (date && typeof date === 'string') filterOptions.date = date;
    if (status && typeof status === 'string') filterOptions.status = status;
    if (customerId && typeof customerId === 'string') filterOptions.customerId = customerId;

    if (role === 'USER') {
      // User can ONLY see deliveries for their customers
      filterOptions.ownerId = currentUserId;
      if (driverId && typeof driverId === 'string') filterOptions.driverId = driverId;
    } else if (role === 'DRIVER') {
      // Driver sees their assigned deliveries
      filterOptions.driverId = currentUserId;
    } else {
      // Admin can filter by anything
      if (driverId && typeof driverId === 'string') filterOptions.driverId = driverId;
      if (ownerId && typeof ownerId === 'string') filterOptions.ownerId = ownerId;
    }

    const deliveries = db.getDeliveries(filterOptions);

    // Driver breakdown stats
    const driverStatsMap: Record<string, { driverId: string; driverName: string; count: number; deliveredCount: number }> = {};
    for (const d of deliveries) {
      if (!driverStatsMap[d.driverId]) {
        driverStatsMap[d.driverId] = { driverId: d.driverId, driverName: d.driverName, count: 0, deliveredCount: 0 };
      }
      driverStatsMap[d.driverId].count++;
      if (d.status === 'delivered') {
        driverStatsMap[d.driverId].deliveredCount++;
      }
    }

    return res.json({
      deliveries,
      driverStats: Object.values(driverStatsMap),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Çatdırılmalar yüklənərkən xəta baş verdi.' });
  }
});

router.post('/deliveries', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { customerId, driverId, notes, status } = req.body;
    if (!customerId || !driverId) {
      return res.status(400).json({ error: 'Müştəri və sürücü seçilməlidir.' });
    }

    const customer = db.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Müştəri tapılmadı.' });
    }

    // Role check: USER can only dispatch their own customers
    if (req.user!.role === 'USER' && customer.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Yalnız öz müştərilərinizi sürücüyə yönləndirə bilərsiniz.' });
    }

    // DRIVER cannot dispatch deliveries
    if (req.user!.role === 'DRIVER') {
      return res.status(403).json({ error: 'Sürücü vəzifə yönləndirə bilməz.' });
    }

    const delivery = db.createDelivery({
      customerId,
      driverId,
      assignedBy: req.user!.id,
      notes,
      status: status || 'assigned',
    });

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'ASSIGNMENT',
      action: `Vəzifə yönləndirildi: ${delivery.customerName} → ${delivery.driverName}`,
      entityType: 'DELIVERY',
      entityId: delivery.id,
      customerId: delivery.customerId,
      customerName: delivery.customerName,
      driverId: delivery.driverId,
      driverName: delivery.driverName,
      details: `${req.user!.name} tərəfindən ${delivery.customerName} üçün tapşırıq sürücü ${delivery.driverName}-a yönləndirildi.`,
      newData: delivery,
    });

    return res.status(201).json({ delivery });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Çatdırılma yaradılarkən xəta baş verdi.' });
  }
});

router.post('/deliveries/:id/start', authMiddleware, (req: AuthRequest, res) => {
  try {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Çatdırılma tapılmadı.' });
    }

    // Driver can only start their own delivery, Admin can start any
    if (req.user!.role === 'DRIVER' && delivery.driverId !== req.user!.id) {
      return res.status(403).json({ error: 'Bu çatdırılmanı başlatmaq hüququnuz yoxdur.' });
    }

    const updated = db.startDelivery(delivery.id, req.user!.id, req.user!.name);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'DELIVERY',
      action: `Yoldadır: ${updated.customerName} (${updated.driverName})`,
      entityType: 'DELIVERY',
      entityId: updated.id,
      customerId: updated.customerId,
      customerName: updated.customerName,
      driverId: updated.driverId,
      driverName: updated.driverName,
      details: `Sürücü ${req.user!.name} ${updated.customerName} sifarişi üçün yola çıxdı.`,
      newData: updated,
    });

    return res.json({ delivery: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Çatdırılma başladılarkən xəta baş verdi.' });
  }
});

router.post('/deliveries/:id/deliver', authMiddleware, (req: AuthRequest, res) => {
  try {
    const delivery = db.getDeliveryById(req.params.id);
    if (!delivery) {
      return res.status(404).json({ error: 'Çatdırılma tapılmadı.' });
    }

    // Requirement 11: Eyni işi iki dəfə “Təhvil verdim” etmək mümkün olmasın
    if (delivery.status === 'delivered') {
      return res.status(400).json({ error: 'Bu çatdırılma artıq təhvil verilib.' });
    }

    // Driver can only deliver their own delivery, Admin can deliver any
    if (req.user!.role === 'DRIVER' && delivery.driverId !== req.user!.id) {
      return res.status(403).json({ error: 'Bu çatdırılmanı təhvil vermək hüququnuz yoxdur.' });
    }

    const { note } = req.body;
    const updated = db.deliverDelivery(delivery.id, req.user!.id, req.user!.name, note);

    db.addLog({
      userId: req.user!.id,
      userName: req.user!.name,
      role: req.user!.role,
      actionType: 'DELIVERY',
      action: `Mal təhvil verildi: ${updated.customerName} (${updated.driverName})`,
      entityType: 'DELIVERY',
      entityId: updated.id,
      customerId: updated.customerId,
      customerName: updated.customerName,
      driverId: updated.driverId,
      driverName: updated.driverName,
      details: `Sürücü ${req.user!.name} ${updated.customerName} müştərisinin malını təhvil verdi.`,
      newData: updated,
    });

    return res.json({ delivery: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Təhvil vermə zamanı xəta baş verdi.' });
  }
});

router.get('/deliveries/driver-stats', authMiddleware, (req: AuthRequest, res) => {
  try {
    const targetDriverId = req.query.driverId as string || (req.user!.role === 'DRIVER' ? req.user!.id : undefined);
    if (!targetDriverId) {
      return res.status(400).json({ error: 'Sürücü ID tələb olunur.' });
    }
    const stats = db.getDriverStats(targetDriverId);
    return res.json({ stats });
  } catch (err: any) {
    return res.status(500).json({ error: 'Sürücü statistikası yüklənmədi.' });
  }
});

// -------------------------------------------------------------
// 11. NOTIFICATIONS API
// -------------------------------------------------------------

router.get('/notifications', authMiddleware, (req: AuthRequest, res) => {
  try {
    const notifications = db.getNotifications(req.user!.id);
    const unreadCount = db.getUnreadNotificationCount(req.user!.id);
    return res.json({ notifications, unreadCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Bildirişlər yüklənərkən xəta baş verdi.' });
  }
});

router.get('/notifications/unread-count', authMiddleware, (req: AuthRequest, res) => {
  try {
    const unreadCount = db.getUnreadNotificationCount(req.user!.id);
    return res.json({ unreadCount });
  } catch (err: any) {
    return res.status(500).json({ error: 'Xəta baş verdi.' });
  }
});

router.post('/notifications/:id/read', authMiddleware, (req: AuthRequest, res) => {
  try {
    const success = db.markNotificationAsRead(req.params.id, req.user!.id);
    return res.json({ success });
  } catch (err: any) {
    return res.status(500).json({ error: 'Xəta baş verdi.' });
  }
});

router.post('/notifications/read-all', authMiddleware, (req: AuthRequest, res) => {
  try {
    const count = db.markAllNotificationsAsRead(req.user!.id);
    return res.json({ success: true, count });
  } catch (err: any) {
    return res.status(500).json({ error: 'Xəta baş verdi.' });
  }
});

// -------------------------------------------------------------
// 12. ORDERS & DELIVERY WORKFLOW API (SİFARİŞLƏR SİSTEMİ)
// -------------------------------------------------------------

// Get Orders list with role-based filtering
router.get('/orders', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    const { status, search, date, driverId, creatorId, ownerId, filterMode } = req.query as Record<string, string>;

    const params: any = {};
    if (search) params.search = search;
    if (date) params.date = date;
    if (status && status !== 'all') params.status = status;

    if (currentUser.role === 'DRIVER') {
      // Driver view:
      if (filterMode === 'open') {
        params.status = 'open_for_drivers';
      } else if (filterMode === 'my_orders') {
        params.driverId = currentUser.id;
      } else if (driverId) {
        params.driverId = driverId;
      }
    } else if (currentUser.role === 'USER') {
      // User view: can view their own created/owned orders, or filter
      if (creatorId) {
        params.creatorId = creatorId;
      } else if (ownerId) {
        params.ownerId = ownerId;
      } else {
        // By default, user sees orders they created or their customers' orders
        params.creatorId = currentUser.id;
      }
    } else if (currentUser.role === 'ADMIN') {
      if (creatorId) params.creatorId = creatorId;
      if (ownerId) params.ownerId = ownerId;
      if (driverId) params.driverId = driverId;
    }

    const orders = db.getOrders(params);
    return res.json({ orders });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Sifarişlər yüklənərkən xəta baş verdi.' });
  }
});

// Order Dashboard stats (Requirement 21)
router.get('/orders/dashboard/stats', authMiddleware, (req: AuthRequest, res) => {
  try {
    const stats = db.getOrderDashboardStats(req.user!);
    return res.json({ stats });
  } catch (err: any) {
    return res.status(500).json({ error: 'Statistika yüklənmədi.' });
  }
});

// Get Order Details
router.get('/orders/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sifariş tapılmadı.' });
    }
    return res.json({ order });
  } catch (err: any) {
    return res.status(500).json({ error: 'Sifariş məlumatı yüklənmədi.' });
  }
});

// Create Order (Requirement 1, 2, 3: "Sifariş var" düyməsi)
router.post('/orders', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role === 'DRIVER') {
      return res.status(403).json({ error: 'Sürücü sifariş yarada bilməz.' });
    }

    const { customerId, notes, dispatchType } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'Müştəri ID tələb olunur.' });
    }

    const order = db.createOrder({
      customerId,
      creatorId: currentUser.id,
      creatorName: currentUser.name,
      creatorRole: currentUser.role,
      notes,
      dispatchType: dispatchType || null,
    });

    return res.status(201).json({ order, message: `Sifariş #${order.orderNumber} uğurla yaradıldı.` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Sifariş yaradılarkən xəta baş verdi.' });
  }
});

// Dispatch Order: User selects "Mən aparacam" (USER) or "Sürücü aparsın" (DRIVER)
router.post('/orders/:id/dispatch', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    const { dispatchType } = req.body;

    if (dispatchType !== 'USER' && dispatchType !== 'DRIVER') {
      return res.status(400).json({ error: 'İcraçı növü düzgün seçilməyib.' });
    }

    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sifariş tapılmadı.' });
    }

    // Only creator or admin can dispatch
    if (currentUser.role !== 'ADMIN' && order.creatorId !== currentUser.id) {
      return res.status(403).json({ error: 'Bu sifarişin icraçısını seçmək hüququnuz yoxdur.' });
    }

    const updated = db.dispatchOrder(
      order.id,
      dispatchType,
      currentUser.id,
      currentUser.name,
      currentUser.role
    );

    return res.json({ order: updated, message: dispatchType === 'USER' ? 'Sifarişi siz özünüz aparacaqsınız.' : 'Sifariş aktiv sürücülərə yönləndirildi.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Xəta baş verdi.' });
  }
});

// Driver claims order: [ Mən aparacam ] (Requirement 5 & 6 with atomic race protection)
router.post('/orders/:id/claim', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role !== 'DRIVER' && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yalnız sürücülər sifarişi götürə bilər.' });
    }

    const updated = db.claimOrder(req.params.id, currentUser.id, currentUser.name);

    db.addLog({
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      action: 'Sifariş qəbul edildi',
      actionType: 'ORDER_CLAIMED',
      entityType: 'DELIVERY',
      entityId: updated.id,
      customerId: updated.customerId,
      customerName: updated.customerName,
      details: `Sürücü ${currentUser.name} #${updated.orderNumber} nömrəli sifarişi götürdü.`,
      newData: updated,
    });

    return res.json({ order: updated, message: 'Sifariş qəbul edildi. Çatdırılmaya başlaya bilərsiniz.' });
  } catch (err: any) {
    // Return 409 Conflict if already claimed by someone else
    const status = err.message?.includes('artıq başqa sürücü') ? 409 : 400;
    return res.status(status).json({ error: err.message || 'Sifariş götürülərkən xəta baş verdi.' });
  }
});

// Executor departs: [ Yola çıxdım ] (Requirement 8)
router.post('/orders/:id/start', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sifariş tapılmadı.' });
    }

    // Must be assigned executor or admin
    if (currentUser.role !== 'ADMIN' && order.executorId !== currentUser.id && order.driverId !== currentUser.id) {
      return res.status(403).json({ error: 'Bu sifariş üçün yola çıxmaq hüququnuz yoxdur.' });
    }

    const updated = db.startOrder(order.id, currentUser.id, currentUser.name, currentUser.role);

    db.addLog({
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      action: 'Yola çıxıldı',
      actionType: 'ORDER_DEPARTED',
      entityType: 'DELIVERY',
      entityId: updated.id,
      customerId: updated.customerId,
      customerName: updated.customerName,
      details: `${currentUser.name} #${updated.orderNumber} nömrəli sifariş üzrə yola çıxdı.`,
      newData: updated,
    });

    return res.json({ order: updated, message: 'Yola çıxdınız. Canlı konum paylaşılır.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Yola çıxılarkən xəta baş verdi.' });
  }
});

// Live Location update (Requirement 8 & 9)
router.post('/orders/:id/location', authMiddleware, (req: AuthRequest, res) => {
  try {
    const { latitude, longitude, speed, accuracy, heading } = req.body;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ error: 'GPS koordinatları tələb olunur.' });
    }

    const updated = db.updateOrderLocation(req.params.id, {
      latitude,
      longitude,
      speed,
      accuracy,
      heading,
    });

    return res.json({ success: true, location: updated.currentLocation, trajectory: updated.trajectory });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Konum yenilənmədi.' });
  }
});

// Executor delivers: [ Təhvil verildi ] (Requirement 13, 14, 15)
router.post('/orders/:id/deliver', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sifariş tapılmadı.' });
    }

    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'Bu sifariş artıq təhvil verilib.' });
    }

    // Must be assigned executor or admin
    if (currentUser.role !== 'ADMIN' && order.executorId !== currentUser.id && order.driverId !== currentUser.id) {
      return res.status(403).json({ error: 'Bu sifarişi təhvil vermək hüququnuz yoxdur.' });
    }

    const { note, latitude, longitude, accuracy } = req.body;
    const location = (typeof latitude === 'number' && typeof longitude === 'number')
      ? { latitude, longitude, accuracy }
      : null;

    const updated = db.deliverOrder(
      order.id,
      currentUser.id,
      currentUser.name,
      location,
      note
    );

    db.addLog({
      userId: currentUser.id,
      userName: currentUser.name,
      role: currentUser.role,
      action: 'Sifariş təhvil verildi',
      actionType: 'ORDER_DELIVERED',
      entityType: 'DELIVERY',
      entityId: updated.id,
      customerId: updated.customerId,
      customerName: updated.customerName,
      details: `${currentUser.name} #${updated.orderNumber} nömrəli sifarişi müştəriyə təhvil verdi.`,
      newData: updated,
    });

    return res.json({ order: updated, message: 'Sifariş uğurla təhvil verildi və çatdırılma tarixçəsinə əlavə edildi.' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Təhvil vermə zamanı xəta baş verdi.' });
  }
});

// Update Order (Admin only - Redaktə etmək)
router.put('/orders/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yalnız Admin sifarişləri redaktə edə bilər.' });
    }

    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sifariş tapılmadı.' });
    }

    const {
      customerName,
      customerPhone,
      customerAddress,
      customerLatitude,
      customerLongitude,
      notes,
      status,
      dispatchType,
      executorType,
      executorId,
      executorName,
    } = req.body;

    const updated = db.updateOrder(
      order.id,
      {
        customerName,
        customerPhone,
        customerAddress,
        customerLatitude,
        customerLongitude,
        notes,
        status,
        dispatchType,
        executorType,
        executorId,
        executorName,
      },
      { id: currentUser.id, name: currentUser.name, role: currentUser.role }
    );

    return res.json({ order: updated, message: `Sifariş #${updated.orderNumber} uğurla redaktə edildi.` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Sifariş redaktə edilərkən xəta baş verdi.' });
  }
});

// Delete Order (Admin only - Silmək)
router.delete('/orders/:id', authMiddleware, (req: AuthRequest, res) => {
  try {
    const currentUser = req.user!;
    if (currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Yalnız Admin sifarişləri silə bilər.' });
    }

    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Sifariş tapılmadı.' });
    }

    const orderNumber = order.orderNumber;
    db.deleteOrder(order.id, { id: currentUser.id, name: currentUser.name, role: currentUser.role });

    return res.json({ success: true, message: `Sifariş #${orderNumber} uğurla silindi.` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Sifariş silinərkən xəta baş verdi.' });
  }
});

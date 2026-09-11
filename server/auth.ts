import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { UserRecord, DriverRecord, UserPermissions } from './types';

const TOKEN_SECRET = process.env.JWT_SECRET || 'mustari_gps_jwt_token_secret_2026_az';

export interface AuthenticatedUser {
  id: string;
  loginId: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'DRIVER';
  permissions: UserPermissions;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function createToken(payload: AuthenticatedUser): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', TOKEN_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return {
      id: payload.id,
      loginId: payload.loginId,
      name: payload.name,
      role: payload.role,
      permissions: payload.permissions,
    };
  } catch (err) {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Giriş tələb olunur (Token tapılmadı)' });
  }

  const token = authHeader.substring(7);
  const tokenData = verifyToken(token);
  if (!tokenData) {
    return res.status(401).json({ error: 'Sessiyanın vaxtı bitib və ya token etibarsızdır' });
  }

  // Double-check user still exists in database and is active!
  if (tokenData.role === 'DRIVER') {
    const driver = db.getDriverById(tokenData.id);
    if (!driver) {
      return res.status(401).json({ error: 'Sürücü hesabı tapılmadı' });
    }
    if (driver.status === 'inactive') {
      return res.status(403).json({ error: 'Sürücü hesabı deaktiv edilib. Giriş qadağandır.' });
    }
    req.user = {
      id: driver.id,
      loginId: driver.loginId,
      name: driver.name,
      role: 'DRIVER',
      permissions: {
        view_customers: true,
        create_customer: false,
        edit_customer: false,
        delete_customer: false,
        use_gps: true,
        view_map: true,
        backup_data: false,
        restore_data: false,
        view_drivers: false,
      },
    };
  } else {
    const user = db.getUserById(tokenData.id);
    if (!user) {
      return res.status(401).json({ error: 'İstifadəçi tapılmadı' });
    }
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Hesabınız deaktiv edilib. Giriş qadağandır.' });
    }
    // Update live permissions directly from database so Admin permission changes take effect immediately!
    req.user = {
      id: user.id,
      loginId: user.loginId,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    };

    // Update user's last activity
    user.lastActivity = new Date().toISOString();
  }

  next();
}

export function requireRole(...allowedRoles: Array<'ADMIN' | 'USER' | 'DRIVER'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Giriş tələb olunur' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu əməliyyat üçün icazəniz yoxdur' });
    }
    next();
  };
}

export function requirePermission(permissionKey: keyof UserPermissions) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Giriş tələb olunur' });
    }
    if (req.user.role === 'ADMIN') {
      return next(); // Admin has all permissions
    }
    if (!req.user.permissions || !req.user.permissions[permissionKey]) {
      return res.status(403).json({ error: `Bu əməliyyat üçün icazəniz yoxdur: (${permissionKey})` });
    }
    next();
  };
}

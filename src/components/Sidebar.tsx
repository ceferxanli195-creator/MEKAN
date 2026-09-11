import React from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  Truck,
  History,
  ShieldCheck,
  Trash2,
  Settings,
  UserCog,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'customers'
  | 'orders'
  | 'deliveries'
  | 'map'
  | 'drivers'
  | 'users'
  | 'permissions'
  | 'logs'
  | 'trash'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';
  const isDriver = user.role === 'DRIVER';

  const navItems: Array<{
    tab: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    adminOnly?: boolean;
    driverAllowed?: boolean;
    userAllowed?: boolean;
  }> = [
    {
      tab: 'dashboard',
      label: isDriver ? 'Sürücü Paneli' : 'Əsas Səhifə',
      icon: LayoutDashboard,
      driverAllowed: true,
      userAllowed: true,
    },
    {
      tab: 'customers',
      label: isDriver ? 'Bütün Müştərilər' : 'Müştərilər',
      icon: Users,
      driverAllowed: true,
      userAllowed: true,
    },
    {
      tab: 'orders',
      label: isDriver ? 'Sifarişlər (Yeni/İcra)' : 'Sifarişlər',
      icon: ShoppingBag,
      driverAllowed: true,
      userAllowed: true,
    },
    {
      tab: 'deliveries',
      label: isDriver ? 'Çatdırılma Tarixçəsi' : 'Çatdırılmalar',
      icon: History,
      driverAllowed: true,
      userAllowed: true,
    },
    {
      tab: 'map',
      label: 'Xəritə və GPS',
      icon: MapPin,
      driverAllowed: true,
      userAllowed: true,
    },
    {
      tab: 'drivers',
      label: 'Sürücülər',
      icon: Truck,
      adminOnly: true,
    },
    {
      tab: 'users',
      label: 'İstifadəçilər',
      icon: UserCog,
      adminOnly: true,
    },
    {
      tab: 'permissions',
      label: 'İcazələr',
      icon: ShieldCheck,
      adminOnly: true,
    },
    {
      tab: 'logs',
      label: isAdmin ? 'Audit və Tarixçə' : 'Son Əməliyyatlar',
      icon: History,
      userAllowed: true,
      driverAllowed: false,
    },
    {
      tab: 'trash',
      label: 'Zibil Qutusu',
      icon: Trash2,
      adminOnly: true, // STRICTLY ADMIN ONLY per Requirement 5
    },
    {
      tab: 'settings',
      label: isDriver ? 'Profil və Şifrə' : 'Hesab və Ayarlar',
      icon: Settings,
      driverAllowed: true,
      userAllowed: true,
    },
  ];

  const visibleItems = navItems.filter(item => {
    if (isAdmin) return true;
    if (isDriver) return !!item.driverAllowed;
    // Normal User: can see userAllowed items that are not adminOnly
    return !item.adminOnly && !!item.userAllowed;
  });

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 p-4 min-h-[calc(100vh-4rem)] select-none">
      <div className="space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onSelectTab(item.tab)}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                isActive
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
};

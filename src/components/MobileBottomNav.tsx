import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  MapPin,
  MoreHorizontal,
  Truck,
  UserCog,
  History,
  Trash2,
  Settings,
  ShieldCheck,
  X,
  ShoppingBag,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';
  const isDriver = user.role === 'DRIVER';

  // Define the primary tabs for the floating pill
  let primaryTabs: Array<{ tab: NavTab; label: string; icon: React.FC<{ className?: string }> }> = [];

  if (isAdmin) {
    primaryTabs = [
      { tab: 'dashboard', label: 'Əsas', icon: LayoutDashboard },
      { tab: 'customers', label: 'Müştərilər', icon: Users },
      { tab: 'orders', label: 'Sifarişlər', icon: ShoppingBag },
      { tab: 'map', label: 'Xəritə', icon: MapPin },
    ];
  } else if (isDriver) {
    primaryTabs = [
      { tab: 'dashboard', label: 'Əsas', icon: LayoutDashboard },
      { tab: 'orders', label: 'Sifarişlər', icon: ShoppingBag },
      { tab: 'customers', label: 'Müştərilər', icon: Users },
      { tab: 'map', label: 'Xəritə', icon: MapPin },
    ];
  } else {
    // Normal User
    primaryTabs = [
      { tab: 'dashboard', label: 'Əsas', icon: LayoutDashboard },
      { tab: 'customers', label: 'Müştərilər', icon: Users },
      { tab: 'orders', label: 'Sifarişlər', icon: ShoppingBag },
      { tab: 'map', label: 'Xəritə', icon: MapPin },
    ];
  }

  // Secondary items for the "Daha çox" sheet
  const moreItems: Array<{ tab: NavTab; label: string; icon: React.FC<{ className?: string }> }> = [];
  moreItems.push({ tab: 'deliveries', label: 'Çatdırılma Tarixçəsi', icon: History });

  if (isAdmin) {
    moreItems.push(
      { tab: 'users', label: 'İstifadəçilər', icon: UserCog },
      { tab: 'drivers', label: 'Sürücülər', icon: Truck },
      { tab: 'permissions', label: 'İcazələr', icon: ShieldCheck },
      { tab: 'logs', label: 'Audit Jurnalı', icon: History },
      { tab: 'trash', label: 'Zibil Qutusu', icon: Trash2 },
      { tab: 'settings', label: 'Hesab və Ayarlar', icon: Settings }
    );
  } else if (isDriver) {
    moreItems.push(
      { tab: 'settings', label: 'Profil və Şifrə', icon: Settings }
    );
  } else {
    moreItems.push(
      { tab: 'logs', label: 'Son Əməliyyatlar', icon: History },
      { tab: 'settings', label: 'Hesab və Ayarlar', icon: Settings }
    );
  }

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    setShowMoreMenu(false);
  };

  const isMoreTabActive = moreItems.some(i => i.tab === currentTab);

  return (
    <>
      {/* Floating Pill Bottom Nav */}
      <div className="md:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto">
        <nav className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 border border-slate-200/80 dark:border-slate-800 p-1.5 flex items-center justify-around">
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.tab;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => handleSelect(item.tab)}
                className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-950/60 scale-105'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-tight truncate max-w-[64px]">{item.label}</span>
              </button>
            );
          })}

          {moreItems.length > 0 && (
            <button
              type="button"
              onClick={() => setShowMoreMenu(true)}
              className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                isMoreTabActive
                  ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-950/60 scale-105'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] leading-tight">Digər</span>
            </button>
          )}
        </nav>
      </div>

      {/* "More" Drawer / Modal for mobile */}
      {showMoreMenu && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-3xl p-5 border-t border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Əlavə Bölmələr
              </h3>
              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.tab;
                return (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => handleSelect(item.tab)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl text-left border transition-all ${
                      isActive
                        ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0 text-sky-600 dark:text-sky-400" />
                    <span className="text-xs font-semibold leading-snug">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

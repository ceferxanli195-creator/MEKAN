import React, { useState } from 'react';
import { Compass, Moon, Sun, LogOut, Shield, Truck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ConfirmModal } from './ConfirmModal';
import { NotificationsDropdown } from './NotificationsDropdown';

interface NavbarProps {
  onNavigateHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigateHome }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const getRoleBadge = () => {
    if (!user) return null;
    if (user.role === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Shield className="w-3 h-3" />
          ADMIN
        </span>
      );
    }
    if (user.role === 'DRIVER') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Truck className="w-3 h-3" />
          SÜRÜCÜ
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
        <UserIcon className="w-3 h-3" />
        İSTİFADƏÇİ
      </span>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo / Branding */}
          <button
            type="button"
            onClick={onNavigateHome}
            className="flex items-center gap-2.5 group text-left focus:outline-hidden"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Müştəri GPS
              </span>
            </div>
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User chip */}
            {user && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 hidden sm:inline truncate max-w-[130px]">
                  {user.name}
                </span>
                {getRoleBadge()}
              </div>
            )}

            {/* Notifications Bell */}
            {user && <NotificationsDropdown />}

            {/* Dark / Light Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={theme === 'dark' ? 'Açıq rejim' : 'Qaranlıq rejim'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Logout button */}
            {user && (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                title="Sistemdən çıxış"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Sistemdən Çıxış"
        message="Sistemdən çıxmaq istədiyinizə əminsiniz?"
        confirmText="Çıxış et"
        cancelText="İmtina"
        isDanger={true}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
};

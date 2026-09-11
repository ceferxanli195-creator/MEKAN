import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Clock, PackageCheck, Truck, X } from 'lucide-react';
import { api } from '../api';
import { NotificationItem } from '../types';

export const NotificationsDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 25 seconds for new notifications
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationAsRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'İndicə';
      if (diffMins < 60) return `${diffMins} dəq əvvəl`;
      if (diffHours < 24) return `${diffHours} saat əvvəl`;
      if (diffDays === 1) return 'Dünən';
      return date.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors focus:outline-hidden"
        title="Bildirişlər"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse shadow-xs shadow-rose-500/50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="p-3.5 px-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                Bildirişlər
              </span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  {unreadCount} yeni
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Hamısını oxundu et</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {!notifications || notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Hələ ki bildiriş yoxdur
                </p>
              </div>
            ) : (
              (notifications || []).map((item) => {
                return (
                  <div
                    key={item.id}
                    onClick={() => !item.isRead && handleMarkAsRead(item.id)}
                    className={`p-3.5 px-4 transition-colors cursor-pointer flex items-start gap-3 ${
                      item.isRead
                        ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'bg-sky-50/60 dark:bg-sky-950/30 hover:bg-sky-50 dark:hover:bg-sky-950/50'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                        <Truck className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug break-words">
                        {item.message}
                      </p>

                      {item.customerName && (
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            Müştəri: {item.customerName}
                          </span>
                          {item.driverName && (
                            <span>• Sürücü: {item.driverName}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {!item.isRead && (
                      <div className="shrink-0 self-center">
                        <span className="w-2 h-2 rounded-full bg-sky-600 dark:bg-sky-400 block" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Sürücü və çatdırılma bildirişləri
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

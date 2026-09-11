import React, { useEffect, useState } from 'react';
import { ShieldCheck, User as UserIcon, Check, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { User, UserPermissions } from '../types';

export const PermissionsPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getUsers();
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'İstifadəçilər yüklənə bilmədi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const permissionKeys: Array<{ key: keyof UserPermissions; label: string }> = [
    { key: 'view_customers', label: 'Müştəriləri görmək' },
    { key: 'create_customer', label: 'Müştəri əlavə etmək' },
    { key: 'edit_customer', label: 'Müştərini redaktə' },
    { key: 'delete_customer', label: 'Müştərini silmək' },
    { key: 'use_gps', label: 'GPS konumu' },
    { key: 'view_map', label: 'Xəritəyə baxış' },
    { key: 'backup_data', label: 'Backup endirmək' },
    { key: 'restore_data', label: 'Backup bərpa' },
  ];

  const toggleUserPerm = async (targetUser: User, permKey: keyof UserPermissions) => {
    if (targetUser.role === 'ADMIN') return; // Admins have full access
    const currentPerms = targetUser.permissions || {
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

    const newPerms = {
      ...currentPerms,
      [permKey]: !currentPerms[permKey],
    };

    setSavingUserId(targetUser.id);
    try {
      await api.updateUser(targetUser.id, { permissions: newPerms });
      setUsers(prev =>
        prev.map(u => (u.id === targetUser.id ? { ...u, permissions: newPerms } : u))
      );
    } catch (err: any) {
      alert(err.message || 'İcazə yenilənmədi.');
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-sky-600" />
          <span>İstifadəçi İcazələri Matrisi</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Hər bir istifadəçinin sistem daxilindəki səlahiyyətlərini təyin edin. Adminlər bütün hüquqlara avtomatik malikdir.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="p-12 flex justify-center">
          <div className="w-7 h-7 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Cards for each user (Mobile & Desktop friendly, NO wide horizontal table scroll!) */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {users.map((u) => {
            const isAdmin = u.role === 'ADMIN';
            return (
              <div
                key={u.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs"
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {u.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono">{u.loginId}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isAdmin
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>

                {isAdmin ? (
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium py-2">
                    Admin hesabı olduğu üçün bütün sistem icazələrinə tam nəzarət hüququna malikdir.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissionKeys.map(({ key, label }) => {
                      const enabled = u.permissions?.[key] ?? true;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={savingUserId === u.id}
                          onClick={() => toggleUserPerm(u, key)}
                          className={`p-2.5 rounded-xl text-left border flex items-center justify-between text-xs transition-colors ${
                            enabled
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                              : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 text-slate-400 line-through'
                          }`}
                        >
                          <span className="font-semibold">{label}</span>
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}
                          >
                            {enabled && <Check className="w-3.5 h-3.5" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

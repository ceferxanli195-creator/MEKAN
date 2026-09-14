import React, { useEffect, useState } from 'react';
import {
  UserCog,
  PlusCircle,
  Shield,
  User as UserIcon,
  Truck,
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  Key,
  Calendar,
  X,
  ShieldCheck,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { User, UserPermissions } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

interface UsersPageProps {
  onOpenPermissions?: (u: User) => void;
}

export const UsersPage: React.FC<UsersPageProps> = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [permUser, setPermUser] = useState<User | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'USER' | 'DRIVER'>('USER');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permission toggles state
  const [tempPermissions, setTempPermissions] = useState<UserPermissions>({
    view_customers: true,
    create_customer: true,
    edit_customer: true,
    delete_customer: true,
    use_gps: true,
    view_map: true,
    backup_data: true,
    restore_data: true,
    view_drivers: true,
  });

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getUsers();
      setUsers(res?.users || []);
    } catch (err: any) {
      setError(err.message || 'İstifadəçilər yüklənə bilmədi.');
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAddModal = () => {
    setUserToEdit(null);
    setName('');
    setLoginId('');
    setPassword('');
    setRole('USER');
    setStatus('active');
    setLiveTrackingEnabled(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setUserToEdit(u);
    setName(u.name);
    setLoginId(u.loginId);
    setPassword('');
    setRole(u.role);
    setStatus(u.status);
    setLiveTrackingEnabled(!!u.liveTrackingEnabled);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleUserTracking = async (u: User) => {
    try {
      const newStatus = !u.liveTrackingEnabled;
      await api.updateUserLiveTracking(u.id, newStatus, '2017');
      setUsers(prev => prev.map(item => item.id === u.id ? { ...item, liveTrackingEnabled: newStatus } : item));
    } catch (err: any) {
      alert(err.message || 'Canlı izləmə statusunu dəyişmək mümkün olmadı.');
    }
  };

  const openPermModal = (u: User) => {
    setPermUser(u);
    setTempPermissions({
      ...u.permissions,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Ad daxil edilməlidir.');
      return;
    }
    if (!userToEdit && (!loginId.trim() || !password)) {
      setFormError('Yeni istifadəçi üçün ID və şifrə tələb olunur.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (userToEdit) {
        await api.updateUser(userToEdit.id, {
          name: name.trim(),
          role,
          status,
          liveTrackingEnabled,
          password: password ? password : undefined,
        });
      } else {
        await api.createUser({
          loginId: loginId.trim(),
          password,
          name: name.trim(),
          role,
          status,
          liveTrackingEnabled,
          permissions: tempPermissions,
        });
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Əməliyyat zamanı xəta baş verdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!permUser) return;
    try {
      await api.updateUser(permUser.id, {
        permissions: tempPermissions,
      });
      setPermUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'İcazələr yenilənmədi.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await api.deleteUser(userToDelete.id);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'İstifadəçi silinmədi.');
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog className="w-6 h-6 text-purple-600" />
            <span>İstifadəçilər</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {users.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sistem istifadəçiləri, giriş icazələri və fəaliyyət statistikası
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Yeni İstifadəçi</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-12 flex justify-center">
          <div className="w-7 h-7 border-3 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Responsive Card Layout (Strict anti-horizontal overflow rule!) */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => {
            const isSelf = currentUser?.id === u.id;
            return (
              <div
                key={u.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {u.name}
                        </h3>
                        {isSelf && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                            Siz
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        ID: {u.loginId}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                            : u.role === 'DRIVER'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                        }`}
                      >
                        {u.role === 'ADMIN' ? <Shield className="w-3 h-3" /> : u.role === 'DRIVER' ? <Truck className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                        {u.role === 'DRIVER' ? 'SÜRÜCÜ' : u.role}
                      </span>

                      <span
                        className={`text-[10px] font-semibold flex items-center gap-1 ${
                          u.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {u.status === 'active' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {u.status === 'active' ? 'Aktiv' : 'Deaktiv'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 py-2 border-y border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Müştəri sayı:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {u.customerCount ?? 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Son giriş:</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('az-AZ') : 'Giriş edilməyib'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Son fəaliyyət:</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {u.lastActivity ? new Date(u.lastActivity).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="text-slate-400">Canlı GPS İzləmə:</span>
                      <span className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                        u.liveTrackingEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                      }`}>
                        <Radio className={`w-3 h-3 ${u.liveTrackingEnabled ? 'animate-pulse' : ''}`} />
                        {u.liveTrackingEnabled ? 'Aktivdir (İzlənir)' : 'Deaktivdir'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 mt-3 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleUserTracking(u)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors ${
                      u.liveTrackingEnabled
                        ? 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300'
                    }`}
                    title={u.liveTrackingEnabled ? 'Canlı izləməni dayandır' : 'Admin: Canlı izləmə icazəsi ver'}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>{u.liveTrackingEnabled ? 'İzləməni Kəs' : 'İzləmə Ver'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openPermModal(u)}
                    className="px-2.5 py-1.5 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 text-xs font-semibold rounded-xl flex items-center gap-1"
                    title="İcazələri tənzimlə"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>İcazələr</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(u)}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Redaktə</span>
                  </button>

                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => setUserToDelete(u)}
                      className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Sil</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {userToEdit ? 'İstifadəçini Redaktə Et' : 'Yeni İstifadəçi Yarat'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {formError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ad və Soyad *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Məsələn: Vüsal Qasımov"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Giriş ID (Login) *
                </label>
                <input
                  type="text"
                  required={!userToEdit}
                  disabled={!!userToEdit}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Məsələn: vusal"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 disabled:opacity-60 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Şifrə {userToEdit ? '(Boş qalsa dəyişmir)' : '*'}
                </label>
                <input
                  type="password"
                  required={!userToEdit}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rol
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="USER">USER (İstifadəçi)</option>
                    <option value="ADMIN">ADMIN (Tam hüquqlu)</option>
                    <option value="DRIVER">SÜRÜCÜ (Driver)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="active">Aktiv</option>
                    <option value="inactive">Deaktiv</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200/70 dark:border-purple-800/40">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Canlı GPS İzləmə (Moderator İcazəsi)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                        Bu istifadəçinin cari yeri xəritədə admin üçün canlı izlənsin
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={liveTrackingEnabled}
                    onChange={(e) => setLiveTrackingEnabled(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center gap-1.5"
                >
                  {isSubmitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>{userToEdit ? 'Yenilə' : 'Yarat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Matrix Modal */}
      {permUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                  <span>İcazələr: {permUser.name}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  ID: {permUser.loginId} • Rol: {permUser.role}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPermUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'view_customers', label: 'Müştəriləri görmək', desc: 'Şəxsi müştəri siyahısına baxa bilər' },
                { key: 'create_customer', label: 'Müştəri əlavə etmək', desc: 'Yeni müştəri və GPS koordinatları qeyd edə bilər' },
                { key: 'edit_customer', label: 'Müştərini redaktə etmək', desc: 'Özünə aid müştərinin məlumatlarını dəyişə bilər' },
                { key: 'delete_customer', label: 'Müştərini silmək', desc: 'Müştərini zibil qutusuna köçürə bilər' },
                { key: 'use_gps', label: 'GPS konumu istifadə etmək', desc: 'Cari GPS koordinatlarını götürməyə icazə' },
                { key: 'view_map', label: 'Xəritəni görmək', desc: 'Xəritə səhifəsinə daxil ola bilər' },
                { key: 'backup_data', label: 'Backup çıxarmaq', desc: 'JSON formatında backup faylı yükləyə bilər' },
                { key: 'restore_data', label: 'Backup bərpa etmək', desc: 'JSON faylı ilə müştəriləri bərpa edə bilər' },
                { key: 'view_drivers', label: 'Sürücüləri görmək', desc: 'Sürücü siyahısına baxış hüququ' },
              ].map(({ key, label, desc }) => {
                const k = key as keyof UserPermissions;
                const isChecked = !!tempPermissions[k];
                return (
                  <label
                    key={key}
                    className="flex items-start justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div className="pr-3">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setTempPermissions(prev => ({ ...prev, [k]: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 mt-1 cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPermUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl"
              >
                İcazələri Yadda Saxla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="İstifadəçini Sil"
        message={`"${userToDelete?.name}" (${userToDelete?.loginId}) adlı istifadəçini silmək istəyirsiniz?`}
        confirmText="Sil"
        cancelText="İmtina"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};

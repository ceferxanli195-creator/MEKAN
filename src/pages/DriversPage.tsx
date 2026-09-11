import React, { useEffect, useState } from 'react';
import { Truck, PlusCircle, Phone, Edit2, Trash2, Shield, AlertCircle, CheckCircle, XCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Driver } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

export const DriversPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<Driver | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<Driver | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDrivers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getDrivers();
      setDrivers(res?.drivers || []);
    } catch (err: any) {
      setError(err.message || 'Sürücülər yüklənə bilmədi.');
      setDrivers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const openAddModal = () => {
    setDriverToEdit(null);
    setName('');
    setPhone('');
    setLoginId('');
    setPassword('');
    setStatus('active');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (d: Driver) => {
    setDriverToEdit(d);
    setName(d.name);
    setPhone(d.phone);
    setLoginId(d.loginId);
    setPassword('');
    setStatus(d.status);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setFormError('Ad və telefon vacib sahələrdir.');
      return;
    }
    if (!driverToEdit && (!loginId.trim() || !password)) {
      setFormError('Yeni sürücü üçün ID və şifrə tələb olunur.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (driverToEdit) {
        await api.updateDriver(driverToEdit.id, {
          name: name.trim(),
          phone: phone.trim(),
          password: password ? password : undefined,
          status,
        });
      } else {
        await api.createDriver({
          loginId: loginId.trim(),
          password,
          name: name.trim(),
          phone: phone.trim(),
          status,
        });
      }
      setIsModalOpen(false);
      fetchDrivers();
    } catch (err: any) {
      setFormError(err.message || 'Əməliyyat zamanı xəta baş verdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!driverToDelete) return;
    try {
      await api.deleteDriver(driverToDelete.id);
      setDriverToDelete(null);
      fetchDrivers();
    } catch (err: any) {
      alert(err.message || 'Sürücü silinmədi.');
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-600" />
            <span>Sürücülər</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {drivers.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Müştəriləri xəritədə görən və naviqasiya edən sürücü hesablarının idarə edilməsi
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Yeni Sürücü</span>
          </button>
        )}
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
          <div className="w-7 h-7 border-3 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && drivers.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Hazırda sürücü yoxdur.
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Yeni sürücü əlavə edərək onlara sistemə giriş ID və şifrəsi təyin edə bilərsiniz.
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl"
            >
              İlk Sürücünü Əlavə Et
            </button>
          )}
        </div>
      )}

      {/* Drivers Cards Grid (NO horizontal table scroll!) */}
      {!isLoading && drivers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {driver.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      ID: {driver.loginId}
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      driver.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {driver.status === 'active' ? (
                      <>
                        <CheckCircle className="w-3 h-3" />
                        Aktiv
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3" />
                        Deaktiv
                      </>
                    )}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <a href={`tel:${driver.phone}`} className="hover:underline font-medium text-sky-600 dark:text-sky-400">
                      {driver.phone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(driver)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Redaktə</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDriverToDelete(driver)}
                    className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sil</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Driver Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {driverToEdit ? 'Sürücünü Redaktə Et' : 'Yeni Sürücü Əlavə Et'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
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
                  placeholder="Məsələn: Əli Əliyev"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Telefon Nömrəsi *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050 123 45 67"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Giriş ID (Login) *
                </label>
                <input
                  type="text"
                  required={!driverToEdit}
                  disabled={!!driverToEdit}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Məsələn: surucu_eli"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Şifrə {driverToEdit ? '(Boş qalsa dəyişmir)' : '*'}
                </label>
                <input
                  type="password"
                  required={!driverToEdit}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Deaktiv (Giriş qadağan)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5"
                >
                  {isSubmitting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>{driverToEdit ? 'Yenilə' : 'Yarat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!driverToDelete}
        title="Sürücünü Sil"
        message={`"${driverToDelete?.name}" adlı sürücünü sistemdən həmişəlik silmək istəyirsiniz?`}
        confirmText="Sil"
        cancelText="İmtina"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDriverToDelete(null)}
      />
    </div>
  );
};

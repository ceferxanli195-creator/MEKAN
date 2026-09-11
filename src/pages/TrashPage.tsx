import React, { useEffect, useState } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Phone,
  MapPin,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Customer } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

export const TrashPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [customerToRestore, setCustomerToRestore] = useState<Customer | null>(null);
  const [customerToPermanentDelete, setCustomerToPermanentDelete] = useState<Customer | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchTrash = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getTrash();
      setDeletedCustomers(res?.trash || []);
    } catch (err: any) {
      setError(err.message || 'Zibil qutusu yüklənə bilmədi.');
      setDeletedCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchTrash();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/40 max-w-lg mx-auto my-12 shadow-sm">
        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/60 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Giriş İcazəsi Yoxdur</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Zibil qutusu yalnız Administrator üçün əlçatandır. Adi istifadəçilər və sürücülər bu bölməyə daxil ola bilməz.
        </p>
      </div>
    );
  }

  const handleRestoreConfirm = async () => {
    if (!customerToRestore) return;
    setIsProcessing(true);
    try {
      await api.restoreCustomer(customerToRestore.id);
      setDeletedCustomers(prev => prev.filter(c => c.id !== customerToRestore.id));
      setCustomerToRestore(null);
    } catch (err: any) {
      alert(err.message || 'Müştəri bərpa edilmədi.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!customerToPermanentDelete) return;
    setIsProcessing(true);
    try {
      await api.permanentDeleteCustomer(customerToPermanentDelete.id);
      setDeletedCustomers(prev => prev.filter(c => c.id !== customerToPermanentDelete.id));
      setCustomerToPermanentDelete(null);
    } catch (err: any) {
      alert(err.message || 'Müştəri həmişəlik silinmədi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-rose-600" />
            <span>Zibil Qutusu</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {deletedCustomers.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Silinmiş müştərilər burada saxlanılır. Onları geri bərpa edə və ya həmişəlik silə bilərsiniz.
          </p>
        </div>
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
          <div className="w-7 h-7 border-3 border-rose-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && deletedCustomers.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <Trash2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Zibil qutusu boşdur.
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hazırda heç bir silinmiş müştəri yoxdur.
          </p>
        </div>
      )}

      {/* Deleted Customers Cards Grid */}
      {!isLoading && deletedCustomers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deletedCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-rose-100 dark:border-rose-950/60 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {customer.fullName}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
                    Silinib
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customer.phone}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{customer.address}</span>
                  </div>

                  {isAdmin && (
                    <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                      Sahib: {customer.ownerName}
                    </div>
                  )}

                  {customer.deletedAt && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 pt-1">
                      <Clock className="w-3 h-3" />
                      <span>Silinmə tarixi: {new Date(customer.deletedAt).toLocaleDateString('az-AZ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerToRestore(customer)}
                  className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Bərpa Et</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerToPermanentDelete(customer)}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Həmişəlik Sil</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Restore Confirmation */}
      <ConfirmModal
        isOpen={!!customerToRestore}
        title="Müştərini Bərpa Et"
        message={`"${customerToRestore?.fullName}" adlı müştərini aktiv siyahıya bərpa etmək istəyirsiniz? Bütün GPS koordinatları və məlumatlar bərpa olunacaq.`}
        confirmText="Bərpa Et"
        cancelText="İmtina"
        isDanger={false}
        isLoading={isProcessing}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setCustomerToRestore(null)}
      />

      {/* Permanent Delete Confirmation */}
      <ConfirmModal
        isOpen={!!customerToPermanentDelete}
        title="Həmişəlik Silmə"
        message={`DİQQƏT: "${customerToPermanentDelete?.fullName}" adlı müştəri sistemdən tamamilə silinəcək və geri qaytarıla bilməyəcək. Əminsiniz?`}
        confirmText="Həmişəlik Sil"
        cancelText="İmtina"
        isDanger={true}
        isLoading={isProcessing}
        onConfirm={handlePermanentDeleteConfirm}
        onCancel={() => setCustomerToPermanentDelete(null)}
      />
    </div>
  );
};

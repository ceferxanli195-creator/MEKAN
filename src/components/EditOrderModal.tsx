import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, ShoppingBag, MapPin, Phone, FileText, UserCheck, Truck, ShieldAlert } from 'lucide-react';
import { Order, OrderStatus, ExecutorType, Driver, User } from '../types';
import { api } from '../api';

interface EditOrderModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onSaved: (updatedOrder: Order) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  order,
  onClose,
  onSaved,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<OrderStatus>('new');
  const [dispatchType, setDispatchType] = useState<string>('');
  const [executorType, setExecutorType] = useState<ExecutorType | ''>('');
  const [executorId, setExecutorId] = useState<string>('');
  const [executorName, setExecutorName] = useState<string>('');

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state with incoming order
  useEffect(() => {
    if (order) {
      setCustomerName(order.customerName || '');
      setCustomerPhone(order.customerPhone || '');
      setCustomerAddress(order.customerAddress || '');
      setNotes(order.notes || '');
      setStatus(order.status || 'new');
      setDispatchType(order.dispatchType || '');
      setExecutorType(order.executorType || '');
      setExecutorId(order.executorId || order.driverId || '');
      setExecutorName(order.executorName || order.driverName || '');
      setError(null);
    }
  }, [order]);

  // Load drivers and users for executor assignment options
  useEffect(() => {
    if (isOpen) {
      setIsLoadingLists(true);
      Promise.all([
        api.getDrivers().catch(() => ({ drivers: [] })),
        api.getUsers().catch(() => ({ users: [] })),
      ])
        .then(([driverRes, userRes]) => {
          setDrivers(driverRes.drivers || []);
          setUsers(userRes.users || []);
        })
        .finally(() => {
          setIsLoadingLists(false);
        });
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleExecutorChange = (val: string) => {
    if (!val) {
      setExecutorId('');
      setExecutorName('');
      setExecutorType('');
      return;
    }

    const [type, id] = val.split(':');
    if (type === 'DRIVER') {
      const drv = drivers.find((d) => d.id === id);
      setExecutorType('DRIVER');
      setExecutorId(id);
      setExecutorName(drv ? drv.name : 'Sürücü');
      setDispatchType('DRIVER');
    } else if (type === 'USER') {
      const usr = users.find((u) => u.id === id);
      setExecutorType('USER');
      setExecutorId(id);
      setExecutorName(usr ? usr.name : 'İstifadəçi');
      setDispatchType('USER');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Müştəri adı boş ola bilməz.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Müştəri telefon nömrəsi boş ola bilməz.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.updateOrder(order.id, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        notes: notes.trim(),
        status,
        dispatchType: dispatchType ? (dispatchType as ExecutorType) : null,
        executorType: executorType ? executorType : null,
        executorId: executorId || null,
        executorName: executorName || null,
      });

      onSaved(res.order);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Sifariş yenilənərkən xəta baş verdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSelectValue = executorId && executorType ? `${executorType}:${executorId}` : '';

  return (
    <div
      id="edit-order-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="edit-order-modal-dialog"
        className="w-full max-w-xl my-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Sifarişi Redaktə Et</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">#{order.orderNumber}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Admin paneli vasitəsilə sifariş məlumatlarını dəyişdirin
              </p>
            </div>
          </div>
          <button
            id="close-edit-order-modal-btn"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Customer details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Müştəri Məlumatları</h4>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Müştəri Adı *
              </label>
              <div className="relative">
                <input
                  id="edit-order-customer-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Məsələn: Əli Məmmədov"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Telefon Nömrəsi *</span>
                </label>
                <input
                  id="edit-order-customer-phone"
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="050-123-45-67"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Çatdırılma Ünvanı</span>
                </label>
                <input
                  id="edit-order-customer-address"
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Məsələn: Nizami küç. 45"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Qeyd / Təlimat</span>
              </label>
              <textarea
                id="edit-order-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Sifarişlə bağlı əlavə qeydlər..."
              />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Section 2: Order Status & Assignee */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">İcra və Status Tənzimləmələri</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sifariş Statusu
                </label>
                <select
                  id="edit-order-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="new">Yeni Sifariş (new)</option>
                  <option value="pending_driver">Sürücü Gözləyir (pending_driver)</option>
                  <option value="assigned">Götürüldü / Təyin edildi (assigned)</option>
                  <option value="in_transit">Yoldadır - Canlı (in_transit)</option>
                  <option value="delivered">Təhvil Verildi (delivered)</option>
                  <option value="cancelled">Ləğv Edildi (cancelled)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Çatdırılma Metodu
                </label>
                <select
                  id="edit-order-dispatch-type"
                  value={dispatchType}
                  onChange={(e) => setDispatchType(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Təyin olunmayıb</option>
                  <option value="DRIVER">Sürücü aparsın (DRIVER)</option>
                  <option value="USER">User Özü aparsın (USER)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Təyin olunmuş İcraçı (Sürücü və ya İstifadəçi)</span>
              </label>
              <select
                id="edit-order-executor-select"
                disabled={isLoadingLists}
                value={currentSelectValue}
                onChange={(e) => handleExecutorChange(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Təyin olunmayıb (Boş) --</option>
                <optgroup label="Sürücülər">
                  {drivers.map((d) => (
                    <option key={`drv-${d.id}`} value={`DRIVER:${d.id}`}>
                      🚚 {d.name} ({d.loginId})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="İstifadəçilər (Userlər)">
                  {users.map((u) => (
                    <option key={`usr-${u.id}`} value={`USER:${u.id}`}>
                      👤 {u.name} ({u.role})
                    </option>
                  ))}
                </optgroup>
              </select>
              {executorName && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                  Seçilmiş cari icraçı: <strong>{executorName}</strong> ({executorType === 'DRIVER' ? 'Sürücü' : 'User'})
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              id="cancel-edit-order-btn"
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              İmtina
            </button>
            <button
              id="save-edit-order-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Yadda saxlanılır...' : 'Dəyişiklikləri Yadda Saxla'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ShoppingBag, UserCheck, Truck, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Customer, ExecutorType, Order } from '../types';
import { api } from '../api';

interface CreateOrderModalProps {
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onOrderCreated: (order: Order) => void;
  onGoToOrders?: () => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  customer,
  onClose,
  onOrderCreated,
  onGoToOrders,
}) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

  if (!isOpen || !customer) return null;

  const handleCreate = async (dispatchType: ExecutorType) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.createOrder({
        customerId: customer.id,
        notes: notes.trim() || undefined,
        dispatchType,
      });

      setSuccessOrder(res.order);
      onOrderCreated(res.order);
    } catch (err: any) {
      setError(err.message || 'Sifariş yaradılarkən xəta baş verdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setNotes('');
    setError(null);
    setSuccessOrder(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Yeni Sifariş Yarat</h2>
              <p className="text-xs text-white/80">Müştəri: {customer.fullName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {successOrder ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Sifariş #{successOrder.orderNumber} Yaradıldı!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {successOrder.dispatchType === 'USER'
                    ? 'Sifariş qeydə alındı. Siz özünüz çatdıracaqsınız (Sürücülərə bildiriş getmədi).'
                    : 'Sifariş qeydə alındı və aktiv sürücülərə bildiriş göndərildi.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Müştəri:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{successOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tarix və Saat:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {successOrder.createdDateStr}, {successOrder.createdTimeStr}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {successOrder.status === 'assigned' ? 'Təyin edildi (User özü)' : 'Sürücü gözləyir'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Bağla
                </button>
                {onGoToOrders && (
                  <button
                    type="button"
                    onClick={() => {
                      handleResetAndClose();
                      onGoToOrders();
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md"
                  >
                    Sifarişlərə Get
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Customer summary */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Müştəri:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{customer.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Telefon:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{customer.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Ünvan:</span>
                  <span className="text-slate-700 dark:text-slate-300 text-right truncate max-w-[240px]">{customer.address}</span>
                </div>
              </div>

              {/* Order Notes / Items */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sifariş Qeydləri / Malların Siyahısı (İstəyə görə):
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Məsələn: 5 qutu süd, 10 bağlama un və s."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Dispatch Choice Buttons (Requirement 4) */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Bu sifarişi kim çatdıracaq?
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Choice 1: Mən aparacam */}
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleCreate('USER')}
                    className="p-4 rounded-xl border-2 border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 text-left transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                          <UserCheck className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                          Mən aparacam
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-snug">
                        Sifarişi siz özünüz çatdıracaqsınız. Sürücülərə bildiriş getmir.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 group-hover:underline">
                      Seç və Yarat →
                    </span>
                  </button>

                  {/* Choice 2: Sürücü aparsın */}
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleCreate('DRIVER')}
                    className="p-4 rounded-xl border-2 border-sky-500/80 bg-sky-50/50 dark:bg-sky-950/30 hover:bg-sky-100/70 dark:hover:bg-sky-900/40 text-left transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center">
                          <Truck className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm text-sky-900 dark:text-sky-200">
                          Sürücü aparsın
                        </span>
                      </div>
                      <p className="text-[11px] text-sky-700 dark:text-sky-400 leading-snug">
                        Bütün aktiv sürücülərə bildiriş gedir. Sürücü sifarişi götürəcək.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1 group-hover:underline">
                      Sürücülərə Yönləndir →
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

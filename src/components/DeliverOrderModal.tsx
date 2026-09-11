import React, { useState } from 'react';
import { CheckCircle2, X, AlertCircle, MapPin, Navigation } from 'lucide-react';
import { Order } from '../types';
import { api } from '../api';

interface DeliverOrderModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onDelivered: (updatedOrder: Order) => void;
}

export const DeliverOrderModal: React.FC<DeliverOrderModalProps> = ({
  isOpen,
  order,
  onClose,
  onDelivered,
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleDeliver = async () => {
    setIsSubmitting(true);
    setError(null);

    // Try to get current device GPS location for delivery proof
    let location: { latitude: number; longitude: number; accuracy?: number } | undefined;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
          });
        });
        location = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      } catch {
        // Fallback without GPS if denied or timed out
      }
    }

    try {
      const res = await api.deliverOrder(order.id, {
        note: note.trim() || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        accuracy: location?.accuracy,
      });

      onDelivered(res.order);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Təhvil vermə zamanı xəta baş verdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <h2 className="text-base font-bold">Sifarişi Təhvil Ver</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Sifariş:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">#{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Müştəri:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ünvan:</span>
              <span className="text-slate-700 dark:text-slate-300 text-right truncate max-w-[220px]">{order.customerAddress}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Təhvil vermə qeydi (İstəyə görə):
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Məsələn: Mal tam təhvil verildi, ödəniş alındı və s."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Təhvil verilmə anında cari GPS yeriniz və zaman qeydə alınacaq.</span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Ləğv et
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleDeliver}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Təsdiqlənir...' : 'Təhvil verdim'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X, CheckCircle2, Clock, Truck, UserCheck, MapPin, Calendar, FileText, Route } from 'lucide-react';
import { Order, OrderHistoryEvent } from '../types';

interface OrderHistoryModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
  onViewTrajectory?: (order: Order) => void;
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({
  isOpen,
  order,
  onClose,
  onViewTrajectory,
}) => {
  if (!isOpen || !order) return null;

  const getStepIcon = (step: OrderHistoryEvent['step']) => {
    switch (step) {
      case 'CREATED':
        return <Calendar className="w-4 h-4 text-emerald-500" />;
      case 'DISPATCH_SELECTED':
        return <UserCheck className="w-4 h-4 text-sky-500" />;
      case 'CLAIMED':
        return <Truck className="w-4 h-4 text-amber-500" />;
      case 'DEPARTED':
        return <Truck className="w-4 h-4 text-indigo-500 animate-pulse" />;
      case 'DELIVERED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Sifariş Tarixçəsi</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono">
                #{order.orderNumber}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Müştəri: {order.customerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Order Quick Summary */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/80 text-xs flex flex-wrap justify-between gap-2">
          <div>
            <span className="text-slate-500">Yaradan: </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{order.creatorName}</span>
          </div>
          <div>
            <span className="text-slate-500">İcraçı: </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{order.executorName || 'Təyin olunmayıb'}</span>
          </div>
          <div>
            <span className="text-slate-500">Status: </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {order.status === 'delivered' ? 'Təhvil verildi' : order.status === 'in_transit' ? 'Yoldadır' : order.status === 'assigned' ? 'Götürülüb' : 'Sürücü gözləyir'}
            </span>
          </div>
        </div>

        {/* Timeline body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {order.history && order.history.length > 0 ? (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {order.history.map((item, idx) => (
                <div key={idx} className="relative group">
                  {/* Step bullet */}
                  <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center group-hover:border-sky-500 transition-colors">
                    {getStepIcon(item.step)}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {item.dateStr || ''} {item.timeStr || ''}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.details}
                    </p>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span>İcra edən: {item.actorName} ({item.actorRole})</span>
                      {item.location && (
                        <span className="font-mono text-sky-600 dark:text-sky-400 flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">
              Tarixçə qeydi tapılmadı.
            </div>
          )}

          {order.notes && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <FileText className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Sifariş qeydi: </span>
                <span>{order.notes}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          {onViewTrajectory ? (
            <button
              id="btn-history-view-trajectory"
              type="button"
              onClick={() => onViewTrajectory(order)}
              className="px-4 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Route className="w-4 h-4 text-sky-600" />
              <span>Marşrut və Traektoriya Xəritəsi</span>
            </button>
          ) : <div />}

          <button
            id="btn-history-close"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs"
          >
            Bağla
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  User as UserIcon,
  Clock,
  Truck,
  CheckCircle2,
  Navigation,
  MapPin,
  ExternalLink,
  Phone,
  FileText,
  AlertCircle,
  History,
  Send,
} from 'lucide-react';
import { Order, ExecutorType } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

interface OrderCardProps {
  order: Order;
  onUpdate: (updatedOrder: Order) => void;
  onViewLiveTracking: (order: Order) => void;
  onViewHistory: (order: Order) => void;
  onOpenDeliverModal: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onUpdate,
  onViewLiveTracking,
  onViewHistory,
  onOpenDeliverModal,
}) => {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isDriver = user?.role === 'DRIVER';
  const isCreator = user?.id === order.creatorId;
  const isAssignedToMe = user?.id === order.executorId || (isDriver && user?.id === order.driverId);

  // Background GPS updater for the active carrier when in_transit
  useEffect(() => {
    if (order.status !== 'in_transit' || !isAssignedToMe || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        api.updateOrderLocation(order.id, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        }).catch(() => {
          // ignore background GPS error
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [order.id, order.status, isAssignedToMe]);

  // Dispatch selection by User: [ Mən aparacam ] or [ Sürücü aparsın ]
  const handleDispatch = async (dispatchType: ExecutorType) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await api.dispatchOrder(order.id, dispatchType);
      onUpdate(res.order);
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Xəta baş verdi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Driver claims order: [ Mən aparacam ]
  const handleClaim = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await api.claimOrder(order.id);
      onUpdate(res.order);
      setSuccessMsg('Sifarişi qəbul etdiniz!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Sifariş götürülərkən xəta baş verdi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Executor departs: [ Yola çıxdım ]
  const handleStart = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      // First try to push initial location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            api.updateOrderLocation(order.id, {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed: pos.coords.speed,
              accuracy: pos.coords.accuracy,
            }).catch(() => {});
          },
          () => {},
          { enableHighAccuracy: true }
        );
      }

      const res = await api.startOrder(order.id);
      onUpdate(res.order);
      setSuccessMsg('Yola çıxdınız! Canlı konumunuz paylaşılır.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Xəta baş verdi.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Status Badge formatting
  const getStatusBadge = () => {
    switch (order.status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5" />
            Yeni Sifariş
          </span>
        );
      case 'pending_driver':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Truck className="w-3.5 h-3.5 animate-bounce" />
            Sürücü gözləyir
          </span>
        );
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <UserIcon className="w-3.5 h-3.5" />
            Götürüldü ({order.executorName || 'Təyin olundu'})
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            Yoldadır (Canlı)
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Təhvil verildi
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Ləğv edildi
          </span>
        );
      default:
        return null;
    }
  };

  const hasCustomerGps = order.customerLatitude !== 0 && order.customerLongitude !== 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      {/* Top row: Order Number & Status */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                Sifariş #{order.orderNumber}
              </span>
              {order.dispatchType === 'USER' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  User Özü
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Yaradıldı: {order.createdDateStr}, {order.createdTimeStr} • {order.creatorName} ({order.creatorRole})
            </p>
          </div>

          <div className="shrink-0">
            {getStatusBadge()}
          </div>
        </div>

        {/* Customer info card */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {order.customerName}
            </span>
            <a
              href={`tel:${order.customerPhone}`}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Phone className="w-3 h-3" />
              {order.customerPhone}
            </a>
          </div>

          <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{order.customerAddress}</span>
          </div>

          {order.notes && (
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800 flex items-start gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span className="italic">"{order.notes}"</span>
            </div>
          )}
        </div>

        {/* Carrier info & timing */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-slate-400">İcraçı: </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {order.executorName ? `${order.executorName} (${order.executorType === 'DRIVER' ? 'Sürücü' : 'User'})` : 'Gözləmədədir'}
            </span>
          </div>

          {order.deliveredAt && (
            <div className="text-emerald-600 dark:text-emerald-400 font-medium">
              Təhvil verildi: {new Date(order.deliveredAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })} ({order.deliveredByName})
            </div>
          )}
        </div>

        {/* Messages */}
        {errorMsg && (
          <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Action Buttons Toolbar */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
        {/* If status is NEW (User hasn't chosen carrier yet) */}
        {order.status === 'new' && (isCreator || isAdmin) && (
          <div className="w-full flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleDispatch('USER')}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition-colors"
            >
              🙋 Mən aparacam
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleDispatch('DRIVER')}
              className="flex-1 py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold transition-colors"
            >
              🚚 Sürücü aparsın
            </button>
          </div>
        )}

        {/* If status is PENDING_DRIVER: Driver claims order (Requirement 5) */}
        {order.status === 'pending_driver' && isDriver && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleClaim}
            className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all"
          >
            <Truck className="w-4 h-4" />
            <span>Mən aparacam</span>
          </button>
        )}

        {/* If assigned to current user/driver, not started yet: [ Yola çıxdım ] (Requirement 8) */}
        {order.status === 'assigned' && isAssignedToMe && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleStart}
            className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5 transition-all"
          >
            <Navigation className="w-4 h-4" />
            <span>Yola çıxdım</span>
          </button>
        )}

        {/* If IN_TRANSIT & is assigned carrier: [ Təhvil verildi ] (Requirement 13) */}
        {order.status === 'in_transit' && isAssignedToMe && (
          <button
            type="button"
            onClick={() => onOpenDeliverModal(order)}
            className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Təhvil verildi</span>
          </button>
        )}

        {/* Live GPS Tracking Button for in_transit/assigned orders */}
        {(order.status === 'in_transit' || order.status === 'assigned') && (
          <button
            type="button"
            onClick={() => onViewLiveTracking(order)}
            className="py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Canlı GPS xəritəsini aç"
          >
            <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
            <span>Canlı konuma bax</span>
          </button>
        )}

        {/* Trajectory History Map Button for completed / delivered orders */}
        {order.status === 'delivered' && (
          <button
            type="button"
            onClick={() => onViewLiveTracking(order)}
            className="py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Keçilən traektoriya və marşrut tarixçəsinə bax"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Traektoriya tarixçəsi</span>
          </button>
        )}

        {/* Waze External Navigation */}
        {hasCustomerGps && (
          <a
            href={`https://waze.com/ul?ll=${order.customerLatitude},${order.customerLongitude}&navigate=yes`}
            target="_blank"
            rel="noreferrer"
            className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Waze ilə get"
          >
            <Navigation className="w-3.5 h-3.5 text-sky-500" />
            <span>Waze</span>
          </a>
        )}

        {/* History Button (Requirement 16) */}
        <button
          type="button"
          onClick={() => onViewHistory(order)}
          className="py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
          title="Tarixçəyə bax"
        >
          <History className="w-3.5 h-3.5 text-slate-500" />
          <span>Tarixçə</span>
        </button>
      </div>
    </div>
  );
};

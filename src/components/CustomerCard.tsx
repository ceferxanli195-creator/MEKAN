import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageSquare,
  Navigation,
  Edit2,
  Trash2,
  MapPin,
  User as UserIcon,
  Calendar,
  Image as ImageIcon,
  Truck,
  Send,
  CheckCircle2,
  PackageCheck,
  Clock,
  X,
  ShoppingBag,
} from 'lucide-react';
import { Customer, Driver, Order } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { CreateOrderModal } from './CreateOrderModal';

interface CustomerCardProps {
  customer: Customer;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onViewMap?: (customer: Customer) => void;
  onUpdated?: (updatedCustomer: Customer) => void;
  onOrderCreated?: (order: Order) => void;
  onGoToOrders?: () => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  onEdit,
  onDelete,
  onViewMap,
  onUpdated,
  onOrderCreated,
  onGoToOrders,
}) => {
  const { user, hasPermission } = useAuth();
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(customer.assignedDriverId || '');
  const [isAssigning, setIsAssigning] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleDeliver = async () => {
    setIsDelivering(true);
    try {
      const res = await api.deliverCustomer(customer.id, deliveryNote);
      setShowDeliverModal(false);
      setDeliveryNote('');
      setActionSuccess('✓ Mal müştəriyə təhvil verildi və bildiriş göndərildi!');
      if (onUpdated) {
        onUpdated(res.customer);
      }
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Təhvil vermə zamanı xəta baş verdi.');
    } finally {
      setIsDelivering(false);
    }
  };

  const hasGps = customer.latitude !== 0 || customer.longitude !== 0;

  // Check permissions & ownership
  const isDriver = user?.role === 'DRIVER';
  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.id === customer.ownerId;

  const canEdit = !isDriver && (isAdmin || (isOwner && hasPermission('edit_customer')));
  const canDelete = !isDriver && (isAdmin || (isOwner && hasPermission('delete_customer')));

  // Format Waze URL
  const wazeUrl = hasGps
    ? `https://waze.com/ul?ll=${customer.latitude},${customer.longitude}&navigate=yes`
    : '#';

  // Fetch drivers when assign modal opens
  const handleOpenAssignModal = async () => {
    try {
      const res = await api.getDrivers();
      setDrivers(res.drivers);
      setSelectedDriverId(customer.assignedDriverId || '');
      setShowAssignModal(true);
    } catch {
      // ignore
    }
  };

  const handleSaveDriverAssignment = async () => {
    setIsAssigning(true);
    try {
      const res = await api.assignDriverToCustomer(
        customer.id,
        selectedDriverId ? selectedDriverId : null
      );
      if (onUpdated) {
        onUpdated(res.customer);
      }
      setShowAssignModal(false);
      setActionSuccess('Sürücü təyinatı yeniləndi.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Təyinat zamanı xəta baş verdi.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Send information to customer (logged in business operations)
  const handleSendToCustomer = async () => {
    let msg = `Salam, hörmətli ${customer.fullName}!\n*Müştəri qeydiyyat məlumatınız:*\n*Telefon:* ${customer.phone}\n*Ünvan:* ${customer.address}`;
    if (customer.notes) {
      msg += `\n*Qeyd:* ${customer.notes}`;
    }
    if (hasGps) {
      msg += `\n*Konum Koordinatları:* ${customer.latitude.toFixed(6)}, ${customer.longitude.toFixed(6)}`;
      msg += `\n*Waze ilə naviqasiya linki:* https://waze.com/ul?ll=${customer.latitude},${customer.longitude}&navigate=yes`;
    }

    const cleanPhoneDigits = customer.phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhoneDigits}&text=${encoded}`, '_blank');

    // Record on backend
    try {
      await api.sendLocationToCustomer(customer.id);
      setActionSuccess('Müştəriyə göndərilmə qeydə alındı.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch {
      // ignore
    }
  };

  // Send information to driver (logged in business operations)
  const handleSendToDriver = async () => {
    let targetDriverId = customer.assignedDriverId;
    if (!targetDriverId) {
      handleOpenAssignModal();
      return;
    }

    let msg = `*SÜRÜCÜ ÜÇÜN ÇATDIRILMA / KONUM MƏLUMATI*\n*Müştəri:* ${customer.fullName}\n*Telefon:* ${customer.phone}\n*Ünvan:* ${customer.address}`;
    if (customer.notes) {
      msg += `\n*Qeyd:* ${customer.notes}`;
    }
    if (hasGps) {
      msg += `\n*GPS:* ${customer.latitude.toFixed(6)}, ${customer.longitude.toFixed(6)}`;
      msg += `\n*Waze ilə birbaşa naviqasiya:* https://waze.com/ul?ll=${customer.latitude},${customer.longitude}&navigate=yes`;
    }

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');

    // Record on backend
    try {
      await api.sendLocationToDriver(customer.id, targetDriverId);
      setActionSuccess('Sürücüyə göndərilmə qeydə alındı.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch {
      // ignore
    }
  };

  const handleWaze = () => {
    if (!hasGps) {
      alert('Bu müştəri üçün GPS koordinatları təyin edilməyib.');
      return;
    }
    window.open(wazeUrl, '_blank');
  };

  const cleanPhone = customer.phone.replace(/\s+/g, '');

  return (
    <>
      <div
        id={`customer-card-${customer.id}`}
        className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
      >
        <div>
          {/* Header row: Name + Owner/GPS badges */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3 min-w-0">
              {customer.photoUrl ? (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="relative group shrink-0"
                >
                  <img
                    src={customer.photoUrl}
                    alt={customer.fullName}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs group-hover:opacity-90"
                  />
                  <div className="absolute inset-0 bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                </button>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold text-lg flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-900/50">
                  {customer.firstName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                  {customer.fullName}
                </h3>
                <a
                  href={`tel:${cleanPhone}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 dark:text-sky-400 hover:underline mt-0.5"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{customer.phone}</span>
                </a>
              </div>
            </div>

            {/* Owner badge for admin / driver */}
            {(isAdmin || isDriver) && (
              <div className="shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium border border-slate-200 dark:border-slate-700">
                <UserIcon className="w-3 h-3 text-slate-500" />
                <span className="truncate max-w-[90px]">{customer.ownerName || 'Bilinməyən'}</span>
              </div>
            )}
          </div>

          {/* Assigned Driver & Delivery Status Bar */}
          <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Sürücü:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {customer.assignedDriverName ? customer.assignedDriverName : 'Təyin edilməyib'}
                </span>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={handleOpenAssignModal}
                  className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline shrink-0"
                >
                  {customer.assignedDriverId ? 'Dəyiş' : 'Təyin et'}
                </button>
              )}
            </div>

            {/* Delivery Status Indicator */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Çatdırılma:</span>
              {customer.currentDeliveryStatus === 'delivered' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  Təhvil verildi
                </span>
              ) : customer.currentDeliveryStatus === 'in_transit' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <Truck className="w-3 h-3" />
                  Yoldadır
                </span>
              ) : customer.currentDeliveryStatus === 'assigned' || customer.assignedDriverId ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                  <Clock className="w-3 h-3" />
                  Yönləndirildi (Gözləyir)
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400">
                  Gözləmədə
                </span>
              )}
            </div>
          </div>

          {/* Action Success Toast */}
          {actionSuccess && (
            <div className="mb-3 p-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Address & Note */}
          <div className="space-y-1.5 mb-4 text-sm">
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
              <span className="leading-snug break-words">{customer.address}</span>
            </div>

            {customer.notes && (
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed italic">
                "{customer.notes}"
              </p>
            )}
          </div>

          {/* GPS Info pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 pb-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Navigation className={`w-3.5 h-3.5 ${hasGps ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span>
                {hasGps ? (
                  <>
                    <span className="font-mono">{customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}</span>
                    {customer.accuracy > 0 && (
                      <span className="ml-1 text-slate-400">(±{customer.accuracy}m)</span>
                    )}
                  </>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">GPS qeyd edilməyib</span>
                )}
              </span>
            </div>

            {customer.createdAt && (
              <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                <Calendar className="w-3 h-3" />
                <span>{new Date(customer.createdAt).toLocaleDateString('az-AZ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sifariş var button - Requirement 1 & 2 for User / Admin */}
        {!isDriver && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowCreateOrderModal(true)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Sifariş var</span>
            </button>
          </div>
        )}

        {/* Action Buttons - Fully wrapped & touch-friendly */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
          {/* Call button */}
          <a
            href={`tel:${cleanPhone}`}
            className="flex-1 min-w-[70px] h-10 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200/60 dark:border-emerald-900/50"
            title="Zəng et"
          >
            <Phone className="w-4 h-4" />
            <span>Zəng</span>
          </a>

          {/* WhatsApp / Send to Customer button */}
          <button
            type="button"
            onClick={handleSendToCustomer}
            className="flex-1 min-w-[85px] h-10 px-2.5 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-teal-200/60 dark:border-teal-900/50"
            title="Müştəriyə WhatsApp ilə göndər və qeyd et"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Müştəriyə</span>
          </button>

          {/* Send to Driver button */}
          {!isDriver && (
            <button
              type="button"
              onClick={handleSendToDriver}
              className="flex-1 min-w-[85px] h-10 px-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-amber-200/60 dark:border-amber-900/50"
              title="Sürücüyə WhatsApp ilə göndər və təyin et"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Sürücüyə</span>
            </button>
          )}

          {/* Waze button */}
          <button
            type="button"
            onClick={handleWaze}
            disabled={!hasGps}
            className="flex-1 min-w-[70px] h-10 px-2.5 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-sky-200/60 dark:border-sky-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Waze ilə get"
          >
            <Navigation className="w-4 h-4" />
            <span>Waze</span>
          </button>

          {/* Edit button */}
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(customer)}
              className="w-10 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center transition-colors shrink-0"
              title="Redaktə et"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {/* Delete button */}
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(customer)}
              className="w-10 h-10 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center transition-colors border border-rose-200/50 dark:border-rose-900/50 shrink-0"
              title="Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Sürücü üçün "Təhvil verdim" düyməsi (Requirement 6 & 11) */}
          {(isDriver || isAdmin) && (
            <div className="w-full pt-1.5">
              {customer.currentDeliveryStatus === 'delivered' ? (
                <button
                  type="button"
                  disabled
                  className="w-full h-10 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-emerald-300 dark:border-emerald-800 cursor-not-allowed opacity-90"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Artıq təhvil verilib</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeliverModal(true)}
                  className="w-full h-10 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Təhvil verdim</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Driver Assignment Modal */}
      {showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Sürücü Təyin Et
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold">{customer.fullName}</span> adlı müştərini hansı sürücüyə təyin etmək istəyirsiniz?
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Sürücü siyahısı
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- Təyinatı ləğv et (Sürücüsüz) --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone}) {d.status === 'inactive' ? '[Deaktiv]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                İmtina
              </button>
              <button
                type="button"
                disabled={isAssigning}
                onClick={handleSaveDriverAssignment}
                className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-xs disabled:opacity-50"
              >
                {isAssigning ? 'Saxlanılır...' : 'Təsdiq Et'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Photo Modal */}
      {showPhotoModal && customer.photoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowPhotoModal(false)}
        >
          <div className="relative max-w-lg w-full max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2">
            <img
              src={customer.photoUrl}
              alt={customer.fullName}
              className="w-full h-auto max-h-[75vh] object-contain rounded-xl mx-auto"
            />
            <div className="p-3 text-center text-white font-medium text-sm">
              {customer.fullName}
            </div>
          </div>
        </div>
      )}

      {/* Deliver Confirmation Modal (Requirement 6 & 11) */}
      {showDeliverModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowDeliverModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Malı Təhvil Ver
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeliverModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
              <p className="font-semibold">
                {customer.fullName} müştərisinə sifarişin çatdırıldığını təsdiq edirsiniz?
              </p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                {customer.address}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Qeyd (İstəyə görə)
              </label>
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={2}
                placeholder="Məsələn: Mal qapıda təhvil verildi, ödəniş alındı..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeliverModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                İmtina
              </button>
              <button
                type="button"
                disabled={isDelivering}
                onClick={handleDeliver}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDelivering ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Təsdiq et (Təhvil verdim)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={showCreateOrderModal}
        customer={customer}
        onClose={() => setShowCreateOrderModal(false)}
        onOrderCreated={(newOrder) => {
          if (onOrderCreated) {
            onOrderCreated(newOrder);
          }
        }}
        onGoToOrders={onGoToOrders}
      />
    </>
  );
};

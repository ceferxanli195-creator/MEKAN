import React, { useEffect, useState } from 'react';
import {
  Truck,
  Navigation,
  Phone,
  MessageSquare,
  MapPin,
  Search,
  CheckCircle2,
  Calendar,
  User as UserIcon,
  Shield,
  ArrowRight,
  RefreshCw,
  History,
  PackageCheck,
  Clock,
  Users,
  X,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Customer, Delivery, OrderDashboardStats } from '../types';
import { NavTab } from './Sidebar';

interface DriverDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orderStats, setOrderStats] = useState<OrderDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Delivery modal state
  const [deliveringCustomer, setDeliveringCustomer] = useState<Customer | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchDriverData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [custRes, delivRes, oStatsRes] = await Promise.all([
        api.getCustomers().catch(() => ({ customers: [] })),
        api.getDeliveries().catch(() => ({ deliveries: [] })),
        api.getOrderDashboardStats().catch(() => null),
      ]);
      setCustomers(custRes?.customers || []);
      setDeliveries(delivRes?.deliveries || []);
      if (oStatsRes?.stats) {
        setOrderStats(oStatsRes.stats);
      }
    } catch (err: any) {
      setError(err.message || 'Məlumatlar yüklənərkən xəta baş verdi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverData();
  }, []);

  const handleDeliver = async () => {
    if (!deliveringCustomer) return;
    setIsDelivering(true);
    try {
      const res = await api.deliverCustomer(deliveringCustomer.id, deliveryNote);
      setCustomers(prev =>
        (prev || []).map(c => (c.id === deliveringCustomer.id ? res.customer : c))
      );
      setDeliveringCustomer(null);
      setDeliveryNote('');
      setToastMessage(`✓ ${res.customer.fullName} üçün mal təhvil verildi və istifadəçiyə bildiriş getdi!`);
      setTimeout(() => setToastMessage(null), 4000);
      fetchDriverData();
    } catch (err: any) {
      alert(err.message || 'Təhvil vermə zamanı xəta baş verdi.');
    } finally {
      setIsDelivering(false);
    }
  };

  const filtered = (customers || []).filter(c => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  });

  const withGpsCount = (customers || []).filter(c => c.latitude !== 0 || c.longitude !== 0).length;
  const deliveredCount = (deliveries || []).filter(d => d.status === 'delivered').length;
  const inTransitCount = (deliveries || []).filter(d => d.status === 'in_transit').length;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Driver Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-amber-600/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-xs font-bold text-amber-100 mb-2">
            <Truck className="w-3.5 h-3.5" />
            <span>SÜRÜCÜ İDARƏETMƏ PANELİ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Salam, {user?.name}!
          </h1>
          <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-xl">
            Sistemdəki bütün müştərilərə baxış, təyin olunmuş çatdırılmalar, dəqiq GPS koordinatları və təhvil jurnalı.
          </p>
        </div>

        {/* Quick Nav Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Sifarişlər {orderStats && orderStats.openOrdersCount > 0 ? `(${orderStats.openOrdersCount})` : ''}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('deliveries')}
            className="px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm rounded-2xl backdrop-blur-xs transition-all flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            <span>Tarixçə</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('map')}
            className="px-4 py-2.5 bg-white text-amber-800 hover:bg-amber-50 font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center gap-2"
          >
            <MapPin className="w-4 h-4 text-amber-600" />
            <span>Xəritə və GPS</span>
          </button>
        </div>
      </div>

      {/* New Open Orders Driver Alert */}
      {orderStats && orderStats.openOrdersCount > 0 && (
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl text-white shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                {orderStats.openOrdersCount} yeni sifariş sürücü gözləyir!
              </h4>
              <p className="text-xs text-white/85">
                Müştərilərdən yeni sifariş daxil olub. İlk qəbul edən sürücü sifarişi götürəcək.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-sm transition-all shrink-0"
          >
            Sifarişləri Götür →
          </button>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Driver Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => onNavigate('customers')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-sky-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Bütün Müştərilər
            </span>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {customers.length}
          </div>
          <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-1 font-medium flex items-center gap-1">
            <span>Siyahıya bax</span> <ArrowRight className="w-3 h-3" />
          </p>
        </div>

        <div
          onClick={() => onNavigate('deliveries')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-emerald-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Təhvil Verildi
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {deliveredCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Təhvil jurnalı
          </p>
        </div>

        <div
          onClick={() => onNavigate('deliveries')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-amber-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Yolda Olanlar
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {inTransitCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Aktiv daşınma
          </p>
        </div>

        <div
          onClick={() => onNavigate('map')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs cursor-pointer hover:border-purple-400 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              GPS Koordinatlı
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
              <Navigation className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
            {withGpsCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Waze ilə birbaşa naviqasiya
          </p>
        </div>
      </div>

      {/* Customers Section (Requirement 2: Sürücü bütün müştəriləri görə bilsin) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              <span>Müştəri Siyahısı və Çatdırılma</span>
              <span className="text-xs font-bold bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 px-2.5 py-0.5 rounded-full">
                {filtered.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Bütün müştərilərin ünvanı, təhkim olunan sürücü, status və təhvil vermə əməliyyatları
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Axtarış (ad, telefon, ünvan)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <button
              type="button"
              onClick={fetchDriverData}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Yenilə"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Müştərilər yüklənir...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            {searchTerm
              ? 'Axtarışa uyğun müştəri tapılmadı.'
              : 'Sistemdə hələ ki müştəri qeydiyyatı yoxdur.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(c => {
              const hasGps = c.latitude !== 0 || c.longitude !== 0;
              const cleanPhone = c.phone.replace(/\s+/g, '');
              const wazeUrl = hasGps
                ? `https://waze.com/ul?ll=${c.latitude},${c.longitude}&navigate=yes`
                : '#';
              const isDelivered = c.currentDeliveryStatus === 'delivered';
              const isInTransit = c.currentDeliveryStatus === 'in_transit';

              return (
                <div
                  key={c.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-between gap-3 hover:border-amber-400 dark:hover:border-amber-500 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                          {c.fullName}
                        </h3>
                        <a
                          href={`tel:${cleanPhone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline mt-1"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{c.phone}</span>
                        </a>
                      </div>

                      {/* Status Badge (Requirement 13) */}
                      <div>
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 rounded-lg">
                            <CheckCircle2 className="w-3 h-3" />
                            Təhvil verildi
                          </span>
                        ) : isInTransit ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 rounded-lg">
                            <Truck className="w-3 h-3" />
                            Yoldadır
                          </span>
                        ) : c.assignedDriverId ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 rounded-lg">
                            <Clock className="w-3 h-3" />
                            Yönləndirildi
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Gözləmədə
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="break-words leading-relaxed">{c.address}</span>
                    </div>

                    {c.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/50 dark:border-slate-800 italic">
                        "{c.notes}"
                      </p>
                    )}

                    {/* Owner & Driver Info Bar */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span>Cavabdeh User: <strong className="text-slate-700 dark:text-slate-300">{c.ownerName || 'Bilinməyən'}</strong></span>
                      <span>Sürücü: <strong className="text-slate-700 dark:text-slate-300">{c.assignedDriverName || 'Təyin edilməyib'}</strong></span>
                    </div>
                  </div>

                  {/* Direct Action Buttons for Driver */}
                  <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="flex-1 min-w-[70px] h-9 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-100 border border-emerald-200/50"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Zəng</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const cleanDigits = c.phone.replace(/[^0-9]/g, '');
                          const msg = encodeURIComponent(
                            `Salam, ${c.fullName}! Çatdırılma üçün sizinlə əlaqə saxlayırıq.\nÜnvanınız: ${c.address}`
                          );
                          window.open(`https://api.whatsapp.com/send?phone=${cleanDigits}&text=${msg}`, '_blank');
                        }}
                        className="flex-1 min-w-[85px] h-9 px-2.5 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-teal-100 border border-teal-200/50"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        disabled={!hasGps}
                        onClick={() => {
                          if (!hasGps) {
                            alert('Bu müştəri üçün GPS koordinatları təyin olunmayıb.');
                            return;
                          }
                          window.open(wazeUrl, '_blank');
                        }}
                        className="flex-1 min-w-[70px] h-9 px-2.5 bg-sky-600 text-white hover:bg-sky-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Waze</span>
                      </button>
                    </div>

                    {/* "Təhvil verdim" Action Button (Requirement 6 & 11) */}
                    <div>
                      {isDelivered ? (
                        <button
                          type="button"
                          disabled
                          className="w-full h-9 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-emerald-300 dark:border-emerald-800 cursor-not-allowed opacity-90"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Artıq təhvil verilib</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveringCustomer(c);
                            setDeliveryNote('');
                          }}
                          className="w-full h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Təhvil verdim</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Driver Profile Information Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-sky-600" />
            <span>Sürücü Profili</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
          >
            <span>Şifrəni dəyiş</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-400 block mb-1">Ad, Soyad</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{user?.name}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-400 block mb-1">Sistem Giriş ID</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{user?.loginId}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-400 block mb-1">Əlaqə Nömrəsi</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{user?.phone || 'Qeyd olunmayıb'}</span>
          </div>
        </div>
      </div>

      {/* Deliver Confirmation Modal (Requirement 6 & 11) */}
      {deliveringCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setDeliveringCustomer(null)}
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
                onClick={() => setDeliveringCustomer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
              <p className="font-semibold text-sm">
                {deliveringCustomer.fullName}
              </p>
              <p className="text-xs text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                {deliveringCustomer.address}
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-[11px]">
                <span>Cavabdeh User: <strong>{deliveringCustomer.ownerName || 'Bilinməyən'}</strong></span>
                <span>Sürücü: <strong>{user?.name}</strong></span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Təhvil Qeydi (İstəyə görə)
              </label>
              <textarea
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                rows={2}
                placeholder="Məsələn: Mal qapıda təhvil verildi, müştəri razı qaldı..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeliveringCustomer(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                İmtina
              </button>
              <button
                type="button"
                disabled={isDelivering}
                onClick={handleDeliver}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
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
    </div>
  );
};

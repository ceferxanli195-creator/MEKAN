import React, { useEffect, useState } from 'react';
import {
  Users,
  MapPin,
  Truck,
  Trash2,
  PlusCircle,
  Clock,
  ArrowRight,
  Shield,
  Activity,
  Phone,
  MessageSquare,
  Navigation,
  Send,
  Edit2,
  CheckCircle2,
  RotateCcw,
  Calendar,
  Filter,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { DashboardStats, Customer, AuditLog, User } from '../types';
import { NavTab } from '../components/Sidebar';
import { DriverDashboard } from '../components/DriverDashboard';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
  onOpenAddCustomer: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenAddCustomer,
}) => {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isDriver = user?.role === 'DRIVER';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operations, setOperations] = useState<AuditLog[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOps, setIsLoadingOps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, opsData] = await Promise.all([
        api.getStats(),
        api.getOperations({ limit: 12 }),
      ]);
      setStats(statsData);
      setOperations(opsData.operations || []);

      if (isAdmin) {
        const uRes = await api.getUsers().catch(() => ({ users: [] }));
        setUsersList(uRes?.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Məlumatlar yüklənə bilmədi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isDriver) {
      fetchDashboardData();
    } else {
      setIsLoading(false);
    }
  }, [isDriver]);

  const handleFilterUserChange = async (userId: string) => {
    setSelectedUserFilter(userId);
    setIsLoadingOps(true);
    try {
      const opsData = await api.getOperations({
        user: userId === 'all' ? undefined : userId,
        limit: 12,
      });
      setOperations(opsData.operations || []);
    } catch {
      // ignore
    } finally {
      setIsLoadingOps(false);
    }
  };

  // If the logged in user is a Driver, render the dedicated Driver Panel
  if (isDriver) {
    return <DriverDashboard onNavigate={onNavigate} />;
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Məlumatlar yüklənir...</p>
        </div>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOCATION_SENT_TO_CUSTOMER':
        return {
          label: 'Məlumat Göndərildi',
          icon: <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
          color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        };
      case 'LOCATION_SENT_TO_DRIVER':
        return {
          label: 'Sürücüyə Ötürüldü',
          icon: <Send className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'DRIVER_ASSIGN':
        return {
          label: 'Sürücü Təyinatı',
          icon: <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
          color: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      case 'CUSTOMER_UPDATE':
      case 'UPDATE_CUSTOMER':
        return {
          label: 'Müştəri Redaktəsi',
          icon: <Edit2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />,
          color: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        };
      case 'CUSTOMER_CREATE':
      case 'CREATE_CUSTOMER':
        return {
          label: 'Yeni Müştəri',
          icon: <PlusCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'CUSTOMER_RESTORE':
      case 'RESTORE_CUSTOMER':
        return {
          label: 'Bərpa Edildi',
          icon: <RotateCcw className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />,
          color: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        };
      case 'CUSTOMER_DELIVERED':
        return {
          label: 'Mal Təhvil Verildi',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'CUSTOMER_DELETE':
      case 'DELETE_CUSTOMER':
        return {
          label: 'Silindi',
          icon: <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
          color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
      default:
        return {
          label: 'Biznes Əməliyyatı',
          icon: <Activity className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />,
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-sky-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-200">
            İdarəetmə Paneli
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-1">
            Xoş gəldiniz, {user?.name}!
          </h1>
          <p className="text-xs sm:text-sm text-sky-100/90 mt-1.5 max-w-xl">
            {isAdmin
              ? 'Bütün istifadəçilər, müştərilər, sürücülər və GPS naviqasiya sistemi üzərində tam nəzarət.'
              : 'Şəxsi müştəriləriniz, GPS qeydiyyatı və operativ naviqasiya.'}
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="px-4 py-3 bg-white/20 hover:bg-white/30 text-white font-bold text-sm rounded-2xl backdrop-blur-xs transition-all flex items-center gap-2"
          >
            <ShoppingBag className="w-5 h-5 text-white" />
            <span>Sifarişlər</span>
          </button>

          {hasPermission('create_customer') && (
            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="px-5 py-3 bg-white text-sky-700 hover:bg-sky-50 font-bold text-sm rounded-2xl shadow-md transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5 text-sky-600" />
              <span>Yeni Müştəri</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards Grid - Pure real values */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {isAdmin ? (
          <>
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ümumi Müştərilər</span>
                <div className="p-2 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.totalCustomers ?? 0}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {stats?.activeCustomers ?? 0} aktiv müştəri
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">İstifadəçilər</span>
                <div className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Shield className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.totalUsers ?? 0}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                {stats?.activeUsers ?? 0} aktiv istifadəçi
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sürücülər</span>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.totalDrivers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {stats?.activeDrivers ?? 0} aktiv sürücü
              </p>
            </div>

            {/* Trash is visible ONLY to Admin */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Zibil Qutusu</span>
                <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Trash2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.deletedCustomers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Silinmiş qeydlər (Admin)
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Regular User Stats - NO Trash card */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Müştərilərim</span>
                <div className="p-2 bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.totalCustomers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Şəxsi qeydiyyatınızda olan
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aktiv Müştərilər</span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.activeCustomers ?? 0}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                Bazadakı aktiv müştərilər
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Bugünkü Əməliyyatlarım</span>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.todayOperations ?? 0}
              </div>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                Bu gün etdiyiniz əməliyyatlar
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aktiv Sürücülər</span>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {stats?.activeDrivers ?? 0}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Təyinat üçün hazır
              </p>
            </div>
          </>
        )}
      </div>

      {/* Two columns: Recent Customers & Recent Business Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-600" />
                <span>Son Əlavə Edilən Müştərilər</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('customers')}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
              >
                Hamısına bax <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stats?.recentCustomers && stats.recentCustomers.length > 0 ? (
              <div className="space-y-3">
                {stats.recentCustomers.map((c) => {
                  const hasGps = c.latitude !== 0 || c.longitude !== 0;
                  const cleanPhone = c.phone.replace(/\s+/g, '');
                  const wazeUrl = hasGps
                    ? `https://waze.com/ul?ll=${c.latitude},${c.longitude}&navigate=yes`
                    : '#';

                  return (
                    <div
                      key={c.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {c.fullName}
                          </h3>
                          {c.assignedDriverName && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-md shrink-0">
                              🚚 {c.assignedDriverName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[260px]">
                          {c.address}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-lg hover:bg-emerald-100"
                          title="Zəng et"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const msg = encodeURIComponent(
                              `*Müştəri:* ${c.fullName}\n*Telefon:* ${c.phone}\n*Ünvan:* ${c.address}${
                                hasGps ? `\n*Waze:* ${wazeUrl}` : ''
                              }`
                            );
                            window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
                          }}
                          className="p-2 bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 rounded-lg hover:bg-teal-100"
                          title="WhatsApp ilə göndər"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {hasGps && (
                          <a
                            href={wazeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 rounded-lg hover:bg-sky-100"
                            title="Waze ilə get"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Hazırda müştəri yoxdur.
              </div>
            )}
          </div>
        </div>

        {/* Recent Business Operations (Real Operations Only, No Login/Logout) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span>Son Əməliyyatlar</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isAdmin
                    ? 'İstifadəçilər tərəfindən icra edilən real biznes əməliyyatları'
                    : 'Yalnız sizin icra etdiyiniz real biznes əməliyyatları'}
                </p>
              </div>

              {/* Admin filter by user */}
              {isAdmin && usersList.length > 0 && (
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <Filter className="w-3 h-3 text-slate-400" />
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => handleFilterUserChange(e.target.value)}
                    className="text-[11px] px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-hidden"
                  >
                    <option value="all">Bütün istifadəçilər</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isLoadingOps ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Əməliyyatlar yüklənir...
              </div>
            ) : operations.length > 0 ? (
              <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                {operations.map((op) => {
                  const badge = getActionBadge(op.action);
                  return (
                    <div
                      key={op.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.color}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>

                          {isAdmin && op.userName && (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              • {op.userName}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {new Date(op.createdAt).toLocaleTimeString('az-AZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {new Date(op.createdAt).toLocaleDateString('az-AZ')}
                        </span>
                      </div>

                      <p className="text-slate-800 dark:text-slate-200 font-medium leading-snug">
                        {op.details}
                      </p>

                      {(op.targetCustomerName || op.targetDriverName) && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                          {op.targetCustomerName && (
                            <span className="text-sky-600 dark:text-sky-400 font-semibold">
                              Müştəri: {op.targetCustomerName}
                            </span>
                          )}
                          {op.targetDriverName && (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Sürücü: {op.targetDriverName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Hazırda qeydə alınmış biznes əməliyyatı yoxdur.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate('logs')}
              className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
            >
              Tam audit jurnalına bax <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

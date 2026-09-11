import React, { useEffect, useState, useMemo } from 'react';
import {
  History,
  Search,
  Trash2,
  Filter,
  Clock,
  User as UserIcon,
  Shield,
  X,
  AlertCircle,
  CheckSquare,
  Square,
  Calendar,
  Truck,
  Users,
  Send,
  MessageSquare,
  Edit2,
  PlusCircle,
  RotateCcw,
  RotateCw,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { AuditLog, User, Driver, Customer } from '../types';
import { ConfirmModal } from '../components/ConfirmModal';

export const LogsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter lists
  const [usersList, setUsersList] = useState<User[]>([]);
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState('all');
  const [selectedActionType, setSelectedActionType] = useState('all');

  // Selected Log IDs for bulk deletion
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);

  // Fetch reference lists (users, drivers, customers) once
  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const promises: Promise<any>[] = [
          api.getDrivers().catch(() => ({ drivers: [] })),
          api.getCustomers().catch(() => ({ customers: [] })),
        ];
        if (isAdmin) {
          promises.push(api.getUsers().catch(() => ({ users: [] })));
        }

        const results = await Promise.all(promises);
        setDriversList(results[0]?.drivers || []);
        setCustomersList(results[1]?.customers || []);
        if (isAdmin && results[2]) {
          setUsersList(results[2]?.users || []);
        }
      } catch {
        // ignore errors in background fetch
      }
    };

    fetchReferences();
  }, [isAdmin]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getLogs({
        search: searchTerm.trim() || undefined,
        date: selectedDate || undefined,
        userId: selectedUserId === 'all' ? undefined : selectedUserId,
        driverId: selectedDriverId === 'all' ? undefined : selectedDriverId,
        customerId: selectedCustomerId === 'all' ? undefined : selectedCustomerId,
        actionType: selectedActionType === 'all' ? undefined : selectedActionType,
      });
      setLogs(res.logs || []);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.message || 'Tarixçə yüklənərkən xəta baş verdi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [searchTerm, selectedDate, selectedUserId, selectedDriverId, selectedCustomerId, selectedActionType]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedDate('');
    setSelectedUserId('all');
    setSelectedDriverId('all');
    setSelectedCustomerId('all');
    setSelectedActionType('all');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedDate !== '' ||
    selectedUserId !== 'all' ||
    selectedDriverId !== 'all' ||
    selectedCustomerId !== 'all' ||
    selectedActionType !== 'all';

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === logs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(logs.map(l => l.id));
    }
  };

  const handleDeleteSelectedConfirm = async () => {
    if (selectedIds.length === 0) return;
    setIsDeleting(true);
    try {
      await api.deleteLogs(selectedIds, false);
      setShowDeleteSelectedModal(false);
      fetchLogs();
    } catch (err: any) {
      alert(err.message || 'Tarixçə silinmədi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllConfirm = async () => {
    setIsDeleting(true);
    try {
      await api.deleteLogs([], true);
      setShowClearAllModal(false);
      fetchLogs();
    } catch (err: any) {
      alert(err.message || 'Bütün tarixçə silinmədi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const actionTypesList = [
    { value: 'all', label: 'Bütün Əməliyyat Növləri' },
    { value: 'LOCATION_SENT_TO_CUSTOMER', label: 'Müştəriyə Məlumat Göndərilməsi' },
    { value: 'LOCATION_SENT_TO_DRIVER', label: 'Sürücüyə Konum Göndərilməsi' },
    { value: 'DRIVER_ASSIGN', label: 'Sürücü Təyinatı' },
    { value: 'CUSTOMER_CREATE', label: 'Müştəri Əlavəsi' },
    { value: 'CUSTOMER_UPDATE', label: 'Müştəri Redaktəsi' },
    { value: 'CUSTOMER_DELETE', label: 'Müştəri Silinməsi' },
    { value: 'CUSTOMER_RESTORE', label: 'Müştəri Bərpası' },
    { value: 'LOGIN', label: 'Sistemə Giriş (Login)' },
    { value: 'LOGOUT', label: 'Sistemdən Çıxış (Logout)' },
    { value: 'CREATE_USER', label: 'İstifadəçi Əlavəsi' },
    { value: 'UPDATE_USER', label: 'İstifadəçi Redaktəsi' },
    { value: 'CREATE_DRIVER', label: 'Sürücü Əlavəsi' },
    { value: 'UPDATE_DRIVER', label: 'Sürücü Redaktəsi' },
  ];

  const getLogBadge = (log: AuditLog) => {
    const action = log.actionType || log.action;
    switch (action) {
      case 'LOCATION_SENT_TO_CUSTOMER':
        return {
          label: 'Müştəriyə Məlumat',
          icon: <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
          color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        };
      case 'LOCATION_SENT_TO_DRIVER':
        return {
          label: 'Sürücüyə Göndərildi',
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
      case 'CUSTOMER_DELETE':
      case 'DELETE_CUSTOMER':
        return {
          label: 'Silindi',
          icon: <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
          color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
      case 'LOGIN':
        return {
          label: 'Daxilolma',
          icon: <Shield className="w-3.5 h-3.5 text-slate-500" />,
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        };
      case 'LOGOUT':
        return {
          label: 'Çıxış',
          icon: <Shield className="w-3.5 h-3.5 text-slate-500" />,
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        };
      default:
        return {
          label: log.action || 'Əməliyyat',
          icon: <History className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />,
          color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-600" />
            <span>Audit Tarixçəsi və Filtrlər</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {logs.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? 'Sistemdə icra edilən bütün əməliyyatların real audit jurnalı və parametrik axtarışı'
              : 'Şəxsi fəaliyyət və biznes əməliyyatlarınızın tam qeydiyyatı'}
          </p>
        </div>

        {/* Admin bulk delete buttons */}
        {isAdmin && logs.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteSelectedModal(true)}
                className="px-3.5 py-2 bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 text-xs font-bold rounded-xl hover:bg-rose-100 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Seçilənləri Sil ({selectedIds.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowClearAllModal(true)}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <span>Bütün Tarixçəni Təmizlə</span>
            </button>
          </div>
        )}
      </div>

      {/* Comprehensive Filter Panel: Date, User, Customer, Driver, Action Type, Search */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Ətraflı Axtarış və Filtrləmə</span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              <span>Filtrləri Sıfırla</span>
            </button>
          )}
        </div>

        {/* First Row: Search input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Açar söz, müştəri adı, sürücü adı və ya əməliyyat detalları..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Second Row: 5 Structured Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Date Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sky-500" />
              <span>Tarix</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* 2. User Filter (Admin can choose any user) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <UserIcon className="w-3 h-3 text-purple-500" />
              <span>İstifadəçi</span>
            </label>
            {isAdmin ? (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Bütün İstifadəçilər</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {user?.name} (Özüm)
              </div>
            )}
          </div>

          {/* 3. Customer Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-sky-500" />
              <span>Müştəri</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Bütün Müştərilər</option>
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Driver Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Truck className="w-3 h-3 text-amber-500" />
              <span>Sürücü</span>
            </label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Bütün Sürücülər</option>
              {driversList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Operation Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
              <History className="w-3 h-3 text-emerald-500" />
              <span>Əməliyyat Növü</span>
            </label>
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {actionTypesList.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Select all bar for Admin */}
        {isAdmin && logs.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
            >
              {selectedIds.length === logs.length ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Hamısını seç ({logs.length})</span>
            </button>

            {selectedIds.length > 0 && (
              <span className="font-semibold text-emerald-600">
                {selectedIds.length} qeyd seçilib
              </span>
            )}
          </div>
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
          <div className="w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && logs.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Tarixçə qeydi tapılmadı.
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {hasActiveFilters
              ? 'Seçilmiş filter meyarlarına uyğun nəticə tapılmadı. Zəhmət olmasa filtrləri dəyişin.'
              : 'Sistemdə hələ heç bir əməliyyat qeydi mövcud deyil.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              Filtrləri təmizlə
            </button>
          )}
        </div>
      )}

      {/* Logs List - Clean Cards with Badges, Target Info, and Timestamps */}
      {!isLoading && logs.length > 0 && (
        <div className="space-y-2.5">
          {logs.map((log) => {
            const isSelected = selectedIds.includes(log.id);
            const badge = getLogBadge(log);

            return (
              <div
                key={log.id}
                onClick={() => isAdmin && toggleSelect(log.id)}
                className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {isAdmin && (
                  <div className="mt-1 shrink-0">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Operation Type Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${badge.color}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>

                      {/* Operator info */}
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white">
                        <UserIcon className="w-3 h-3 text-slate-400" />
                        <span>{log.userName}</span>
                        {log.role && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({log.role})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0 font-medium">
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(log.createdAt).toLocaleTimeString('az-AZ', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(log.createdAt).toLocaleDateString('az-AZ')}
                      </span>
                    </div>
                  </div>

                  {/* Log Details Text */}
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words font-medium">
                    {log.details}
                  </p>

                  {/* Target Entities: Customer & Driver */}
                  {(log.customerName || log.driverName) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
                      {log.customerName && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold">
                          <Users className="w-3 h-3 text-sky-500" />
                          <span>Müştəri: {log.customerName}</span>
                        </div>
                      )}

                      {log.driverName && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold">
                          <Truck className="w-3 h-3 text-amber-500" />
                          <span>Sürücü: {log.driverName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Logs Deletion Confirmation */}
      <ConfirmModal
        isOpen={showDeleteSelectedModal}
        title="Seçilmiş Tarixçə Qeydlərini Sil"
        message={`Seçilmiş ${selectedIds.length} ədəd tarixçə qeydini silmək istəyirsiniz?`}
        confirmText="Sil"
        cancelText="İmtina"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteSelectedConfirm}
        onCancel={() => setShowDeleteSelectedModal(false)}
      />

      {/* Clear All Logs Confirmation */}
      <ConfirmModal
        isOpen={showClearAllModal}
        title="Bütün Tarixçəni Təmizlə"
        message="BÜTÜN audit tarixçəsi həmişəlik silinəcək. Bu əməliyyat geri qaytarıla bilməz. Davam etmək istəyirsiniz?"
        confirmText="Bütün Tarixçəni Sil"
        cancelText="İmtina"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleClearAllConfirm}
        onCancel={() => setShowClearAllModal(false)}
      />
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Calendar,
  Filter,
  Download,
  Truck,
  CheckCircle2,
  Clock,
  Navigation,
  Phone,
  User as UserIcon,
  PackageCheck,
  AlertCircle,
  RotateCcw,
  MapPin,
  Check,
  X,
  ChevronRight,
  List,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Delivery, DeliveryStatus, Driver } from '../types';

export const DeliveriesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isDriver = user?.role === 'DRIVER';

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [driverStats, setDriverStats] = useState<Array<{ driverId: string; driverName: string; count: number; deliveredCount: number }>>([]);
  const [driversList, setDriversList] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Delivery modal
  const [deliveringItem, setDeliveringItem] = useState<Delivery | null>(null);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;
      if (isAdmin && selectedDriverId !== 'all') params.driverId = selectedDriverId;

      const res = await api.getDeliveries(params);
      setDeliveries(res.deliveries || []);
      setDriverStats(res.driverStats || []);

      if (isAdmin) {
        const dRes = await api.getDrivers();
        setDriversList(dRes.drivers || []);
      }
    } catch (err: any) {
      setError(err.message || 'Çatdırılmalar yüklənərkən xəta baş verdi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, dateFilter, selectedDriverId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Calculations for KPI cards
  const stats = useMemo(() => {
    const total = deliveries.length;
    const delivered = deliveries.filter(d => d.status === 'delivered').length;
    const inTransit = deliveries.filter(d => d.status === 'in_transit').length;
    const assigned = deliveries.filter(d => d.status === 'assigned').length;

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayDelivered = deliveries.filter(
      d => d.status === 'delivered' && d.deliveredAt && d.deliveredAt.slice(0, 10) === todayStr
    ).length;

    return { total, delivered, inTransit, assigned, todayDelivered };
  }, [deliveries]);

  // Start delivery action ("Yola çıxdım")
  const handleStartDelivery = async (deliveryId: string) => {
    try {
      const res = await api.startDelivery(deliveryId);
      setDeliveries(prev => prev.map(d => (d.id === deliveryId ? res.delivery : d)));
      setSuccessToast('Sifariş üçün yola çıxdınız (Status: Yoldadır)');
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Xəta baş verdi.');
    }
  };

  // Complete delivery ("Təhvil verdim")
  const handleConfirmDeliver = async () => {
    if (!deliveringItem) return;
    setIsSubmitting(true);
    try {
      const res = await api.deliverDelivery(deliveringItem.id, deliveryNote);
      setDeliveries(prev => prev.map(d => (d.id === deliveringItem.id ? res.delivery : d)));
      setDeliveringItem(null);
      setDeliveryNote('');
      setSuccessToast(`✓ ${res.delivery.customerName} üçün mal təhvil verildi və istifadəçiyə bildiriş göndərildi!`);
      setTimeout(() => setSuccessToast(null), 4000);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Təhvil vermə zamanı xəta baş verdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (deliveries.length === 0) {
      alert('İxrac üçün heç bir qeyd tapılmadı.');
      return;
    }

    const headers = [
      'Müştəri',
      'Telefon',
      'Ünvan',
      'Cavabdeh İstifadəçi',
      'Sürücü',
      'Yönləndirilmə Tarixi',
      'Təhvil Verilmə Tarixi',
      'Status',
      'Qeyd',
    ];

    const statusLabels: Record<DeliveryStatus, string> = {
      assigned: 'Yönləndirildi (Gözləyir)',
      in_transit: 'Yoldadır',
      delivered: 'Təhvil verildi',
    };

    const rows = deliveries.map(d => [
      `"${(d.customerName || '').replace(/"/g, '""')}"`,
      `"${(d.customerPhone || '').replace(/"/g, '""')}"`,
      `"${(d.customerAddress || '').replace(/"/g, '""')}"`,
      `"${(d.ownerName || '').replace(/"/g, '""')}"`,
      `"${(d.driverName || '').replace(/"/g, '""')}"`,
      `"${d.assignedAt ? new Date(d.assignedAt).toLocaleString('az-AZ') : ''}"`,
      `"${d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('az-AZ') : ''}"`,
      `"${statusLabels[d.status] || d.status}"`,
      `"${(d.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catdirilma_tarixcesi_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const setTodayDate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDateFilter(today);
  };

  const clearDateFilter = () => {
    setDateFilter('');
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            <span>{isDriver ? 'Çatdırılma Tarixçəsi' : 'Çatdırılmalar və Tarixçə'}</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {deliveries.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isDriver
              ? 'Sizə təyin edilmiş sifarişlər, çatdırılma statusları və təhvil qeydləri'
              : 'Sürücülərin çatdırılma jurnalı, icra vaxtları və təhvil statusları'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* View toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Kart görünüşü"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Cədvəl görünüşü"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors"
            title="Yenilə"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none px-3.5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            title="Excel / CSV kimi yüklə"
          >
            <Download className="w-4 h-4" />
            <span>Excel / CSV İxrac</span>
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Ümumi Çatdırılmalar</span>
            <Truck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Bütün seçilmiş dövr üzrə
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <span>Təhvil Verildi</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.delivered}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Bu gün: <strong className="text-emerald-600">{stats.todayDelivered}</strong>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <span>Yoldadır</span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {stats.inTransit}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Hazırda daşınmada olan
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 text-xs font-semibold">
            <span>Yönləndirilib (Gözləyir)</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-2">
            {stats.assigned}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Sürücü tərəfindən gözlənilir
          </div>
        </div>
      </div>

      {/* Driver breakdown section for Admin (Requirement 12) */}
      {isAdmin && driverStats.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-amber-500" />
            <span>Sürücülər Üzrə Çatdırılma Statistikası</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {driverStats.map((ds) => {
              const isSelected = selectedDriverId === ds.driverId;
              return (
                <button
                  key={ds.driverId}
                  type="button"
                  onClick={() => setSelectedDriverId(isSelected ? 'all' : ds.driverId)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 dark:border-sky-700 ring-2 ring-sky-400/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {ds.driverName}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    <span>Ümumi: <strong>{ds.count}</strong></span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Təhvil: <strong>{ds.deliveredCount}</strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Müştəri adı, telefon və ya qeyd..."
              className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Bütün Statuslar</option>
              <option value="assigned">Yönləndirildi (Gözləyir)</option>
              <option value="in_transit">Yoldadır</option>
              <option value="delivered">Təhvil verildi</option>
            </select>
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-8 pr-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>
            {dateFilter ? (
              <button
                type="button"
                onClick={clearDateFilter}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                title="Tarix filtrini təmizlə"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={setTodayDate}
                className="px-2.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold whitespace-nowrap"
              >
                Bu gün
              </button>
            )}
          </div>

          {/* Driver filter for Admin */}
          {isAdmin ? (
            <div>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="all">Bütün Sürücülər</option>
                {driversList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>Sürücü: <strong>{user?.name}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-12 flex justify-center">
          <div className="w-7 h-7 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && deliveries.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-800">
          <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Heç bir çatdırılma qeydi tapılmadı
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Axtarış filtrlərini dəyişərək yenidən cəhd edin və ya yeni müştəri yönləndirməsi gözləyin.
          </p>
        </div>
      )}

      {/* Deliveries List - Cards View */}
      {!isLoading && deliveries.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliveries.map((item) => {
            const isDelivered = item.status === 'delivered';
            const isInTransit = item.status === 'in_transit';
            const hasGps = item.customerLatitude !== 0 || item.customerLongitude !== 0;
            const wazeUrl = hasGps
              ? `https://waze.com/ul?ll=${item.customerLatitude},${item.customerLongitude}&navigate=yes`
              : '#';

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Top: Customer & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {item.customerName}
                      </h3>
                      {item.customerPhone && (
                        <a
                          href={`tel:${item.customerPhone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline mt-0.5"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{item.customerPhone}</span>
                        </a>
                      )}
                    </div>

                    {/* Status Badge (Requirement 13) */}
                    <div>
                      {isDelivered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Təhvil verildi
                        </span>
                      ) : isInTransit ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Truck className="w-3.5 h-3.5 animate-bounce" />
                          Yoldadır
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                          <Clock className="w-3.5 h-3.5" />
                          Yönləndirildi
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-snug break-words">{item.customerAddress}</span>
                  </div>

                  {/* Owner and Driver info */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Müştəri Sahibi (User):</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                        {item.ownerName || 'Bilinməyən'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Təyin olunmuş Sürücü:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                        {item.driverName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-slate-400">Yönləndirildi:</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {item.assignedAt ? new Date(item.assignedAt).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </div>

                    {isDelivered && item.deliveredAt && (
                      <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                        <span className="font-medium">Təhvil saatı:</span>
                        <span className="font-mono text-[11px] font-bold">
                          {new Date(item.deliveredAt).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Customer or Delivery Notes */}
                  {(item.notes || item.customerNotes) && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800/80 mb-3 italic">
                      "{item.notes || item.customerNotes}"
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Waze button */}
                    <button
                      type="button"
                      disabled={!hasGps}
                      onClick={() => window.open(wazeUrl, '_blank')}
                      className="flex-1 py-2 px-3 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-sky-200/60 dark:border-sky-900/50 disabled:opacity-40"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Waze</span>
                    </button>

                    {/* Start trip button if assigned and not yet in transit */}
                    {!isDelivered && !isInTransit && (isDriver || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleStartDelivery(item.id)}
                        className="flex-1 py-2 px-3 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-amber-200/60"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Yola çıxdım</span>
                      </button>
                    )}
                  </div>

                  {/* "Təhvil verdim" Action Button (Requirement 6 & 11) */}
                  {(isDriver || isAdmin) && (
                    <div>
                      {isDelivered ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-emerald-300 dark:border-emerald-800 cursor-not-allowed opacity-90"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Artıq təhvil verilib</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveringItem(item);
                            setDeliveryNote(item.notes || '');
                          }}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] cursor-pointer"
                        >
                          <PackageCheck className="w-4 h-4" />
                          <span>Təhvil verdim</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deliveries List - Table View */}
      {!isLoading && deliveries.length > 0 && viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Müştəri</th>
                  <th className="py-3 px-4">Ünvan</th>
                  <th className="py-3 px-4">Cavabdeh User</th>
                  <th className="py-3 px-4">Sürücü</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Yönləndirildi</th>
                  <th className="py-3 px-4">Təhvil Verildi</th>
                  <th className="py-3 px-4 text-right">Əməliyyat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {deliveries.map((item) => {
                  const isDelivered = item.status === 'delivered';
                  const isInTransit = item.status === 'in_transit';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        <div>{item.customerName}</div>
                        {item.customerPhone && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.customerPhone}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px] truncate" title={item.customerAddress}>
                        {item.customerAddress}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.ownerName || '-'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                        {item.driverName}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            Təhvil verildi
                          </span>
                        ) : isInTransit ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                            <Truck className="w-3 h-3" />
                            Yoldadır
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300">
                            <Clock className="w-3 h-3" />
                            Yönləndirildi
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {item.assignedAt ? new Date(item.assignedAt).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {isDelivered && item.deliveredAt
                          ? new Date(item.deliveredAt).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {(isDriver || isAdmin) && (
                          isDelivered ? (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Təhvil verildi
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDeliveringItem(item);
                                setDeliveryNote(item.notes || '');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Təhvil verdim
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Deliver Confirmation Modal (Requirement 6 & 11) */}
      {deliveringItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
          onClick={() => setDeliveringItem(null)}
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
                onClick={() => setDeliveringItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
              <p className="font-semibold text-sm">
                {deliveringItem.customerName}
              </p>
              <p className="text-xs text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                {deliveringItem.customerAddress}
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-[11px]">
                <span>Cavabdeh User: <strong>{deliveringItem.ownerName}</strong></span>
                <span>Sürücü: <strong>{deliveringItem.driverName}</strong></span>
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
                onClick={() => setDeliveringItem(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                İmtina
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDeliver}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
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

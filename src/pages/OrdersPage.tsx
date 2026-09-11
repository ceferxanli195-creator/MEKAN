import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  RefreshCw,
  Truck,
  CheckCircle2,
  Clock,
  Navigation,
  AlertCircle,
  Calendar,
  UserCheck,
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { OrderCard } from '../components/OrderCard';
import { LiveOrderTrackingModal } from '../components/LiveOrderTrackingModal';
import { OrderHistoryModal } from '../components/OrderHistoryModal';
import { DeliverOrderModal } from '../components/DeliverOrderModal';
import { NavTab } from '../components/Sidebar';

interface OrdersPageProps {
  onNavigate?: (tab: NavTab) => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isDriver = user?.role === 'DRIVER';
  const isAdmin = user?.role === 'ADMIN';

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>(isDriver ? 'open' : 'all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Modals state
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [deliverOrder, setDeliverOrder] = useState<Order | null>(null);

  const fetchOrders = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      let filterMode: 'all' | 'open' | 'my_orders' | undefined = undefined;
      let statusFilter: string | undefined = undefined;

      if (isDriver) {
        if (activeTab === 'open') {
          filterMode = 'open';
        } else if (activeTab === 'my_active') {
          filterMode = 'my_orders';
          statusFilter = 'active';
        } else if (activeTab === 'my_delivered') {
          filterMode = 'my_orders';
          statusFilter = 'delivered';
        }
      } else {
        if (activeTab === 'pending') {
          statusFilter = 'pending_driver';
        } else if (activeTab === 'in_transit') {
          statusFilter = 'in_transit';
        } else if (activeTab === 'delivered') {
          statusFilter = 'delivered';
        }
      }

      const res = await api.getOrders({
        search: searchQuery.trim() || undefined,
        status: statusFilter,
        filterMode,
        date: selectedDate || undefined,
      });

      setOrders(res?.orders || []);
    } catch (err: any) {
      setError(err.message || 'Sifarişlər yüklənərkən xəta baş verdi.');
      setOrders([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab, selectedDate]);

  // Periodic silent polling every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders(true);
    }, 8000);
    return () => clearInterval(timer);
  }, [activeTab, selectedDate, searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const handleOrderUpdated = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    if (trackingOrder?.id === updated.id) {
      setTrackingOrder(updated);
    }
  };

  // Filter tabs definition
  const driverTabs = [
    { id: 'open', label: 'Yeni Sifarişlər', icon: Truck },
    { id: 'my_active', label: 'Götürdüyüm Sifarişlər', icon: UserCheck },
    { id: 'my_delivered', label: 'Tarixçə (Təhvil verilənlər)', icon: CheckCircle2 },
  ];

  const userTabs = [
    { id: 'all', label: 'Bütün Sifarişlər', icon: ShoppingBag },
    { id: 'pending', label: 'Sürücü Gözləyir', icon: Clock },
    { id: 'in_transit', label: 'Yoldadır (Canlı)', icon: Navigation },
    { id: 'delivered', label: 'Təhvil Verilib', icon: CheckCircle2 },
  ];

  const tabs = isDriver ? driverTabs : userTabs;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>{isDriver ? 'Sürücü Sifarişləri' : 'Sifarişlər və Çatdırılma'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isDriver
              ? 'Müştərilərdən gələn yeni sifarişləri qəbul edin və çatdırılmanı icra edin.'
              : 'Müştərilərə aid sifarişlərin icra vəziyyəti və canlı GPS izləməsi.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Yenilə</span>
          </button>

          {!isDriver && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
            >
              <span>+ Müştəridən Sifariş Al</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sifariş #ID, müştəri adı, telefon və ya ünvan üzrə axtarış..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </form>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              Təmizlə
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
          ))}
        </div>
      ) : !orders || orders.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {isDriver && activeTab === 'open'
              ? 'Hazırda yeni sifariş yoxdur'
              : 'Sifariş tapılmadı'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            {isDriver
              ? 'User yeni sifariş yaratdıqda dərhal burada görünəcək və sizə bildiriş gələcək.'
              : '“Müştərilər” bölməsindən istənilən müştərinin qarşısındakı [ Sifariş var ] düyməsini basaraq yeni sifariş yarada bilərsiniz.'}
          </p>

          {!isDriver && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20"
            >
              Müştərilər Siyahısına Get
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(orders || []).map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onUpdate={handleOrderUpdated}
              onViewLiveTracking={(ord) => setTrackingOrder(ord)}
              onViewHistory={(ord) => setHistoryOrder(ord)}
              onOpenDeliverModal={(ord) => setDeliverOrder(ord)}
            />
          ))}
        </div>
      )}

      {/* Live Tracking Modal */}
      <LiveOrderTrackingModal
        isOpen={!!trackingOrder}
        order={trackingOrder}
        onClose={() => setTrackingOrder(null)}
      />

      {/* History Modal */}
      <OrderHistoryModal
        isOpen={!!historyOrder}
        order={historyOrder}
        onClose={() => setHistoryOrder(null)}
        onViewTrajectory={(ord) => {
          setHistoryOrder(null);
          setTrackingOrder(ord);
        }}
      />

      {/* Deliver Modal */}
      <DeliverOrderModal
        isOpen={!!deliverOrder}
        order={deliverOrder}
        onClose={() => setDeliverOrder(null)}
        onDelivered={(updated) => {
          handleOrderUpdated(updated);
          fetchOrders(true);
        }}
      />
    </div>
  );
};

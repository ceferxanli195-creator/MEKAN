import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  X,
  Filter,
  Users,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Customer, User } from '../types';
import { CustomerCard } from '../components/CustomerCard';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { NavTab } from '../components/Sidebar';

interface CustomersPageProps {
  onNavigate?: (tab: NavTab) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ onNavigate }) => {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isDriver = user?.role === 'DRIVER';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getCustomers({
        search: searchTerm,
        ownerId: selectedOwnerId === 'all' ? undefined : selectedOwnerId,
      });
      setCustomers(res?.customers || []);

      if (isAdmin) {
        const usersRes = await api.getUsers().catch(() => ({ users: [] }));
        setUsersList(usersRes?.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Müştərilər yüklənərkən xəta baş verdi.');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchTerm, selectedOwnerId]);

  // Handle Save (Create or Edit)
  const handleSaveCustomer = async (data: Partial<Customer>) => {
    if (customerToEdit) {
      const res = await api.updateCustomer(customerToEdit.id, data);
      setCustomers(prev => (prev || []).map(c => (c.id === customerToEdit.id ? res.customer : c)));
    } else {
      const res = await api.createCustomer(data);
      setCustomers(prev => [res.customer, ...(prev || [])]);
    }
    fetchCustomers();
  };

  // Handle Delete (Soft delete to Trash)
  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteCustomer(customerToDelete.id);
      setCustomers(prev => (prev || []).filter(c => c.id !== customerToDelete.id));
      setCustomerToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Silinmə zamanı xəta baş verdi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsFormModalOpen(true);
  };

  const handleDeletePrompt = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  // Unique owners for driver/admin filter pills
  const availableOwners = useMemo(() => {
    const map = new Map<string, string>();
    (customers || []).forEach(c => {
      if (c.ownerId && c.ownerName) {
        map.set(c.ownerId, c.ownerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [customers]);

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-600" />
            <span>{isDriver ? 'Müştəri Qrupları' : 'Müştərilər'}</span>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full ml-1">
              {customers.length}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isDriver
              ? 'Sürücü baxışı: İstifadəçilər üzrə müştəri siyahısı və naviqasiya'
              : 'GPS koordinatları və müştəri əlaqə bazası'}
          </p>
        </div>

        {/* Add Customer button */}
        {!isDriver && hasPermission('create_customer') && (
          <button
            type="button"
            onClick={() => {
              setCustomerToEdit(null);
              setIsFormModalOpen(true);
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-2 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Yeni Müştəri</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar - No Horizontal Overflow */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-3">
        {/* Search input with normalization support */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ad, soyad, telefon (+994...), ünvan və ya qeyd ilə axtarış..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Owner Filter Pills for Admin and Driver - Wrapped */}
        {(isAdmin || isDriver) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Sahib:</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedOwnerId('all')}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                selectedOwnerId === 'all'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Hamısı ({customers.length})
            </button>

            {/* List all registered users if Admin */}
            {isAdmin && usersList.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedOwnerId(u.id)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  selectedOwnerId === u.id
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {u.name}
              </button>
            ))}

            {/* Driver owner list */}
            {isDriver && availableOwners.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedOwnerId(o.id)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                  selectedOwnerId === o.id
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchCustomers}
            className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="p-12 flex flex-col items-center justify-center gap-2">
          <div className="w-7 h-7 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Müştərilər axtarılır...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && customers.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {searchTerm ? 'Nəticə tapılmadı' : 'Hazırda müştəri yoxdur'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `"${searchTerm}" sorğusu üzrə heç bir müştəri qeydi tapılmadı.`
              : 'Sistemdə hələ heç bir müştəri qeydiyyatdan keçməyib.'}
          </p>
          {!isDriver && hasPermission('create_customer') && !searchTerm && (
            <button
              type="button"
              onClick={() => {
                setCustomerToEdit(null);
                setIsFormModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl"
            >
              <PlusCircle className="w-4 h-4" />
              <span>İlk Müştərini Əlavə Et</span>
            </button>
          )}
        </div>
      )}

      {/* Customers Cards Grid */}
      {!isLoading && customers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onEdit={handleEdit}
              onDelete={handleDeletePrompt}
              onGoToOrders={() => onNavigate && onNavigate('orders')}
              onUpdated={(updated) =>
                setCustomers(prev => prev.map(c => (c.id === updated.id ? updated : c)))
              }
            />
          ))}
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      <CustomerFormModal
        isOpen={isFormModalOpen}
        customerToEdit={customerToEdit}
        usersList={usersList}
        onSave={handleSaveCustomer}
        onClose={() => {
          setIsFormModalOpen(false);
          setCustomerToEdit(null);
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!customerToDelete}
        title="Müştərini Sil"
        message={`"${customerToDelete?.fullName}" adlı müştərini silmək istəyirsiniz? Müştəri Zibil qutusuna köçürüləcək və lazım gəldikdə bərpa edilə bilər.`}
        confirmText="Zibil qutusuna at"
        cancelText="İmtina"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setCustomerToDelete(null)}
      />
    </div>
  );
};

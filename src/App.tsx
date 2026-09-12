import React, { useState } from 'react';
import { Compass } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { BackgroundGpsBanner } from './components/BackgroundGpsBanner';
import { Sidebar, NavTab } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CustomerFormModal } from './components/CustomerFormModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { OrdersPage } from './pages/OrdersPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { MapPage } from './pages/MapPage';
import { DriversPage } from './pages/DriversPage';
import { UsersPage } from './pages/UsersPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { LogsPage } from './pages/LogsPage';
import { TrashPage } from './pages/TrashPage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './api';
import { Customer, User } from './types';

export default function App() {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [usersList, setUsersList] = useState<User[]>([]);

  // If initial auth check is in progress
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 animate-pulse">
            <Compass className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Müştəri GPS</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sistem yüklənir...</p>
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, show Login Screen
  if (!user) {
    return <LoginPage />;
  }

  const handleGlobalCreateCustomer = async (data: Partial<Customer>) => {
    await api.createCustomer(data);
    setIsAddCustomerOpen(false);
    setCurrentTab('customers');
  };

  const openAddCustomerFromDashboard = async () => {
    if (user.role === 'ADMIN') {
      try {
        const uRes = await api.getUsers();
        setUsersList(uRes.users);
      } catch {
        // ignore
      }
    }
    setIsAddCustomerOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <Navbar onNavigateHome={() => setCurrentTab('dashboard')} />

      {/* Persistent Background GPS Live Banner for Drivers */}
      <BackgroundGpsBanner />

      {/* Main Layout Area */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onNavigate={setCurrentTab}
              onOpenAddCustomer={openAddCustomerFromDashboard}
            />
          )}
          {currentTab === 'customers' && <CustomersPage onNavigate={setCurrentTab} />}
          {currentTab === 'orders' && <OrdersPage onNavigate={setCurrentTab} />}
          {currentTab === 'deliveries' && <DeliveriesPage />}
          {currentTab === 'map' && <MapPage />}
          {currentTab === 'drivers' && <DriversPage />}
          {currentTab === 'users' && <UsersPage />}
          {currentTab === 'permissions' && <PermissionsPage />}
          {currentTab === 'logs' && <LogsPage />}
          {currentTab === 'trash' && <TrashPage />}
          {currentTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation */}
      <MobileBottomNav currentTab={currentTab} onSelectTab={setCurrentTab} />

      {/* Global Add Customer Modal (for Dashboard quick action) */}
      <CustomerFormModal
        isOpen={isAddCustomerOpen}
        customerToEdit={null}
        usersList={usersList}
        onSave={handleGlobalCreateCustomer}
        onClose={() => setIsAddCustomerOpen(false)}
      />
    </div>
  );
}

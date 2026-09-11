import React, { useState } from 'react';
import {
  Settings,
  User as UserIcon,
  Lock,
  Download,
  Upload,
  Shield,
  CheckCircle2,
  AlertCircle,
  FileJson,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export const SettingsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Backup & Restore states
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canBackup = user?.role === 'ADMIN' || hasPermission('backup_data');
  const canRestore = user?.role === 'ADMIN' || hasPermission('restore_data');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Yeni şifrə ən az 6 simvol olmalıdır.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Yeni şifrələr bir-biri ilə uyğun gəlmir.' });
      return;
    }

    setIsChangingPass(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Şifrəniz uğurla dəyişdirildi!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Şifrə dəyişdirilə bilmədi.' });
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleExportBackup = async () => {
    setIsExporting(true);
    setBackupMsg(null);
    try {
      await api.exportBackup();
      setBackupMsg({ type: 'success', text: 'Backup faylı uğurla kompüterinizə endirildi.' });
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err.message || 'Backup çıxarıla bilmədi.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.customers || !Array.isArray(parsed.customers)) {
          throw new Error('Fayl strukturu yalnışdır. "customers" massivi tapılmadı.');
        }

        setIsImporting(true);
        setBackupMsg(null);

        const res = await api.restoreBackup(parsed);
        setBackupMsg({
          type: 'success',
          text: `Backup uğurla bərpa edildi: ${res.count} müştəri qeydə alındı.`,
        });
      } catch (err: any) {
        setBackupMsg({ type: 'error', text: err.message || 'Fayl oxuna bilmədi və ya yalnış JSON formatıdır.' });
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-sky-600" />
          <span>Hesab və Tənzimləmələr</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Şəxsi hesab parametrləri, təhlükəsizlik və məlumatların ehtiyat nüsxəsi
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <UserIcon className="w-4 h-4 text-sky-600" />
          <span>Profil Məlumatları</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">Ad və Soyad</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{user?.name}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">İstifadəçi ID (Login)</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{user?.loginId}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">Sistem Rolu</span>
            <span className="font-bold text-sky-600 dark:text-sky-400 text-sm flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              {user?.role}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block mb-1">Hesab Statusu</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aktiv
            </span>
          </div>
        </div>
      </div>

      {/* Password Change Form */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-sky-600" />
          <span>Şifrəni Dəyişdir</span>
        </h2>

        {passwordMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4 ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
            }`}
          >
            {passwordMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3.5 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cari Şifrə *
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Yeni Şifrə *
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ən az 6 simvol"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Yeni Şifrənin Təkrarı *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Təkrar daxil edin"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={isChangingPass}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            {isChangingPass && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <span>Şifrəni Yenilə</span>
          </button>
        </form>
      </div>

      {/* Backup & Restore Section */}
      {(canBackup || canRestore) && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
            <FileJson className="w-4 h-4 text-emerald-600" />
            <span>Məlumatların Ehtiyat Nüsxəsi (Backup & Restore)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Bütün müştərilərin və GPS koordinatlarının ehtiyat nüsxəsini JSON formatında ixrac və ya bərpa edin.
          </p>

          {backupMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4 ${
                backupMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
              }`}
            >
              {backupMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{backupMsg.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {canBackup && (
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors disabled:opacity-60"
              >
                {isExporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>JSON Backup Endir</span>
              </button>
            )}

            {canRestore && (
              <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer">
                {isImporting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-slate-500" />
                )}
                <span>Backup Faylı Seç və Bərpa Et</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      )}

      {/* System Information */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-400 space-y-1">
        <p><strong className="text-slate-600 dark:text-slate-300">Tətbiq:</strong> Müştəri GPS v1.0.0</p>
        <p><strong className="text-slate-600 dark:text-slate-300">Dəstək:</strong> PWA & Oflayn dəstəyi, Avtomatik lokal sinxronizasiya</p>
      </div>
    </div>
  );
};

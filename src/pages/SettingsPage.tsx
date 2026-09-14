import React, { useState } from 'react';
import {
  Settings,
  User as UserIcon,
  Lock,
  Download,
  Upload,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  FileJson,
  RefreshCw,
  Radio,
  Eye,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { backgroundGps } from '../services/BackgroundGpsService';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser, hasPermission } = useAuth();

  // Moderator (Admin) security panel state
  const [isModeratorUnlocked, setIsModeratorUnlocked] = useState(false);
  const [moderatorPin, setModeratorPin] = useState('');
  const [showModeratorPin, setShowModeratorPin] = useState(false);
  const [moderatorError, setModeratorError] = useState<string | null>(null);
  const [moderatorSuccessMsg, setModeratorSuccessMsg] = useState<string | null>(null);
  const [isTogglingTracking, setIsTogglingTracking] = useState(false);

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

  const handleUnlockModerator = (e: React.FormEvent) => {
    e.preventDefault();
    setModeratorError(null);
    setModeratorSuccessMsg(null);

    // Secret verification: Password "2017" or ADMIN role
    if (moderatorPin.trim() === '2017' || user?.role === 'ADMIN') {
      setIsModeratorUnlocked(true);
      setModeratorPin('');
      setModeratorError(null);
    } else {
      setModeratorError('Moderator şifrəsi yanlışdır. Giriş rədd edildi.');
    }
  };

  const handleToggleLiveTracking = async () => {
    if (!user) return;
    setIsTogglingTracking(true);
    setModeratorError(null);
    setModeratorSuccessMsg(null);
    const newStatus = !user.liveTrackingEnabled;

    try {
      await api.updateUserLiveTracking(user.id, newStatus, '2017');
      await refreshUser();
      if (newStatus) {
        backgroundGps.startRealGps(user.id, 'user');
        setModeratorSuccessMsg('Canlı GPS izləmə uğurla aktivləşdirildi. İstifadəçinin konumu xəritədə adminə ötürülür.');
      } else {
        backgroundGps.stop();
        setModeratorSuccessMsg('Canlı GPS izləmə uğurla dayandırıldı.');
      }
    } catch (err: any) {
      setModeratorError(err.message || 'Canlı izləmə parametrini dəyişmək mümkün olmadı.');
    } finally {
      setIsTogglingTracking(false);
    }
  };

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

      {/* Moderator (Admin) Control Section - Protected by Secret Password (2017) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isModeratorUnlocked
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
            }`}>
              {isModeratorUnlocked ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Moderator (Admin)</span>
                {isModeratorUnlocked ? (
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold">
                    Açıqdır 🔓
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-bold">
                    Qorunur 🔒
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sistem rəhbərliyi və təhlükəsizlik nəzarəti üçün xüsusi moderator paneli
              </p>
            </div>
          </div>

          {isModeratorUnlocked && (
            <button
              type="button"
              onClick={() => {
                setIsModeratorUnlocked(false);
                setModeratorSuccessMsg(null);
                setModeratorError(null);
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Paneli Kilidlə 🔒
            </button>
          )}
        </div>

        {moderatorError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{moderatorError}</span>
          </div>
        )}

        {moderatorSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{moderatorSuccessMsg}</span>
          </div>
        )}

        {!isModeratorUnlocked ? (
          /* Locked Form */
          <form onSubmit={handleUnlockModerator} className="space-y-3.5 max-w-md">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Bu bölmə yalnız sistem moderatoru və ya administrator tərəfindən idarə olunur. Canlı izləmə icazəsini tənzimləmək üçün təhlükəsizlik şifrəsini daxil edin.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Moderator Giriş Şifrəsi *
              </label>
              <div className="relative">
                <input
                  type={showModeratorPin ? 'text' : 'password'}
                  required
                  value={moderatorPin}
                  onChange={(e) => setModeratorPin(e.target.value)}
                  placeholder="Şifrə daxil edin"
                  className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowModeratorPin(!showModeratorPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showModeratorPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors shadow-xs"
            >
              <KeyRound className="w-4 h-4" />
              <span>Moderator Girişi</span>
            </button>
          </form>
        ) : (
          /* Unlocked Moderator Panel */
          <div className="space-y-4">
            <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl ${
                  user?.liveTrackingEnabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                }`}>
                  <Radio className={`w-5 h-5 ${user?.liveTrackingEnabled ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Canlı GPS İzləmə İcazəsi
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      user?.liveTrackingEnabled
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      {user?.liveTrackingEnabled ? 'Aktivdir' : 'Deaktivdir'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                    {user?.liveTrackingEnabled
                      ? 'İstifadəçinin canlı GPS yeri və hərəkət trayektoriyası xəritədə administratora real vaxt rejimində ötürülür.'
                      : 'Bu istifadəçi üçün canlı məkan ötürülməsi deaktivdir. Xəritədə izlənməsi üçün aktivləşdirin.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isTogglingTracking}
                onClick={handleToggleLiveTracking}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                  user?.liveTrackingEnabled
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                } disabled:opacity-60`}
              >
                {isTogglingTracking && (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>
                  {user?.liveTrackingEnabled ? 'Canlı İzləməni Söndür' : 'Canlı İzləməni Aktivləşdir'}
                </span>
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Shield className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Təhlükəsizlik bildirişi: İstifadəçi tənzimləmələri bitirdikdən sonra «Paneli Kilidlə» düyməsini sıxmağınız tövsiyə olunur. İstifadəçi şifrə olmadan izləməni söndürə bilməz.
              </span>
            </div>
          </div>
        )}
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

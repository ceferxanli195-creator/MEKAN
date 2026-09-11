import React, { useState } from 'react';
import { Compass, Eye, EyeOff, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      setError('Zəhmət olmasa İstifadəçi ID və Şifrəni daxil edin.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login(loginId.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Daxil edilən məlumatlar yanlışdır.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-900/5 dark:shadow-black/50 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-sky-500/25">
            <Compass className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Müştəri GPS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Müştəri İdarəetmə və GPS Naviqasiya Sistemi
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form: ONLY ID and Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              İstifadəçi ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="İstifadəçi ID daxil edin"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Şifrə
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-3 bg-slate-50 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-md shadow-sky-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {isLoading && (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{isLoading ? 'Yoxlanılır...' : 'Sistemə Daxil Ol'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

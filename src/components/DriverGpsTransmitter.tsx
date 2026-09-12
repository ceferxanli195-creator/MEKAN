import React, { useState, useEffect } from 'react';
import {
  Navigation,
  Radio,
  Gauge,
  Compass,
  Battery,
  AlertCircle,
  Play,
  Square,
  CheckCircle2,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { backgroundGps, GpsStatusState } from '../services/BackgroundGpsService';

interface DriverGpsTransmitterProps {
  driverId?: string;
  driverName?: string;
  onLocationSent?: (coords: { latitude: number; longitude: number; speed: number }) => void;
}

export const DriverGpsTransmitter: React.FC<DriverGpsTransmitterProps> = ({
  driverId,
  driverName,
  onLocationSent,
}) => {
  const [gpsState, setGpsState] = useState<GpsStatusState>(backgroundGps.getState());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Subscribe to background singleton GPS service
  useEffect(() => {
    const unsubscribe = backgroundGps.subscribe((state) => {
      setGpsState(state);
      if (onLocationSent && state.coords) {
        onLocationSent({
          latitude: state.coords.latitude,
          longitude: state.coords.longitude,
          speed: state.speed,
        });
      }
    });
    return unsubscribe;
  }, [onLocationSent]);

  // Session timer when broadcasting
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (gpsState.isBroadcasting) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gpsState.isBroadcasting]);

  const handleStartRealGps = () => {
    backgroundGps.startRealGps(driverId);
  };

  const handleStartSimulation = () => {
    backgroundGps.startSimulation(driverId);
  };

  const handleStop = () => {
    backgroundGps.stop();
  };

  const formatElapsed = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs > 0 ? (hrs < 10 ? '0' + hrs : hrs) + ':' : ''}${
      mins < 10 ? '0' + mins : mins
    }:${secs < 10 ? '0' + secs : secs}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header & Main Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              gpsState.isBroadcasting
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Mobil Arxa Plan GPS Yayımı
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  gpsState.isBroadcasting
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    gpsState.isBroadcasting ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                  }`}
                />
                {gpsState.isBroadcasting
                  ? gpsState.isSimulating
                    ? 'Simulyasiya Aktivdir'
                    : 'Canlı Arxa Planda Yayımda'
                  : 'Gözləmədədir'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {driverName ? `${driverName} — ` : ''}Sürücünün real vaxt GPS məkanını, sürətini və hərəkət tarixçəsini fasiləsiz bazaya yazır.
            </p>
          </div>
        </div>

        {/* Start / Stop Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {!gpsState.isBroadcasting ? (
            <>
              <button
                type="button"
                onClick={handleStartRealGps}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>ARXA PLAN GPS YAYIMINI BAŞLAT</span>
              </button>

              <button
                type="button"
                onClick={handleStartSimulation}
                title="Bakı marşrutu üzrə avtomatik test GPS simulyasiyası"
                className="flex items-center justify-center gap-1.5 px-3 py-3 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-700 dark:text-sky-300 rounded-2xl text-xs font-bold border border-sky-200 dark:border-sky-800 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Test Simulyasiya</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-rose-600/25 transition-all active:scale-95 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>YAYIMI DAYANDIR</span>
            </button>
          )}
        </div>
      </div>

      {/* Feature Badges for Mobile */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Fasiləsiz Arxa Plan Worker</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold">
          <Smartphone className="w-3.5 h-3.5 text-sky-500" />
          <span>Screen Wake Lock (Ekran sönmür)</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Oflayn Keş & Avto-Sinronizasiya</span>
        </span>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {/* Speedometer */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">Cari Sürət</span>
            <Gauge className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-3xl font-black tracking-tight ${
                gpsState.speed > 80
                  ? 'text-rose-600'
                  : gpsState.speed > 50
                  ? 'text-amber-600'
                  : gpsState.speed > 0
                  ? 'text-emerald-600'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            >
              {gpsState.isBroadcasting ? gpsState.speed : '0'}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">km/saat</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            {gpsState.speed >= 3 ? '🟢 Hərəkətdədir' : '🟠 Dayanıb (Parklanma)'}
          </div>
        </div>

        {/* GPS Coordinates */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">GPS Koordinatlar</span>
            <Navigation className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
            {gpsState.coords
              ? `${gpsState.coords.latitude.toFixed(4)}, ${gpsState.coords.longitude.toFixed(4)}`
              : 'Peyk siqnalı gözlənir'}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            {gpsState.accuracy !== null ? `Dəqiqlik: ±${gpsState.accuracy}m` : 'Peyk siqnalı axtarılır'}
          </div>
        </div>

        {/* Heading & Battery */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">İstiqamət & Batareya</span>
            <Compass className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-base font-black text-slate-800 dark:text-slate-200">
              {gpsState.heading !== null ? `${gpsState.heading}°` : '—'}
            </span>
            {gpsState.batteryLevel !== null && (
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Battery className="w-3.5 h-3.5 text-emerald-500" />
                {gpsState.batteryLevel}%
              </span>
            )}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            {gpsState.wakeLockActive ? '⚡ Ekran oyaqdır' : 'Ekran rejimi hazır'}
          </div>
        </div>

        {/* Transmission stats */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold">Yayım Müddəti</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-base font-black font-mono text-slate-800 dark:text-slate-200">
            {gpsState.isBroadcasting ? formatElapsed(elapsedSeconds) : '00:00'}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1 truncate">
            {gpsState.sendCount > 0 ? `${gpsState.sendCount} koordinat ötürüldü` : 'Gözləmədədir'}
          </div>
        </div>
      </div>

      {/* Error / Status Bar */}
      {gpsState.error ? (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{gpsState.error}</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-600 dark:text-slate-300 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{gpsState.statusMessage}</span>
          </div>
          {gpsState.lastSentTime && (
            <span className="text-[11px] text-slate-400 font-mono">
              Son ötürülmə: {gpsState.lastSentTime}
            </span>
          )}
        </div>
      )}

      {/* Mobile PWA / APK Instruction helper */}
      <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl text-indigo-950 dark:text-indigo-200 text-xs flex items-start gap-3">
        <Smartphone className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Mobil Brauzer & Arxa Plan GPS Qeydi:</span> "ARXA PLAN GPS YAYIMINI BAŞLAT" düyməsini sıxdıqdan sonra başqa tətbiqlərə keçsəniz və ya səhifəni dəyişsəniz belə arxa plan sistemi GPS koordinatlarını bazaya göndərməyə davam edəcək. Saytı Safari və ya Chrome-dan <strong>"Ana ekrana əlavə et" (Add to Home screen)</strong> etdikdə isə tam tətbiq kimi işləyir.
        </div>
      </div>
    </div>
  );
};

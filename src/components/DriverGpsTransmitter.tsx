import React, { useState, useEffect, useRef } from 'react';
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
  Info,
} from 'lucide-react';
import { api } from '../api';

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
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(() => {
    return localStorage.getItem('gps_broadcasting_active') === 'true';
  });
  const [speedKmH, setSpeedKmH] = useState<number>(0);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [lastSentTime, setLastSentTime] = useState<string | null>(null);
  const [sendCount, setSendCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('GPS yayımı gözləmədədir');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);
  const simStepRef = useRef<number>(0);

  // Read device battery if supported
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }).catch(() => {});
    }
  }, []);

  // Screen Wake Lock API (keep phone screen awake while driving)
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      // Non-critical, ignore
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // Timer for duration
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isBroadcasting) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isBroadcasting]);

  // Send position to server
  const sendLocationToServer = async (
    lat: number,
    lng: number,
    speed: number,
    head?: number | null,
    acc?: number | null
  ) => {
    try {
      await api.updateDriverLocation({
        latitude: lat,
        longitude: lng,
        speed,
        heading: head,
        accuracy: acc,
        batteryLevel: batteryLevel ?? undefined,
        driverId: driverId || undefined,
      });

      setLastSentTime(new Date().toLocaleTimeString('az-AZ'));
      setSendCount(prev => prev + 1);
      setStatusMessage('Canlı koordinatlar serverə ötürüldü');
      setGpsError(null);

      if (onLocationSent) {
        onLocationSent({ latitude: lat, longitude: lng, speed });
      }
    } catch (err: any) {
      setStatusMessage('Serverə ötürülmə xətası: ' + (err.message || 'Şəbəkə xətası'));
    }
  };

  // Start Real GPS watch
  const startRealGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Cihazınızda Geolocation API dəstəklənmir.');
      return;
    }

    setGpsError(null);
    setStatusMessage('Peyk GPS siqnalı axtarılır...');
    requestWakeLock();

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading: posHeading, accuracy: posAcc } = pos.coords;
        setCoords({ latitude, longitude });
        setAccuracy(Math.round(posAcc));
        setHeading(posHeading !== null && !isNaN(posHeading) ? Math.round(posHeading) : null);

        // Speed calculation (pos.coords.speed is in m/s)
        let calculatedSpeed = 0;
        if (speed !== null && !isNaN(speed) && speed > 0) {
          calculatedSpeed = Math.round(speed * 3.6); // m/s to km/h
        } else if (lastPosRef.current) {
          const now = Date.now();
          const timeSec = (now - lastPosRef.current.time) / 1000;
          if (timeSec >= 2) {
            // Distance calculation
            const distMeters = calculateSimpleDist(
              lastPosRef.current.lat,
              lastPosRef.current.lng,
              latitude,
              longitude
            );
            calculatedSpeed = Math.round((distMeters / timeSec) * 3.6);
          }
        }

        lastPosRef.current = { lat: latitude, lng: longitude, time: Date.now() };
        setSpeedKmH(calculatedSpeed);

        sendLocationToServer(latitude, longitude, calculatedSpeed, posHeading, posAcc);
      },
      (err) => {
        let errMsg = 'GPS xətası baş verdi.';
        if (err.code === 1) errMsg = 'GPS icazəsi verilməyib. Brauzer ayarlarında məkan icazəsini aktiv edin.';
        else if (err.code === 2) errMsg = 'Məkan təyin edilə bilmədi (Peyk əlaqəsi yoxdur).';
        else if (err.code === 3) errMsg = 'GPS siqnalı vaxtı bitdi.';
        setGpsError(errMsg);
        setStatusMessage(errMsg);
      },
      options
    );
  };

  // Start Simulation Route (Baku Streets)
  const simulationRoute = [
    { lat: 40.4093, lng: 49.8671, speed: 45, head: 70 },
    { lat: 40.4110, lng: 49.8710, speed: 52, head: 75 },
    { lat: 40.4135, lng: 49.8755, speed: 58, head: 80 },
    { lat: 40.4160, lng: 49.8800, speed: 64, head: 85 },
    { lat: 40.4180, lng: 49.8850, speed: 50, head: 90 },
    { lat: 40.4200, lng: 49.8890, speed: 0, head: 90 }, // stop
    { lat: 40.4200, lng: 49.8890, speed: 0, head: 90 }, // stop
    { lat: 40.4175, lng: 49.8830, speed: 38, head: 250 },
    { lat: 40.4140, lng: 49.8770, speed: 49, head: 245 },
    { lat: 40.4100, lng: 49.8690, speed: 42, head: 240 },
  ];

  const startSimulation = () => {
    setIsSimulating(true);
    setStatusMessage('Simulyasiya rejimi aktivdir (Bakı marşrutu)');
    requestWakeLock();

    intervalRef.current = setInterval(() => {
      const point = simulationRoute[simStepRef.current % simulationRoute.length];
      simStepRef.current += 1;

      setCoords({ latitude: point.lat, longitude: point.lng });
      setSpeedKmH(point.speed);
      setHeading(point.head);
      setAccuracy(5);

      sendLocationToServer(point.lat, point.lng, point.speed, point.head, 5);
    }, 3500);
  };

  // Toggle Live Broadcast
  const handleToggleBroadcast = (mode: 'real' | 'sim') => {
    if (isBroadcasting) {
      // Stop
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      releaseWakeLock();
      setIsBroadcasting(false);
      setIsSimulating(false);
      setStatusMessage('GPS yayımı dayandırıldı');
      localStorage.setItem('gps_broadcasting_active', 'false');
    } else {
      // Start
      setIsBroadcasting(true);
      localStorage.setItem('gps_broadcasting_active', 'true');
      if (mode === 'sim') {
        startSimulation();
      } else {
        startRealGps();
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      releaseWakeLock();
    };
  }, []);

  // Format elapsed time HH:MM:SS
  const formatElapsed = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs > 0 ? (hrs < 10 ? '0' + hrs : hrs) + ':' : ''}${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
            isBroadcasting
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Canlı GPS Məkan Yayımı
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isBroadcasting
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isBroadcasting ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                {isBroadcasting ? (isSimulating ? 'Simulyasiya Aktivdir' : 'Canlı Yayımda') : 'Deaktivdir'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {driverName ? `${driverName} — ` : ''}Telefonun GPS siqnalını xəritəyə və adminə canlı ötürür
            </p>
          </div>
        </div>

        {/* Start / Stop Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isBroadcasting ? (
            <>
              <button
                onClick={() => handleToggleBroadcast('real')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>GPS Yayımını Başlat</span>
              </button>
              <button
                onClick={() => handleToggleBroadcast('sim')}
                title="Test məqsədilə xəritədə avtomatik hərəkət simulyasiyası"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-700 dark:text-sky-300 rounded-xl text-xs font-semibold border border-sky-200 dark:border-sky-800 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Test Rejim</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => handleToggleBroadcast('real')}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-rose-600/20 transition-all active:scale-95"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Yayımını Dayandır</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {/* Speedometer */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Cari Sürət</span>
            <Gauge className="w-4 h-4 text-sky-600" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-black tracking-tight ${
              speedKmH > 80
                ? 'text-rose-600'
                : speedKmH > 50
                ? 'text-amber-600'
                : speedKmH > 0
                ? 'text-emerald-600'
                : 'text-slate-800 dark:text-slate-200'
            }`}>
              {isBroadcasting ? speedKmH : '0'}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">km/saat</span>
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            {speedKmH >= 3 ? '🟢 Hərəkətdədir' : '🟠 Dayanıb (Parklanma)'}
          </div>
        </div>

        {/* GPS Coordinates */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">GPS Koordinatlar</span>
            <Navigation className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
            {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'Məkan gözlənir'}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            {accuracy ? `Dəqiqlik: ±${accuracy}m` : 'Peyk siqnalı gözlənir'}
          </div>
        </div>

        {/* Heading & Battery */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">İstiqamət & Batareya</span>
            <Compass className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {heading !== null ? `${heading}°` : '---'}
            </span>
            {batteryLevel !== null && (
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Battery className="w-3.5 h-3.5 text-emerald-500" />
                {batteryLevel}%
              </span>
            )}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
            Ekran oyaq saxlanılır
          </div>
        </div>

        {/* Transmission stats */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-medium">Yayım Müddəti</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
            {isBroadcasting ? formatElapsed(elapsedSeconds) : '00:00'}
          </div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
            {sendCount > 0 ? `${sendCount} paket ötürüldü` : 'Gözləmədədir'}
          </div>
        </div>
      </div>

      {/* Error / Status Bar */}
      {gpsError ? (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{gpsError}</span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          {lastSentTime && (
            <span className="text-[11px] text-slate-400">Son yenilənmə: {lastSentTime}</span>
          )}
        </div>
      )}

      {/* Mobile PWA / APK Instruction helper */}
      <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl text-indigo-900 dark:text-indigo-200 text-xs flex items-start gap-2.5">
        <Smartphone className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Mobil Tətbiq (APK / IPA / PWA) Məsləhəti:</span> Sürücü telefonunda Safari və ya Chrome ilə sayta daxil olub <strong>"Ana ekrana əlavə et" (Add to Home screen)</strong> seçdikdə tətbiq tam ekran APK/IPA kimi işləyir və GPS arxa planda fasiləsiz canlı izləmə aparır.
        </div>
      </div>
    </div>
  );
};

function calculateSimpleDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

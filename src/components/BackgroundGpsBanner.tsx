import React, { useEffect, useState } from 'react';
import {
  Radio,
  Gauge,
  Compass,
  Battery,
  Square,
  AlertTriangle,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { backgroundGps, GpsStatusState } from '../services/BackgroundGpsService';
import { useAuth } from '../context/AuthContext';

export const BackgroundGpsBanner: React.FC = () => {
  const { user } = useAuth();
  const [gpsState, setGpsState] = useState<GpsStatusState>(backgroundGps.getState());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = backgroundGps.subscribe((state) => {
      setGpsState(state);
    });
    return unsubscribe;
  }, []);

  // Only render if broadcasting is active or user is DRIVER
  if (!gpsState.isBroadcasting) {
    return null;
  }

  return (
    <aside aria-label="Canlı GPS Yayımı" className="sticky top-0 z-40 w-full bg-slate-900 text-white shadow-xl border-b border-emerald-500/40">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Pulsing Live Indicator & Speed */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex items-center justify-center shrink-0">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider uppercase text-emerald-400 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>ARXA PLAN GPS AKTİVDİR</span>
              </span>
              {gpsState.isSimulating && (
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold">
                  Simulyasiya
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 mt-0.5">
              <span className="font-mono font-bold text-white flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                {gpsState.speed} km/s
              </span>
              <span className="hidden sm:inline text-slate-400">•</span>
              <span className="hidden sm:inline font-mono text-[11px] text-slate-300">
                Göndərildi: {gpsState.sendCount} dəfə {gpsState.lastSentTime ? `(${gpsState.lastSentTime})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Badges & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {gpsState.wakeLockActive && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-full text-[11px] font-semibold">
              <Smartphone className="w-3 h-3" />
              <span>Ekran Oyaqdır</span>
            </span>
          )}

          {gpsState.batteryLevel !== null && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full text-[11px] font-semibold">
              <Battery className="w-3 h-3 text-emerald-400" />
              <span>{gpsState.batteryLevel}%</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
            title={isExpanded ? 'Yığcam görünüş' : 'Ətraflı'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => backgroundGps.stop()}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-rose-900/30"
          >
            <Square className="w-3 h-3 fill-current" />
            <span className="hidden xs:inline">Dayandır</span>
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <div className="border-t border-slate-800 bg-slate-950/90 px-4 py-3 text-xs text-slate-300 animate-in slide-in-from-top-2">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Koordinat</span>
              <span className="font-mono text-white text-xs font-semibold">
                {gpsState.coords
                  ? `${gpsState.coords.latitude.toFixed(5)}, ${gpsState.coords.longitude.toFixed(5)}`
                  : 'Gözlənilir...'}
              </span>
            </div>

            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Bucaq / İstiqamət</span>
              <span className="font-mono text-white text-xs font-semibold flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                {gpsState.heading !== null ? `${gpsState.heading}°` : '—'}
              </span>
            </div>

            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Dəqiqlik</span>
              <span className="font-mono text-white text-xs font-semibold">
                {gpsState.accuracy !== null ? `±${gpsState.accuracy} metr` : '—'}
              </span>
            </div>

            <div className="p-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
              <span className="text-emerald-400 text-xs font-medium truncate block">
                {gpsState.statusMessage}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

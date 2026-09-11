import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, X, Check, Navigation } from 'lucide-react';

interface GpsPickModalProps {
  isOpen: boolean;
  initialLat?: number;
  initialLng?: number;
  onSelect: (coords: { latitude: number; longitude: number; accuracy: number }) => void;
  onClose: () => void;
}

export const GpsPickModal: React.FC<GpsPickModalProps> = ({
  isOpen,
  initialLat,
  initialLng,
  onSelect,
  onClose,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const defaultLat = initialLat && initialLat !== 0 ? initialLat : 40.4093; // Baku default
  const defaultLng = initialLng && initialLng !== 0 ? initialLng : 49.8671;

  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });

  const [confirmMode, setConfirmMode] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setPickedCoords({
      lat: defaultLat,
      lng: defaultLng,
    });
    setConfirmMode(false);

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous map if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 14);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom pulse pin icon
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color: #0284c7; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([defaultLat, defaultLng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setPickedCoords({ lat: Number(pos.lat.toFixed(6)), lng: Number(pos.lng.toFixed(6)) });
        setConfirmMode(true);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setPickedCoords({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) });
        setConfirmMode(true);
      });

      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, defaultLat, defaultLng]);

  if (!isOpen) return null;

  const handleApply = () => {
    onSelect({
      latitude: pickedCoords.lat,
      longitude: pickedCoords.lng,
      accuracy: 5, // manual map pick default accuracy
    });
    onClose();
  };

  return (
    <div
      id="gps-pick-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Xəritədən Konum Seçin
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Xəritədə klikləyin və ya marker-i sürükləyin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Canvas */}
        <div className="relative flex-1 min-h-[340px] sm:min-h-[420px] bg-slate-100 dark:bg-slate-950">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

          {/* Coordinate badge overlay */}
          <div className="absolute top-3 left-3 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Lat: {pickedCoords.lat.toFixed(6)}, Lng: {pickedCoords.lng.toFixed(6)}</span>
          </div>
        </div>

        {/* Confirmation Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 text-center sm:text-left">
              Bu nöqtəni müştərinin konumu kimi qeyd etmək istəyirsiniz?
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Bu konumu seç
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Filter, Navigation, Phone, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Customer, User } from '../types';

export const MapPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isDriver = user?.role === 'DRIVER';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getCustomers({
        ownerId: selectedOwnerId === 'all' ? undefined : selectedOwnerId,
      });
      setCustomers(res?.customers || []);

      if (isAdmin) {
        const uRes = await api.getUsers().catch(() => ({ users: [] }));
        setUsersList(uRes?.users || []);
      }
    } catch (err: any) {
      setError(err.message || 'Xəritə məlumatları yüklənə bilmədi.');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedOwnerId]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Default to Baku
    const map = L.map(mapContainerRef.current).setView([40.4093, 49.8671], 12);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    // Handle container size
    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when customers change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    const validCustomers = customers.filter(c => c.latitude !== 0 && c.longitude !== 0);

    if (validCustomers.length === 0) return;

    const bounds = L.latLngBounds([]);

    validCustomers.forEach(customer => {
      const latLng: [number, number] = [customer.latitude, customer.longitude];
      bounds.extend(latLng);

      const customIcon = L.divIcon({
        className: 'customer-map-pin',
        html: `<div style="background-color: #0284c7; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 13px;">
          ${customer.firstName.charAt(0).toUpperCase()}
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const cleanPhone = customer.phone.replace(/\s+/g, '');
      const wazeUrl = `https://waze.com/ul?ll=${customer.latitude},${customer.longitude}&navigate=yes`;
      const whatsappMsg = encodeURIComponent(
        `*Müştəri:* ${customer.fullName}\n*Telefon:* ${customer.phone}\n*Ünvan:* ${customer.address}\n*Waze:* ${wazeUrl}`
      );

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 200px; padding: 2px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 700; color: #0f172a;">${customer.fullName}</h4>
          <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">${customer.address}</p>
          <div style="margin-bottom: 8px; font-size: 11px; color: #0284c7; font-weight: 600;">
            Sahib: ${customer.ownerName || 'Bilinməyən'}
          </div>
          <div style="display: flex; gap: 6px; margin-top: 8px;">
            <a href="tel:${cleanPhone}" style="flex: 1; padding: 6px 8px; background: #10b981; color: white; text-align: center; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 600;">
              Zəng
            </a>
            <a href="https://api.whatsapp.com/send?text=${whatsappMsg}" target="_blank" style="flex: 1; padding: 6px 8px; background: #0d9488; color: white; text-align: center; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 600;">
              WhatsApp
            </a>
            <a href="${wazeUrl}" target="_blank" style="flex: 1; padding: 6px 8px; background: #0284c7; color: white; text-align: center; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 600;">
              Waze
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(latLng, { icon: customIcon }).bindPopup(popupHtml);
      layer.addLayer(marker);
    });

    if (validCustomers.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [customers]);

  const gpsCount = customers.filter(c => c.latitude !== 0 || c.longitude !== 0).length;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Map Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-600" />
            <span>Müştərilərin Xəritəsi</span>
            <span className="text-xs font-semibold text-sky-700 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-300 px-2.5 py-1 rounded-full">
              {gpsCount} nöqtə
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAdmin && 'Bütün müştərilərin koordinatları və naviqasiya nöqtələri'}
            {isDriver && 'Sürücü xəritəsi: Bütün müştərilər və birbaşa Waze naviqasiyası'}
            {!isAdmin && !isDriver && 'Yalnız şəxsi müştərilərinizin GPS koordinatları'}
          </p>
        </div>

        {/* Owner Filter for Admin & Driver */}
        {(isAdmin || isDriver) && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Bütün İstifadəçilər (Hamısı)</option>
              {isAdmin && usersList.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.loginId})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Map Canvas - Fluid, no horizontal overflow */}
      <div className="relative w-full h-[65vh] min-h-[420px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-xs bg-slate-100 dark:bg-slate-950">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

        {/* Floating summary badge */}
        <div className="absolute top-3 left-3 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3.5 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-sky-600" />
          <span>Xəritədə: {gpsCount} müştəri</span>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  X,
  Navigation,
  MapPin,
  Truck,
  Clock,
  RefreshCw,
  ExternalLink,
  Compass,
  Route,
  Gauge,
  CheckCircle2,
  Flag,
} from 'lucide-react';
import { Order, TrajectoryPoint } from '../types';
import { api } from '../api';

interface LiveOrderTrackingModalProps {
  isOpen: boolean;
  order: Order | null;
  onClose: () => void;
}

function getCardinalDirection(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined || isNaN(degrees)) return 'Sabit / Məlum deyil';
  const val = Math.floor((degrees / 22.5) + 0.5);
  const arr = [
    'Şimal (N)',
    'Şimal-Şərq (NE)',
    'Şimal-Şərq (NE)',
    'Şərq (ENE)',
    'Şərq (E)',
    'Cənub-Şərq (ESE)',
    'Cənub-Şərq (SE)',
    'Cənub (SSE)',
    'Cənub (S)',
    'Cənub-Qərb (SSW)',
    'Cənub-Qərb (SW)',
    'Qərb (WSW)',
    'Qərb (W)',
    'Şimal-Qərb (WNW)',
    'Şimal-Qərb (NW)',
    'Şimal (NNW)',
  ];
  return arr[val % 16];
}

function calculateTrajectoryDistanceKm(points: { latitude: number; longitude: number }[]): number {
  if (!points || points.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    totalMeters += L.latLng(points[i - 1].latitude, points[i - 1].longitude).distanceTo(
      L.latLng(points[i].latitude, points[i].longitude)
    );
  }
  return Number((totalMeters / 1000).toFixed(2));
}

export const LiveOrderTrackingModal: React.FC<LiveOrderTrackingModalProps> = ({
  isOpen,
  order: initialOrder,
  onClose,
}) => {
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date>(new Date());

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const deliveredMarkerRef = useRef<L.Marker | null>(null);
  const trajectoryLineRef = useRef<L.Polyline | null>(null);
  const targetGuideLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  // Poll for live GPS update every 3.5 seconds if in transit
  useEffect(() => {
    if (!isOpen || !order || order.status === 'delivered') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.getOrderById(order.id);
        setOrder(res.order);
        setLastPollTime(new Date());
      } catch {
        // silent background poll
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isOpen, order?.id, order?.status]);

  // Initialize and update Leaflet map
  useEffect(() => {
    if (!isOpen || !order || !mapContainerRef.current) return;

    // Initialize Map if needed
    if (!mapInstanceRef.current) {
      const initialLat =
        order.currentLocation?.latitude ||
        order.customerLatitude ||
        40.4093;
      const initialLng =
        order.currentLocation?.longitude ||
        order.customerLongitude ||
        49.8671;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds: L.LatLngExpression[] = [];

    // 1. Customer Marker (Red Destination Pin)
    if (order.customerLatitude && order.customerLongitude) {
      bounds.push([order.customerLatitude, order.customerLongitude]);
      if (!customerMarkerRef.current) {
        const customerIcon = L.divIcon({
          className: 'customer-destination-icon',
          html: `
            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-rose-600 text-white shadow-2xl border-2 border-white animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

        customerMarkerRef.current = L.marker([order.customerLatitude, order.customerLongitude], {
          icon: customerIcon,
        })
          .addTo(map)
          .bindPopup(
            `<div class="p-1 text-xs"><b>📍 Müştəri Ünvanı</b><br/><b>${order.customerName}</b><br/>${order.customerAddress}</div>`
          );
      } else {
        customerMarkerRef.current.setLatLng([order.customerLatitude, order.customerLongitude]);
      }
    }

    // 2. Trajectory breadcrumb path
    const trajectoryPoints: TrajectoryPoint[] = order.trajectory || [];
    const trajectoryCoords: [number, number][] = trajectoryPoints.map((pt) => [pt.latitude, pt.longitude]);

    // If order has a current location but not in trajectory list, add it
    if (order.currentLocation && order.currentLocation.latitude && order.currentLocation.longitude) {
      const lastCoord = trajectoryCoords[trajectoryCoords.length - 1];
      if (
        !lastCoord ||
        Math.abs(lastCoord[0] - order.currentLocation.latitude) > 0.00002 ||
        Math.abs(lastCoord[1] - order.currentLocation.longitude) > 0.00002
      ) {
        trajectoryCoords.push([order.currentLocation.latitude, order.currentLocation.longitude]);
      }
    }

    if (trajectoryCoords.length > 0) {
      trajectoryCoords.forEach((coord) => bounds.push(coord));

      if (!trajectoryLineRef.current) {
        // Draw crisp trajectory line
        trajectoryLineRef.current = L.polyline(trajectoryCoords, {
          color: '#0284c7', // vibrant sky-600
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(map);
      } else {
        trajectoryLineRef.current.setLatLngs(trajectoryCoords);
      }

      // 3. Trajectory Start Marker (Green Circle Pin)
      const startCoord = trajectoryCoords[0];
      if (startCoord) {
        if (!startMarkerRef.current) {
          const startIcon = L.divIcon({
            className: 'start-marker-icon',
            html: `
              <div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white shadow-lg border-2 border-white font-bold text-[10px]">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          startMarkerRef.current = L.marker(startCoord, { icon: startIcon })
            .addTo(map)
            .bindPopup(`<div class="p-1 text-xs"><b>🟢 Başlanğıc Nöqtəsi</b><br/>Marşrut buradan başlayıb</div>`);
        } else {
          startMarkerRef.current.setLatLng(startCoord);
        }
      }
    }

    // 4. Driver Live Location & Heading Direction Arrow
    const driverLoc = order.currentLocation;
    if (driverLoc && driverLoc.latitude && driverLoc.longitude) {
      bounds.push([driverLoc.latitude, driverLoc.longitude]);

      const heading = driverLoc.heading !== undefined && driverLoc.heading !== null ? driverLoc.heading : 0;
      const isDelivered = order.status === 'delivered';

      const driverIconHtml = isDelivered
        ? `
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 text-white shadow-2xl border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        `
        : `
          <div class="relative flex items-center justify-center w-12 h-12">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60"></span>
            <div class="relative flex items-center justify-center w-11 h-11 rounded-full bg-sky-600 text-white shadow-2xl border-2 border-white">
              <!-- Directional Navigation Arrow rotating with driver heading -->
              <div style="transform: rotate(${heading}deg); transform-origin: center center; display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>
              </div>
            </div>
            <!-- Small speed bubble if moving -->
            ${
              driverLoc.speed && driverLoc.speed > 1
                ? `<span class="absolute -bottom-1 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-700 shadow">${Math.round(
                    driverLoc.speed * 3.6
                  )} km/h</span>`
                : ''
            }
          </div>
        `;

      const driverIcon = L.divIcon({
        className: 'driver-live-heading-icon',
        html: driverIconHtml,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      if (!driverMarkerRef.current) {
        driverMarkerRef.current = L.marker([driverLoc.latitude, driverLoc.longitude], {
          icon: driverIcon,
        })
          .addTo(map)
          .bindPopup(
            `<div class="p-1 text-xs"><b>🚚 Sürücü: ${order.executorName || 'Yoldadır'}</b><br/>Status: ${
              isDelivered ? 'Təhvil verildi' : 'Canlı Hərəkətdə'
            }<br/>İstiqamət: ${heading}° (${getCardinalDirection(heading)})</div>`
          );
      } else {
        driverMarkerRef.current.setLatLng([driverLoc.latitude, driverLoc.longitude]);
        driverMarkerRef.current.setIcon(driverIcon);
      }

      // 5. Guide line connecting driver and customer (dashed line)
      if (order.customerLatitude && order.customerLongitude && !isDelivered) {
        const guidePoints: [number, number][] = [
          [driverLoc.latitude, driverLoc.longitude],
          [order.customerLatitude, order.customerLongitude],
        ];

        if (!targetGuideLineRef.current) {
          targetGuideLineRef.current = L.polyline(guidePoints, {
            color: '#94a3b8',
            weight: 2,
            opacity: 0.7,
            dashArray: '6, 6',
          }).addTo(map);
        } else {
          targetGuideLineRef.current.setLatLngs(guidePoints);
        }
      }
    }

    // 6. Delivered marker if delivered at specific point
    if (order.status === 'delivered' && order.deliveredLocation?.latitude && order.deliveredLocation?.longitude) {
      const delLoc = order.deliveredLocation;
      bounds.push([delLoc.latitude, delLoc.longitude]);

      if (!deliveredMarkerRef.current) {
        const delIcon = L.divIcon({
          className: 'delivered-marker-icon',
          html: `
            <div class="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-600 text-white shadow-xl border-2 border-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        deliveredMarkerRef.current = L.marker([delLoc.latitude, delLoc.longitude], { icon: delIcon })
          .addTo(map)
          .bindPopup(`<div class="p-1 text-xs"><b>🏁 Təhvil Verildi</b><br/>Təhvil nöqtəsi</div>`);
      } else {
        deliveredMarkerRef.current.setLatLng([delLoc.latitude, delLoc.longitude]);
      }
    }

    // Fit map bounds to show full trajectory and endpoints
    if (bounds.length > 0) {
      try {
        map.fitBounds(bounds as any, { padding: [45, 45], maxZoom: 16 });
      } catch {
        // bounds error safety
      }
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [isOpen, order?.currentLocation?.latitude, order?.currentLocation?.longitude, order?.trajectory?.length]);

  // Clean up Leaflet on modal unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        driverMarkerRef.current = null;
        customerMarkerRef.current = null;
        startMarkerRef.current = null;
        deliveredMarkerRef.current = null;
        trajectoryLineRef.current = null;
        targetGuideLineRef.current = null;
      }
    };
  }, []);

  if (!isOpen || !order) return null;

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.getOrderById(order.id);
      setOrder(res.order);
      setLastPollTime(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  const hasLiveGps = !!(order.currentLocation && order.currentLocation.latitude && order.currentLocation.longitude);
  const trajectoryPoints: TrajectoryPoint[] = order.trajectory || [];
  const trajectoryDistanceKm = calculateTrajectoryDistanceKm(trajectoryPoints);

  const straightDistanceKm =
    hasLiveGps && order.customerLatitude && order.customerLongitude
      ? (
          L.latLng(order.currentLocation!.latitude, order.currentLocation!.longitude).distanceTo(
            L.latLng(order.customerLatitude, order.customerLongitude)
          ) / 1000
        ).toFixed(2)
      : null;

  const currentHeading = order.currentLocation?.heading;
  const cardinalStr = getCardinalDirection(currentHeading);
  const isDelivered = order.status === 'delivered';

  return (
    <div
      id="live-order-tracking-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
    >
      <div
        id="live-order-tracking-modal-card"
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[88vh] max-h-[840px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${
                isDelivered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400'
              }`}
            >
              {isDelivered ? <CheckCircle2 className="w-6 h-6" /> : <Truck className="w-6 h-6 animate-pulse" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {isDelivered ? 'Marşrut və Traektoriya Tarixçəsi' : 'Canlı Sürücü İzləmə və Traektoriya'}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/30 text-sky-300 font-mono font-bold">
                  #{order.orderNumber}
                </span>
                {isDelivered && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold">
                    Tamamlandı
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Müştəri: <span className="text-slate-200 font-medium">{order.customerName}</span> • İcraçı:{' '}
                <span className="text-slate-200 font-medium">{order.executorName || 'Təyin edilməyib'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDelivered && (
              <button
                id="btn-tracking-refresh"
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Canlı konumu yenilə"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
              </button>
            )}
            <button
              id="btn-tracking-close"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Metrics Toolbar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isDelivered ? 'bg-emerald-500' : 'bg-sky-500 animate-ping'
                }`}
              ></span>
              <span
                className={`font-bold text-[11px] uppercase tracking-wider ${
                  isDelivered ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'
                }`}
              >
                {isDelivered ? 'Təhvil verildi (Tarixçə)' : 'Yoldadır (Canlı Hərəkət)'}
              </span>
            </div>

            {/* Direction / Heading */}
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <Compass className="w-3.5 h-3.5 text-sky-500" />
              <span>İstiqamət:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {currentHeading !== null && currentHeading !== undefined ? `${currentHeading}°` : ''} {cardinalStr}
              </span>
            </div>

            {/* Trajectory Distance */}
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-xs">
              <Route className="w-3.5 h-3.5 text-emerald-500" />
              <span>Cızılan traektoriya:</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {trajectoryDistanceKm > 0 ? `${trajectoryDistanceKm} km` : `${trajectoryPoints.length} nöqtə`}
              </span>
            </div>

            {/* Speed if active */}
            {!isDelivered && order.currentLocation?.speed !== null && order.currentLocation?.speed !== undefined && (
              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-xs">
                <Gauge className="w-3.5 h-3.5 text-amber-500" />
                <span>Sürət:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  {Math.round((order.currentLocation.speed || 0) * 3.6)} km/s
                </span>
              </div>
            )}

            {/* Remaining distance to customer */}
            {!isDelivered && straightDistanceKm && (
              <div className="text-slate-600 dark:text-slate-300">
                Müştəriyə qədər: <span className="font-bold font-mono text-rose-500">{straightDistanceKm} km</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>{isDelivered ? 'Tarixçə saxlanıldı' : `Son sinxron: ${lastPollTime.toLocaleTimeString('az-AZ')}`}</span>
          </div>
        </div>

        {/* Map Canvas */}
        <div className="flex-1 relative w-full h-full bg-slate-100 dark:bg-slate-950">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Overlay Map Legend */}
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-800 text-[11px] space-y-1.5 pointer-events-none">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1 mb-1">
              <Route className="w-3.5 h-3.5 text-sky-500" />
              <span>Xəritə İzahatı:</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
              <span>Yaşıl nöqtə: Marşrut başlanğıcı</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-4 h-1 bg-sky-500 inline-block rounded-full"></span>
              <span>Göy xətt: Sürücünün hərəkət traektoriyası</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-full bg-sky-600 inline-block"></span>
              <span>Ox işarəsi: Sürücünün hərəkət istiqaməti ({cardinalStr})</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="w-3 h-3 rounded-full bg-rose-600 inline-block"></span>
              <span>Qırmızı nişan: Müştərinin çatdırılma ünvanı</span>
            </div>
            {isDelivered && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block"></span>
                <span>Bayraq / İşarə: Təhvil verildiyi son məkan</span>
              </div>
            )}
          </div>

          {!hasLiveGps && trajectoryPoints.length === 0 && (
            <div className="absolute top-4 left-4 right-4 z-20 p-3.5 bg-amber-500/95 text-white rounded-2xl shadow-lg backdrop-blur-sm text-xs flex items-center justify-between">
              <span>Sürücünün hələlik GPS koordinatı qəbul edilməyib. Sürücü hərəkət etdikcə canlı xəritədə cızılacaq.</span>
            </div>
          )}
        </div>

        {/* Footer info & Navigation */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="space-y-0.5">
            <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-bold">{order.customerAddress}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Müştəri Tel: <span className="font-mono text-slate-700 dark:text-slate-300">{order.customerPhone}</span>
              {order.customerNotes && ` • Qeyd: ${order.customerNotes}`}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {order.customerLatitude && order.customerLongitude ? (
              <a
                href={`https://waze.com/ul?ll=${order.customerLatitude},${order.customerLongitude}&navigate=yes`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 font-bold text-xs flex items-center gap-1.5 hover:bg-sky-100 transition-colors border border-sky-200 dark:border-sky-800"
              >
                <Navigation className="w-3.5 h-3.5 text-sky-500" />
                <span>Waze ilə Aç</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}
            <button
              id="btn-tracking-footer-close"
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
            >
              Bağla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

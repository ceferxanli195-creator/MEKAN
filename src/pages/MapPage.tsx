import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Filter,
  Navigation,
  Phone,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Truck,
  Gauge,
  Clock,
  Battery,
  Square,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Package,
  CheckCircle2,
  X,
  Compass,
  Calendar,
  User as UserIcon,
  Radio,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Customer, User, Driver, DriverStop, TrajectoryPoint, DriverActiveOrderInfo } from '../types';

export const MapPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isDriver = user?.role === 'DRIVER';
  const isUser = user?.role === 'USER';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live Drivers
  const [liveDrivers, setLiveDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | 'all'>('all');
  const [inspectedDriver, setInspectedDriver] = useState<Driver | null>(null);
  const [driverTrajectory, setDriverTrajectory] = useState<TrajectoryPoint[]>([]);
  const [driverStops, setDriverStops] = useState<DriverStop[]>([]);
  const [isLoadingTrajectory, setIsLoadingTrajectory] = useState(false);

  // Layer Visibility Toggles
  const [showCustomers, setShowCustomers] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showUsers, setShowUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | 'all'>('all');
  const [showTrajectory, setShowTrajectory] = useState(true);

  // Leaflet references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const customerLayerRef = useRef<L.LayerGroup | null>(null);
  const driverLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const trajectoryLayerRef = useRef<L.LayerGroup | null>(null);
  const stopsLayerRef = useRef<L.LayerGroup | null>(null);

  // Simulation state for Admin test
  const [isSimulatingTest, setIsSimulatingTest] = useState(false);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Customers & Users
  const fetchCustomersAndUsers = async () => {
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

  // 2. Fetch Live Drivers (Real-time polling)
  const fetchLiveDrivers = async () => {
    try {
      const res = await api.getLiveDrivers();
      const drivers = res?.drivers || [];
      setLiveDrivers(drivers);

      // Keep inspectedDriver state up-to-date
      if (inspectedDriver) {
        const updated = drivers.find(d => d.id === inspectedDriver.id);
        if (updated) {
          setInspectedDriver(updated);
        }
      }
    } catch (err) {
      // Quiet fail during background polling
    }
  };

  // 3. Fetch Driver Trajectory & Stops
  const loadDriverTrajectory = async (driverId: string) => {
    setIsLoadingTrajectory(true);
    try {
      const res = await api.getDriverTrajectory(driverId);
      setDriverTrajectory(res.trajectory || []);
      setDriverStops(res.stops || []);
      const targetDriver = liveDrivers.find(d => d.id === driverId) || res.driver;
      if (targetDriver) {
        setInspectedDriver(targetDriver);
      }
    } catch (err) {
      console.warn('Traektoriya yüklənmədi:', err);
    } finally {
      setIsLoadingTrajectory(false);
    }
  };

  useEffect(() => {
    fetchCustomersAndUsers();
  }, [selectedOwnerId]);

  // Periodic polling for Live Drivers & Users every 4 seconds
  useEffect(() => {
    fetchLiveDrivers();
    if (isAdmin) {
      api.getUsers().then(res => setUsersList(res?.users || [])).catch(() => {});
    }
    const interval = setInterval(() => {
      fetchLiveDrivers();
      if (isAdmin) {
        api.getUsers().then(res => setUsersList(res?.users || [])).catch(() => {});
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [inspectedDriver?.id, isAdmin]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Default view: Baku center
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView([40.4093, 49.8671], 12);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Layer groups
    customerLayerRef.current = L.layerGroup().addTo(map);
    trajectoryLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    driverLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

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

  // Update Customer Pins
  useEffect(() => {
    if (!customerLayerRef.current || !mapInstanceRef.current) return;
    const layer = customerLayerRef.current;
    layer.clearLayers();

    if (!showCustomers) return;

    const validCustomers = customers.filter(c => c.latitude !== 0 && c.longitude !== 0);

    validCustomers.forEach(customer => {
      const latLng: [number, number] = [customer.latitude, customer.longitude];

      const customIcon = L.divIcon({
        className: 'customer-map-pin',
        html: `<div style="background-color: #0284c7; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">
          ${customer.firstName.charAt(0).toUpperCase()}
        </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
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
  }, [customers, showCustomers]);

  // Update Live Driver Markers
  useEffect(() => {
    if (!driverLayerRef.current || !mapInstanceRef.current) return;
    const layer = driverLayerRef.current;
    layer.clearLayers();

    if (!showDrivers) return;

    const filteredDrivers = liveDrivers.filter(d => {
      if (selectedDriverId !== 'all' && d.id !== selectedDriverId) return false;
      return d.currentLocation && d.currentLocation.latitude && d.currentLocation.longitude;
    });

    filteredDrivers.forEach(driver => {
      const loc = driver.currentLocation!;
      const latLng: [number, number] = [loc.latitude, loc.longitude];
      const isMoving = loc.speed >= 3;
      const headingDeg = loc.heading || 0;

      // Custom animated vehicle icon with speed badge & direction
      const driverIcon = L.divIcon({
        className: 'driver-live-marker',
        html: `
          <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
            ${isMoving ? `
              <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(16, 185, 129, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            ` : `
              <div style="position: absolute; inset: -3px; border-radius: 50%; background: rgba(245, 158, 11, 0.25);"></div>
            `}
            <div style="width: 38px; height: 38px; border-radius: 50%; background: ${isMoving ? '#059669' : '#d97706'}; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; transform: rotate(${headingDeg}deg); transition: transform 0.4s ease;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
                <path d="M15 18H9"/>
                <path d="M19 18h2a1 1 0 0 0 1-1v-5l-3-4h-5v10Z"/>
                <circle cx="7" cy="18" r="2"/>
                <circle cx="17" cy="18" r="2"/>
              </svg>
            </div>
            <div style="position: absolute; top: -14px; background: rgba(15, 23, 42, 0.9); color: white; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">
              ${driver.name} • ${loc.speed} km/s
            </div>
          </div>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
        popupAnchor: [0, -26],
      });

      // Carried Orders summary HTML
      const carryingOrdersCount = driver.activeOrders?.length || 0;
      const ordersListHtml = (driver.activeOrders || [])
        .map(
          ao => `
            <div style="background: #f8fafc; padding: 6px 8px; border-radius: 8px; margin-bottom: 4px; border: 1px solid #e2e8f0; font-size: 11px;">
              <div style="font-weight: 700; color: #0284c7;">Sifariş #${ao.orderNumber}: ${ao.customerName}</div>
              <div style="color: #64748b;">Ünvan: ${ao.customerAddress}</div>
              <div style="color: #0f172a; font-weight: 600;">Göndərən User: ${ao.creatorName || ao.ownerName}</div>
              ${ao.destinationDistanceKm !== undefined ? `<div style="color: #059669; font-weight: 600;">Məsafə: ~${ao.destinationDistanceKm} km</div>` : ''}
            </div>
          `
        )
        .join('');

      const cleanPhone = driver.phone.replace(/\s+/g, '');
      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 230px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">${driver.name}</h4>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 12px; background: ${isMoving ? '#dcfce7' : '#fef3c7'}; color: ${isMoving ? '#166534' : '#92400e'};">
              ${isMoving ? '🟢 Hərəkətdədir' : '🟠 Dayanıb'}
            </span>
          </div>

          <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px;">
            <span style="font-size: 22px; font-weight: 900; color: #0284c7;">${loc.speed}</span>
            <span style="font-size: 12px; font-weight: 700; color: #64748b;">km/saat</span>
          </div>

          <div style="font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.5;">
            <div><strong>Telefon:</strong> ${driver.phone || 'Qeyd olunmayıb'}</div>
            <div><strong>Daşınan sifarişlər:</strong> ${carryingOrdersCount} ədəd</div>
            ${loc.batteryLevel ? `<div><strong>Batareya:</strong> ${loc.batteryLevel}%</div>` : ''}
          </div>

          ${carryingOrdersCount > 0 ? `
            <div style="margin-bottom: 8px;">
              <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 4px;">Daşınan Mallar:</div>
              ${ordersListHtml}
            </div>
          ` : '<div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">Hazırda aktiv daşınan sifariş yoxdur</div>'}

          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
            <button id="btn-inspect-driver-${driver.id}" style="width: 100%; padding: 7px 10px; background: #0284c7; color: white; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
              Traektoriya və Dayanacaqları Göstər
            </button>
            <a href="tel:${cleanPhone}" style="width: 100%; box-sizing: border-box; padding: 6px 10px; background: #10b981; color: white; text-align: center; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 700;">
              Sürücüyə Zəng Et
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(latLng, { icon: driverIcon }).bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-inspect-driver-${driver.id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedDriverId(driver.id);
            loadDriverTrajectory(driver.id);
          };
        }
      });

      marker.on('click', () => {
        setInspectedDriver(driver);
      });

      layer.addLayer(marker);
    });
  }, [liveDrivers, selectedDriverId, showDrivers]);

  // Derivation: Live Tracked Users (Admin Tracking)
  const liveTrackedUsers = usersList.filter(
    u => u.liveTrackingEnabled && u.currentLocation && u.currentLocation.latitude && u.currentLocation.longitude
  );

  // Update User Pins (Admin Live Tracking)
  useEffect(() => {
    if (!userLayerRef.current || !mapInstanceRef.current) return;
    const layer = userLayerRef.current;
    layer.clearLayers();

    if (!showUsers || !isAdmin) return;

    const filteredUsers = liveTrackedUsers.filter(
      u => selectedUserId === 'all' || u.id === selectedUserId
    );

    filteredUsers.forEach(userItem => {
      const loc = userItem.currentLocation!;
      const latLng: [number, number] = [loc.latitude, loc.longitude];

      const userIcon = L.divIcon({
        className: 'user-live-marker',
        html: `
          <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: -4px; border-radius: 50%; background: rgba(147, 51, 234, 0.35); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #7c3aed; border: 3px solid white; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px;">
              ${userItem.name.charAt(0).toUpperCase()}
            </div>
            <div style="position: absolute; top: -14px; background: rgba(76, 29, 149, 0.95); color: white; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);">
              👤 ${userItem.name} • ${loc.speed || 0} km/s
            </div>
          </div>
        `,
        iconSize: [46, 46],
        iconAnchor: [23, 23],
        popupAnchor: [0, -25],
      });

      const lastSeenTime = loc.updatedAt
        ? new Date(loc.updatedAt).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'İndi';

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 220px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #581c87;">${userItem.name}</h4>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 12px; background: #f3e8ff; color: #6b21a8;">
              🟢 Canlı İzlənir
            </span>
          </div>

          <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px;">
            <span style="font-size: 20px; font-weight: 900; color: #7c3aed;">${loc.speed || 0}</span>
            <span style="font-size: 12px; font-weight: 700; color: #64748b;">km/saat</span>
          </div>

          <div style="font-size: 11px; color: #475569; margin-bottom: 8px; line-height: 1.5;">
            <div><strong>İstifadəçi ID:</strong> ${userItem.loginId}</div>
            <div><strong>Rol:</strong> ${userItem.role}</div>
            <div><strong>Son Yenilənmə:</strong> ${lastSeenTime}</div>
            <div><strong>Koordinat:</strong> ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}</div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px;">
            <button id="btn-focus-user-${userItem.id}" style="width: 100%; padding: 7px 10px; background: #7c3aed; color: white; border: none; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
              Mərkəzləşdir və Yaxınlaşdır
            </button>
          </div>
        </div>
      `;

      const marker = L.marker(latLng, { icon: userIcon }).bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-focus-user-${userItem.id}`);
        if (btn) {
          btn.onclick = () => {
            mapInstanceRef.current?.setView(latLng, 16);
          };
        }
      });

      layer.addLayer(marker);
    });
  }, [liveTrackedUsers, selectedUserId, showUsers, isAdmin]);

  // Update Trajectory Polyline & Stops Markers
  useEffect(() => {
    if (!trajectoryLayerRef.current || !stopsLayerRef.current || !mapInstanceRef.current) return;
    const trajLayer = trajectoryLayerRef.current;
    const stopsLayer = stopsLayerRef.current;

    trajLayer.clearLayers();
    stopsLayer.clearLayers();

    if (!showTrajectory || driverTrajectory.length === 0) return;

    // Build polyline points
    const latLngs: [number, number][] = driverTrajectory.map(p => [p.latitude, p.longitude]);

    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round',
    });
    trajLayer.addLayer(polyline);

    // Render Stop Pins
    driverStops.forEach((stop, index) => {
      const stopLatLng: [number, number] = [stop.latitude, stop.longitude];

      const stopIcon = L.divIcon({
        className: 'driver-stop-pin',
        html: `
          <div style="background-color: #ef4444; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 11px;">
            🛑
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -16],
      });

      const stopPopupHtml = `
        <div style="font-family: sans-serif; min-width: 190px; padding: 2px;">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #b91c1c;">Dayanacaq #${index + 1}</h4>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
            Dayanma müddəti: ${stop.durationMinutes} dəqiqə
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
            <strong>Giriş:</strong> ${stop.startTimeStr}
          </div>
          ${stop.endTimeStr ? `
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
              <strong>Çıxış:</strong> ${stop.endTimeStr}
            </div>
          ` : '<div style="font-size: 11px; color: #dc2626; font-weight: 700;">Hazırda bu nöqtədə dayanıb</div>'}
          ${stop.address ? `<div style="font-size: 11px; color: #475569; margin-top: 4px;">Ünvan: ${stop.address}</div>` : ''}
        </div>
      `;

      const stopMarker = L.marker(stopLatLng, { icon: stopIcon }).bindPopup(stopPopupHtml);
      stopsLayer.addLayer(stopMarker);
    });

    // Auto-fit map to trajectory bounds
    if (latLngs.length > 1 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(latLngs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [driverTrajectory, driverStops, showTrajectory]);

  // Center on driver
  const handleCenterOnDriver = (driver: Driver) => {
    if (!mapInstanceRef.current || !driver.currentLocation) return;
    mapInstanceRef.current.setView(
      [driver.currentLocation.latitude, driver.currentLocation.longitude],
      15,
      { animate: true }
    );
    setInspectedDriver(driver);
    loadDriverTrajectory(driver.id);
  };

  // Admin Quick Simulation
  const handleToggleAdminSimulation = () => {
    if (isSimulatingTest) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      setIsSimulatingTest(false);
    } else {
      const targetDriver = liveDrivers[0];
      if (!targetDriver) {
        alert('Simulyasiya üçün heç bir sürücü tapılmadı.');
        return;
      }
      setIsSimulatingTest(true);
      let step = 0;
      const simCoords = [
        { lat: 40.4093, lng: 49.8671, sp: 45, h: 70 },
        { lat: 40.4120, lng: 49.8720, sp: 55, h: 75 },
        { lat: 40.4150, lng: 49.8780, sp: 62, h: 80 },
        { lat: 40.4180, lng: 49.8830, sp: 40, h: 85 },
        { lat: 40.4200, lng: 49.8870, sp: 0, h: 90 }, // stop
      ];

      simIntervalRef.current = setInterval(async () => {
        const pt = simCoords[step % simCoords.length];
        step++;
        await api.updateDriverLocation({
          latitude: pt.lat,
          longitude: pt.lng,
          speed: pt.sp,
          heading: pt.h,
          driverId: targetDriver.id,
        }).catch(() => {});
        fetchLiveDrivers();
      }, 3000);
    }
  };

  // Clean up simulation
  useEffect(() => {
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  const gpsCount = customers.filter(c => c.latitude !== 0 || c.longitude !== 0).length;
  const activeMovingDriversCount = liveDrivers.filter(
    d => d.currentLocation && d.currentLocation.speed >= 3
  ).length;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      {/* Top Header & Role Notice */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              <span>Canlı Sürücü və Müştəri Xəritəsi</span>
            </h1>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {liveDrivers.length} sürücü aktivdir ({activeMovingDriversCount} hərəkətdə)
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin && 'Admin Rejimi: Bütün donanma sürücülərinin canlı koordinatları, sürəti, marşrutu və dayanacaqları'}
            {isUser && 'İstifadəçi Rejimi: Sizin sifarişinizi daşıyan sürücünün real-vaxt canlı izlənməsi'}
            {isDriver && 'Sürücü Rejimi: Şəxsi GPS məkanınız və təhvil veriləcək müştəri nöqtələri'}
          </p>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Driver Selector for Admin */}
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <Truck className="w-4 h-4 text-slate-400" />
              <select
                value={selectedDriverId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDriverId(val);
                  if (val !== 'all') {
                    const drv = liveDrivers.find(d => d.id === val);
                    if (drv) handleCenterOnDriver(drv);
                  }
                }}
                className="bg-transparent font-medium text-slate-900 dark:text-white focus:outline-hidden"
              >
                <option value="all">Bütün Sürücülər ({liveDrivers.length})</option>
                {liveDrivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.currentLocation ? `${d.currentLocation.speed} km/s` : 'Qeyri-aktiv'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tracked Users Selector for Admin */}
          {isAdmin && liveTrackedUsers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 p-1.5 rounded-xl border border-purple-200 dark:border-purple-800 text-xs">
              <Radio className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
              <select
                value={selectedUserId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedUserId(val);
                  if (val !== 'all') {
                    const target = liveTrackedUsers.find(u => u.id === val);
                    if (target?.currentLocation) {
                      mapInstanceRef.current?.setView(
                        [target.currentLocation.latitude, target.currentLocation.longitude],
                        16
                      );
                    }
                  }
                }}
                className="bg-transparent font-medium text-purple-900 dark:text-purple-200 focus:outline-hidden"
              >
                <option value="all">İzlənən Userlər ({liveTrackedUsers.length})</option>
                {liveTrackedUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    👤 {u.name} ({u.currentLocation?.speed || 0} km/s)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Owner Filter for Admin & Driver */}
          {(isAdmin || isDriver) && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                className="bg-transparent font-medium text-slate-900 dark:text-white focus:outline-hidden"
              >
                <option value="all">Bütün İstifadəçilər</option>
                {isAdmin && usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.loginId})</option>
                ))}
              </select>
            </div>
          )}

          {/* Admin Simulation Button for instant testing */}
          {isAdmin && (
            <button
              onClick={handleToggleAdminSimulation}
              title="Test: Sürücünün xəritədə canlı hərəkətini simulyasiya edir"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isSimulatingTest
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSimulatingTest ? 'Testi Dayandır' : 'Test Hərəkət'}</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchCustomersAndUsers();
              fetchLiveDrivers();
            }}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            title="Yenilə"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* User Assigned Order Banner (Strict Requirement: "sürücü hansı userin malını aparırsa mən userdə görə bilsin") */}
      {isUser && (
        <div className="p-4 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-2xl text-white shadow-md">
          {liveDrivers.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Truck className="w-6 h-6 text-white animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    Sizin malınızı daşıyan sürücü: {liveDrivers[0].name} ({liveDrivers[0].phone})
                  </h3>
                  <p className="text-xs text-sky-100 mt-0.5">
                    Cari Sürət: <strong className="text-white">{liveDrivers[0].currentLocation?.speed || 0} km/saat</strong> • 
                    Status: {liveDrivers[0].currentLocation?.isMoving ? '🟢 Hərəkətdədir' : '🟠 Dayanacaqda'} •
                    {liveDrivers[0].activeOrders && liveDrivers[0].activeOrders.length > 0
                      ? ` Sifariş #${liveDrivers[0].activeOrders[0].orderNumber} (${liveDrivers[0].activeOrders[0].customerName})`
                      : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleCenterOnDriver(liveDrivers[0])}
                className="px-4 py-2 bg-white text-sky-800 hover:bg-sky-50 font-bold text-xs rounded-xl shadow-sm transition-all shrink-0"
              >
                Sürücüyə Bax →
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-sky-200 shrink-0" />
              <div className="text-xs text-sky-100">
                Hazırda sizin adınıza yolda olan aktiv sürücü yoxdur. Sifarişiniz sürücü tərəfindən götürülüb "Daşınmada" statusuna keçdikdə sürücünün canlı konumu, sürəti və marşrutu burada avtomatik görünəcək.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Layer Visibility Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowDrivers(!showDrivers)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showDrivers
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Sürücülər ({liveDrivers.length})</span>
        </button>

        <button
          onClick={() => setShowCustomers(!showCustomers)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showCustomers
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>Müştərilər ({gpsCount})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setShowUsers(!showUsers)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showUsers
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>İzlənən Userlər ({liveTrackedUsers.length})</span>
          </button>
        )}

        <button
          onClick={() => setShowTrajectory(!showTrajectory)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            showTrajectory
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Marşrut & Dayanacaqlar {driverStops.length > 0 ? `(${driverStops.length})` : ''}</span>
        </button>

        {inspectedDriver && (
          <button
            onClick={() => {
              setInspectedDriver(null);
              setDriverTrajectory([]);
              setDriverStops([]);
            }}
            className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>Seçimi təmizlə</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Map Layout (with optional Driver Details Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Map Canvas */}
        <div className={`${inspectedDriver ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'} relative w-full h-[68vh] min-h-[460px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-xs bg-slate-100 dark:bg-slate-950 transition-all`}>
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-10" />

          {/* Floating Badges */}
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs px-3.5 py-1.5 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Canlı İzləmə Aktivdir</span>
            </div>

            {inspectedDriver && inspectedDriver.currentLocation && (
              <div className="bg-slate-900/95 text-white backdrop-blur-xs px-3.5 py-2 rounded-xl shadow-lg border border-slate-700 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <Truck className="w-4 h-4" />
                  <span>{inspectedDriver.name}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  Sürət: <strong>{inspectedDriver.currentLocation.speed} km/s</strong> • 
                  {inspectedDriver.currentLocation.isMoving ? ' 🟢 Hərəkətdə' : ' 🟠 Dayanıb'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Selected Driver Inspection Drawer (when a driver is clicked/focused) */}
        {inspectedDriver && (
          <div className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 max-h-[68vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {inspectedDriver.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ID: {inspectedDriver.loginId} • {inspectedDriver.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectedDriver(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Speed & Movement status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Sürət</span>
                  <Gauge className="w-3.5 h-3.5 text-sky-500" />
                </div>
                <div className="text-xl font-black text-sky-600 mt-0.5">
                  {inspectedDriver.currentLocation?.speed || 0} <span className="text-xs font-semibold text-slate-500">km/s</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Status</span>
                  <Navigation className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="text-xs font-bold mt-1.5 text-slate-800 dark:text-slate-200">
                  {inspectedDriver.currentLocation?.isMoving ? '🟢 Hərəkətdədir' : '🟠 Dayanıb'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleCenterOnDriver(inspectedDriver)}
                className="flex-1 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all text-center"
              >
                Xəritədə Fokusla
              </button>
              {inspectedDriver.phone && (
                <a
                  href={`tel:${inspectedDriver.phone.replace(/\s+/g, '')}`}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Zəng</span>
                </a>
              )}
            </div>

            {/* Active Carried Orders */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Daşınan Sifarişlər</span>
                <span className="text-[11px] font-semibold text-sky-600 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded-full">
                  {inspectedDriver.activeOrders?.length || 0} ədəd
                </span>
              </div>

              {inspectedDriver.activeOrders && inspectedDriver.activeOrders.length > 0 ? (
                <div className="space-y-2">
                  {inspectedDriver.activeOrders.map(order => (
                    <div
                      key={order.orderId}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                        <span>#{order.orderNumber} - {order.customerName}</span>
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-sm">
                          {order.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        Ünvan: {order.customerAddress}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                        User: {order.creatorName || order.ownerName}
                      </div>
                      {order.destinationDistanceKm !== undefined && (
                        <div className="text-[11px] text-sky-600 font-semibold">
                          Çatdırılmaya qalan məsafə: ~{order.destinationDistanceKm} km
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-center">
                  Aktiv daşınan sifariş yoxdur
                </div>
              )}
            </div>

            {/* Recorded Stops & Duration */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Dayanacaqlar Tarixçəsi</span>
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                  {driverStops.length} dayanacaq
                </span>
              </div>

              {isLoadingTrajectory ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-sky-600" />
                  Dayanacaqlar yüklənir...
                </div>
              ) : driverStops.length > 0 ? (
                <div className="space-y-2">
                  {driverStops.map((stop, idx) => (
                    <div
                      key={stop.id}
                      className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                        <span>🛑 Dayanacaq #{idx + 1}</span>
                        <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300">
                          {stop.durationMinutes} dəqiqə
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {stop.address || `${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Vaxt: {stop.startTimeStr} {stop.endTimeStr ? ` - ${stop.endTimeStr}` : ' (Hazırda dayanıb)'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-2.5 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-center">
                  Hələ heç bir dayanacaq qeydə alınmayıb
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

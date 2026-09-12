import { api } from '../api';

export interface GpsLocationData {
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number | null;
  accuracy: number | null;
  batteryLevel?: number | null;
  timestamp: string;
}

export interface GpsStatusState {
  isBroadcasting: boolean;
  isSimulating: boolean;
  lastSentTime: string | null;
  sendCount: number;
  statusMessage: string;
  error: string | null;
  coords: { latitude: number; longitude: number } | null;
  speed: number;
  heading: number | null;
  accuracy: number | null;
  batteryLevel: number | null;
  wakeLockActive: boolean;
  audioKeepAliveActive: boolean;
}

type GpsSubscriber = (state: GpsStatusState) => void;

class BackgroundGpsManager {
  private isBroadcasting = false;
  private isSimulating = false;
  private lastSentTime: string | null = null;
  private sendCount = 0;
  private statusMessage = 'GPS yayımı hazır vəziyyətdədir';
  private error: string | null = null;

  private currentCoords: { latitude: number; longitude: number } | null = null;
  private currentSpeed = 0;
  private currentHeading: number | null = null;
  private currentAccuracy: number | null = null;
  private currentBattery: number | null = null;

  private watchId: number | null = null;
  private lastPosTime = 0;
  private lastPosCoords: { lat: number; lng: number } | null = null;
  private subscribers: Set<GpsSubscriber> = new Set();

  private wakeLock: any = null;
  private worker: Worker | null = null;
  private audioCtx: (AudioContext | any) = null;
  private simStep = 0;
  private offlineQueue: Array<{
    lat: number;
    lng: number;
    speed: number;
    heading: number | null;
    accuracy: number | null;
    batteryLevel?: number | null;
  }> = [];

  constructor() {
    // Battery listener
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.currentBattery = Math.round(battery.level * 100);
        battery.addEventListener('levelchange', () => {
          this.currentBattery = Math.round(battery.level * 100);
          this.notifySubscribers();
        });
      }).catch(() => {});
    }

    // Visibility change listener (re-acquire screen wake lock on wake)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.isBroadcasting && document.visibilityState === 'visible') {
          this.requestWakeLock();
          // If we had coordinates, send immediately
          if (this.currentCoords) {
            this.sendLocation(
              this.currentCoords.latitude,
              this.currentCoords.longitude,
              this.currentSpeed,
              this.currentHeading,
              this.currentAccuracy
            );
          }
        }
      });
    }

    // Online listener to flush offline backlog
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushOfflineQueue();
      });
    }
  }

  // --- Screen Wake Lock API ---
  private async requestWakeLock() {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
          this.notifySubscribers();
        });
        this.notifySubscribers();
      }
    } catch {
      // Non-fatal if browser denies or doesn't support wake lock
    }
  }

  private releaseWakeLock() {
    try {
      if (this.wakeLock) {
        this.wakeLock.release().catch(() => {});
        this.wakeLock = null;
        this.notifySubscribers();
      }
    } catch {}
  }

  // --- Background Web Worker Timer (immune to tab throttling) ---
  private startBackgroundWorker() {
    try {
      if (typeof window !== 'undefined' && window.Worker) {
        const workerCode = `
          let timer = null;
          self.onmessage = function(e) {
            if (e.data === 'start') {
              if (!timer) {
                timer = setInterval(function() {
                  self.postMessage('tick');
                }, 3500);
              }
            } else if (e.data === 'stop') {
              if (timer) {
                clearInterval(timer);
                timer = null;
              }
            }
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
        this.worker.onmessage = (e) => {
          if (e.data === 'tick' && this.isBroadcasting) {
            this.handleWorkerTick();
          }
        };
        this.worker.postMessage('start');
      }
    } catch (e) {
      console.warn('Background worker fallback to interval:', e);
    }
  }

  private stopBackgroundWorker() {
    if (this.worker) {
      this.worker.postMessage('stop');
      this.worker.terminate();
      this.worker = null;
    }
  }

  // --- Silent Audio Keep-Alive (prevents iOS/Android from sleeping the JS engine) ---
  private startAudioKeepAlive() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx) {
          this.audioCtx = new AudioContextClass();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        // Create an inaudible buffer oscillator
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        gain.gain.value = 0.0001; // virtually silent
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        this.notifySubscribers();
      }
    } catch (err) {
      // Audio context might require explicit user interaction, handled gracefully
    }
  }

  private stopAudioKeepAlive() {
    try {
      if (this.audioCtx) {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
        this.notifySubscribers();
      }
    } catch {}
  }

  // --- Worker Tick Handler ---
  private handleWorkerTick() {
    if (this.isSimulating) {
      this.stepSimulation();
    } else if (this.currentCoords) {
      // Ensure backend receives alive ping even if driver is stopped at red light
      this.sendLocation(
        this.currentCoords.latitude,
        this.currentCoords.longitude,
        this.currentSpeed,
        this.currentHeading,
        this.currentAccuracy
      );
    }
  }

  // --- Send Location to Backend Database ---
  public async sendLocation(
    lat: number,
    lng: number,
    speed: number,
    head?: number | null,
    acc?: number | null,
    driverId?: string
  ) {
    const payload = {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      speed: Math.max(0, Math.round(speed)),
      heading: head !== undefined && head !== null ? Math.round(head) : undefined,
      accuracy: acc !== undefined && acc !== null ? Math.round(acc) : undefined,
      batteryLevel: this.currentBattery ?? undefined,
      driverId: driverId || undefined,
    };

    try {
      await api.updateDriverLocation(payload);
      this.lastSentTime = new Date().toLocaleTimeString('az-AZ');
      this.sendCount += 1;
      this.error = null;
      this.statusMessage = 'Koordinatlar real vaxtda bazaya ötürüldü';
      this.notifySubscribers();

      // Flush any queued positions
      this.flushOfflineQueue();
    } catch (err: any) {
      this.statusMessage = 'Müvəqqəti əlaqə xətası (Yerli keşə saxlanıldı)';
      // Queue offline
      this.offlineQueue.push({
        lat: payload.latitude,
        lng: payload.longitude,
        speed: payload.speed,
        heading: payload.heading ?? null,
        accuracy: payload.accuracy ?? null,
        batteryLevel: payload.batteryLevel ?? null,
      });
      if (this.offlineQueue.length > 100) {
        this.offlineQueue.shift();
      }
      this.notifySubscribers();
    }
  }

  private async flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    const batch = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of batch) {
      try {
        await api.updateDriverLocation({
          latitude: item.lat,
          longitude: item.lng,
          speed: item.speed,
          heading: item.heading ?? undefined,
          accuracy: item.accuracy ?? undefined,
          batteryLevel: item.batteryLevel ?? undefined,
        });
      } catch {
        // Stop flushing if still offline
        this.offlineQueue.unshift(item);
        break;
      }
    }
  }

  // --- Start Real GPS Watch ---
  public startRealGps(driverId?: string) {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.error = 'Cihazınızda Geolocation API dəstəklənmir.';
      this.statusMessage = this.error;
      this.notifySubscribers();
      return;
    }

    this.isBroadcasting = true;
    this.isSimulating = false;
    this.error = null;
    this.statusMessage = 'Peyk GPS siqnalı aktivləşdirilir...';
    localStorage.setItem('mustari_gps_broadcasting_active', 'true');

    this.requestWakeLock();
    this.startBackgroundWorker();
    this.startAudioKeepAlive();

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 12000,
    };

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        this.currentCoords = { latitude, longitude };
        this.currentAccuracy = accuracy ? Math.round(accuracy) : null;
        this.currentHeading = heading !== null && !isNaN(heading) ? Math.round(heading) : null;

        // Speed calculation
        let calculatedSpeed = 0;
        if (speed !== null && !isNaN(speed) && speed > 0) {
          calculatedSpeed = Math.round(speed * 3.6); // m/s to km/h
        } else if (this.lastPosCoords && this.lastPosTime > 0) {
          const now = Date.now();
          const timeSec = (now - this.lastPosTime) / 1000;
          if (timeSec >= 2) {
            const dist = this.calculateDistance(
              this.lastPosCoords.lat,
              this.lastPosCoords.lng,
              latitude,
              longitude
            );
            calculatedSpeed = Math.round((dist / timeSec) * 3.6);
          }
        }

        this.lastPosCoords = { lat: latitude, lng: longitude };
        this.lastPosTime = Date.now();
        this.currentSpeed = calculatedSpeed;

        this.sendLocation(
          latitude,
          longitude,
          calculatedSpeed,
          this.currentHeading,
          this.currentAccuracy,
          driverId
        );
      },
      (err) => {
        let msg = 'GPS xətası baş verdi.';
        if (err.code === 1) msg = 'GPS icazəsi verilməyib. Zəhmət olmasa brauzerdə məkan icazəsini aktiv edin.';
        else if (err.code === 2) msg = 'Məkan təyin edilə bilmədi (Peyk siqnalı axtarılır).';
        else if (err.code === 3) msg = 'GPS siqnalı vaxtı bitdi. Yenidən cəhd edilir...';
        this.error = msg;
        this.statusMessage = msg;
        this.notifySubscribers();
      },
      options
    );

    this.notifySubscribers();
  }

  // --- Baku City Simulation Route ---
  private simulationPoints = [
    { lat: 40.4093, lng: 49.8671, speed: 45, head: 70 },
    { lat: 40.4110, lng: 49.8710, speed: 52, head: 75 },
    { lat: 40.4135, lng: 49.8755, speed: 58, head: 80 },
    { lat: 40.4160, lng: 49.8800, speed: 64, head: 85 },
    { lat: 40.4180, lng: 49.8850, speed: 50, head: 90 },
    { lat: 40.4200, lng: 49.8890, speed: 0, head: 90 }, // Dayanacaq
    { lat: 40.4200, lng: 49.8890, speed: 0, head: 90 }, // Dayanacaq
    { lat: 40.4175, lng: 49.8830, speed: 38, head: 250 },
    { lat: 40.4140, lng: 49.8770, speed: 49, head: 245 },
    { lat: 40.4100, lng: 49.8690, speed: 42, head: 240 },
  ];

  public startSimulation(driverId?: string) {
    this.isBroadcasting = true;
    this.isSimulating = true;
    this.error = null;
    this.statusMessage = 'Simulyasiya rejimi aktivdir (Bakı marşrutu)';
    localStorage.setItem('mustari_gps_broadcasting_active', 'true');

    this.requestWakeLock();
    this.startBackgroundWorker();
    this.startAudioKeepAlive();

    this.stepSimulation(driverId);
    this.notifySubscribers();
  }

  private stepSimulation(driverId?: string) {
    const point = this.simulationPoints[this.simStep % this.simulationPoints.length];
    this.simStep += 1;

    this.currentCoords = { latitude: point.lat, longitude: point.lng };
    this.currentSpeed = point.speed;
    this.currentHeading = point.head;
    this.currentAccuracy = 4;

    this.sendLocation(point.lat, point.lng, point.speed, point.head, 4, driverId);
  }

  // --- Stop Broadcast ---
  public stop() {
    this.isBroadcasting = false;
    this.isSimulating = false;
    this.statusMessage = 'GPS yayımı dayandırıldı';
    localStorage.setItem('mustari_gps_broadcasting_active', 'false');

    if (this.watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    this.stopBackgroundWorker();
    this.releaseWakeLock();
    this.stopAudioKeepAlive();
    this.notifySubscribers();
  }

  // --- Distance helper in meters ---
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- State & Subscriptions ---
  public getState(): GpsStatusState {
    return {
      isBroadcasting: this.isBroadcasting,
      isSimulating: this.isSimulating,
      lastSentTime: this.lastSentTime,
      sendCount: this.sendCount,
      statusMessage: this.statusMessage,
      error: this.error,
      coords: this.currentCoords,
      speed: this.currentSpeed,
      heading: this.currentHeading,
      accuracy: this.currentAccuracy,
      batteryLevel: this.currentBattery,
      wakeLockActive: !!this.wakeLock,
      audioKeepAliveActive: !!this.audioCtx,
    };
  }

  public subscribe(fn: GpsSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.getState());
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notifySubscribers() {
    const state = this.getState();
    for (const fn of this.subscribers) {
      try {
        fn(state);
      } catch (err) {
        console.error('GPS subscriber error:', err);
      }
    }
  }
}

export const backgroundGps = new BackgroundGpsManager();

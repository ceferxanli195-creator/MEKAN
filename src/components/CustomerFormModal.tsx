import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Navigation, Upload, Camera, AlertTriangle, Check, User as UserIcon, Truck } from 'lucide-react';
import { Customer, User, Driver } from '../types';
import { useAuth } from '../context/AuthContext';
import { GpsPickModal } from './GpsPickModal';
import { api } from '../api';

interface CustomerFormModalProps {
  isOpen: boolean;
  customerToEdit?: Customer | null;
  usersList?: User[];
  onSave: (data: Partial<Customer>) => Promise<void>;
  onClose: () => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  customerToEdit,
  usersList = [],
  onSave,
  onClose,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [ownerId, setOwnerId] = useState<string>('');
  const [assignedDriverId, setAssignedDriverId] = useState<string>('');
  const [driversList, setDriversList] = useState<Driver[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);
  const [gpsAccuracyWarning, setGpsAccuracyWarning] = useState<string | null>(null);
  const [pendingGps, setPendingGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load available drivers
    api.getDrivers().then(res => setDriversList(res.drivers)).catch(() => {});

    setError(null);
    setGpsAccuracyWarning(null);
    setPendingGps(null);

    if (customerToEdit) {
      setFirstName(customerToEdit.firstName || '');
      setLastName(customerToEdit.lastName || '');
      setPhone(customerToEdit.phone || '');
      setAddress(customerToEdit.address || '');
      setNotes(customerToEdit.notes || '');
      setLatitude(customerToEdit.latitude || 0);
      setLongitude(customerToEdit.longitude || 0);
      setAccuracy(customerToEdit.accuracy || 0);
      setPhotoUrl(customerToEdit.photoUrl || '');
      setOwnerId(customerToEdit.ownerId || user?.id || '');
      setAssignedDriverId(customerToEdit.assignedDriverId || '');
    } else {
      setFirstName('');
      setLastName('');
      setPhone('');
      setAddress('');
      setNotes('');
      setLatitude(0);
      setLongitude(0);
      setAccuracy(0);
      setPhotoUrl('');
      setOwnerId(user?.id || '');
      setAssignedDriverId('');
    }
  }, [isOpen, customerToEdit, user]);

  if (!isOpen) return null;

  // Handle current GPS location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Cihazınızda GPS/Geolocation dəstəklənmir.');
      return;
    }

    setIsLocating(true);
    setError(null);
    setGpsAccuracyWarning(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const acc = Math.round(position.coords.accuracy);

        if (acc > 30) {
          setGpsAccuracyWarning(
            `GPS dəqiqliyi aşağıdır (${acc} m). Daha dəqiq konum üçün açıq ərazidə yenidən cəhd edin.`
          );
        } else {
          setGpsAccuracyWarning(null);
        }

        // Prompt confirmation
        setPendingGps({ lat, lng, accuracy: acc });
      },
      (geoError) => {
        setIsLocating(false);
        let msg = 'Cari konum müəyyən edilə bilmədi.';
        if (geoError.code === geoError.PERMISSION_DENIED) {
          msg = 'Konum icazəsini aktivləşdirin (Permission denied).';
        } else if (geoError.code === geoError.TIMEOUT) {
          msg = 'GPS sorğusu vaxtaşımına uğradı. Zəhmət olmasa yenidən cəhd edin.';
        }
        setError(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const confirmPendingGps = () => {
    if (pendingGps) {
      setLatitude(pendingGps.lat);
      setLongitude(pendingGps.lng);
      setAccuracy(pendingGps.accuracy);
      setPendingGps(null);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError('Foto ölçüsü 8 MB-dan çox olmamalıdır.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('Ad sahəsi boş buraxıla bilməz.');
      return;
    }
    if (!phone.trim()) {
      setError('Telefon nömrəsi tələb olunur.');
      return;
    }
    if (!address.trim()) {
      setError('Ünvan tələb olunur.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Partial<Customer> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        latitude,
        longitude,
        accuracy,
        photoUrl,
        assignedDriverId: assignedDriverId ? assignedDriverId : null,
      };

      if (isAdmin && ownerId) {
        payload.ownerId = ownerId;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Müştəri saxlanılarkən xəta baş verdi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasGps = latitude !== 0 || longitude !== 0;

  return (
    <>
      <div
        id="customer-form-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      >
        <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {customerToEdit ? 'Müştərini Redaktə Et' : 'Yeni Müştəri Əlavə Et'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Ad <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Məsələn: Rəşad"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Soyad
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Məsələn: Məmmədov"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Phone & Owner */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Telefon <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050 123 45 67"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Owner selection for Admin */}
              {isAdmin ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Sahib İstifadəçi (Admin)</span>
                  </label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  >
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.loginId}) {u.status === 'inactive' ? '[Deaktiv]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sahib
                  </label>
                  <div className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300">
                    {user?.name || 'Siz'}
                  </div>
                </div>
              )}
            </div>

            {/* Driver Assignment */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Təyin Edilmiş Sürücü</span>
              </label>
              <select
                value={assignedDriverId}
                onChange={(e) => setAssignedDriverId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              >
                <option value="">-- Sürücü təyin edilməyib --</option>
                {driversList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone}) {d.status === 'inactive' ? '[Deaktiv]' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Ünvan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Məsələn: Nərimanov r., Təbriz küç. 45"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Qeyd (İxtiyari)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Məsələn: 3-cü blok, 4-cü mərtəbə, qapı kodu 45"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 resize-none"
              />
            </div>

            {/* Photo Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Müştəri Fotosu (Qapı / Obyekt / Görünüş)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              <div className="flex items-center gap-3">
                {photoUrl ? (
                  <div className="relative group">
                    <img
                      src={photoUrl}
                      alt="Preview"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    <span>Şəkil Yüklə</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>Kamera ilə Çək</span>
                  </button>
                </div>
              </div>
            </div>

            {/* GPS Section */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  GPS Konumu
                </span>
                {hasGps && (
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                    {latitude.toFixed(5)}, {longitude.toFixed(5)} {accuracy > 0 && `(±${accuracy}m)`}
                  </span>
                )}
              </div>

              {/* Pending GPS Confirmation Alert */}
              {pendingGps && (
                <div className="p-3 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 rounded-xl text-xs text-sky-800 dark:text-sky-200 space-y-2">
                  <p className="font-medium">
                    Cari koordinatlar təyin edildi (Lat: {pendingGps.lat}, Lng: {pendingGps.lng}, Dəqiqlik: {pendingGps.accuracy}m).
                  </p>
                  <p>Bu nöqtəni müştərinin konumu kimi qeyd etmək istəyirsiniz?</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingGps(null)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                    >
                      İmtina
                    </button>
                    <button
                      type="button"
                      onClick={confirmPendingGps}
                      className="px-3 py-1.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Bu konumu seç
                    </button>
                  </div>
                </div>
              )}

              {/* Accuracy Warning */}
              {gpsAccuracyWarning && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>{gpsAccuracyWarning}</span>
                </div>
              )}

              {/* GPS Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={isLocating}
                  className="flex-1 min-w-[140px] px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Navigation className={`w-4 h-4 text-sky-600 dark:text-sky-400 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Konum axtarılır...' : 'Hazırkı konumumu tap'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsGpsModalOpen(true)}
                  className="flex-1 min-w-[140px] px-3.5 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Xəritədən seç</span>
                </button>

                {hasGps && (
                  <button
                    type="button"
                    onClick={() => {
                      setLatitude(0);
                      setLongitude(0);
                      setAccuracy(0);
                    }}
                    className="px-3 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    Təmizlə
                  </button>
                )}
              </div>
            </div>

            {/* Action Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                İmtina
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                {isSubmitting && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                <span>{customerToEdit ? 'Yadda Saxla' : 'Müştərini Əlavə Et'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Interactive Map Picker Modal */}
      <GpsPickModal
        isOpen={isGpsModalOpen}
        initialLat={latitude}
        initialLng={longitude}
        onSelect={(coords) => {
          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
          setAccuracy(coords.accuracy);
        }}
        onClose={() => setIsGpsModalOpen(false)}
      />
    </>
  );
};

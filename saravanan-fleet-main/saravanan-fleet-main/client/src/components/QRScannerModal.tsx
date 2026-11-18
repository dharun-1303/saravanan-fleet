import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  Search,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  ShieldAlert,
  Truck,
  ExternalLink,
  PlusCircle,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { Vehicle, Trip } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  trips?: Trip[];
  onSelectVehicle: (vehicleId: string, action: 'view' | 'trip') => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  trips = [],
  onSelectVehicle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedVehicle, setScannedVehicle] = useState<Vehicle | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedVehicle(null);
      setCameraError(null);
      setSearchTerm('');
      return;
    }

    // Small timeout ensures the DOM element #qr-reader is mounted and rendered
    const timer = setTimeout(() => {
      startScanner();
    }, 80);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setCameraError(null);
      const readerElem = document.getElementById('qr-reader');
      if (!readerElem) return;

      // Stop any existing instance
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch {
          // ignore cleanup error
        }
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      let cameraConfig: any = { facingMode: 'environment' };
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const rear = cameras.find(c => /back|rear|environment/i.test(c.label));
          cameraConfig = rear ? rear.id : cameras[0].id;
        }
      } catch {
        // Fall back to facingMode constraint
      }

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 230, height: 230 },
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame scan error (ignore standard frame misses)
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.warn('Camera scanner primary start failed, trying front camera fallback:', err);
      try {
        if (scannerRef.current) {
          await scannerRef.current.start(
            { facingMode: 'user' },
            { fps: 10, qrbox: { width: 230, height: 230 } },
            (decodedText) => handleScanSuccess(decodedText),
            () => {}
          );
          setIsScanning(true);
          return;
        }
      } catch (e) {
        console.warn('Fallback scanner also failed:', e);
      }
      setCameraError('Camera access unavailable or not granted in this browser session. You can upload a QR image or manually search below.');
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      setIsScanning(false);
      try {
        if (scanner.isScanning) {
          scanner.stop().then(() => scanner.clear()).catch(() => {});
        } else {
          scanner.clear();
        }
      } catch (e) {
        console.warn('Scanner stop error:', e);
      }
    }
  };

  const resolveScannedVehicle = (text: string): Vehicle | undefined => {
    if (!text || !text.trim() || vehicles.length === 0) return undefined;
    const raw = text.trim();

    // Helper to match vehicle against any string candidate
    const matchCandidate = (candidate: string): Vehicle | undefined => {
      if (!candidate) return undefined;
      const clean = candidate.trim().toLowerCase();
      const cleanNoSpace = clean.replace(/[\s\-_]/g, '');
      if (!cleanNoSpace) return undefined;

      return vehicles.find(v => {
        const vid = (v.vehicle_id || '').toLowerCase();
        const vreg = (v.registration_number || '').toLowerCase();
        const vname = (v.vehicle_name || '').toLowerCase();
        const vtab = (v.sheet_tab_name || '').toLowerCase();
        const vidNoSpace = vid.replace(/[\s\-_]/g, '');
        const vregNoSpace = vreg.replace(/[\s\-_]/g, '');
        const vnameNoSpace = vname.replace(/[\s\-_]/g, '');
        const vtabNoSpace = vtab.replace(/[\s\-_]/g, '');

        return (
          vid === clean ||
          vreg === clean ||
          vidNoSpace === cleanNoSpace ||
          vregNoSpace === cleanNoSpace ||
          vname === clean ||
          vnameNoSpace === cleanNoSpace ||
          vtab === clean ||
          vtabNoSpace === cleanNoSpace
        );
      });
    };

    // 1. Try parsing JSON
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const candidates = [
          parsed.vehicle_id,
          parsed.id,
          parsed.reg,
          parsed.registration,
          parsed.registration_number,
          parsed.name,
          parsed.vehicle_name,
        ].filter(Boolean);

        for (const c of candidates) {
          const matched = matchCandidate(String(c));
          if (matched) return matched;
        }
      }
    } catch {
      // Not JSON
    }

    // 2. Try parsing URL (query params or hash/path)
    try {
      const url = new URL(raw, window.location.origin);
      const params = url.searchParams;
      const urlCandidates = [
        params.get('vehicle_id'),
        params.get('vehicle'),
        params.get('reg'),
        params.get('id'),
        params.get('qr'),
      ].filter(Boolean);

      for (const c of urlCandidates) {
        const matched = matchCandidate(String(c));
        if (matched) return matched;
      }

      const hashPart = url.hash.replace(/^#/, '');
      const [hPath, hQuery] = hashPart.split('?');
      if (hQuery) {
        const hParams = new URLSearchParams(hQuery);
        const hCandidates = [
          hParams.get('vehicle_id'),
          hParams.get('vehicle'),
          hParams.get('reg'),
          hParams.get('id'),
          hParams.get('qr'),
        ].filter(Boolean);
        for (const c of hCandidates) {
          const matched = matchCandidate(String(c));
          if (matched) return matched;
        }
      }

      if (hPath) {
        const parts = hPath.split('/');
        for (const part of parts) {
          const matched = matchCandidate(part);
          if (matched) return matched;
        }
      }
    } catch {
      // Not a URL
    }

    // 3. Try plain text match
    return matchCandidate(raw);
  };

  const handleScanSuccess = (text: string) => {
    stopScanner();
    const matchedVehicle = resolveScannedVehicle(text);
    if (matchedVehicle) {
      setCameraError(null);
      setScannedVehicle(matchedVehicle);
    } else {
      setCameraError(`Scanned QR code "${text.slice(0, 35)}" does not match any registered vehicle.`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setCameraError(null);
      const scanner = scannerRef.current || new Html5Qrcode('qr-reader');
      const decodedText = await scanner.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err: any) {
      setCameraError('Could not detect a QR code in the uploaded image. Please try another image or search below.');
    }
  };

  const activeTripForScanned = useMemo(() => {
    if (!scannedVehicle) return null;
    return trips.find(t => {
      const matches =
        t.vehicle_id === scannedVehicle.vehicle_id ||
        t.vehicle_id.toLowerCase() === scannedVehicle.registration_number.toLowerCase();
      if (!matches) return false;
      const hasNoEndKm =
        t.end_km === null ||
        t.end_km === undefined ||
        String(t.end_km).trim() === '' ||
        isNaN(Number(t.end_km));
      const isTripStatusActive =
        t.trip_status === 'IN_TRANSIT' ||
        (t.trip_status as string) === 'PENDING_EXIT' ||
        t.gate_status === 'PENDING_EXIT' ||
        t.gate_status === 'DISPATCHED' ||
        t.status === 'IN_TRANSIT' ||
        t.status === 'UNFINISHED';
      const isNotCompleted =
        t.trip_status !== 'COMPLETED' &&
        t.status !== 'COMPLETED' &&
        t.gate_status !== 'COMPLETED';
      return (hasNoEndKm || isTripStatusActive) && isNotCompleted;
    });
  }, [scannedVehicle, trips]);

  if (!isOpen) return null;

  const filteredVehicles = vehicles.filter(
    v =>
      v.vehicle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.registration_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Camera className="w-5 h-5 text-blue-600" />
            <span>Scan Vehicle QR Code</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. VERIFIED VEHICLE VIEW: Shows Log Trip and View History buttons */}
        {scannedVehicle ? (
          <div className="py-5 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner ${
              activeTripForScanned ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {activeTripForScanned ? <Clock className="w-8 h-8" /> : <CheckCircle className="w-8 h-8" />}
            </div>

            <div
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 border shadow-2xs ${
                activeTripForScanned
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              {activeTripForScanned ? 'Active Trip in Progress' : 'Vehicle Verified & Ready'}
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mt-1">{scannedVehicle.vehicle_name}</h3>
            <div className="inline-block mt-1.5 px-3 py-1 bg-blue-50 text-blue-800 font-mono font-bold text-sm rounded-lg border border-blue-200">
              {scannedVehicle.registration_number}
            </div>
            <p className="text-xs text-slate-500 mt-1.5 font-medium">
              {scannedVehicle.vehicle_type} &bull; {scannedVehicle.fuel_type}
            </p>

            {/* Active trip ongoing snippet */}
            {activeTripForScanned && (
              <div className="mt-3.5 mx-auto max-w-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-left text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Origin: <strong className="text-slate-800">{activeTripForScanned.from || 'Yard'}</strong></span>
                  <span>Start: <strong className="font-mono text-slate-800">{activeTripForScanned.start_km.toLocaleString('en-IN')} KM</strong></span>
                </div>
                {activeTripForScanned.driver && (
                  <div className="text-[11px] text-slate-500">
                    Driver: <strong className="text-slate-700">{activeTripForScanned.driver}</strong>
                  </div>
                )}
              </div>
            )}

            {/* THE TWO BUTTONS: Log Trip & View History */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  onSelectVehicle(scannedVehicle.vehicle_id, 'trip');
                }}
                className={`py-3 px-3 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
                  activeTripForScanned
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25 ring-2 ring-amber-400/40'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25 ring-2 ring-blue-400/40'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{activeTripForScanned ? 'Close Active Trip' : 'Log Trip'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectVehicle(scannedVehicle.vehicle_id, 'view');
                }}
                className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-slate-200"
              >
                <ExternalLink className="w-4 h-4 text-slate-600" />
                <span>View History</span>
              </button>
            </div>

            {/* Re-scan button */}
            <button
              type="button"
              onClick={() => {
                setScannedVehicle(null);
                setSearchTerm('');
                startScanner();
              }}
              className="mt-4 text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Scan another vehicle</span>
            </button>
          </div>
        ) : (
          /* 2. CAMERA SCANNER & SEARCH VIEW */
          <div className="mt-4">
            {/* Camera viewport container */}
            <div id="qr-reader" className="w-full bg-slate-900 rounded-xl overflow-hidden min-h-[220px]" />

            {/* Hidden file input for QR image upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Photo / Screenshot Upload Action */}
            <div className="mt-2.5 flex items-center justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload QR Image / Photo</span>
              </button>
            </div>

            {cameraError && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Manual vehicle lookup fallback */}
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                Or Search by Registration Number / Model:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. TN87E5753 or BMW..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {searchTerm.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-1 divide-y divide-slate-100 bg-white border border-slate-200 rounded-lg p-1">
                  {filteredVehicles.map(v => (
                    <div
                      key={v.vehicle_id}
                      onClick={() => setScannedVehicle(v)}
                      className="p-2 hover:bg-blue-50 rounded cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{v.vehicle_name}</div>
                        <div className="text-[11px] font-mono text-blue-600 font-medium">{v.registration_number}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  ))}
                  {filteredVehicles.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-400">No vehicles matching "{searchTerm}"</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

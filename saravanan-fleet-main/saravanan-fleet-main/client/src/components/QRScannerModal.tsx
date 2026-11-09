import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, Search, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { Vehicle } from '../types';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string, action: 'view' | 'trip') => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  onSelectVehicle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scannedVehicle, setScannedVehicle] = useState<Vehicle | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedVehicle(null);
      setCameraError(null);
      setSearchTerm('');
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async () => {
    try {
      setCameraError(null);
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
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
      console.warn('Camera scanner could not start:', err);
      setCameraError('Camera access unavailable or not granted in this browser session. You can manually search below.');
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current && isScanning) {
      scannerRef.current
        .stop()
        .then(() => scannerRef.current?.clear())
        .catch(e => console.warn('Scanner stop warning:', e));
      scannerRef.current = null;
      setIsScanning(false);
    }
  };

  const handleScanSuccess = (text: string) => {
    stopScanner();
    try {
      // Could be json or direct id/reg
      let matchedVehicle: Vehicle | undefined;
      try {
        const parsed = JSON.parse(text);
        if (parsed.vehicle_id) {
          matchedVehicle = vehicles.find(v => v.vehicle_id === parsed.vehicle_id);
        } else if (parsed.reg) {
          matchedVehicle = vehicles.find(v => v.registration_number.toLowerCase() === parsed.reg.toLowerCase());
        }
      } catch {
        // Plain string check
        matchedVehicle = vehicles.find(
          v =>
            v.vehicle_id.toLowerCase() === text.trim().toLowerCase() ||
            v.registration_number.toLowerCase() === text.trim().toLowerCase()
        );
      }

      if (matchedVehicle) {
        setScannedVehicle(matchedVehicle);
      } else {
        setCameraError(`Scanned code "${text.slice(0, 30)}" does not match any fleet vehicle.`);
      }
    } catch (err: any) {
      setCameraError('Failed to parse vehicle identifier from QR.');
    }
  };

  if (!isOpen) return null;

  const filteredVehicles = vehicles.filter(
    v =>
      v.vehicle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.registration_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Camera className="w-5 h-5 text-blue-600" />
            <span>Scan Vehicle QR Code</span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {scannedVehicle ? (
          <div className="py-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Vehicle Verified</span>
            <h3 className="text-xl font-bold text-slate-900 mt-1">{scannedVehicle.vehicle_name}</h3>
            <p className="font-mono text-sm font-semibold text-blue-600">{scannedVehicle.registration_number}</p>
            <p className="text-xs text-slate-500 mt-1">{scannedVehicle.vehicle_type} &bull; {scannedVehicle.fuel_type}</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onClose();
                  onSelectVehicle(scannedVehicle.vehicle_id, 'trip');
                }}
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20"
              >
                Record Trip Now
              </button>
              <button
                onClick={() => {
                  onClose();
                  onSelectVehicle(scannedVehicle.vehicle_id, 'view');
                }}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold"
              >
                View History
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            {/* Camera viewport container */}
            <div id="qr-reader" className="w-full bg-slate-900 rounded-xl overflow-hidden min-h-[220px]" />

            {cameraError && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Manual vehicle lookup fallback */}
            <div className="mt-4 pt-4 border-t border-slate-100">
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

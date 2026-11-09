import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, Printer, ExternalLink, ShieldCheck } from 'lucide-react';
import { Vehicle } from '../types';

interface QRModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onNavigateToVehicle?: (vehicleId: string) => void;
}

export const QRModal: React.FC<QRModalProps> = ({ vehicle, onClose, onNavigateToVehicle }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!vehicle) return;
    // Stable identifier or URL
    const qrPayload = JSON.stringify({
      app: 'SaravananFleet',
      vehicle_id: vehicle.vehicle_id,
      reg: vehicle.registration_number,
      name: vehicle.vehicle_name,
    });

    QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR generation error:', err));
  }, [vehicle]);

  if (!vehicle) return null;

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_${vehicle.registration_number}_${vehicle.vehicle_name.replace(/\s+/g, '_')}.png`;
    a.click();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Fleet QR - ${vehicle.vehicle_name} (${vehicle.registration_number})</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { border: 2px solid #334155; padding: 24px; border-radius: 12px; text-align: center; width: 340px; }
            h2 { margin: 0 0 4px; font-size: 20px; color: #0f172a; }
            .reg { font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #1e40af; margin-bottom: 12px; }
            img { width: 260px; height: 260px; }
            .footer { margin-top: 12px; font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>SARAVANAN ELECTRICALS</h2>
            <div class="reg">${vehicle.registration_number}</div>
            <div style="font-size: 14px; margin-bottom: 12px; font-weight: 600;">${vehicle.vehicle_name} &bull; ${vehicle.fuel_type}</div>
            <img src="${qrDataUrl}" />
            <div class="footer">Scan to record trips, fuel or view maintenance history</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Vehicle QR Pass</span>
          </div>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Exit Vehicle Pass"
            className="p-2 -mr-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="my-4 sm:my-5 flex flex-col items-center overflow-y-auto pr-1">
          <div className="text-center mb-3">
            <span className="text-xs uppercase font-semibold text-slate-400">{vehicle.vehicle_type}</span>
            <h3 className="text-xl font-bold text-slate-900">{vehicle.vehicle_name}</h3>
            <div className="inline-block mt-1 px-3 py-1 bg-blue-50 text-blue-800 font-mono font-bold text-sm rounded-md border border-blue-200">
              {vehicle.registration_number}
            </div>
          </div>

          <div className="p-2.5 sm:p-3 bg-white border-2 border-dashed border-slate-200 rounded-xl shadow-inner max-w-full">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Vehicle QR Code" className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg object-contain" />
            ) : (
              <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 text-sm">Generating QR...</div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500 text-center max-w-xs">
            Affix to vehicle windshield or dashboard for driver trip verification.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-lg transition-all"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download PNG</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-sm shadow-blue-500/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print Badge</span>
          </button>
        </div>

        {onNavigateToVehicle && (
          <button
            onClick={() => {
              onClose();
              onNavigateToVehicle(vehicle.vehicle_id);
            }}
            className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            <span>Open Complete History</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

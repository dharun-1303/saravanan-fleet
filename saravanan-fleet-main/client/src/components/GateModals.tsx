import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, ShieldCheck, Check, Clock, AlertCircle } from 'lucide-react';
import { Trip, Vehicle } from '../types';
import { formatKM, formatDate, formatDateTime } from '../utils/formatters';

interface GateOutModalProps {
  isOpen: boolean;
  trip: Trip | null;
  vehicle?: Vehicle;
  onClose: () => void;
  onConfirm: (data: { gate_out_by: string; gate_out_time: string }) => Promise<void>;
}

export const GateOutModal: React.FC<GateOutModalProps> = ({
  isOpen,
  trip,
  vehicle,
  onClose,
  onConfirm,
}) => {
  const [securityName, setSecurityName] = useState('');
  const [confirmedCheck, setConfirmedCheck] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSecurityName(trip?.gate_out_by || '');
      setConfirmedCheck(true);
      setError(null);
    }
  }, [isOpen, trip]);

  if (!isOpen || !trip) return null;

  const vehicleName = vehicle?.vehicle_name || trip.vehicle_id;
  const regNumber = vehicle?.registration_number || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = securityName.trim();
    if (!name) {
      setError('Please enter the Security Guard Name / ID.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm({
        gate_out_by: name,
        gate_out_time: new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm gate out.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Approve Gate Out</h3>
              <p className="text-xs text-slate-500">Security checkpoint vehicle departure verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Vehicle & Trip Inspection Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Vehicle</span>
                <div className="font-bold text-slate-900 text-sm">{vehicleName}</div>
              </div>
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-900 border border-amber-300 font-mono font-bold rounded-lg text-xs">
                {regNumber || 'VEHICLE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
              <div>
                <span className="text-slate-500 block text-[11px]">Route</span>
                <span className="font-medium text-slate-800">
                  {trip.from || 'Origin'} → {trip.to || 'Destination'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Driver</span>
                <span className="font-medium text-slate-800">{trip.driver || '—'}</span>
              </div>
            </div>

            {/* Start KM Check */}
            <div className="p-2.5 bg-white rounded-lg border border-amber-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-900 block">Verified Start Odometer:</span>
                <span className="text-[10px] text-slate-500">Cross-check with instrument cluster</span>
              </div>
              <span className="font-mono font-extrabold text-amber-700 text-base">
                {trip.start_km.toLocaleString('en-IN')} KM
              </span>
            </div>
          </div>

          {/* Security Personnel Name */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Security Guard Name / ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Guard Ramesh / Gate 1"
              value={securityName}
              onChange={e => setSecurityName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Timestamp Notice */}
          <div className="flex items-center gap-2 text-slate-500 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>
              Gate OUT timestamp: <strong className="text-slate-700">{formatDateTime(new Date().toISOString())}</strong>
            </span>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !securityName.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Confirming...' : 'Confirm Gate OUT'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GateInModalProps {
  isOpen: boolean;
  trip: Trip | null;
  vehicle?: Vehicle;
  onClose: () => void;
  onConfirm: (data: { gate_in_by: string; gate_in_time: string; end_km: number }) => Promise<void>;
}

export const GateInModal: React.FC<GateInModalProps> = ({
  isOpen,
  trip,
  vehicle,
  onClose,
  onConfirm,
}) => {
  const [securityName, setSecurityName] = useState('');
  const [endKmInput, setEndKmInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && trip) {
      setSecurityName(trip.gate_in_by || '');
      setEndKmInput(trip.end_km !== null && trip.end_km !== undefined ? trip.end_km.toString() : '');
      setError(null);
    }
  }, [isOpen, trip]);

  if (!isOpen || !trip) return null;

  const vehicleName = vehicle?.vehicle_name || trip.vehicle_id;
  const regNumber = vehicle?.registration_number || '';
  const numEnd = endKmInput ? parseFloat(endKmInput) : NaN;
  const calculatedDistance = !isNaN(numEnd) && numEnd >= trip.start_km ? numEnd - trip.start_km : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const name = securityName.trim();
    if (!name) {
      setError('Please enter the Security Guard Name / ID.');
      return;
    }

    if (isNaN(numEnd) || numEnd < 0) {
      setError('Please enter a valid ending odometer reading (End KM).');
      return;
    }

    if (numEnd < trip.start_km) {
      setError(`Ending KM (${numEnd}) cannot be less than Start KM (${trip.start_km}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm({
        gate_in_by: name,
        gate_in_time: new Date().toISOString(),
        end_km: numEnd,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm gate in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Approve Gate In</h3>
              <p className="text-xs text-slate-500">Security checkpoint return verification & acknowledgment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Vehicle & Trip Inspection Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Vehicle</span>
                <div className="font-bold text-slate-900 text-sm">{vehicleName}</div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-900 border border-emerald-300 font-mono font-bold rounded-lg text-xs">
                {regNumber || 'VEHICLE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
              <div>
                <span className="text-slate-500 block text-[11px]">Departure Start KM</span>
                <span className="font-mono font-semibold text-slate-800">
                  {trip.start_km.toLocaleString('en-IN')} KM
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Gate Out Details</span>
                <span className="font-medium text-slate-800">
                  {trip.gate_out_time ? formatDateTime(trip.gate_out_time) : 'Dispatched'}{' '}
                  {trip.gate_out_by ? `(${trip.gate_out_by})` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* End KM Verification Input */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Verified Return Odometer (End KM) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              placeholder={`Enter return KM (min: ${trip.start_km})`}
              value={endKmInput}
              onChange={e => setEndKmInput(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono font-bold text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Driver/Gate check reading on arrival at gate
            </span>
          </div>

          {/* Dynamic Distance Computation */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
            <span className="font-bold text-emerald-950">Calculated Trip Distance:</span>
            <span className="font-mono font-extrabold text-emerald-700 text-base">
              {formatKM(calculatedDistance)}
            </span>
          </div>

          {/* Security Personnel Name */}
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Security Guard Name / ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Guard Ramesh / Gate 1"
              value={securityName}
              onChange={e => setSecurityName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Timestamp Notice */}
          <div className="flex items-center gap-2 text-slate-500 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>
              Gate IN timestamp: <strong className="text-slate-700">{formatDateTime(new Date().toISOString())}</strong>
            </span>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !securityName.trim() || isNaN(numEnd) || numEnd < trip.start_km}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Confirming...' : 'Confirm Gate IN'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

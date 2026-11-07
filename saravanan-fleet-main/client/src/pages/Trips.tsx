import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Search, Filter, Download, Edit2, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Trip, Vehicle } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatINR, formatKM, formatDate } from '../utils/formatters';

interface TripsProps {
  trips: Trip[];
  vehicles: Vehicle[];
  onAddTrip: (tripData: Partial<Trip>) => Promise<void>;
  onUpdateTrip: (tripId: string, tripData: Partial<Trip>) => Promise<void>;
  onDeleteTrip?: (tripId: string) => Promise<void>;
  onExportCSV: () => void;
  preselectedVehicleId?: string | null;
  onPreselectedConsumed?: () => void;
}

export const Trips: React.FC<TripsProps> = ({
  trips,
  vehicles,
  onAddTrip,
  onUpdateTrip,
  onDeleteTrip,
  onExportCSV,
  preselectedVehicleId,
  onPreselectedConsumed,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    vehicle_id: vehicles[0]?.vehicle_id || '',
    date: new Date().toISOString().split('T')[0],
    from: '',
    to: '',
    start_km: '',
    end_km: '',
    remark: '',
    amount: '',
    driver: '',
    employee: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehicleMap = new Map(vehicles.map(v => [v.vehicle_id, `${v.vehicle_name} (${v.registration_number})`]));

  // Auto-open Add Trip modal when arriving from QR scan
  useEffect(() => {
    if (preselectedVehicleId && vehicles.length > 0) {
      setEditingTrip(null);
      setFormData({
        vehicle_id: preselectedVehicleId,
        date: new Date().toISOString().split('T')[0],
        from: '',
        to: '',
        start_km: '',
        end_km: '',
        remark: '',
        amount: '',
        driver: '',
        employee: '',
      });
      setFormError(null);
      setIsModalOpen(true);
      onPreselectedConsumed?.();
    }
  }, [preselectedVehicleId, vehicles.length]);

  const handleOpenAdd = () => {
    setEditingTrip(null);
    setFormData({
      vehicle_id: vehicles[0]?.vehicle_id || '',
      date: new Date().toISOString().split('T')[0],
      from: '',
      to: '',
      start_km: '',
      end_km: '',
      remark: '',
      amount: '',
      driver: '',
      employee: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Trip) => {
    setEditingTrip(t);
    setFormData({
      vehicle_id: t.vehicle_id,
      date: t.date,
      from: t.from,
      to: t.to,
      start_km: t.start_km.toString(),
      end_km: t.end_km !== null && t.end_km !== undefined ? t.end_km.toString() : '',
      remark: t.remark,
      amount: t.amount ? t.amount.toString() : '',
      driver: t.driver || '',
      employee: t.employee || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const calculatedDistance = () => {
    const s = parseFloat(formData.start_km);
    const e = parseFloat(formData.end_km);
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      return e - s;
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const s = parseFloat(formData.start_km);
    const eVal = formData.end_km ? parseFloat(formData.end_km) : null;

    if (isNaN(s) || s < 0) {
      setFormError('Please enter a valid start odometer reading.');
      return;
    }

    if (eVal !== null && eVal < s) {
      setFormError(`End KM (${eVal}) cannot be less than Start KM (${s}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingTrip) {
        await onUpdateTrip(editingTrip.trip_id, {
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          from: formData.from,
          to: formData.to,
          start_km: s,
          end_km: eVal,
          remark: formData.remark,
          amount: parseFloat(formData.amount) || 0,
          driver: formData.driver,
          employee: formData.employee,
        });
      } else {
        await onAddTrip({
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          from: formData.from,
          to: formData.to,
          start_km: s,
          end_km: eVal,
          remark: formData.remark,
          amount: parseFloat(formData.amount) || 0,
          driver: formData.driver,
          employee: formData.employee,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save trip record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTrips = trips.filter(t => {
    const matchesSearch =
      t.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.driver && t.driver.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.remark && t.remark.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesVehicle = selectedVehicle === 'all' || t.vehicle_id === selectedVehicle;
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'completed' && t.status === 'COMPLETED') ||
      (selectedStatus === 'unfinished' && t.status === 'UNFINISHED');

    return matchesSearch && matchesVehicle && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Action and Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search route, destination, driver..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedVehicle}
              onChange={e => setSelectedVehicle(e.target.value)}
              className="flex-1 sm:flex-none px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium max-w-none sm:max-w-[160px]"
            >
              <option value="all">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.vehicle_name} ({v.registration_number})
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="flex-1 sm:flex-none px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="unfinished">Unfinished / In Transit</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Log Trip</span>
          </button>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Origin & Destination</th>
                <th className="py-3 px-4">Start KM</th>
                <th className="py-3 px-4">End KM</th>
                <th className="py-3 px-4">Distance</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Driver / Remark</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrips.map(trip => (
                <tr key={trip.trip_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">{formatDate(trip.date)}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800 block">
                      {vehicleMap.get(trip.vehicle_id) || trip.vehicle_id}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">
                      {trip.from} <span className="text-blue-500">→</span> {trip.to}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{trip.start_km.toLocaleString('en-IN')}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {trip.end_km !== null && trip.end_km !== undefined ? trip.end_km.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{formatKM(trip.distance)}</td>
                  <td className="py-3 px-4 font-medium text-slate-800">{formatINR(trip.amount)}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={trip.status} />
                  </td>
                  <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                    {trip.remark || '—'} {trip.driver && `(${trip.driver})`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(trip)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Edit trip"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteTrip && (
                      <button
                        onClick={() => setDeletingTrip(trip)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1"
                        title="Delete trip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No trips found matching filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Trip Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingTrip ? 'Edit Trip Record' : 'Log New Fleet Trip'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs overflow-y-auto pr-1">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vehicle *</label>
                <select
                  required
                  value={formData.vehicle_id}
                  onChange={e => setFormData({ ...formData, vehicle_id: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                >
                  {vehicles.map(v => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      {v.vehicle_name} — {v.registration_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 1500"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">From (Origin)</label>
                  <input
                    type="text"
                    placeholder="e.g. Tirupattur Yard"
                    value={formData.from}
                    onChange={e => setFormData({ ...formData, from: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">To (Destination)</label>
                  <input
                    type="text"
                    placeholder="e.g. Substation Site"
                    value={formData.to}
                    onChange={e => setFormData({ ...formData, to: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Start KM *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 54200"
                    value={formData.start_km}
                    onChange={e => setFormData({ ...formData, start_km: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    End KM <span className="font-normal text-slate-400">(Leave empty if in transit)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 54380"
                    value={formData.end_km}
                    onChange={e => setFormData({ ...formData, end_km: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
                  />
                </div>
              </div>

              {/* Calculated Distance display */}
              <div className="bg-blue-50 border border-blue-200/70 p-2.5 rounded-lg flex items-center justify-between">
                <span className="font-semibold text-blue-900">Calculated Distance:</span>
                <span className="font-mono font-bold text-blue-800 text-sm">{formatKM(calculatedDistance())}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Driver Name</label>
                  <select
                    value={formData.driver}
                    onChange={e => setFormData({ ...formData, driver: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="">Select Driver</option>
                    <option value="Saravana Perumal">Saravana Perumal</option>
                     <option value="Sathish">Sathish</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Staff / Employee</label>
                  <input
                    type="text"
                    placeholder="Accompanying staff"
                    value={formData.employee}
                    onChange={e => setFormData({ ...formData, employee: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Purpose / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Substation transformer delivery, tender visit..."
                  value={formData.remark}
                  onChange={e => setFormData({ ...formData, remark: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving to Sheets...' : editingTrip ? 'Update Trip' : 'Record Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingTrip)}
        title="Delete Trip Record"
        message={`Are you sure you want to permanently delete this trip from ${deletingTrip?.from} to ${deletingTrip?.to} (${deletingTrip?.distance} km) on ${formatDate(deletingTrip?.date || '')}? This row will also be permanently deleted from Google Sheets.`}
        isLoading={isDeleting}
        onConfirm={async () => {
          if (!deletingTrip || !onDeleteTrip) return;
          try {
            setIsDeleting(true);
            await onDeleteTrip(deletingTrip.trip_id);
            setDeletingTrip(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onCancel={() => setDeletingTrip(null)}
      />
    </div>
  );
};

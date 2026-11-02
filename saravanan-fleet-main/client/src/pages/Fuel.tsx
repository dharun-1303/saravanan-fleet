import React, { useState } from 'react';
import { Fuel as FuelIcon, Plus, Search, Download, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { FuelRecord, Vehicle } from '../types';
import { KPICard } from '../components/KPICard';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatINR, formatKM, formatDate } from '../utils/formatters';

interface FuelProps {
  fuelRecords: FuelRecord[];
  vehicles: Vehicle[];
  onAddFuel: (data: Partial<FuelRecord>) => Promise<void>;
  onUpdateFuel: (id: string, data: Partial<FuelRecord>) => Promise<void>;
  onDeleteFuel?: (id: string) => Promise<void>;
  onExportCSV: () => void;
}

export const FuelPage: React.FC<FuelProps> = ({
  fuelRecords,
  vehicles,
  onAddFuel,
  onUpdateFuel,
  onDeleteFuel,
  onExportCSV,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFuel, setEditingFuel] = useState<FuelRecord | null>(null);
  const [deletingFuel, setDeletingFuel] = useState<FuelRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: vehicles[0]?.vehicle_id || '',
    date: new Date().toISOString().split('T')[0],
    odometer: '',
    fuel_type: 'Diesel',
    litres: '',
    amount: '',
    vendor: '',
    remarks: '',
    recorded_by: 'Fleet Incharge',
    receipt_url: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehicleMap = new Map(vehicles.map(v => [v.vehicle_id, `${v.vehicle_name} (${v.registration_number})`]));

  // Stats
  const totalCost = fuelRecords.reduce((acc, f) => acc + (f.amount || 0), 0);
  const totalLitres = fuelRecords.reduce((acc, f) => acc + (f.litres || 0), 0);
  const avgCostPerLitre = totalLitres > 0 ? (totalCost / totalLitres).toFixed(1) : '0';

  const handleOpenAdd = () => {
    setEditingFuel(null);
    setFormData({
      vehicle_id: vehicles[0]?.vehicle_id || '',
      date: new Date().toISOString().split('T')[0],
      odometer: '',
      fuel_type: 'Diesel',
      litres: '',
      amount: '',
      vendor: '',
      remarks: '',
      recorded_by: 'Fleet Incharge',
      receipt_url: '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (f: FuelRecord) => {
    setEditingFuel(f);
    setFormData({
      vehicle_id: f.vehicle_id,
      date: f.date,
      odometer: f.odometer.toString(),
      fuel_type: f.fuel_type,
      litres: f.litres.toString(),
      amount: f.amount.toString(),
      vendor: f.vendor || '',
      remarks: f.remarks || '',
      recorded_by: f.recorded_by || 'Staff',
      receipt_url: f.receipt_url || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(formData.amount);
    const lit = parseFloat(formData.litres);
    const odo = parseFloat(formData.odometer);

    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid fuel amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingFuel) {
        await onUpdateFuel(editingFuel.fuel_id, {
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          odometer: odo || 0,
          fuel_type: formData.fuel_type,
          litres: lit || 0,
          amount: amt,
          vendor: formData.vendor,
          remarks: formData.remarks,
          recorded_by: formData.recorded_by,
          receipt_url: formData.receipt_url,
        });
      } else {
        await onAddFuel({
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          odometer: odo || 0,
          fuel_type: formData.fuel_type,
          litres: lit || 0,
          amount: amt,
          vendor: formData.vendor,
          remarks: formData.remarks,
          recorded_by: formData.recorded_by,
          receipt_url: formData.receipt_url,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save fuel log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFuel = fuelRecords.filter(f => {
    const matchesSearch =
      (f.vendor && f.vendor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.remarks && f.remarks.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.recorded_by && f.recorded_by.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesVehicle = selectedVehicle === 'all' || f.vehicle_id === selectedVehicle;
    return matchesSearch && matchesVehicle;
  });

  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total Fuel Spend"
          value={formatINR(totalCost)}
          subtitle="All logged refuels"
          icon={FuelIcon}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Total Fuel Volume"
          value={`${totalLitres.toLocaleString('en-IN')} Litres`}
          subtitle="Diesel / Petrol / CNG"
          icon={FuelIcon}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KPICard
          title="Average Cost / Litre"
          value={`₹${avgCostPerLitre}`}
          subtitle="Weighted fleet average"
          icon={FuelIcon}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor, fuel type, remarks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
          <select
            value={selectedVehicle}
            onChange={e => setSelectedVehicle(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium max-w-none sm:max-w-[170px]"
          >
            <option value="all">All Vehicles</option>
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.vehicle_name} ({v.registration_number})
              </option>
            ))}
          </select>
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Log Fuel</span>
          </button>
        </div>
      </div>

      {/* Fuel Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Odometer</th>
                <th className="py-3 px-4">Fuel Type</th>
                <th className="py-3 px-4">Volume</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Remarks / By</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFuel.map(f => (
                <tr key={f.fuel_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">{formatDate(f.date)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {vehicleMap.get(f.vehicle_id) || f.vehicle_id}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{f.odometer.toLocaleString('en-IN')} km</td>
                  <td className="py-3 px-4 text-slate-700 uppercase font-medium">{f.fuel_type}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{f.litres} L</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{formatINR(f.amount)}</td>
                  <td className="py-3 px-4 text-slate-600">{f.vendor || '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {f.remarks} {f.recorded_by && `(${f.recorded_by})`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(f)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                      title="Edit fuel record"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteFuel && (
                      <button
                        onClick={() => setDeletingFuel(f)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1"
                        title="Delete fuel record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredFuel.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FuelIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No fuel logs found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingFuel ? 'Edit Fuel Record' : 'Record Fuel Refill'}
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
                  <label className="font-semibold text-slate-700 block mb-1">Fuel Type</label>
                  <select
                    value={formData.fuel_type}
                    onChange={e => setFormData({ ...formData, fuel_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Petrol">Petrol</option>
                    <option value="CNG">CNG</option>
                    <option value="Electric">Electric</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 4500"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Litres</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 48.5"
                    value={formData.litres}
                    onChange={e => setFormData({ ...formData, litres: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Odometer (KM)</label>
                  <input
                    type="number"
                    placeholder="e.g. 48900"
                    value={formData.odometer}
                    onChange={e => setFormData({ ...formData, odometer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Fuel Station / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. HPCL Petrol Bunk, Tirupattur"
                  value={formData.vendor}
                  onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Recorded By</label>
                  <input
                    type="text"
                    value={formData.recorded_by}
                    onChange={e => setFormData({ ...formData, recorded_by: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Remarks</label>
                  <input
                    type="text"
                    placeholder="Full tank refill..."
                    value={formData.remarks}
                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving to Sheets...' : editingFuel ? 'Update Record' : 'Save Fuel Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingFuel)}
        title="Delete Fuel Record"
        message={`Are you sure you want to permanently delete this ${deletingFuel?.fuel_type} refill record (${formatINR(deletingFuel?.amount || 0)}) from ${formatDate(deletingFuel?.date || '')}? This row will also be permanently deleted from Google Sheets.`}
        isLoading={isDeleting}
        onConfirm={async () => {
          if (!deletingFuel || !onDeleteFuel) return;
          try {
            setIsDeleting(true);
            await onDeleteFuel(deletingFuel.fuel_id);
            setDeletingFuel(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onCancel={() => setDeletingFuel(null)}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { Wrench, Plus, Search, Download, Edit2, Trash2, X, AlertCircle, Calendar } from 'lucide-react';
import { MaintenanceRecord, Vehicle } from '../types';
import { KPICard } from '../components/KPICard';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatINR, formatKM, formatDate } from '../utils/formatters';

interface MaintenanceProps {
  maintenanceRecords: MaintenanceRecord[];
  vehicles: Vehicle[];
  onAddMaintenance: (data: Partial<MaintenanceRecord>) => Promise<void>;
  onUpdateMaintenance: (id: string, data: Partial<MaintenanceRecord>) => Promise<void>;
  onDeleteMaintenance?: (id: string) => Promise<void>;
  onExportCSV: () => void;
}

export const MaintenancePage: React.FC<MaintenanceProps> = ({
  maintenanceRecords,
  vehicles,
  onAddMaintenance,
  onUpdateMaintenance,
  onDeleteMaintenance,
  onExportCSV,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<MaintenanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: vehicles[0]?.vehicle_id || '',
    service_date: new Date().toISOString().split('T')[0],
    odometer: '',
    category: 'Scheduled Service',
    description: '',
    workshop: '',
    cost: '',
    next_service_due_km: '',
    next_service_due_date: '',
    notes: '',
    recorded_by: 'Transport Manager',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehicleMap = new Map(vehicles.map(v => [v.vehicle_id, `${v.vehicle_name} (${v.registration_number})`]));

  const totalCost = maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0);
  const scheduledCount = maintenanceRecords.filter(m => m.category === 'Scheduled Service').length;
  const repairsCount = maintenanceRecords.length - scheduledCount;

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setFormData({
      vehicle_id: vehicles[0]?.vehicle_id || '',
      service_date: new Date().toISOString().split('T')[0],
      odometer: '',
      category: 'Scheduled Service',
      description: '',
      workshop: '',
      cost: '',
      next_service_due_km: '',
      next_service_due_date: '',
      notes: '',
      recorded_by: 'Transport Manager',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: MaintenanceRecord) => {
    setEditingRecord(m);
    setFormData({
      vehicle_id: m.vehicle_id,
      service_date: m.service_date,
      odometer: m.odometer.toString(),
      category: m.category,
      description: m.description,
      workshop: m.workshop,
      cost: m.cost.toString(),
      next_service_due_km: m.next_service_due_km ? m.next_service_due_km.toString() : '',
      next_service_due_date: m.next_service_due_date || '',
      notes: m.notes,
      recorded_by: m.recorded_by,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const costVal = parseFloat(formData.cost);
    const odoVal = parseFloat(formData.odometer);
    const nextKmVal = formData.next_service_due_km ? parseFloat(formData.next_service_due_km) : null;

    if (isNaN(costVal) || costVal < 0) {
      setFormError('Please enter a valid maintenance cost.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        vehicle_id: formData.vehicle_id,
        service_date: formData.service_date,
        odometer: odoVal || 0,
        category: formData.category,
        description: formData.description,
        workshop: formData.workshop,
        cost: costVal,
        next_service_due_km: nextKmVal,
        next_service_due_date: formData.next_service_due_date || null,
        notes: formData.notes,
        recorded_by: formData.recorded_by,
      };

      if (editingRecord) {
        await onUpdateMaintenance(editingRecord.maintenance_id, payload);
      } else {
        await onAddMaintenance(payload);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save maintenance record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRecords = maintenanceRecords.filter(m => {
    const matchesSearch =
      m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.workshop.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVehicle = selectedVehicle === 'all' || m.vehicle_id === selectedVehicle;
    const matchesCategory = selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesVehicle && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total Maintenance Spend"
          value={formatINR(totalCost)}
          subtitle={`${maintenanceRecords.length} maintenance events`}
          icon={Wrench}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KPICard
          title="Scheduled Services"
          value={scheduledCount}
          subtitle="Routine oil & checks"
          icon={Calendar}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KPICard
          title="Repairs & Tyres"
          value={repairsCount}
          subtitle="Corrective & component renewals"
          icon={Wrench}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Action Header */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search description, workshop or parts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
          <div className="grid grid-cols-2 sm:flex items-center gap-2">
            <select
              value={selectedVehicle}
              onChange={e => setSelectedVehicle(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium max-w-none sm:max-w-[170px]"
            >
              <option value="all">All Vehicles</option>
              {vehicles.map(v => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.vehicle_name} ({v.registration_number})
                </option>
              ))}
            </select>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium"
            >
              <option value="all">All Categories</option>
              <option value="Scheduled Service">Scheduled Service</option>
              <option value="Oil Change">Oil Change</option>
              <option value="Tyres">Tyres</option>
              <option value="Battery">Battery</option>
              <option value="Brakes">Brakes</option>
              <option value="Electrical">Electrical</option>
              <option value="Minor Repair">Minor Repair</option>
              <option value="Emergency Repair">Emergency Repair</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCSV}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-amber-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Log Maintenance</span>
          </button>
        </div>
      </div>

      {/* Maintenance Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Service Date</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Work Description</th>
                <th className="py-3 px-4">Odometer</th>
                <th className="py-3 px-4">Cost</th>
                <th className="py-3 px-4">Next Due (Date / KM)</th>
                <th className="py-3 px-4">Workshop</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map(m => (
                <tr key={m.maintenance_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">{formatDate(m.service_date)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {vehicleMap.get(m.vehicle_id) || m.vehicle_id}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                      {m.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-xs">{m.description}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{m.odometer.toLocaleString('en-IN')} km</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{formatINR(m.cost)}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {m.next_service_due_date ? formatDate(m.next_service_due_date) : ''}
                    {m.next_service_due_km ? ` (${m.next_service_due_km.toLocaleString('en-IN')} km)` : '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{m.workshop || '—'}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(m)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                      title="Edit maintenance record"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteMaintenance && (
                      <button
                        onClick={() => setDeletingRecord(m)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1"
                        title="Delete maintenance record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No maintenance records found.</p>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingRecord ? 'Edit Maintenance Record' : 'Log Maintenance & Repairs'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
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
                  <label className="font-semibold text-slate-700 block mb-1">Service Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.service_date}
                    onChange={e => setFormData({ ...formData, service_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Scheduled Service">Scheduled Service</option>
                    <option value="Oil Change">Oil Change</option>
                    <option value="Tyres">Tyres</option>
                    <option value="Battery">Battery</option>
                    <option value="Brakes">Brakes</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Minor Repair">Minor Repair</option>
                    <option value="Emergency Repair">Emergency Repair</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Odometer (KM)</label>
                  <input
                    type="number"
                    placeholder="e.g. 71000"
                    value={formData.odometer}
                    onChange={e => setFormData({ ...formData, odometer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cost (INR) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 16400"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description of Work</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Engine oil replacement, oil filter, brake lining..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Workshop / Service Centre</label>
                <input
                  type="text"
                  placeholder="e.g. Authorised Service Centre / Local Garage"
                  value={formData.workshop}
                  onChange={e => setFormData({ ...formData, workshop: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
                <div>
                  <label className="font-semibold text-amber-900 block mb-1">Next Service Due (KM)</label>
                  <input
                    type="number"
                    placeholder="e.g. 76000"
                    value={formData.next_service_due_km}
                    onChange={e => setFormData({ ...formData, next_service_due_km: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="font-semibold text-amber-900 block mb-1">Next Service Due (Date)</label>
                  <input
                    type="date"
                    value={formData.next_service_due_date}
                    onChange={e => setFormData({ ...formData, next_service_due_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg"
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
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving to Sheets...' : editingRecord ? 'Update Record' : 'Save Maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingRecord)}
        title="Delete Maintenance Record"
        message={`Are you sure you want to permanently delete this ${deletingRecord?.category} record (${formatINR(deletingRecord?.cost || 0)}) from ${formatDate(deletingRecord?.service_date || '')}? This row will also be permanently deleted from Google Sheets.`}
        isLoading={isDeleting}
        onConfirm={async () => {
          if (!deletingRecord || !onDeleteMaintenance) return;
          try {
            setIsDeleting(true);
            await onDeleteMaintenance(deletingRecord.maintenance_id);
            setDeletingRecord(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onCancel={() => setDeletingRecord(null)}
      />
    </div>
  );
};

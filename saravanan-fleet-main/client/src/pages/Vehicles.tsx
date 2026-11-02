import React, { useState, useRef } from 'react';
import { Truck, Plus, Search, Filter, QrCode, Edit2, Trash2, ArrowRight, CheckCircle2, X, Upload, Image } from 'lucide-react';
import { Vehicle } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { QRModal } from '../components/QRModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { api } from '../api/client';

interface VehiclesProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
  onAddVehicle: (data: Partial<Vehicle>) => Promise<void>;
  onUpdateVehicle: (id: string, data: Partial<Vehicle>) => Promise<void>;
  onDeleteVehicle?: (id: string) => Promise<void>;
}

export const Vehicles: React.FC<VehiclesProps> = ({
  vehicles,
  onSelectVehicle,
  onAddVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFuel, setSelectedFuel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [selectedQRVehicle, setSelectedQRVehicle] = useState<Vehicle | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    vehicle_name: '',
    registration_number: '',
    vehicle_type: 'Car',
    fuel_type: 'Diesel',
    photo_url: '',
    sheet_tab_name: '',
    notes: '',
    active: true,
  });

  const handleOpenAdd = () => {
    setFormData({
      vehicle_name: '',
      registration_number: '',
      vehicle_type: 'Car',
      fuel_type: 'Diesel',
      photo_url: '',
      sheet_tab_name: '',
      notes: '',
      active: true,
    });
    setEditingVehicle(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (v: Vehicle, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingVehicle(v);
    setFormData({
      vehicle_name: v.vehicle_name,
      registration_number: v.registration_number,
      vehicle_type: v.vehicle_type,
      fuel_type: v.fuel_type,
      photo_url: v.photo_url,
      sheet_tab_name: v.sheet_tab_name,
      notes: v.notes,
      active: v.active,
    });
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVehicle) {
      await onUpdateVehicle(editingVehicle.vehicle_id, formData);
    } else {
      await onAddVehicle(formData);
    }
    setIsAddModalOpen(false);
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const result = await api.uploadPhoto(file);
      setFormData(prev => ({ ...prev, photo_url: result.url }));
    } catch {
      setPhotoError('Upload failed. Try pasting a URL instead.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch =
      v.vehicle_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.registration_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFuel = selectedFuel === 'all' || v.fuel_type.toLowerCase() === selectedFuel.toLowerCase();
    const matchesStatus =
      selectedStatus === 'all' ||
      (selectedStatus === 'active' && v.active) ||
      (selectedStatus === 'inactive' && !v.active);
    return matchesSearch && matchesFuel && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by model or registration..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedFuel}
              onChange={e => setSelectedFuel(e.target.value)}
              className="flex-1 sm:flex-none px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium"
            >
              <option value="all">All Fuels</option>
              <option value="diesel">Diesel</option>
              <option value="petrol">Petrol</option>
              <option value="cng">CNG</option>
              <option value="ev">Electric</option>
            </select>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="flex-1 sm:flex-none px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-95 flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Vehicle</span>
        </button>
      </div>

      {/* Vehicle Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredVehicles.map(v => (
          <div
            key={v.vehicle_id}
            onClick={() => onSelectVehicle(v.vehicle_id)}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col group"
          >
            {/* Image Box */}
            <div className="aspect-16/10 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden relative flex items-center justify-center">
              {v.photo_url ? (
                <img
                  src={v.photo_url}
                  alt={v.vehicle_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors">
                  <Truck className="w-10 h-10 mb-1 opacity-70" />
                  <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-300">{v.registration_number}</span>
                </div>
              )}
              <div className="absolute top-2.5 right-2.5">
                <StatusBadge status={v.active ? 'Active' : 'Archived'} size="sm" />
              </div>
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white tracking-wide">
                {v.vehicle_type}
              </div>
            </div>

            {/* Info Body */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {v.vehicle_name}
                </h3>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {v.registration_number}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">{v.fuel_type}</span>
                </div>
                {v.notes && (
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2">{v.notes}</p>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedQRVehicle(v);
                  }}
                  className="flex items-center gap-1 text-slate-600 hover:text-blue-600 font-semibold px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5 text-blue-600" />
                  <span>QR Code</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleOpenEdit(v, e)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    title="Edit vehicle details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {onDeleteVehicle && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingVehicle(v);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Delete vehicle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="flex items-center gap-1 text-blue-600 font-semibold">
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredVehicles.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No vehicles matched your search filter.</p>
        </div>
      )}

      {/* QR Modal */}
      <QRModal vehicle={selectedQRVehicle} onClose={() => setSelectedQRVehicle(null)} />

      {/* Add / Edit Vehicle Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {editingVehicle ? 'Edit Vehicle Details' : 'Add New Vehicle'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs overflow-y-auto pr-1">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vehicle Name / Model *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BMW, BIG EICHER..."
                  value={formData.vehicle_name}
                  onChange={e => setFormData({ ...formData, vehicle_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Registration Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TN87E5753"
                  value={formData.registration_number}
                  onChange={e => setFormData({ ...formData, registration_number: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Vehicle Type</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={e => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Sedan">Sedan</option>
                    <option value="Luxury Sedan">Luxury Sedan</option>
                    <option value="MUV">MUV</option>
                    <option value="SUV">SUV</option>
                    <option value="Compact SUV">Compact SUV</option>
                    <option value="Hatchback">Hatchback</option>
                    <option value="Van">Van</option>
                    <option value="LCV">LCV</option>
                    <option value="Heavy Truck">Heavy Truck</option>
                    <option value="Pickup Truck">Pickup Truck</option>
                  </select>
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

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vehicle Photo</label>
                {/* Upload button */}
                <div className="flex gap-2 mb-1.5">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {photoUploading ? 'Uploading...' : 'Upload Photo'}
                  </button>
                  {formData.photo_url && (
                    <img src={formData.photo_url} alt="preview" className="h-8 w-14 object-cover rounded border border-slate-200" />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste an image URL: https://..."
                  value={formData.photo_url}
                  onChange={e => setFormData({ ...formData, photo_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
                />
                {photoError && <p className="text-xs text-red-500 mt-1">{photoError}</p>}
                <p className="text-[10px] text-slate-400 mt-1">Uploaded photos are stored on this server (local only). URLs work across devices.</p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Google Sheets Tab Name</label>
                <input
                  type="text"
                  placeholder="e.g. BMW TN87E5753"
                  value={formData.sheet_tab_name}
                  onChange={e => setFormData({ ...formData, sheet_tab_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Operational Notes</label>
                <textarea
                  rows={2}
                  placeholder="Assigned driver, purpose, base location..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={formData.active}
                  onChange={e => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="activeCheck" className="font-semibold text-slate-700">
                  Active in Fleet (uncheck to archive)
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm shadow-blue-500/20"
                >
                  {editingVehicle ? 'Save Changes' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingVehicle)}
        title="Delete Vehicle"
        message={`Are you sure you want to permanently delete vehicle "${deletingVehicle?.vehicle_name}" (${deletingVehicle?.registration_number})? This vehicle record will also be permanently deleted from Google Sheets.`}
        isLoading={isDeleting}
        onConfirm={async () => {
          if (!deletingVehicle || !onDeleteVehicle) return;
          try {
            setIsDeleting(true);
            await onDeleteVehicle(deletingVehicle.vehicle_id);
            setDeletingVehicle(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onCancel={() => setDeletingVehicle(null)}
      />
    </div>
  );
};

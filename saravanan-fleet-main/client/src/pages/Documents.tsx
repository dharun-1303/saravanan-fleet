import React, { useState, useRef } from 'react';
import { FileText, Plus, Search, Download, Edit2, Trash2, X, AlertCircle, ExternalLink, ShieldCheck, Upload } from 'lucide-react';
import { DocumentRecord, Vehicle } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDate, formatRelativeDays } from '../utils/formatters';
import { api } from '../api/client';

interface DocumentsProps {
  documentRecords: DocumentRecord[];
  vehicles: Vehicle[];
  onAddDocument: (data: Partial<DocumentRecord>) => Promise<void>;
  onUpdateDocument: (id: string, data: Partial<DocumentRecord>) => Promise<void>;
  onDeleteDocument?: (id: string) => Promise<void>;
}

export const DocumentsPage: React.FC<DocumentsProps> = ({
  documentRecords,
  vehicles,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<DocumentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: vehicles[0]?.vehicle_id || '',
    document_type: 'Insurance' as const,
    document_number: '',
    issue_date: '',
    expiry_date: '',
    issuer: '',
    file_url: '',
    notes: '',
    recorded_by: 'Compliance Officer',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const vehicleMap = new Map(vehicles.map(v => [v.vehicle_id, `${v.vehicle_name} (${v.registration_number})`]));

  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setDocUploadError(null);
    try {
      const result = await api.uploadDocument(file);
      setFormData(prev => ({ ...prev, file_url: result.url }));
    } catch {
      setDocUploadError('Upload failed. Try pasting a Google Drive URL instead.');
    } finally {
      setDocUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleOpenAdd = () => {
    setEditingDoc(null);
    setFormData({
      vehicle_id: vehicles[0]?.vehicle_id || '',
      document_type: 'Insurance',
      document_number: '',
      issue_date: '',
      expiry_date: '',
      issuer: '',
      file_url: '',
      notes: '',
      recorded_by: 'Compliance Officer',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: DocumentRecord) => {
    setEditingDoc(d);
    setFormData({
      vehicle_id: d.vehicle_id,
      document_type: d.document_type as any,
      document_number: d.document_number,
      issue_date: d.issue_date || '',
      expiry_date: d.expiry_date || '',
      issuer: d.issuer || '',
      file_url: d.file_url || '',
      notes: d.notes || '',
      recorded_by: d.recorded_by || 'Staff',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      setIsSubmitting(true);
      if (editingDoc) {
        await onUpdateDocument(editingDoc.document_id, formData);
      } else {
        await onAddDocument(formData);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save document record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDocs = documentRecords.filter(d => {
    const matchesSearch =
      d.document_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.notes.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVehicle = selectedVehicle === 'all' || d.vehicle_id === selectedVehicle;
    const matchesType = selectedType === 'all' || d.document_type === selectedType;
    return matchesSearch && matchesVehicle && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search document #, insurer, issuer..."
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
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 shadow-2xs font-medium"
            >
              <option value="all">All Types</option>
              <option value="Insurance">Insurance</option>
              <option value="PUC">PUC</option>
              <option value="Fitness">Fitness (FC)</option>
              <option value="Registration">Registration (RC)</option>
              <option value="Permit">State Permit</option>
              <option value="Tax">Road Tax</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Document</span>
        </button>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Document Type</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Document Number</th>
                <th className="py-3 px-4">Issue Date</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Issuer / Insurer</th>
                <th className="py-3 px-4">File / Link</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.map(doc => {
                const daysRemaining = doc.expiry_date
                  ? Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                const statusInfo = daysRemaining !== null ? formatRelativeDays(daysRemaining) : { text: 'No Expiry' };

                return (
                  <tr key={doc.document_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">{doc.document_type}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {vehicleMap.get(doc.vehicle_id) || doc.vehicle_id}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">{doc.document_number || '—'}</td>
                    <td className="py-3 px-4 text-slate-600">{doc.issue_date ? formatDate(doc.issue_date) : '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{doc.expiry_date ? formatDate(doc.expiry_date) : '—'}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={statusInfo.text} />
                    </td>
                    <td className="py-3 px-4 text-slate-600">{doc.issuer || '—'}</td>
                    <td className="py-3 px-4">
                      {doc.file_url ? (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-[11px]"
                        >
                          <span>{doc.file_url.includes('drive.google.com') ? 'Google Drive' : 'View Doc'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No link</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(doc)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Edit document"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteDocument && (
                        <button
                          onClick={() => setDeletingDoc(doc)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No compliance documents found.</p>
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
                {editingDoc ? 'Edit Document Details' : 'Add Compliance Document'}
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
                  <label className="font-semibold text-slate-700 block mb-1">Document Type *</label>
                  <select
                    value={formData.document_type}
                    onChange={e => setFormData({ ...formData, document_type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Insurance">Insurance</option>
                    <option value="PUC">PUC</option>
                    <option value="Fitness">Fitness Certificate</option>
                    <option value="Registration">Registration Certificate (RC)</option>
                    <option value="Permit">State Permit</option>
                    <option value="Tax">Road Tax</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Document / Policy #</label>
                  <input
                    type="text"
                    placeholder="e.g. POL-192837"
                    value={formData.document_number}
                    onChange={e => setFormData({ ...formData, document_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={formData.issue_date}
                    onChange={e => setFormData({ ...formData, issue_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Expiry Date <span className="text-slate-400 font-normal text-xs">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Issuer / Insurer Authority</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC ERGO / RTO Tirupattur"
                  value={formData.issuer}
                  onChange={e => setFormData({ ...formData, issuer: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Document Link / File</label>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,image/*" className="hidden" onChange={handleDocFileChange} />
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    disabled={docUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {docUploading ? 'Uploading to Drive...' : 'Upload File (Auto-saves to Drive)'}
                  </button>
                  {formData.file_url && (
                    <a href={formData.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold">
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                  )}
                  {formData.file_url && formData.file_url.includes('drive.google.com') && (
                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Google Drive Link Active
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Or paste Google Drive share link: https://drive.google.com/file/d/..."
                  value={formData.file_url}
                  onChange={e => setFormData({ ...formData, file_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                {docUploadError && <p className="text-xs text-red-500 mt-1">{docUploadError}</p>}
                <p className="text-[10px] text-slate-400 mt-1">
                  Files uploaded via the button above or pasted share links are linked to Google Sheets for multi-device access.
                </p>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes / Renewal Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Comprehensive corporate policy with zero depreciation..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
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
                  {isSubmitting ? 'Saving to Sheets...' : editingDoc ? 'Update Document' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingDoc)}
        title="Delete Document"
        message={`Are you sure you want to permanently delete document "${deletingDoc?.document_type}" (${deletingDoc?.document_number || 'No number'})? This row will also be permanently deleted from Google Sheets.`}
        isLoading={isDeleting}
        onConfirm={async () => {
          if (!deletingDoc || !onDeleteDocument) return;
          try {
            setIsDeleting(true);
            await onDeleteDocument(deletingDoc.document_id);
            setDeletingDoc(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onCancel={() => setDeletingDoc(null)}
      />
    </div>
  );
};

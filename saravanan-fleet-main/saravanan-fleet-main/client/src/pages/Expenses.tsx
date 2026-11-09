import React, { useState } from 'react';
import { Receipt, Plus, Search, Download, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { ExpenseRecord, Vehicle } from '../types';
import { KPICard } from '../components/KPICard';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatINR, formatDate } from '../utils/formatters';

interface ExpensesProps {
  expenseRecords: ExpenseRecord[];
  vehicles: Vehicle[];
  onAddExpense: (data: Partial<ExpenseRecord>) => Promise<void>;
  onUpdateExpense: (id: string, data: Partial<ExpenseRecord>) => Promise<void>;
  onDeleteExpense?: (id: string) => Promise<void>;
  onExportCSV: () => void;
}

export const ExpensesPage: React.FC<ExpensesProps> = ({
  expenseRecords,
  vehicles,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onExportCSV,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<ExpenseRecord | null>(null);
  const [deletingExp, setDeletingExp] = useState<ExpenseRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    vehicle_id: vehicles[0]?.vehicle_id || '',
    date: new Date().toISOString().split('T')[0],
    category: 'Tolls' as const,
    description: '',
    amount: '',
    vendor: '',
    receipt_url: '',
    notes: '',
    recorded_by: 'Staff',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehicleMap = new Map(vehicles.map(v => [v.vehicle_id, `${v.vehicle_name} (${v.registration_number})`]));

  const totalCost = expenseRecords.reduce((acc, e) => acc + (e.amount || 0), 0);
  const tollsCost = expenseRecords.filter(e => e.category === 'Tolls').reduce((acc, e) => acc + e.amount, 0);

  const handleOpenAdd = () => {
    setEditingExp(null);
    setFormData({
      vehicle_id: vehicles[0]?.vehicle_id || '',
      date: new Date().toISOString().split('T')[0],
      category: 'Tolls',
      description: '',
      amount: '',
      vendor: '',
      receipt_url: '',
      notes: '',
      recorded_by: 'Staff',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (e: ExpenseRecord) => {
    setEditingExp(e);
    setFormData({
      vehicle_id: e.vehicle_id,
      date: e.date,
      category: e.category as any,
      description: e.description,
      amount: e.amount.toString(),
      vendor: e.vendor || '',
      receipt_url: e.receipt_url || '',
      notes: e.notes || '',
      recorded_by: e.recorded_by || 'Staff',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid expense amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingExp) {
        await onUpdateExpense(editingExp.expense_id, {
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          category: formData.category,
          description: formData.description,
          amount: amt,
          vendor: formData.vendor,
          receipt_url: formData.receipt_url,
          notes: formData.notes,
          recorded_by: formData.recorded_by,
        });
      } else {
        await onAddExpense({
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          category: formData.category,
          description: formData.description,
          amount: amt,
          vendor: formData.vendor,
          receipt_url: formData.receipt_url,
          notes: formData.notes,
          recorded_by: formData.recorded_by,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExpenses = expenseRecords.filter(e => {
    const matchesSearch =
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVehicle = selectedVehicle === 'all' || e.vehicle_id === selectedVehicle;
    const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
    return matchesSearch && matchesVehicle && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Total Misc Expenses"
          value={formatINR(totalCost)}
          subtitle={`${expenseRecords.length} recorded items`}
          icon={Receipt}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KPICard
          title="Highway Tolls (Fastag)"
          value={formatINR(tollsCost)}
          subtitle="Toll plaza pass charges"
          icon={Receipt}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Operational Categories"
          value="7 Types"
          subtitle="Parking, cleaning, permits & allowances"
          icon={Receipt}
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
              placeholder="Search description, vendor, toll plaza..."
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
              <option value="Tolls">Tolls</option>
              <option value="Parking">Parking</option>
              <option value="Cleaning/Washing">Cleaning / Washing</option>
              <option value="Driver Allowance">Driver Allowance</option>
              <option value="Permits & Taxes">Permits & Taxes</option>
              <option value="Fines">Fines / Challans</option>
              <option value="Other">Other</option>
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
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Vendor</th>
                <th className="py-3 px-4">Notes / By</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(exp => (
                <tr key={exp.expense_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">{formatDate(exp.date)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {vehicleMap.get(exp.vehicle_id) || exp.vehicle_id}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {exp.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-xs">{exp.description}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{formatINR(exp.amount)}</td>
                  <td className="py-3 px-4 text-slate-600">{exp.vendor || '—'}</td>
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    {exp.notes} {exp.recorded_by && `(${exp.recorded_by})`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(exp)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Edit expense"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteExpense && (
                      <button
                        onClick={() => setDeletingExp(exp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors ml-1"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No expenses found matching filter.</p>
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
                {editingExp ? 'Edit Expense Record' : 'Record Vehicle Expense'}
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
                  <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Tolls">Tolls (Fastag)</option>
                    <option value="Parking">Parking Fee</option>
                    <option value="Cleaning/Washing">Cleaning / Washing</option>
                    <option value="Driver Allowance">Driver Allowance</option>
                    <option value="Permits & Taxes">Permits & Taxes</option>
                    <option value="Fines">Fines / Challan</option>
                    <option value="Repairs">Repairs (Minor)</option>
                    <option value="Other">Other Operational</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Amount (INR) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 680"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Vendor / Payee</label>
                  <input
                    type="text"
                    placeholder="e.g. NHAI Fastag / Parking Booth"
                    value={formData.vendor}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Multi-axle toll plaza Dharmapuri stretch"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Receipt URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.receipt_url}
                  onChange={e => setFormData({ ...formData, receipt_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Auto-debited from ICICI Fastag account..."
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
                  {isSubmitting ? 'Saving to Sheets...' : editingExp ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingExp)}
        title="Delete Expense Record"
        message={`Are you sure you want to permanently delete this ${deletingExp?.category} expense (${formatINR(deletingExp?.amount || 0)}) from ${formatDate(deletingExp?.date || '')}? This row will also be permanently deleted from Google Sheets.`}
        isLoading={isDeleting}
        onConfirm={async () => {
          if (!deletingExp || !onDeleteExpense) return;
          try {
            setIsDeleting(true);
            await onDeleteExpense(deletingExp.expense_id);
            setDeletingExp(null);
          } finally {
            setIsDeleting(false);
          }
        }}
        onCancel={() => setDeletingExp(null)}
      />
    </div>
  );
};

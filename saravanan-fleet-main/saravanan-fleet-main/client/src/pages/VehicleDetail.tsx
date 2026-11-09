import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Fuel,
  Wrench,
  Receipt,
  FileText,
  QrCode,
  Edit,
  TrendingUp,
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Truck,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { GateStatusBadge } from '../components/GateStatusBadge';
import { QRModal } from '../components/QRModal';
import { Vehicle, Trip, FuelRecord, MaintenanceRecord, DocumentRecord, ExpenseRecord, AnalyticsSummary } from '../types';
import { api } from '../api/client';
import { formatINR, formatKM, formatDate, formatRelativeDays } from '../utils/formatters';

interface VehicleDetailProps {
  vehicleId: string;
  onBack: () => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onAddTripForVehicle: (vehicleId: string) => void;
  onAddFuelForVehicle: (vehicleId: string) => void;
  onAddMaintForVehicle: (vehicleId: string) => void;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const VehicleDetail: React.FC<VehicleDetailProps> = ({
  vehicleId,
  onBack,
  onEditVehicle,
  onAddTripForVehicle,
  onAddFuelForVehicle,
  onAddMaintForVehicle,
}) => {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fuel, setFuel] = useState<FuelRecord[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trips' | 'fuel' | 'maintenance' | 'documents' | 'expenses' | 'timeline'>('overview');

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'this_month' | 'previous_month' | 'month_year' | 'full_year' | 'custom'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [customStart, setCustomStart] = useState<string>('2026-01-01');
  const [customEnd, setCustomEnd] = useState<string>('2026-12-31');

  useEffect(() => {
    loadVehicleData();
  }, [vehicleId, filterType, selectedYear, selectedMonth, customStart, customEnd]);

  const loadVehicleData = async () => {
    try {
      setLoading(true);
      const [v, t, f, m, d, e, a] = await Promise.all([
        api.getVehicle(vehicleId),
        api.getTrips(vehicleId),
        api.getFuel(vehicleId),
        api.getMaintenance(vehicleId),
        api.getDocuments(vehicleId),
        api.getExpenses(vehicleId),
        api.getAnalytics({
          vehicleId,
          type: filterType,
          year: selectedYear,
          month: selectedMonth,
          startDate: filterType === 'custom' ? customStart : undefined,
          endDate: filterType === 'custom' ? customEnd : undefined,
        }),
      ]);
      setVehicle(v);
      setTrips(t);
      setFuel(f);
      setMaintenance(m);
      setDocuments(d);
      setExpenses(e);
      setAnalytics(a);
    } catch (err) {
      console.error('Error loading vehicle data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!vehicle) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-sm text-slate-500">Vehicle not found or loading...</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          Return to Vehicles
        </button>
      </div>
    );
  }

  // Activity Timeline generation
  const timelineEvents: { date: string; type: string; title: string; desc: string; amount?: number }[] = [
    ...trips.map(t => ({
      date: t.date,
      type: 'Trip',
      title: `${t.from} → ${t.to}`,
      desc: `${t.distance} km • ${t.remark || 'Regular run'}`,
      amount: t.amount,
    })),
    ...fuel.map(f => ({
      date: f.date,
      type: 'Fuel',
      title: `${f.litres}L ${f.fuel_type} Refill`,
      desc: `@ ${f.vendor || 'Station'} • Odo: ${f.odometer} km`,
      amount: f.amount,
    })),
    ...maintenance.map(m => ({
      date: m.service_date,
      type: 'Maintenance',
      title: m.category,
      desc: `${m.description} • Workshop: ${m.workshop}`,
      amount: m.cost,
    })),
    ...expenses.map(e => ({
      date: e.date,
      type: 'Expense',
      title: e.category,
      desc: `${e.description} • Vendor: ${e.vendor}`,
      amount: e.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      {/* Back and Vehicle Header Hero */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Fleet</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-2xs"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>QR Code</span>
          </button>
          <button
            onClick={() => onEditVehicle(vehicle)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 shadow-2xs"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Vehicle</span>
          </button>
        </div>
      </div>

      {/* Vehicle Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
          <div className="w-full sm:w-56 md:w-64 aspect-16/10 rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border border-slate-200 flex items-center justify-center">
            {vehicle.photo_url ? (
              <img
                src={vehicle.photo_url}
                alt={vehicle.vehicle_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <Truck className="w-12 h-12 mb-1.5 opacity-70 text-slate-400" />
                <span className="text-xs font-mono font-bold text-slate-200">{vehicle.registration_number}</span>
              </div>
            )}
          </div>

          <div className="flex-1 w-full">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs uppercase font-semibold text-blue-600 tracking-wider">
                  {vehicle.fuel_type} &bull; {vehicle.vehicle_type}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{vehicle.vehicle_name}</h1>
              </div>
              <StatusBadge status={vehicle.active ? 'Active' : 'Inactive'} size="md" />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-slate-900 text-white font-mono font-bold text-sm rounded-lg tracking-wider">
                {vehicle.registration_number}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Tab: <strong className="text-slate-700">{vehicle.sheet_tab_name}</strong>
              </span>
              {analytics?.latestOdometer && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-semibold bg-slate-100 px-2.5 py-1 rounded-md">
                  <Gauge className="w-3.5 h-3.5 text-blue-600" />
                  Latest Odometer: {formatKM(analytics.latestOdometer)}
                </span>
              )}
            </div>

            {vehicle.notes && (
              <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                {vehicle.notes}
              </p>
            )}

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
              <button
                onClick={() => onAddTripForVehicle(vehicle.vehicle_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Trip</span>
              </button>
              <button
                onClick={() => onAddFuelForVehicle(vehicle.vehicle_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Fuel className="w-3.5 h-3.5" />
                <span>Add Fuel</span>
              </button>
              <button
                onClick={() => onAddMaintForVehicle(vehicle.vehicle_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Log Maintenance</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Engine Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Analysis Period:</span>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {analytics?.periodLabel || 'All-time'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All-Time History</option>
              <option value="this_month">This Month</option>
              <option value="previous_month">Previous Month</option>
              <option value="month_year">Select Month & Year</option>
              <option value="full_year">Full Calendar Year</option>
              <option value="custom">Custom Date Range</option>
            </select>

            {filterType === 'month_year' && (
              <>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-medium text-slate-700"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2026, i, 1).toLocaleString('en-US', { month: 'short' })}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-medium text-slate-700"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
              </>
            )}

            {filterType === 'full_year' && (
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
              >
                <option value={2026}>Year 2026</option>
                <option value={2025}>Year 2025</option>
                <option value={2024}>Year 2024</option>
              </select>
            )}

            {filterType === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calculated KPIs for Selected Period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Distance in Period"
          value={formatKM(analytics?.totalDistance || 0)}
          subtitle={`${analytics?.completedTrips || 0} completed trips`}
          icon={MapPin}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KPICard
          title="Fuel Cost"
          value={formatINR(analytics?.totalFuelCost || 0)}
          subtitle={`${analytics?.totalFuelLitres || 0} Litres`}
          icon={Fuel}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Maintenance Cost"
          value={formatINR(analytics?.totalMaintenanceCost || 0)}
          subtitle="Repairs & routine checks"
          icon={Wrench}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KPICard
          title="Total Operating Cost"
          value={formatINR(analytics?.totalRecordedExpenditure || 0)}
          subtitle={analytics?.costPerKm ? `Avg ₹${analytics.costPerKm}/km` : 'Insufficient mileage data'}
          icon={Receipt}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Cost per KM Explanation Callout */}
      {analytics && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-600">
          <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold text-slate-800">Operational Efficiency Metric: </span>
            <span>{analytics.costPerKmExplanation}</span>
          </div>
        </div>
      )}

      {/* Vehicle Specific Charts: Monthly Distance, Operating Cost Trend, Expense Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Distance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Distance Travelled by Month</h3>
          <p className="text-xs text-slate-500 mb-4">Kilometres logged in individual trip records</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.monthlyTrends || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} km`, 'Distance']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="distance" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operating Cost Trend */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Monthly Operating Cost Trend</h3>
          <p className="text-xs text-slate-500 mb-4">Fuel vs Maintenance spending progression</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.monthlyTrends || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [formatINR(Number(val)), name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="fuelCost" name="Fuel (₹)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="maintenanceCost" name="Maintenance (₹)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabs for Detailed Tables and Activity Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50 px-2 sm:px-4 flex gap-1 overflow-x-auto">
          {[
            { id: 'trips', label: `Trips (${trips.length})`, icon: MapPin },
            { id: 'fuel', label: `Fuel Logs (${fuel.length})`, icon: Fuel },
            { id: 'maintenance', label: `Maintenance (${maintenance.length})`, icon: Wrench },
            { id: 'documents', label: `Documents (${documents.length})`, icon: FileText },
            { id: 'expenses', label: `Expenses (${expenses.length})`, icon: Receipt },
            { id: 'timeline', label: `Activity Timeline (${timelineEvents.length})`, icon: Clock },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-3 sm:p-5">
          {/* TRIPS TABLE */}
          {activeTab === 'trips' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Route</th>
                    <th className="pb-2.5">Odometer (Start / End)</th>
                    <th className="pb-2.5">Distance</th>
                    <th className="pb-2.5">Amount</th>
                    <th className="pb-2.5">Gate Status</th>
                    <th className="pb-2.5">Trip Status</th>
                    <th className="pb-2.5">Remark / Driver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trips.map(t => (
                    <tr key={t.trip_id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 font-medium text-slate-800">{formatDate(t.date)}</td>
                      <td className="py-2.5 text-slate-700">
                        {t.from} <span className="text-slate-400">→</span> {t.to}
                      </td>
                      <td className="py-2.5 text-slate-600 font-mono">
                        {t.start_km.toLocaleString('en-IN')} / {t.end_km ? t.end_km.toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="py-2.5 font-semibold text-slate-900">{formatKM(t.distance)}</td>
                      <td className="py-2.5 text-slate-800 font-medium">{formatINR(t.amount)}</td>
                      <td className="py-2.5">
                        <GateStatusBadge
                          status={t.gate_status}
                          gateOutTime={t.gate_out_time}
                          gateOutBy={t.gate_out_by}
                          gateInTime={t.gate_in_time}
                          gateInBy={t.gate_in_by}
                          showDetails={false}
                        />
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="py-2.5 text-slate-500 text-[11px]">
                        {t.remark} {t.driver && `(${t.driver})`}
                      </td>
                    </tr>
                  ))}
                  {trips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">No trips recorded for this vehicle.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* FUEL TABLE */}
          {activeTab === 'fuel' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Odometer</th>
                    <th className="pb-2.5">Litres</th>
                    <th className="pb-2.5">Amount</th>
                    <th className="pb-2.5">Vendor</th>
                    <th className="pb-2.5">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fuel.map(f => (
                    <tr key={f.fuel_id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 font-medium text-slate-800">{formatDate(f.date)}</td>
                      <td className="py-2.5 font-mono text-slate-600">{f.odometer.toLocaleString('en-IN')} km</td>
                      <td className="py-2.5 font-semibold text-slate-900">{f.litres} L</td>
                      <td className="py-2.5 font-bold text-slate-900">{formatINR(f.amount)}</td>
                      <td className="py-2.5 text-slate-600">{f.vendor || '—'}</td>
                      <td className="py-2.5 text-slate-500">{f.recorded_by}</td>
                    </tr>
                  ))}
                  {fuel.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">No fuel records logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* MAINTENANCE TABLE */}
          {activeTab === 'maintenance' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-2.5">Service Date</th>
                    <th className="pb-2.5">Category</th>
                    <th className="pb-2.5">Description</th>
                    <th className="pb-2.5">Cost</th>
                    <th className="pb-2.5">Next Due</th>
                    <th className="pb-2.5">Workshop</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {maintenance.map(m => (
                    <tr key={m.maintenance_id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 font-medium text-slate-800">{formatDate(m.service_date)}</td>
                      <td className="py-2.5 font-semibold text-slate-900">{m.category}</td>
                      <td className="py-2.5 text-slate-600 max-w-xs">{m.description}</td>
                      <td className="py-2.5 font-bold text-amber-700">{formatINR(m.cost)}</td>
                      <td className="py-2.5 text-slate-600">
                        {m.next_service_due_date ? formatDate(m.next_service_due_date) : ''}
                        {m.next_service_due_km ? ` (${m.next_service_due_km} km)` : ''}
                      </td>
                      <td className="py-2.5 text-slate-500">{m.workshop || '—'}</td>
                    </tr>
                  ))}
                  {maintenance.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">No maintenance logged for this vehicle.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* DOCUMENTS TABLE */}
          {activeTab === 'documents' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-2.5">Type</th>
                    <th className="pb-2.5">Document #</th>
                    <th className="pb-2.5">Expiry Date</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5">Issuer</th>
                    <th className="pb-2.5">Notes</th>
                    <th className="pb-2.5 text-right">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map(d => {
                    const daysRemaining = d.expiry_date
                      ? Math.ceil((new Date(d.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;
                    const statusInfo = daysRemaining !== null ? formatRelativeDays(daysRemaining) : { text: 'No Expiry' };
                    return (
                      <tr key={d.document_id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 font-bold text-slate-900">{d.document_type}</td>
                        <td className="py-2.5 font-mono text-slate-700">{d.document_number || '—'}</td>
                        <td className="py-2.5 text-slate-800 font-medium">{d.expiry_date ? formatDate(d.expiry_date) : '—'}</td>
                        <td className="py-2.5">
                          <StatusBadge status={statusInfo.text} />
                        </td>
                        <td className="py-2.5 text-slate-600">{d.issuer || '—'}</td>
                        <td className="py-2.5 text-slate-500 text-[11px]">{d.notes}</td>
                        <td className="py-2.5 text-right">
                          {d.file_url ? (
                            <a
                              href={d.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-xs"
                              title="Open in Google Drive"
                            >
                              <span>View Document</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs italic">No file</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">No compliance documents attached.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* EXPENSES TABLE */}
          {activeTab === 'expenses' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Category</th>
                    <th className="pb-2.5">Description</th>
                    <th className="pb-2.5">Amount</th>
                    <th className="pb-2.5">Vendor</th>
                    <th className="pb-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map(e => (
                    <tr key={e.expense_id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 font-medium text-slate-800">{formatDate(e.date)}</td>
                      <td className="py-2.5 font-semibold text-slate-900">{e.category}</td>
                      <td className="py-2.5 text-slate-600">{e.description}</td>
                      <td className="py-2.5 font-bold text-slate-900">{formatINR(e.amount)}</td>
                      <td className="py-2.5 text-slate-600">{e.vendor || '—'}</td>
                      <td className="py-2.5 text-slate-500 text-[11px]">{e.notes}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">No miscellaneous expenses recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timelineEvents.map((evt, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-white border-2 border-blue-600 group-hover:scale-125 transition-transform" />
                  <div className="bg-slate-50 hover:bg-blue-50/40 p-3 rounded-xl border border-slate-200/80 transition-colors">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">{evt.title}</span>
                      <span className="text-[11px] font-semibold text-slate-500">{formatDate(evt.date)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{evt.desc}</p>
                    {evt.amount && (
                      <div className="mt-2 text-xs font-semibold text-blue-700">
                        Recorded: {formatINR(evt.amount)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {timelineEvents.length === 0 && (
                <p className="text-xs text-slate-400">No activity recorded for timeline.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <QRModal vehicle={vehicle} onClose={() => setShowQRModal(false)} />
      )}
    </div>
  );
};

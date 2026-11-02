import React, { useState } from 'react';
import {
  Truck,
  MapPin,
  Fuel,
  Wrench,
  Receipt,
  AlertTriangle,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
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
import { Vehicle, Trip, AlertItem, AnalyticsSummary } from '../types';
import { formatINR, formatKM, formatDate } from '../utils/formatters';

interface DashboardProps {
  vehicles: Vehicle[];
  trips: Trip[];
  alerts: AlertItem[];
  analytics: AnalyticsSummary | null;
  onSelectVehicle: (vehicleId: string) => void;
  onNavigateTab: (tab: any) => void;
  onAddTrip: () => void;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const Dashboard: React.FC<DashboardProps> = ({
  vehicles,
  trips,
  alerts,
  analytics,
  onSelectVehicle,
  onNavigateTab,
  onAddTrip,
}) => {
  const [quickFilter, setQuickFilter] = useState<'all' | 'this_month' | 'previous_month'>('this_month');

  const activeVehicles = vehicles.filter(v => v.active);
  const unfinishedTrips = trips.filter(t => t.status === 'UNFINISHED');
  const vehiclesInUseCount = new Set(unfinishedTrips.map(t => t.vehicle_id)).size;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.dismissed);
  const expiringDocs = alerts.filter(a => (a.type === 'DOC_EXPIRING_SOON' || a.type === 'DOC_EXPIRED') && !a.dismissed);
  const dueServices = alerts.filter(a => (a.type.startsWith('SERVICE_')) && !a.dismissed);

  // Available vehicles = active minus currently in use
  const availableVehiclesCount = Math.max(0, activeVehicles.length - vehiclesInUseCount);

  const monthlyTrends = analytics?.monthlyTrends || [];
  const categoryBreakdown = analytics?.categoryBreakdown || [];
  const vehicleComparisons = analytics?.vehicleComparisons || [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              Live Fleet Intelligence
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">Saravanan Electricals & Engineering</h2>
            <p className="text-slate-300 text-xs mt-1 max-w-xl">
              Enterprise fleet operations, continuous odometer tracking, automatic statutory compliance, and Google Sheets bidirectional synchronization.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddTrip}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <MapPin className="w-4 h-4" />
              <span>Log Trip</span>
            </button>
            <button
              onClick={() => onNavigateTab('reports')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs backdrop-blur-xs transition-all active:scale-95"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Primary Fleet Status KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Active Vehicles"
          value={activeVehicles.length}
          subtitle={`${availableVehiclesCount} available for dispatch`}
          icon={Truck}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          onClick={() => onNavigateTab('vehicles')}
        />
        <KPICard
          title="Vehicles in Transit"
          value={vehiclesInUseCount}
          subtitle={`${unfinishedTrips.length} active trip${unfinishedTrips.length === 1 ? '' : 's'}`}
          icon={Clock}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          onClick={() => onNavigateTab('trips')}
        />
        <KPICard
          title="Critical Alerts"
          value={criticalAlerts.length}
          subtitle={`${expiringDocs.length} compliance doc issues`}
          icon={AlertTriangle}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
          onClick={() => onNavigateTab('alerts')}
        />
        <KPICard
          title="Upcoming Services"
          value={dueServices.length}
          subtitle="Routine maintenance due"
          icon={Wrench}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
          onClick={() => onNavigateTab('alerts')}
        />
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Recorded Distance"
          value={formatKM(analytics?.totalDistance || 0)}
          subtitle={`${analytics?.totalTrips || 0} total trips logged`}
          icon={MapPin}
          iconBgColor="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <KPICard
          title="Fuel Expenditure"
          value={formatINR(analytics?.totalFuelCost || 0)}
          subtitle={`${(analytics?.totalFuelLitres || 0).toLocaleString('en-IN')} L consumed`}
          icon={Fuel}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Maintenance Cost"
          value={formatINR(analytics?.totalMaintenanceCost || 0)}
          subtitle="Repairs, tyres & service"
          icon={Wrench}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KPICard
          title="Total Operating Cost"
          value={formatINR(analytics?.totalRecordedExpenditure || 0)}
          subtitle={analytics?.costPerKm ? `Avg ₹${analytics.costPerKm}/km` : 'All recorded categories'}
          icon={Receipt}
          iconBgColor="bg-slate-100"
          iconColor="text-slate-800"
        />
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Distance & Trips Chart */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Monthly Fleet Distance (KM)</h3>
              <p className="text-xs text-slate-500">Distance trend across all vehicles</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">Kilometres</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString('en-IN')} km`, 'Distance']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="distance" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Expenditure Bar Chart */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Monthly Expenditure Breakdown (INR)</h3>
              <p className="text-xs text-slate-500">Fuel, maintenance, and other expenses</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">Cost in ₹</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [formatINR(Number(val)), name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="fuelCost" name="Fuel" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maintenanceCost" name="Maintenance" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="otherExpenseCost" name="Other Exp" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cost Comparison by Vehicle & Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle-wise spending */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Vehicle Cost & Usage Comparison</h3>
              <p className="text-xs text-slate-500">Top operational spending across current fleet</p>
            </div>
            <button
              onClick={() => onNavigateTab('analytics')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleComparisons.slice(0, 7)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis dataKey="vehicle_name" type="category" tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 500 }} width={90} />
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val)), 'Total Cost']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="totalCost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Category Pie */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col">
          <h3 className="text-sm font-bold text-slate-800">Operating Cost Distribution</h3>
          <p className="text-xs text-slate-500 mb-2">Category-wise share of fleet expenditure</p>
          <div className="h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {categoryBreakdown.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [formatINR(Number(val)), 'Amount']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-3">
            {categoryBreakdown.map((cat, idx) => (
              <div key={cat.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-600 font-medium truncate max-w-[120px]">{cat.category}</span>
                </div>
                <div className="font-semibold text-slate-900">{cat.percentage}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fleet Vehicles Quick Overview Grid */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Fleet Roster ({vehicles.length} Vehicles)</h3>
            <p className="text-xs text-slate-500">Click any vehicle to open its comprehensive individual analytics page</p>
          </div>
          <button
            onClick={() => onNavigateTab('vehicles')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Manage All Vehicles</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {vehicles.map(v => {
            const hasUnfinished = unfinishedTrips.some(t => t.vehicle_id === v.vehicle_id);
            return (
              <div
                key={v.vehicle_id}
                onClick={() => onSelectVehicle(v.vehicle_id)}
                className="group relative bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl p-3 cursor-pointer transition-all duration-150 flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-16/10 rounded-lg overflow-hidden bg-slate-900 mb-2.5 relative flex items-center justify-center">
                    {v.photo_url ? (
                      <img
                        src={v.photo_url}
                        alt={v.vehicle_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-400 transition-colors p-2 text-center">
                        <Truck className="w-6 h-6 mb-0.5 opacity-80" />
                        <span className="text-[9px] font-mono text-slate-300 font-semibold">{v.registration_number}</span>
                      </div>
                    )}
                    {hasUnfinished && (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-sm shadow-xs animate-pulse">
                        In Transit
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                    {v.vehicle_name}
                  </h4>
                  <p className="text-[11px] font-mono font-semibold text-slate-500">{v.registration_number}</p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="capitalize">{v.fuel_type}</span>
                  <StatusBadge status={v.active ? 'Active' : 'Inactive'} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

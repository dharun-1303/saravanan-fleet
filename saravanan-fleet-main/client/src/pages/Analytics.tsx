import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Filter,
  TrendingUp,
  MapPin,
  Fuel,
  Wrench,
  Receipt,
  Truck,
  ArrowRight,
  Info,
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
import { Vehicle, AnalyticsSummary } from '../types';
import { api } from '../api/client';
import { formatINR, formatKM } from '../utils/formatters';

interface AnalyticsProps {
  vehicles: Vehicle[];
  onSelectVehicle: (vehicleId: string) => void;
  onExportCSV: () => void;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const AnalyticsPage: React.FC<AnalyticsProps> = ({
  vehicles,
  onSelectVehicle,
  onExportCSV,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'this_month' | 'previous_month' | 'month_year' | 'full_year' | 'custom'>('full_year');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10);
  const [customStart, setCustomStart] = useState<string>('2026-01-01');
  const [customEnd, setCustomEnd] = useState<string>('2026-12-31');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [filterType, selectedYear, selectedMonth, customStart, customEnd]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await api.getAnalytics({
        type: filterType,
        year: selectedYear,
        month: selectedMonth,
        startDate: filterType === 'custom' ? customStart : undefined,
        endDate: filterType === 'custom' ? customEnd : undefined,
      });
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const monthlyTrends = analytics?.monthlyTrends || [];
  const categoryBreakdown = analytics?.categoryBreakdown || [];
  const comparisons = analytics?.vehicleComparisons || [];

  return (
    <div className="space-y-6">
      {/* Filter and Period Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Fleet Operations & Cost Analytics</h2>
          </div>
          <p className="text-xs text-slate-500">
            Multi-vehicle comparative metrics, monthly trends, and cost efficiency evaluations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 shadow-2xs"
          >
            <option value="full_year">Full Calendar Year</option>
            <option value="this_month">This Month</option>
            <option value="previous_month">Previous Month</option>
            <option value="month_year">Select Month & Year</option>
            <option value="custom">Custom Date Range</option>
            <option value="all">All-Time History</option>
          </select>

          {filterType === 'month_year' && (
            <>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 shadow-2xs"
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
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 shadow-2xs"
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
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-700 shadow-2xs"
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

          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Analytics CSV</span>
          </button>
        </div>
      </div>

      {/* Aggregate Metrics in Period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Fleet Distance"
          value={formatKM(analytics?.totalDistance || 0)}
          subtitle={`${analytics?.totalTrips || 0} trips logged`}
          icon={MapPin}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KPICard
          title="Fleet Fuel Spend"
          value={formatINR(analytics?.totalFuelCost || 0)}
          subtitle={`${(analytics?.totalFuelLitres || 0).toLocaleString('en-IN')} Litres`}
          icon={Fuel}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <KPICard
          title="Fleet Maintenance Spend"
          value={formatINR(analytics?.totalMaintenanceCost || 0)}
          subtitle="All workshop & part charges"
          icon={Wrench}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KPICard
          title="Total Recorded Expenses"
          value={formatINR(analytics?.totalRecordedExpenditure || 0)}
          subtitle={analytics?.costPerKm ? `Avg ₹${analytics.costPerKm}/km across fleet` : 'In complete categories'}
          icon={Receipt}
          iconBgColor="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* Monthly Fleet Distance & Cost Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Fleet Monthly Distance & Trips</h3>
          <p className="text-xs text-slate-500 mb-4">Total kilometres logged month by month</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name: any) => [name === 'distance' ? `${val} km` : val, name]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="distance" name="Distance (KM)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="tripCount" name="Trips Count" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-1">Fleet Monthly Expenditure</h3>
          <p className="text-xs text-slate-500 mb-4">Monthly comparison of fuel, maintenance and other expenses</p>
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
                <Bar dataKey="fuelCost" name="Fuel" fill="#2563eb" stackId="a" />
                <Bar dataKey="maintenanceCost" name="Maintenance" fill="#f59e0b" stackId="a" />
                <Bar dataKey="otherExpenseCost" name="Other Exp" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Ranked Vehicles: Most Used & High Maintenance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most-Used Vehicles */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">Most-Used Vehicles (by Distance)</h3>
            <span className="text-[11px] font-semibold text-slate-500">Kilometres Travelled</span>
          </div>
          <div className="space-y-3">
            {analytics?.mostUsedVehicles?.map((v, idx) => (
              <div
                key={v.vehicle_id}
                onClick={() => onSelectVehicle(v.vehicle_id)}
                className="p-3 bg-slate-50 hover:bg-blue-50/60 rounded-xl border border-slate-200/80 cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{v.vehicle_name}</h4>
                    <span className="text-[11px] font-mono text-slate-500">{v.registration_number}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 text-xs">{formatKM(v.distance)}</div>
                  <span className="text-[10px] text-blue-600 font-medium">View History →</span>
                </div>
              </div>
            ))}
            {(!analytics?.mostUsedVehicles || analytics.mostUsedVehicles.length === 0) && (
              <p className="text-xs text-slate-400 py-4 text-center">No distance records in selected period.</p>
            )}
          </div>
        </div>

        {/* High Maintenance Vehicles */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">Highest Maintenance Incurred</h3>
            <span className="text-[11px] font-semibold text-slate-500">Repair Spending</span>
          </div>
          <div className="space-y-3">
            {analytics?.highMaintenanceVehicles?.map((v, idx) => (
              <div
                key={v.vehicle_id}
                onClick={() => onSelectVehicle(v.vehicle_id)}
                className="p-3 bg-slate-50 hover:bg-amber-50/60 rounded-xl border border-slate-200/80 cursor-pointer flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{v.vehicle_name}</h4>
                    <span className="text-[11px] font-mono text-slate-500">{v.registration_number}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-amber-800 text-xs">{formatINR(v.maintenanceCost)}</div>
                  <span className="text-[10px] text-amber-700 font-medium">View Garage Logs →</span>
                </div>
              </div>
            ))}
            {(!analytics?.highMaintenanceVehicles || analytics.highMaintenanceVehicles.length === 0) && (
              <p className="text-xs text-slate-400 py-4 text-center">No maintenance spending recorded in this period.</p>
            )}
          </div>
        </div>
      </div>

      {/* Comprehensive Vehicle Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Fleet Vehicle Operational Comparison Table</h3>
            <p className="text-xs text-slate-500">Cross-vehicle metrics for selected period</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Vehicle</th>
                <th className="py-3 px-4">Registration</th>
                <th className="py-3 px-4">Distance</th>
                <th className="py-3 px-4">Trips</th>
                <th className="py-3 px-4">Fuel (₹)</th>
                <th className="py-3 px-4">Maintenance (₹)</th>
                <th className="py-3 px-4">Other (₹)</th>
                <th className="py-3 px-4">Total Cost</th>
                <th className="py-3 px-4">Cost / KM</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisons.map(vc => (
                <tr key={vc.vehicle_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{vc.vehicle_name}</td>
                  <td className="py-3 px-4 font-mono font-medium text-blue-700">{vc.registration_number}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">{formatKM(vc.distance)}</td>
                  <td className="py-3 px-4 text-slate-700">{vc.tripCount}</td>
                  <td className="py-3 px-4 text-slate-800">{formatINR(vc.fuelCost)}</td>
                  <td className="py-3 px-4 text-slate-800">{formatINR(vc.maintenanceCost)}</td>
                  <td className="py-3 px-4 text-slate-800">{formatINR(vc.otherExpenseCost)}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{formatINR(vc.totalCost)}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">
                    {vc.costPerKm ? `₹${vc.costPerKm}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onSelectVehicle(vc.vehicle_id)}
                      className="text-blue-600 hover:text-blue-700 font-semibold text-xs flex items-center gap-1 ml-auto"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

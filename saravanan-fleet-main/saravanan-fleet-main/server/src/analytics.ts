import { Vehicle, Trip, FuelRecord, MaintenanceRecord, DocumentRecord, ExpenseRecord } from './types/index.js';

export interface DateFilter {
  type: 'all' | 'this_month' | 'previous_month' | 'month_year' | 'full_year' | 'custom';
  year?: number;
  month?: number; // 1 - 12
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface MonthlyAggregate {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. Oct 2026
  distance: number;
  tripCount: number;
  fuelCost: number;
  fuelLitres: number;
  maintenanceCost: number;
  otherExpenseCost: number;
  totalCost: number;
}

export interface VehicleComparison {
  vehicle_id: string;
  vehicle_name: string;
  registration_number: string;
  distance: number;
  fuelCost: number;
  maintenanceCost: number;
  otherExpenseCost: number;
  totalCost: number;
  costPerKm: number | null;
  tripCount: number;
}

export interface AnalyticsSummary {
  periodLabel: string;
  totalDistance: number;
  totalTrips: number;
  completedTrips: number;
  unfinishedTrips: number;
  totalFuelCost: number;
  totalFuelLitres: number;
  totalMaintenanceCost: number;
  totalTripExpenseCost: number;
  totalOtherExpenseCost: number;
  totalRecordedExpenditure: number;
  costPerKm: number | null;
  costPerKmReliable: boolean;
  costPerKmExplanation: string;
  coverageNote: string;
  latestOdometer: number | null;
  monthlyTrends: MonthlyAggregate[];
  categoryBreakdown: { category: string; amount: number; percentage: number }[];
  vehicleComparisons?: VehicleComparison[];
  highMaintenanceVehicles?: { vehicle_id: string; vehicle_name: string; registration_number: string; maintenanceCost: number }[];
  mostUsedVehicles?: { vehicle_id: string; vehicle_name: string; registration_number: string; distance: number }[];
}

export function parseDateFlexible(val: any): Date | null {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  if (!s) return null;

  // Check if it's a numeric Excel serial date, e.g. "45230"
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + serial * 86400000);
    if (!isNaN(d.getTime())) return d;
  }

  // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(.*)$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(.*)$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Standard fallback
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

export class AnalyticsEngine {
  public static isDateInFilter(dateStr: string, filter: DateFilter): boolean {
    if (!dateStr || filter.type === 'all') return true;
    const date = parseDateFlexible(dateStr);
    if (!date || isNaN(date.getTime())) return false;

    const y = date.getFullYear();
    const m = date.getMonth() + 1; // 1-12

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    switch (filter.type) {
      case 'this_month':
        return y === currentYear && m === currentMonth;
      case 'previous_month': {
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        return y === prevYear && m === prevMonth;
      }
      case 'month_year':
        return (!filter.year || y === filter.year) && (!filter.month || m === filter.month);
      case 'full_year':
        return filter.year ? y === filter.year : y === currentYear;
      case 'custom': {
        if (!filter.startDate && !filter.endDate) return true;
        const targetTime = date.getTime();
        const start = filter.startDate ? (parseDateFlexible(filter.startDate)?.getTime() ?? -Infinity) : -Infinity;
        const end = filter.endDate ? ((parseDateFlexible(filter.endDate)?.getTime() ?? Infinity) + 86400000 - 1) : Infinity;
        return targetTime >= start && targetTime <= end;
      }
      default:
        return true;
    }
  }

  public static getPeriodLabel(filter: DateFilter): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    switch (filter.type) {
      case 'this_month':
        return `${months[now.getMonth()]} ${now.getFullYear()}`;
      case 'previous_month': {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        return `${months[prevMonth]} ${prevYear}`;
      }
      case 'month_year':
        return `${months[(filter.month || 1) - 1]} ${filter.year || now.getFullYear()}`;
      case 'full_year':
        return `Year ${filter.year || now.getFullYear()}`;
      case 'custom':
        return `${filter.startDate || 'Beginning'} to ${filter.endDate || 'Present'}`;
      case 'all':
      default:
        return 'All Time History';
    }
  }

  public static calculateAnalytics(params: {
    vehicles: Vehicle[];
    trips: Trip[];
    fuel: FuelRecord[];
    maintenance: MaintenanceRecord[];
    expenses: ExpenseRecord[];
    filter: DateFilter;
    targetVehicleId?: string;
  }): AnalyticsSummary {
    const { vehicles, trips, fuel, maintenance, expenses, filter, targetVehicleId } = params;

    // Filter vehicles
    const scopedVehicles = targetVehicleId 
      ? vehicles.filter(v => v.vehicle_id === targetVehicleId)
      : vehicles;

    const scopedVehicleIds = new Set(scopedVehicles.map(v => v.vehicle_id));

    // Filter records by date and vehicle scope
    const filteredTrips = trips.filter(t => scopedVehicleIds.has(t.vehicle_id) && this.isDateInFilter(t.date, filter));
    const filteredFuel = fuel.filter(f => scopedVehicleIds.has(f.vehicle_id) && this.isDateInFilter(f.date, filter));
    const filteredMaint = maintenance.filter(m => scopedVehicleIds.has(m.vehicle_id) && this.isDateInFilter(m.service_date, filter));
    const filteredExpenses = expenses.filter(e => scopedVehicleIds.has(e.vehicle_id) && this.isDateInFilter(e.date, filter));

    // Calculate core metrics
    const totalDistance = filteredTrips.reduce((acc, t) => acc + (t.distance || 0), 0);
    const totalTrips = filteredTrips.length;
    const completedTrips = filteredTrips.filter(t => t.status === 'COMPLETED').length;
    const unfinishedTrips = filteredTrips.filter(t => t.status === 'UNFINISHED').length;

    const totalFuelCost = filteredFuel.reduce((acc, f) => acc + (f.amount || 0), 0);
    const totalFuelLitres = filteredFuel.reduce((acc, f) => acc + (f.litres || 0), 0);
    const totalMaintenanceCost = filteredMaint.reduce((acc, m) => acc + (m.cost || 0), 0);
    // Trip amounts (tolls, driver allowances, etc.) are treated as a separate expense category
    const totalTripExpenseCost = filteredTrips.reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalOtherExpenseCost = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalRecordedExpenditure = totalFuelCost + totalMaintenanceCost + totalTripExpenseCost + totalOtherExpenseCost;

    // Cost per km calculation
    let costPerKm: number | null = null;
    let costPerKmReliable = false;
    let costPerKmExplanation = '';

    if (totalDistance > 0 && totalRecordedExpenditure > 0) {
      costPerKm = parseFloat((totalRecordedExpenditure / totalDistance).toFixed(2));
      costPerKmReliable = totalFuelCost > 0;
      costPerKmExplanation = costPerKmReliable
        ? `₹${costPerKm}/km based on ₹${totalRecordedExpenditure.toLocaleString('en-IN')} total recorded cost across ${totalDistance.toLocaleString('en-IN')} km.`
        : `₹${costPerKm}/km calculated without recorded fuel data for this exact interval. May underestimate operating cost.`;
    } else if (totalDistance === 0 && totalRecordedExpenditure > 0) {
      costPerKmExplanation = 'No distance recorded in this period, but maintenance/expenses occurred.';
    } else {
      costPerKmExplanation = 'Insufficient distance or cost records in selected timeframe.';
    }

    // Determine latest odometer reading for single vehicle
    let latestOdometer: number | null = null;
    if (targetVehicleId) {
      const allVehicleTrips = trips.filter(t => t.vehicle_id === targetVehicleId);
      const allVehicleFuel = fuel.filter(f => f.vehicle_id === targetVehicleId);
      const allVehicleMaint = maintenance.filter(m => m.vehicle_id === targetVehicleId);

      const tripMaxKm = Math.max(...allVehicleTrips.map(t => t.end_km || t.start_km || 0), 0);
      const fuelMaxKm = Math.max(...allVehicleFuel.map(f => f.odometer || 0), 0);
      const maintMaxKm = Math.max(...allVehicleMaint.map(m => m.odometer || 0), 0);

      const maxKm = Math.max(tripMaxKm, fuelMaxKm, maintMaxKm);
      latestOdometer = maxKm > 0 ? maxKm : null;
    }

    // Aggregate monthly trends
    const monthMap = new Map<string, MonthlyAggregate>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const getOrCreateMonth = (dateStr: string) => {
      const d = parseDateFlexible(dateStr);
      if (!d || isNaN(d.getTime())) return null;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          monthKey: key,
          monthLabel: `${months[d.getMonth()]} ${d.getFullYear()}`,
          distance: 0,
          tripCount: 0,
          fuelCost: 0,
          fuelLitres: 0,
          maintenanceCost: 0,
          otherExpenseCost: 0,
          totalCost: 0,
        });
      }
      return monthMap.get(key)!;
    };

    filteredTrips.forEach(t => {
      const m = getOrCreateMonth(t.date);
      if (m) {
        m.distance += t.distance || 0;
        m.tripCount += 1;
        if (t.amount && t.amount > 0) {
          m.otherExpenseCost += t.amount;
          m.totalCost += t.amount;
        }
      }
    });

    filteredFuel.forEach(f => {
      const m = getOrCreateMonth(f.date);
      if (m) {
        m.fuelCost += f.amount || 0;
        m.fuelLitres += f.litres || 0;
        m.totalCost += f.amount || 0;
      }
    });

    filteredMaint.forEach(mt => {
      const m = getOrCreateMonth(mt.service_date);
      if (m) {
        m.maintenanceCost += mt.cost || 0;
        m.totalCost += mt.cost || 0;
      }
    });

    filteredExpenses.forEach(e => {
      const m = getOrCreateMonth(e.date);
      if (m) {
        m.otherExpenseCost += e.amount || 0;
        m.totalCost += e.amount || 0;
      }
    });

    const monthlyTrends = Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Category breakdown
    const categoryBreakdown: { category: string; amount: number; percentage: number }[] = [];
    if (totalRecordedExpenditure > 0) {
      if (totalFuelCost > 0) {
        categoryBreakdown.push({
          category: 'Fuel',
          amount: totalFuelCost,
          percentage: parseFloat(((totalFuelCost / totalRecordedExpenditure) * 100).toFixed(1)),
        });
      }
      if (totalMaintenanceCost > 0) {
        categoryBreakdown.push({
          category: 'Maintenance & Repairs',
          amount: totalMaintenanceCost,
          percentage: parseFloat(((totalMaintenanceCost / totalRecordedExpenditure) * 100).toFixed(1)),
        });
      }
      if (totalTripExpenseCost > 0) {
        categoryBreakdown.push({
          category: 'Trip Expenses',
          amount: totalTripExpenseCost,
          percentage: parseFloat(((totalTripExpenseCost / totalRecordedExpenditure) * 100).toFixed(1)),
        });
      }
      const subCategories: Record<string, number> = {};
      filteredExpenses.forEach(e => {
        subCategories[e.category] = (subCategories[e.category] || 0) + e.amount;
      });
      for (const [cat, amt] of Object.entries(subCategories)) {
        categoryBreakdown.push({
          category: cat,
          amount: amt,
          percentage: parseFloat(((amt / totalRecordedExpenditure) * 100).toFixed(1)),
        });
      }
    }

    // Vehicle comparison for fleet view
    let vehicleComparisons: VehicleComparison[] | undefined;
    let highMaintenanceVehicles: { vehicle_id: string; vehicle_name: string; registration_number: string; maintenanceCost: number }[] | undefined;
    let mostUsedVehicles: { vehicle_id: string; vehicle_name: string; registration_number: string; distance: number }[] | undefined;

    if (!targetVehicleId) {
      vehicleComparisons = scopedVehicles.map(v => {
        const vTrips = filteredTrips.filter(t => t.vehicle_id === v.vehicle_id);
        const vFuel = filteredFuel.filter(f => f.vehicle_id === v.vehicle_id);
        const vMaint = filteredMaint.filter(m => m.vehicle_id === v.vehicle_id);
        const vExp = filteredExpenses.filter(e => e.vehicle_id === v.vehicle_id);

        const dist = vTrips.reduce((acc, t) => acc + (t.distance || 0), 0);
        const fCost = vFuel.reduce((acc, f) => acc + (f.amount || 0), 0);
        const mCost = vMaint.reduce((acc, m) => acc + (m.cost || 0), 0);
        const tExpCost = vTrips.reduce((acc, t) => acc + (t.amount || 0), 0);
        const oCost = vExp.reduce((acc, e) => acc + (e.amount || 0), 0);
        const tCost = fCost + mCost + tExpCost + oCost;
        const cPerKm = dist > 0 && tCost > 0 ? parseFloat((tCost / dist).toFixed(2)) : null;

        return {
          vehicle_id: v.vehicle_id,
          vehicle_name: v.vehicle_name,
          registration_number: v.registration_number,
          distance: dist,
          fuelCost: fCost,
          maintenanceCost: mCost,
          otherExpenseCost: oCost,
          totalCost: tCost,
          costPerKm: cPerKm,
          tripCount: vTrips.length,
        };
      });

      // Sorted ranking
      mostUsedVehicles = [...vehicleComparisons]
        .sort((a, b) => b.distance - a.distance)
        .slice(0, 5)
        .map(v => ({
          vehicle_id: v.vehicle_id,
          vehicle_name: v.vehicle_name,
          registration_number: v.registration_number,
          distance: v.distance,
        }));

      highMaintenanceVehicles = [...vehicleComparisons]
        .filter(v => v.maintenanceCost > 0)
        .sort((a, b) => b.maintenanceCost - a.maintenanceCost)
        .slice(0, 5)
        .map(v => ({
          vehicle_id: v.vehicle_id,
          vehicle_name: v.vehicle_name,
          registration_number: v.registration_number,
          maintenanceCost: v.maintenanceCost,
        }));
    }

    const coverageNote = 'Coverage includes recorded trips, fuel logs, maintenance invoices and miscellaneous operational expenses within the active timeframe.';

    return {
      periodLabel: this.getPeriodLabel(filter),
      totalDistance,
      totalTrips,
      completedTrips,
      unfinishedTrips,
      totalFuelCost,
      totalFuelLitres,
      totalMaintenanceCost,
      totalTripExpenseCost,
      totalOtherExpenseCost,
      totalRecordedExpenditure,
      costPerKm,
      costPerKmReliable,
      costPerKmExplanation,
      coverageNote,
      latestOdometer,
      monthlyTrends,
      categoryBreakdown,
      vehicleComparisons,
      highMaintenanceVehicles,
      mostUsedVehicles,
    };
  }
}

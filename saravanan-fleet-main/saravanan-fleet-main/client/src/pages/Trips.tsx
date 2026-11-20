import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  X,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Clock,
  LogOut,
  Calendar,
  User,
} from 'lucide-react';
import { Trip, Vehicle, GateStatus, AuthUser, ROLE_PERMISSIONS } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { GateStatusBadge } from '../components/GateStatusBadge';
import { GateOutModal, GateInModal } from '../components/GateModals';
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
  currentUser?: AuthUser | null;
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
  currentUser,
}) => {
  const userRole = currentUser?.role || 'super_admin';
  const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.super_admin;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'pending_gate' | 'dispatched' | 'completed'>(
    userRole === 'security_gate' ? 'pending_gate' : 'all'
  );

  useEffect(() => {
    if (userRole === 'security_gate') {
      setActiveTab('pending_gate');
    }
  }, [userRole]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [isCloseActiveTripMode, setIsCloseActiveTripMode] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Focus input refs
  const endKmInputRef = useRef<HTMLInputElement>(null);
  const startKmInputRef = useRef<HTMLInputElement>(null);

  // Security Gate Action Modals
  const [gateOutTrip, setGateOutTrip] = useState<Trip | null>(null);
  const [gateInTrip, setGateInTrip] = useState<Trip | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    vehicle_id: vehicles[0]?.vehicle_id || '',
    date: new Date().toISOString().split('T')[0],
    from: '',
    to: '',
    has_enroute: 'No' as 'No' | 'Yes',
    enroute: '',
    start_km: '',
    end_km: '',
    remark: '',
    amount: '',
    driver: '',
    employee: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const vehicleMap = useMemo(
    () => new Map(vehicles.map(v => [v.vehicle_id, `${v.vehicle_name} (${v.registration_number})`])),
    [vehicles]
  );

  const vehicleObjectMap = useMemo(
    () => new Map(vehicles.map(v => [v.vehicle_id, v])),
    [vehicles]
  );

  // Driver/Role-accessible trips calculation
  const roleTrips = useMemo(() => {
    if (userRole !== 'driver') {
      return trips;
    }

    const rawDriverName = (
      currentUser?.driverName ||
      (currentUser?.name && !currentUser.name.includes('(QR Scan)') && !currentUser.name.toLowerCase().includes('fleet driver') ? currentUser.name : '') ||
      ''
    ).trim().toLowerCase();

    const isGenericOrQRSession = Boolean(
      currentUser?.canBypassQR ||
      !rawDriverName ||
      currentUser?.name.includes('QR Scan') ||
      currentUser?.name.toLowerCase().includes('fleet driver')
    );

    return trips.filter(t => {
      // 1. All active/open trips (PENDING_EXIT, IN_TRANSIT, DISPATCHED, or missing end_km)
      const hasNoEndKm =
        t.end_km === null ||
        t.end_km === undefined ||
        String(t.end_km).trim() === '' ||
        isNaN(Number(t.end_km));
      const isOpenGate =
        t.gate_status === 'PENDING_EXIT' ||
        t.gate_status === 'DISPATCHED' ||
        t.gate_status === 'PENDING_ENTRY';
      const isOpenStatus =
        t.status === 'IN_TRANSIT' ||
        t.status === 'UNFINISHED' ||
        (t.trip_status as string) === 'IN_TRANSIT' ||
        (t.trip_status as string) === 'PENDING_EXIT';
      const isNotCompleted =
        t.status !== 'COMPLETED' &&
        t.gate_status !== 'COMPLETED' &&
        t.trip_status !== 'COMPLETED';

      const isActiveOpen = (hasNoEndKm || isOpenGate || isOpenStatus) && isNotCompleted;
      if (isActiveOpen) return true;

      // 2. Do not hide trips if trip.driver is empty, '-', or '—'
      const cleanDriver = (t.driver || '').trim().toLowerCase();
      if (!cleanDriver || cleanDriver === '-' || cleanDriver === '—' || cleanDriver === 'unassigned') {
        return true;
      }

      // 3. Do not hide trips if generic or QR scan session (display recent trips)
      if (isGenericOrQRSession) {
        return true;
      }

      // 4. Trips matching the logged-in driver's name (case-insensitive trim match)
      if (rawDriverName && (cleanDriver === rawDriverName || cleanDriver.includes(rawDriverName) || rawDriverName.includes(cleanDriver))) {
        return true;
      }

      // 5. Scanned vehicle trips
      if (preselectedVehicleId && t.vehicle_id === preselectedVehicleId) {
        return true;
      }

      return false;
    });
  }, [trips, userRole, currentUser, preselectedVehicleId]);

  // Base trips scoped by role and selected vehicle dropdown
  const baseTrips = useMemo(() => {
    if (selectedVehicle === 'all') return roleTrips;
    return roleTrips.filter(t => t.vehicle_id === selectedVehicle);
  }, [roleTrips, selectedVehicle]);

  const allTripsCount = baseTrips.length;

  const pendingGateCount = useMemo(
    () =>
      baseTrips.filter(
        t =>
          t.gate_status === 'PENDING_EXIT' ||
          t.gate_status === 'PENDING_ENTRY' ||
          (!t.gate_status && t.status !== 'COMPLETED')
      ).length,
    [baseTrips]
  );

  const inTransitCount = useMemo(
    () =>
      baseTrips.filter(
        t =>
          t.gate_status === 'DISPATCHED' ||
          t.status === 'IN_TRANSIT' ||
          (t.status === 'UNFINISHED' && t.gate_status !== 'PENDING_EXIT' && t.gate_status !== 'PENDING_ENTRY')
      ).length,
    [baseTrips]
  );

  const completedCount = useMemo(
    () => baseTrips.filter(t => t.status === 'COMPLETED' || t.gate_status === 'COMPLETED').length,
    [baseTrips]
  );

  // Auto-focus End KM when Close Active Trip opens, or Start KM when Log New Trip opens
  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => {
        if (isCloseActiveTripMode) {
          endKmInputRef.current?.focus();
          endKmInputRef.current?.select();
        } else {
          startKmInputRef.current?.focus();
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, isCloseActiveTripMode]);

  // Auto-open Add Trip / Close Active Trip modal when arriving from QR scan or Vehicle page action
  useEffect(() => {
    if (preselectedVehicleId && vehicles.length > 0) {
      const clean = preselectedVehicleId.trim().toLowerCase();
      const cleanNoSpace = clean.replace(/[\s\-_]/g, '');
      const matched = vehicles.find(v => {
        const vid = (v.vehicle_id || '').toLowerCase();
        const reg = (v.registration_number || '').toLowerCase();
        const name = (v.vehicle_name || '').toLowerCase();
        const tab = (v.sheet_tab_name || '').toLowerCase();
        return (
          vid === clean ||
          reg === clean ||
          name === clean ||
          tab === clean ||
          vid.replace(/[\s\-_]/g, '') === cleanNoSpace ||
          reg.replace(/[\s\-_]/g, '') === cleanNoSpace ||
          name.replace(/[\s\-_]/g, '') === cleanNoSpace ||
          tab.replace(/[\s\-_]/g, '') === cleanNoSpace
        );
      });
      const targetVehicleId = matched ? matched.vehicle_id : preselectedVehicleId;

      // 1. Active Trip Detection on QR Scan:
      // Look up existing trips for that specific vehicle where end_km is empty/null OR trip_status is 'IN_TRANSIT' / 'PENDING_EXIT' (i.e., not 'COMPLETED')
      const activeTrips = trips.filter(t => {
        const matchesVehicle =
          t.vehicle_id === targetVehicleId ||
          t.vehicle_id === preselectedVehicleId ||
          (matched && (
            t.vehicle_id.toLowerCase() === matched.vehicle_id.toLowerCase() ||
            t.vehicle_id.toLowerCase() === matched.registration_number.toLowerCase() ||
            t.vehicle_id.toLowerCase().replace(/[\s\-_]/g, '') === cleanNoSpace
          ));
        if (!matchesVehicle) return false;

        const hasNoEndKm =
          t.end_km === null ||
          t.end_km === undefined ||
          String(t.end_km).trim() === '' ||
          isNaN(Number(t.end_km));
        const isTripStatusActive =
          t.trip_status === 'IN_TRANSIT' ||
          (t.trip_status as string) === 'PENDING_EXIT' ||
          t.gate_status === 'PENDING_EXIT' ||
          t.gate_status === 'DISPATCHED' ||
          t.status === 'IN_TRANSIT' ||
          t.status === 'UNFINISHED';
        const isNotCompleted =
          t.trip_status !== 'COMPLETED' &&
          t.status !== 'COMPLETED' &&
          t.gate_status !== 'COMPLETED';

        return (hasNoEndKm || isTripStatusActive) && isNotCompleted;
      });

      const activeTrip = activeTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (activeTrip) {
        // Scenario A: Active Trip Found (Second Scan — End Trip)
        setEditingTrip(activeTrip);
        setIsCloseActiveTripMode(true);
        setFormData({
          vehicle_id: activeTrip.vehicle_id,
          date: activeTrip.date,
          from: activeTrip.from || '',
          to: activeTrip.to || '',
          has_enroute: activeTrip.enroute && activeTrip.enroute.trim() ? 'Yes' : 'No',
          enroute: activeTrip.enroute || '',
          start_km: activeTrip.start_km.toString(),
          end_km: activeTrip.end_km !== null && activeTrip.end_km !== undefined ? activeTrip.end_km.toString() : '',
          remark: activeTrip.remark || '',
          amount: activeTrip.amount ? activeTrip.amount.toString() : '',
          driver: activeTrip.driver || '',
          employee: activeTrip.employee || '',
        });
        setSelectedVehicle(targetVehicleId);
        setFormError(null);
        setIsModalOpen(true);
        onPreselectedConsumed?.();
      } else {
        // Scenario B: No Active Trip Found (First Scan — Start Trip)
        setEditingTrip(null);
        setIsCloseActiveTripMode(false);
        setFormData({
          vehicle_id: targetVehicleId,
          date: new Date().toISOString().split('T')[0],
          from: '',
          to: '',
          has_enroute: 'No',
          enroute: '',
          start_km: '',
          end_km: '',
          remark: '',
          amount: '',
          driver: '',
          employee: '',
        });
        setSelectedVehicle(targetVehicleId);
        setFormError(null);
        setIsModalOpen(true);
        onPreselectedConsumed?.();
      }
    }
  }, [preselectedVehicleId, vehicles, trips]);

  const handleOpenAdd = () => {
    setEditingTrip(null);
    setIsCloseActiveTripMode(false);
    setFormData({
      vehicle_id: vehicles[0]?.vehicle_id || '',
      date: new Date().toISOString().split('T')[0],
      from: '',
      to: '',
      has_enroute: 'No',
      enroute: '',
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
    setIsCloseActiveTripMode(false);
    setFormData({
      vehicle_id: t.vehicle_id,
      date: t.date,
      from: t.from || '',
      to: t.to || '',
      has_enroute: t.enroute && t.enroute.trim() ? 'Yes' : 'No',
      enroute: t.enroute || '',
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

  const handleOpenCloseActiveTrip = (t: Trip) => {
    setEditingTrip(t);
    setIsCloseActiveTripMode(true);
    setFormData({
      vehicle_id: t.vehicle_id,
      date: t.date,
      from: t.from || '',
      to: t.to || '',
      has_enroute: t.enroute && t.enroute.trim() ? 'Yes' : 'No',
      enroute: t.enroute || '',
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

  const canModifyTrip = (t: Trip) => {
    if (userRole === 'super_admin' || userRole === 'operations_manager') {
      return true;
    }
    if (userRole === 'driver') {
      const rawDriverName = (
        currentUser?.driverName ||
        (currentUser?.name && !currentUser.name.includes('(QR Scan)') && !currentUser.name.toLowerCase().includes('fleet driver') ? currentUser.name : '') ||
        ''
      ).trim().toLowerCase();

      const isGenericOrQRSession = Boolean(
        currentUser?.canBypassQR ||
        !rawDriverName ||
        currentUser?.name.includes('QR Scan') ||
        currentUser?.name.toLowerCase().includes('fleet driver')
      );

      // In QR or generic driver session, driver can edit/delete visible trips
      if (isGenericOrQRSession) {
        return true;
      }

      // Empty or unassigned driver name can be edited/claimed/deleted
      const cleanDriver = (t.driver || '').trim().toLowerCase();
      if (!cleanDriver || cleanDriver === '-' || cleanDriver === '—' || cleanDriver === 'unassigned') {
        return true;
      }

      // Active / open trips can always be edited or closed by any driver
      const hasNoEndKm =
        t.end_km === null ||
        t.end_km === undefined ||
        String(t.end_km).trim() === '' ||
        isNaN(Number(t.end_km));
      const isOpenGate =
        t.gate_status === 'PENDING_EXIT' ||
        t.gate_status === 'DISPATCHED' ||
        t.gate_status === 'PENDING_ENTRY';
      const isOpenStatus =
        t.status === 'IN_TRANSIT' ||
        t.status === 'UNFINISHED' ||
        (t.trip_status as string) === 'IN_TRANSIT' ||
        (t.trip_status as string) === 'PENDING_EXIT';
      const isNotCompleted =
        t.status !== 'COMPLETED' &&
        t.gate_status !== 'COMPLETED' &&
        t.trip_status !== 'COMPLETED';

      if ((hasNoEndKm || isOpenGate || isOpenStatus) && isNotCompleted) {
        return true;
      }

      // Trip owned by this driver
      if (rawDriverName && (cleanDriver === rawDriverName || cleanDriver.includes(rawDriverName) || rawDriverName.includes(cleanDriver))) {
        return true;
      }

      // Scanned vehicle trip
      if (preselectedVehicleId && t.vehicle_id === preselectedVehicleId) {
        return true;
      }

      return false;
    }
    return false;
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
    const eVal = formData.end_km !== '' && formData.end_km !== null && formData.end_km !== undefined ? parseFloat(formData.end_km) : null;

    if (isNaN(s) || s < 0) {
      setFormError('Please enter a valid start odometer reading.');
      return;
    }

    if (isCloseActiveTripMode) {
      if (eVal === null || isNaN(eVal)) {
        setFormError('Please enter the End KM odometer reading to complete this trip.');
        return;
      }
      if (eVal < s) {
        setFormError(`End KM (${eVal}) cannot be less than Start KM (${s}). Total distance cannot be negative.`);
        return;
      }
    } else if (eVal !== null && eVal < s) {
      setFormError(`End KM (${eVal}) cannot be less than Start KM (${s}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      const enrouteValue = formData.has_enroute === 'Yes' && formData.enroute.trim() ? formData.enroute.trim() : '';

      if (isCloseActiveTripMode && editingTrip) {
        // Scenario A: Submitting Close Active Trip updates that existing trip record (PUT /api/trips/:id),
        // sets gate_status to 'PENDING_ENTRY' (so security can acknowledge Gate In), and syncs with Google Sheets.
        await onUpdateTrip(editingTrip.trip_id, {
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          from: formData.from,
          to: formData.to,
          enroute: enrouteValue,
          start_km: s,
          end_km: eVal,
          distance: eVal !== null && eVal >= s ? eVal - s : 0,
          gate_status: 'PENDING_ENTRY',
          trip_status: 'IN_TRANSIT',
          status: 'UNFINISHED',
          remark: formData.remark,
          amount: parseFloat(formData.amount) || 0,
          driver: formData.driver,
          employee: formData.employee,
        });
      } else if (editingTrip) {
        // Standard edit
        let nextGateStatus = editingTrip.gate_status;
        if (editingTrip.gate_status === 'DISPATCHED' && eVal !== null && eVal >= s) {
          nextGateStatus = 'PENDING_ENTRY';
        } else if (!nextGateStatus) {
          nextGateStatus = eVal !== null && eVal >= s ? 'COMPLETED' : 'PENDING_EXIT';
        }

        await onUpdateTrip(editingTrip.trip_id, {
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          from: formData.from,
          to: formData.to,
          enroute: enrouteValue,
          start_km: s,
          end_km: eVal,
          distance: eVal !== null && eVal >= s ? eVal - s : 0,
          remark: formData.remark,
          amount: parseFloat(formData.amount) || 0,
          driver: formData.driver,
          employee: formData.employee,
          gate_status: nextGateStatus,
        });
      } else {
        // Scenario B: Driver logs trip start: set gate_status to 'PENDING_EXIT'
        await onAddTrip({
          vehicle_id: formData.vehicle_id,
          date: formData.date,
          from: formData.from,
          to: formData.to,
          enroute: enrouteValue,
          start_km: s,
          end_km: eVal,
          distance: eVal !== null && eVal >= s ? eVal - s : 0,
          remark: formData.remark,
          amount: parseFloat(formData.amount) || 0,
          driver: formData.driver,
          employee: formData.employee,
          gate_status: 'PENDING_EXIT',
        });
      }
      setIsModalOpen(false);
      setIsCloseActiveTripMode(false);
      setEditingTrip(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save trip record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Security Gate Out Confirmation
  const handleConfirmGateOut = async (data: { gate_out_by: string; gate_out_time: string }) => {
    if (!gateOutTrip) return;
    const currentTimestamp = data.gate_out_time || new Date().toISOString();
    const guard = data.gate_out_by || currentUser?.name || 'Gate Security Guard';
    await onUpdateTrip(gateOutTrip.trip_id, {
      gate_status: 'DISPATCHED',
      status: 'IN_TRANSIT',
      trip_status: 'IN_TRANSIT',
      gate_out_time: currentTimestamp,
      gate_out_by: guard,
      security_guard_out: guard,
    });
    setGateOutTrip(null);
  };

  // Security Gate In Confirmation
  const handleConfirmGateIn = async (data: { gate_in_by: string; gate_in_time: string; end_km: number; enroute?: string }) => {
    if (!gateInTrip) return;
    const currentTimestamp = data.gate_in_time || new Date().toISOString();
    const startKm = gateInTrip.start_km;
    const distance = Math.max(0, data.end_km - startKm);
    const guard = data.gate_in_by || currentUser?.name || 'Gate Security Guard';
    await onUpdateTrip(gateInTrip.trip_id, {
      gate_status: 'COMPLETED',
      status: 'COMPLETED',
      trip_status: 'COMPLETED',
      end_km: data.end_km,
      distance,
      gate_in_time: currentTimestamp,
      gate_in_by: guard,
      security_guard_in: guard,
      ...(data.enroute !== undefined ? { enroute: data.enroute } : {}),
    });
    setGateInTrip(null);
  };

  const filteredTrips = baseTrips.filter(t => {
    const matchesSearch =
      !searchTerm ||
      t.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.driver && t.driver.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.remark && t.remark.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.gate_out_by && t.gate_out_by.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.gate_in_by && t.gate_in_by.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filter by Active Tab
    let matchesTab = true;
    if (activeTab === 'pending_gate') {
      matchesTab =
        t.gate_status === 'PENDING_EXIT' ||
        t.gate_status === 'PENDING_ENTRY' ||
        (!t.gate_status && t.status !== 'COMPLETED');
    } else if (activeTab === 'dispatched') {
      matchesTab =
        t.gate_status === 'DISPATCHED' ||
        t.status === 'IN_TRANSIT' ||
        (t.status === 'UNFINISHED' && t.gate_status !== 'PENDING_EXIT' && t.gate_status !== 'PENDING_ENTRY');
    } else if (activeTab === 'completed') {
      matchesTab = t.status === 'COMPLETED' || t.gate_status === 'COMPLETED';
    }

    // Filter by Dropdown Status
    let matchesStatus = true;
    if (selectedStatus === 'pending_gate') {
      matchesStatus =
        t.gate_status === 'PENDING_EXIT' ||
        t.gate_status === 'PENDING_ENTRY' ||
        (!t.gate_status && t.status !== 'COMPLETED');
    } else if (selectedStatus === 'pending_exit') {
      matchesStatus = t.gate_status === 'PENDING_EXIT';
    } else if (selectedStatus === 'dispatched') {
      matchesStatus = t.gate_status === 'DISPATCHED' || t.status === 'IN_TRANSIT';
    } else if (selectedStatus === 'pending_entry') {
      matchesStatus = t.gate_status === 'PENDING_ENTRY';
    } else if (selectedStatus === 'completed') {
      matchesStatus = t.status === 'COMPLETED';
    } else if (selectedStatus === 'unfinished') {
      matchesStatus = t.status === 'UNFINISHED' || t.status === 'IN_TRANSIT';
    }

    return matchesSearch && matchesTab && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* RBAC Role Context Banners */}
      {userRole === 'security_gate' && (
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md border border-emerald-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Security Gate Terminal</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  Gate Guard: {currentUser?.name || 'Security Station'}
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Verify odometer readings and authorize <strong>Gate OUT</strong> (departure) and <strong>Gate IN</strong> (yard return).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('pending_gate')}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-all self-start sm:self-auto shadow-xs active:scale-95"
          >
            Show Pending Approvals ({pendingGateCount})
          </button>
        </div>
      )}

      {userRole === 'accounts_auditor' && (
        <div className="bg-amber-950/90 text-white p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border border-amber-800/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-600/30 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-xs text-white">Auditor &amp; Finance View-Only Mode</div>
              <p className="text-[11px] text-amber-200">
                Operational records are read-only for verification. CSV export and reconciliation enabled.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExportCSV}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-all self-start sm:self-auto"
          >
            Export All Trips CSV
          </button>
        </div>
      )}

      {userRole === 'driver' && (
        <div className="bg-cyan-950/90 text-white p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border border-cyan-800/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center flex-shrink-0">
              <Truck className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="font-bold text-xs text-white">
                Driver Trip Register {currentUser?.driverName ? `• ${currentUser.driverName}` : ''}
              </div>
              <p className="text-[11px] text-cyan-200">
                Log your departure start odometer or complete active trip. Scan any vehicle QR sticker for automatic vehicle lock.
              </p>
            </div>
          </div>
          {permissions.canAddTrip && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-xl transition-all self-start sm:self-auto"
            >
              + Log My Trip
            </button>
          )}
        </div>
      )}

      {/* Quick Filter Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-2xs'
          }`}
        >
          <span>All Trips</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {allTripsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('pending_gate')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pending_gate'
              ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/25 ring-2 ring-amber-400/30'
              : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-300 shadow-2xs'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          <span>Pending Gate Acknowledgment</span>
          {pendingGateCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'pending_gate' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-900 animate-pulse'
              }`}
            >
              {pendingGateCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('dispatched')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'dispatched'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-2xs'
          }`}
        >
          <Truck className="w-3.5 h-3.5 text-blue-500" />
          <span>In Transit / Dispatched</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'dispatched' ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {inTransitCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-2xs'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>Completed & Verified</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'completed' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {completedCount}
          </span>
        </button>
      </div>

      {/* Action and Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search route, destination, driver, security guard..."
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
              <option value="pending_gate">🟡 Pending Gate Acknowledgment</option>
              <option value="pending_exit">🟡 Pending Exit</option>
              <option value="dispatched">🔵 In Transit / Dispatched</option>
              <option value="pending_entry">🟠 Pending Entry</option>
              <option value="completed">🟢 Completed</option>
              <option value="unfinished">Unfinished</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {permissions.canExportCSV && (
            <button
              onClick={onExportCSV}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export CSV</span>
            </button>
          )}
          {permissions.canAddTrip && (
            <button
              onClick={handleOpenAdd}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Log Trip</span>
            </button>
          )}
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
                <th className="py-3 px-4">Gate Security Status</th>
                <th className="py-3 px-4">Trip Status</th>
                <th className="py-3 px-4">Driver / Remark</th>
                <th className="py-3 px-4 text-right min-w-[190px]">Security & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrips.map(trip => {
                const vehicleObj = vehicleObjectMap.get(trip.vehicle_id);
                const isGateCompleted = trip.gate_status === 'COMPLETED' || trip.status === 'COMPLETED';
                const isDispatched = trip.gate_status === 'DISPATCHED';
                const isPendingEntry = trip.gate_status === 'PENDING_ENTRY';
                const isPendingExit =
                  !isGateCompleted &&
                  !isDispatched &&
                  !isPendingEntry &&
                  (trip.gate_status === 'PENDING_EXIT' || !trip.gate_out_time);

                return (
                  <tr key={trip.trip_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {formatDate(trip.date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {vehicleMap.get(trip.vehicle_id) || trip.vehicle_id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">
                        {trip.enroute ? (
                          <span>
                            {trip.from || 'Origin'}{' '}
                            <span className="text-blue-500 font-bold">→</span>{' '}
                            <span className="text-blue-700 font-semibold">(via {trip.enroute})</span>{' '}
                            <span className="text-blue-500 font-bold">→</span>{' '}
                            {trip.to || 'Destination'}
                          </span>
                        ) : (
                          <span>
                            {trip.from || '—'} <span className="text-blue-500">→</span> {trip.to || '—'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {trip.start_km.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {trip.end_km !== null && trip.end_km !== undefined
                        ? trip.end_km.toLocaleString('en-IN')
                        : '—'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{formatKM(trip.distance)}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{formatINR(trip.amount)}</td>

                    {/* Gate Security Status Badge */}
                    <td className="py-3 px-4">
                      <GateStatusBadge
                        status={trip.gate_status}
                        gateOutTime={trip.gate_out_time}
                        gateOutBy={trip.gate_out_by}
                        gateInTime={trip.gate_in_time}
                        gateInBy={trip.gate_in_by}
                      />
                    </td>

                    {/* Operational Trip Status */}
                    <td className="py-3 px-4">
                      <StatusBadge status={trip.status} />
                    </td>

                    <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                      {trip.remark || '—'} {trip.driver && `(${trip.driver})`}
                    </td>

                    {/* Security Action Buttons & Controls */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Shield Button: Gate Out when GATE SECURITY STATUS is 'Pending Exit' */}
                        {permissions.canGateApprove && isPendingExit && !isGateCompleted && (
                          <button
                            type="button"
                            onClick={() => setGateOutTrip(trip)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all shadow-2xs active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                            title="Acknowledge Vehicle Out (Gate Exit)"
                            aria-label="Acknowledge Vehicle Out (Gate Exit)"
                          >
                            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>Gate OUT</span>
                          </button>
                        )}

                        {/* Shield Button: Gate In when GATE SECURITY STATUS is 'In Transit' / 'Dispatched' */}
                        {permissions.canGateApprove && (isDispatched || isPendingEntry || (!trip.gate_in_time && trip.gate_out_time && !isGateCompleted)) && (
                          <button
                            type="button"
                            onClick={() => setGateInTrip(trip)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all shadow-2xs active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                              isPendingEntry
                                ? 'bg-orange-50 hover:bg-orange-100 text-orange-900 border-orange-300 ring-2 ring-orange-300/40 animate-pulse'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                            }`}
                            title="Acknowledge Vehicle In (Gate Entry)"
                            aria-label="Acknowledge Vehicle In (Gate Entry)"
                          >
                            <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${isPendingEntry ? 'text-orange-600' : 'text-emerald-600'}`} />
                            <span>Gate IN</span>
                          </button>
                        )}

                        {/* Gate Verified Indicator */}
                        {isGateCompleted && trip.gate_in_time && (
                          <span
                            className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-md border border-emerald-200/60"
                            title={`Gate In verified by ${trip.gate_in_by || 'Security'}`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Verified</span>
                          </span>
                        )}

                        {/* Edit & Delete Action Buttons (Checked against Role Permissions & Driver Ownership) */}
                        {permissions.canEditTrip && canModifyTrip(trip) && (
                          <button
                            onClick={() => handleOpenEdit(trip)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Edit trip"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {permissions.canDeleteTrip && onDeleteTrip && canModifyTrip(trip) && (
                          <button
                            onClick={() => setDeletingTrip(trip)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete trip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium">No trips found matching filter criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit / Close Active Trip Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                {isCloseActiveTripMode ? (
                  <>
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Close Active Trip</h3>
                      <p className="text-[11px] text-amber-700 font-medium">Second QR Scan Detected • Gate In Flow</p>
                    </div>
                  </>
                ) : (
                  <h3 className="text-base font-bold text-slate-900">
                    {editingTrip ? 'Edit Trip Record' : 'Log New Fleet Trip'}
                  </h3>
                )}
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setIsCloseActiveTripMode(false);
                  setEditingTrip(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {isCloseActiveTripMode ? (
              /* Scenario A: Close Active Trip View (Second Scan - End Trip) */
              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs overflow-y-auto pr-1">
                {/* Pre-filled ongoing trip details displayed as read-only */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 text-xs block">
                          {vehicleMap.get(formData.vehicle_id) || formData.vehicle_id}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {vehicleObjectMap.get(formData.vehicle_id)?.registration_number || ''}
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                      In Transit
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center min-h-[58px]">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Date</span>
                      <span className="font-semibold text-slate-800">{formatDate(formData.date)}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center min-h-[58px]">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Driver Name</span>
                      <span className="font-semibold text-slate-800">{formData.driver || '—'}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center min-h-[58px]">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Origin (From)</span>
                      <span className="font-semibold text-slate-800">{formData.from || '—'}</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border-2 border-blue-400 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all flex flex-col justify-between min-h-[58px]">
                      <label className="text-blue-700 block text-[10px] uppercase font-bold tracking-wider mb-0.5 flex items-center justify-between">
                        <span>Destination (To)</span>
                        <span className="text-[9px] text-blue-600 font-semibold lowercase">editable</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter destination..."
                        value={formData.to}
                        onChange={e => setFormData({ ...formData, to: e.target.value })}
                        className="w-full bg-blue-50/40 hover:bg-white focus:bg-white px-2 py-0.5 border border-blue-200 focus:border-blue-500 rounded font-semibold text-slate-900 text-xs focus:outline-hidden placeholder-slate-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 font-semibold text-xs block">Start KM (Read-Only)</span>
                      <span className="text-[10px] text-slate-400">Recorded at departure</span>
                    </div>
                    <span className="font-mono font-bold text-sm text-blue-900 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                      {Number(formData.start_km).toLocaleString('en-IN')} KM
                    </span>
                  </div>
                </div>

                {/* Conditional Enroute Stops Question & Input */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-semibold text-slate-800 text-xs">
                      Did this trip have any enroute stops?
                    </label>
                    <div className="inline-flex rounded-lg p-0.5 bg-slate-200 font-semibold text-xs flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, has_enroute: 'No', enroute: '' })}
                        className={`px-3 py-1 rounded-md transition-all ${
                          formData.has_enroute === 'No'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, has_enroute: 'Yes' })}
                        className={`px-3 py-1 rounded-md transition-all ${
                          formData.has_enroute === 'Yes'
                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>

                  {formData.has_enroute === 'Yes' && (
                    <div className="pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                      <label className="font-semibold text-slate-700 block mb-1">
                        Enroute / Via Location(s)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Poonamallee, Guindy"
                        value={formData.enroute}
                        onChange={e => setFormData({ ...formData, enroute: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* End KM Input Field - Focus Target */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-900 text-xs">
                      End KM (Final Odometer Reading) *
                    </label>
                    <span className="text-[11px] font-mono text-slate-500">
                      Start KM: {Number(formData.start_km).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <input
                    ref={endKmInputRef}
                    type="number"
                    required
                    placeholder={`e.g. ${Number(formData.start_km) + 50}`}
                    value={formData.end_km}
                    onChange={e => setFormData({ ...formData, end_km: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-blue-600 rounded-xl font-mono font-bold text-base text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-4 focus:ring-blue-100 shadow-xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Must be greater than or equal to Start KM. Total distance auto-calculates below.
                  </span>
                </div>

                {/* Calculated Distance display */}
                <div className="bg-blue-50 border border-blue-200/80 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="font-semibold text-blue-900">Calculated Distance:</span>
                  <span className="font-mono font-bold text-blue-800 text-sm">{formatKM(calculatedDistance())}</span>
                </div>

                {/* Gate Security Notice */}
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2 text-amber-800 text-[11px]">
                  <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Submitting updates this trip and sets gate status to <strong>Pending Entry</strong> so security can acknowledge Gate In.
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Remarks (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Trip completed, returned to yard..."
                    value={formData.remark}
                    onChange={e => setFormData({ ...formData, remark: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsCloseActiveTripMode(false);
                      setEditingTrip(null);
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm shadow-emerald-500/20 disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving to Sheets...' : 'Submit & Request Gate In'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Scenario B / Standard Trip Form: Log New Fleet Trip */
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Start KM *</label>
                    <input
                      ref={startKmInputRef}
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

                {/* Conditional Enroute Stops Question & Input */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-semibold text-slate-800 text-xs">
                      Did this trip have any enroute stops?
                    </label>
                    <div className="inline-flex rounded-lg p-0.5 bg-slate-200 font-semibold text-xs flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, has_enroute: 'No', enroute: '' })}
                        className={`px-3 py-1 rounded-md transition-all ${
                          formData.has_enroute === 'No'
                            ? 'bg-white text-slate-900 shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, has_enroute: 'Yes' })}
                        className={`px-3 py-1 rounded-md transition-all ${
                          formData.has_enroute === 'Yes'
                            ? 'bg-blue-600 text-white shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>

                  {formData.has_enroute === 'Yes' && (
                    <div className="pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                      <label className="font-semibold text-slate-700 block mb-1">
                        Enroute / Via Location(s)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Poonamallee, Guindy"
                        value={formData.enroute}
                        onChange={e => setFormData({ ...formData, enroute: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* Calculated Distance display */}
                <div className="bg-blue-50 border border-blue-200/70 p-2.5 rounded-lg flex items-center justify-between">
                  <span className="font-semibold text-blue-900">Calculated Distance:</span>
                  <span className="font-mono font-bold text-blue-800 text-sm">{formatKM(calculatedDistance())}</span>
                </div>

                {/* Gate Security Notice */}
                {!editingTrip && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2 text-amber-800 text-[11px]">
                    <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      New trips are recorded with <strong>Pending Exit</strong> gate status for security verification.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Driver Name</label>
                    <select
                      value={formData.driver}
                      onChange={e => setFormData({ ...formData, driver: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="">Select Driver</option>
                      <option value="Sathish">Sathish</option>
                      <option value="Saravana Perumal">Saravanan Perumal</option>
                      <option value="Ravi">Ravi</option>
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
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsCloseActiveTripMode(false);
                      setEditingTrip(null);
                    }}
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
            )}
          </div>
        </div>
      )}

      {/* Security Gate Out Action Modal */}
      <GateOutModal
        isOpen={Boolean(gateOutTrip)}
        trip={gateOutTrip}
        vehicle={gateOutTrip ? vehicleObjectMap.get(gateOutTrip.vehicle_id) : undefined}
        defaultGuardName={currentUser?.name || 'Gate Security Guard'}
        onClose={() => setGateOutTrip(null)}
        onConfirm={handleConfirmGateOut}
      />

      {/* Security Gate In Action Modal */}
      <GateInModal
        isOpen={Boolean(gateInTrip)}
        trip={gateInTrip}
        vehicle={gateInTrip ? vehicleObjectMap.get(gateInTrip.vehicle_id) : undefined}
        defaultGuardName={currentUser?.name || 'Gate Security Guard'}
        onClose={() => setGateInTrip(null)}
        onConfirm={handleConfirmGateIn}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingTrip)}
        title="Delete Trip Record"
        message={`Are you sure you want to delete this trip from ${deletingTrip?.from || '—'} to ${deletingTrip?.to || '—'} (${deletingTrip?.distance || 0} km) on ${formatDate(deletingTrip?.date || '')}? This action will permanently remove the record and sync with Google Sheets.`}
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

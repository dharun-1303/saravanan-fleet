import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { QRScannerModal } from './components/QRScannerModal';
import { LoginPage } from './pages/Login';
import { useAlertNotifications } from './hooks/useAlertNotifications';

import { Dashboard } from './pages/Dashboard';
import { Vehicles } from './pages/Vehicles';
import { VehicleDetail } from './pages/VehicleDetail';
import { Trips } from './pages/Trips';
import { FuelPage } from './pages/Fuel';
import { MaintenancePage } from './pages/Maintenance';
import { DocumentsPage } from './pages/Documents';
import { ExpensesPage } from './pages/Expenses';
import { ServiceAlertsPage } from './pages/ServiceAlerts';
import { AnalyticsPage } from './pages/Analytics';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';

import {
  Vehicle,
  Trip,
  FuelRecord,
  MaintenanceRecord,
  DocumentRecord,
  ExpenseRecord,
  SettingRecord,
  AlertItem,
  SyncStatus,
  AnalyticsSummary,
  AuthUser,
  UserRole,
  ROLE_CONFIGS,
  ROLE_PERMISSIONS,
  DEFAULT_USERS,
  DEFAULT_SECURITY_GATE_PIN,
  DEFAULT_DRIVER_PIN,
} from './types';
import { api, API_BASE } from './api/client';

export const App: React.FC = () => {
  // Active RBAC User Session (with QR Bypass detection)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    // 1. Check if vehicle QR parameter exists in URL on initial load -> automatic Driver QR bypass
    const searchParams = new URLSearchParams(window.location.search);
    const hasSearchQr =
      searchParams.get('vehicle_id') ||
      searchParams.get('vehicle') ||
      searchParams.get('reg') ||
      searchParams.get('id') ||
      searchParams.get('qr');

    const rawHash = window.location.hash.replace(/^#/, '');
    const [hPath, hQuery] = rawHash.split('?');
    const hParams = new URLSearchParams(hQuery || '');
    const hasHashQr =
      hParams.get('vehicle_id') ||
      hParams.get('vehicle') ||
      hParams.get('reg') ||
      hParams.get('id') ||
      hParams.get('qr') ||
      ((hPath.startsWith('trips/') || hPath.startsWith('qr/') || hPath.startsWith('scan/')) && hPath.split('/')[1]);

    if (hasSearchQr || hasHashQr) {
      const qrDriverUser: AuthUser = {
        id: 'driver-qr-bypass',
        name: 'Fleet Driver (QR Scan)',
        role: 'driver',
        canBypassQR: true,
      };
      localStorage.setItem('saravanan_fleet_auth', JSON.stringify(qrDriverUser));
      return qrDriverUser;
    }

    // 2. Otherwise restore saved session from localStorage
    try {
      const saved = localStorage.getItem('saravanan_fleet_auth');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    if (currentUser?.role === 'security_gate' || currentUser?.role === 'driver') {
      return 'trips';
    }
    if (currentUser?.role === 'accounts_auditor') {
      return 'trips';
    }
    return 'dashboard';
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleFromTab, setVehicleFromTab] = useState<NavTab>('vehicles'); // track which tab opened the vehicle

  // Data Store States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fuel, setFuel] = useState<FuelRecord[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [settings, setSettings] = useState<SettingRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    last_synced_at: null,
    sync_state: 'idle',
    source: 'local_cache',
    message: 'Connecting to fleet server...',
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [preselectedTripVehicleId, setPreselectedTripVehicleId] = useState<string | null>(null);
  const [preselectedFuelVehicleId, setPreselectedFuelVehicleId] = useState<string | null>(null);
  const [preselectedMaintVehicleId, setPreselectedMaintVehicleId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Initial Load & Polling (every 20s)
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetchSyncStatusAndUpdates();
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Mobile Back Button & History Synchronization & QR URL landing
  useEffect(() => {
    const validTabs: NavTab[] = [
      'dashboard',
      'vehicles',
      'trips',
      'fuel',
      'maintenance',
      'documents',
      'expenses',
      'alerts',
      'analytics',
      'reports',
      'settings',
    ];

    const getVehicleParamFromUrl = (): { vehicleId: string | null; tab: NavTab | null } => {
      // 1. Search params from window.location.search
      const searchParams = new URLSearchParams(window.location.search);
      const searchVehicle =
        searchParams.get('vehicle_id') ||
        searchParams.get('vehicle') ||
        searchParams.get('reg') ||
        searchParams.get('id') ||
        searchParams.get('qr');
      if (searchVehicle) {
        return { vehicleId: searchVehicle, tab: 'trips' };
      }

      // 2. Hash and hash query params
      const rawHash = window.location.hash.replace(/^#/, '');
      const [hashPath, hashQuery] = rawHash.split('?');
      if (hashQuery) {
        const hashParams = new URLSearchParams(hashQuery);
        const hashVehicle =
          hashParams.get('vehicle_id') ||
          hashParams.get('vehicle') ||
          hashParams.get('reg') ||
          hashParams.get('id') ||
          hashParams.get('qr');
        if (hashVehicle) {
          return { vehicleId: hashVehicle, tab: 'trips' };
        }
      }

      if (hashPath) {
        const parts = hashPath.split('/');
        if (parts[0] === 'trips' && parts[1]) {
          return { vehicleId: parts[1], tab: 'trips' };
        }
        if ((parts[0] === 'qr' || parts[0] === 'scan') && parts[1]) {
          return { vehicleId: parts[1], tab: 'trips' };
        }
      }

      return { vehicleId: null, tab: null };
    };

    const initialUrlInfo = getVehicleParamFromUrl();
    if (initialUrlInfo.vehicleId) {
      // Ensure authenticated as driver if no session
      if (!currentUser) {
        const qrDriverUser: AuthUser = {
          id: 'driver-qr-bypass',
          name: 'Fleet Driver (QR Scan)',
          role: 'driver',
          canBypassQR: true,
        };
        setCurrentUser(qrDriverUser);
        localStorage.setItem('saravanan_fleet_auth', JSON.stringify(qrDriverUser));
      }
      setCurrentTab('trips');
      setPreselectedTripVehicleId(initialUrlInfo.vehicleId);
      setSelectedVehicleId(null);
    } else {
      const rawHash = window.location.hash.replace(/^#/, '');
      const [hashPath] = rawHash.split('?');
      if (hashPath) {
        const parts = hashPath.split('/');
        const tabCandidate = parts[0] as NavTab;
        if (validTabs.includes(tabCandidate)) {
          // Verify tab permission for current role
          if (currentUser) {
            const allowed = ROLE_PERMISSIONS[currentUser.role]?.allowedTabs || [];
            if (allowed.includes(tabCandidate)) {
              setCurrentTab(tabCandidate);
            }
          } else {
            setCurrentTab(tabCandidate);
          }
          if (parts[1]) {
            setSelectedVehicleId(parts[1]);
          }
        }
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      // 1. Close mobile drawer or modal if open
      setIsMobileMenuOpen(false);
      setIsQRScannerOpen(false);

      // 2. Check for vehicle parameter in URL
      const urlInfo = getVehicleParamFromUrl();
      if (urlInfo.vehicleId) {
        setCurrentTab('trips');
        setPreselectedTripVehicleId(urlInfo.vehicleId);
        setSelectedVehicleId(null);
        return;
      }

      // 3. Restore tab and vehicle from history state or URL hash
      const state = event.state;
      if (state) {
        setSelectedVehicleId(state.vehicleId || null);
        if (state.tab && validTabs.includes(state.tab)) {
          setCurrentTab(state.tab);
        }
      } else {
        const currentHash = window.location.hash.replace(/^#/, '');
        const [hashPath] = currentHash.split('?');
        const parts = hashPath.split('/');
        const tabCandidate = parts[0] as NavTab;
        if (tabCandidate && validTabs.includes(tabCandidate)) {
          setCurrentTab(tabCandidate);
          setSelectedVehicleId(parts[1] || null);
        } else {
          setSelectedVehicleId(null);
          setCurrentTab('dashboard');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchAllData = async () => {
    try {
      const [v, t, f, m, d, e, a, s, status, an] = await Promise.all([
        api.getVehicles(),
        api.getTrips(),
        api.getFuel(),
        api.getMaintenance(),
        api.getDocuments(),
        api.getExpenses(),
        api.getAlerts(),
        api.getSettings(),
        api.getSyncStatus(),
        api.getAnalytics({ type: 'all' }),
      ]);
      setVehicles(v);
      setTrips(t);
      setFuel(f);
      setMaintenance(m);
      setDocuments(d);
      setExpenses(e);
      setAlerts(a);
      setSettings(s);
      setSyncStatus(status);
      setAnalytics(an);
    } catch (err: any) {
      console.error('Error fetching fleet data:', err);
      setSyncStatus(prev => ({
        ...prev,
        sync_state: 'error',
        message: `Unable to connect to backend (${API_BASE}). If Render backend is sleeping, please allow ~50s for wake up.`,
      }));
    }
  };

  const fetchSyncStatusAndUpdates = async () => {
    try {
      await fetchAllData();
    } catch (err) {
      console.warn('Sync status poll failed:', err);
    }
  };

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await api.refreshSync();
      await fetchAllData();
      showNotification('Google Sheets two-way sync completed.', 'success');
    } catch (err) {
      console.error('Manual sync failed:', err);
      showNotification('Sync failed. Please check network/credentials.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Authentication Handlers
  const handleLogin = (user: AuthUser) => {
    setCurrentUser(user);
    localStorage.setItem('saravanan_fleet_auth', JSON.stringify(user));

    const allowed = ROLE_PERMISSIONS[user.role]?.allowedTabs || ['trips'];
    if (!allowed.includes(currentTab)) {
      const target = allowed[0] as NavTab;
      setCurrentTab(target);
      window.history.replaceState({ tab: target, vehicleId: null }, '', `#${target}`);
    }
    showNotification(`Signed in as ${user.name} (${ROLE_CONFIGS[user.role].badgeLabel}).`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('saravanan_fleet_auth');
    setCurrentUser(null);
    setSelectedVehicleId(null);
    setCurrentTab('dashboard');
    window.history.replaceState(null, '', '#');
    showNotification('Logged out successfully.', 'success');
  };

  const handleSwitchRole = () => {
    localStorage.removeItem('saravanan_fleet_auth');
    setCurrentUser(null);
    setSelectedVehicleId(null);
    setCurrentTab('dashboard');
    window.history.replaceState(null, '', '#');
    showNotification('Session cleared. Please sign in with your role credentials.', 'success');
  };

  // Vehicle detail navigation
  const handleSelectVehicle = (vehicleId: string) => {
    setVehicleFromTab(currentTab);
    setSelectedVehicleId(vehicleId);
    window.history.pushState({ tab: currentTab, vehicleId }, '', `#${currentTab}/${vehicleId}`);
  };

  const handleBackFromVehicle = () => {
    if (window.history.state?.vehicleId) {
      window.history.back();
    } else {
      setSelectedVehicleId(null);
      setCurrentTab(vehicleFromTab);
      window.history.replaceState({ tab: vehicleFromTab, vehicleId: null }, '', `#${vehicleFromTab}`);
    }
  };

  // Tab switching with RBAC Permission enforcement
  const handleTabChange = (tab: NavTab) => {
    setIsMobileMenuOpen(false);

    if (currentUser) {
      const allowed = ROLE_PERMISSIONS[currentUser.role]?.allowedTabs || [];
      if (!allowed.includes(tab)) {
        showNotification(
          `Tab "${tab}" is not permitted for ${ROLE_CONFIGS[currentUser.role].badgeLabel}.`,
          'error'
        );
        return;
      }
    }

    if (tab === currentTab && !selectedVehicleId) return;
    setSelectedVehicleId(null);
    setCurrentTab(tab);
    window.history.pushState({ tab, vehicleId: null }, '', `#${tab}`);
  };

  const handleOpenMobileMenu = () => {
    setIsMobileMenuOpen(true);
    window.history.pushState({ modal: 'mobileMenu', tab: currentTab, vehicleId: selectedVehicleId }, '', window.location.hash);
  };

  const handleCloseMobileMenu = () => {
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      if (window.history.state?.modal === 'mobileMenu') {
        window.history.back();
      }
    }
  };

  const handleOpenQRScanner = () => {
    setIsQRScannerOpen(true);
    window.history.pushState({ modal: 'qrScanner', tab: currentTab, vehicleId: selectedVehicleId }, '', window.location.hash);
  };

  const handleCloseQRScanner = () => {
    if (isQRScannerOpen) {
      setIsQRScannerOpen(false);
      if (window.history.state?.modal === 'qrScanner') {
        window.history.back();
      }
    }
  };

  // Action handlers
  const handleAddVehicle = async (data: Partial<Vehicle>) => {
    await api.createVehicle(data);
    await fetchAllData();
  };

  const handleUpdateVehicle = async (id: string, data: Partial<Vehicle>) => {
    await api.updateVehicle(id, data);
    await fetchAllData();
  };

  const handleDeleteVehicle = async (id: string) => {
    try {
      await api.deleteVehicle(id);
      showNotification('Vehicle record deleted from Google Sheets and application.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete vehicle.', 'error');
      throw err;
    }
  };

  const handleAddTrip = async (data: Partial<Trip>) => {
    try {
      const newTrip = await api.createTrip(data);
      if (newTrip) {
        setTrips(prev => [newTrip, ...prev.filter(t => t.trip_id !== newTrip.trip_id)]);
      }
      const refreshedTrips = await api.getTrips();
      if (refreshedTrips && Array.isArray(refreshedTrips)) {
        setTrips(refreshedTrips);
      }
      await fetchAllData();
      showNotification('Trip recorded successfully and synced with Google Sheets.', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to record trip.', 'error');
      throw err;
    }
  };

  const handleUpdateTrip = async (id: string, data: Partial<Trip>) => {
    try {
      let updated: Trip | null = null;
      if (data.gate_status === 'DISPATCHED' && data.gate_out_time) {
        updated = await api.gateOutTrip(id, {
          gate_out_by: data.security_guard_out || data.gate_out_by || 'Gate Security Guard',
          security_guard_out: data.security_guard_out || data.gate_out_by || 'Gate Security Guard',
          gate_out_time: data.gate_out_time,
        });
      } else if (data.gate_status === 'COMPLETED' && data.gate_in_time) {
        updated = await api.gateInTrip(id, {
          gate_in_by: data.security_guard_in || data.gate_in_by || 'Gate Security Guard',
          security_guard_in: data.security_guard_in || data.gate_in_by || 'Gate Security Guard',
          gate_in_time: data.gate_in_time,
          end_km: data.end_km !== null && data.end_km !== undefined ? Number(data.end_km) : 0,
          enroute: data.enroute,
        });
      } else if (data.gate_status === 'PENDING_ENTRY' || (data.end_km !== undefined && data.end_km !== null && data.gate_status !== 'COMPLETED')) {
        updated = await api.closeActiveTrip(id, {
          end_km: Number(data.end_km),
          distance: data.distance !== undefined ? Number(data.distance) : undefined,
          enroute: data.enroute,
          remarks: data.remark,
          remark: data.remark,
          gate_status: 'PENDING_ENTRY',
        });
      } else {
        updated = await api.updateTrip(id, data);
      }

      // Optimistically update local trips state immediately
      if (updated) {
        setTrips(prev => prev.map(t => (t.trip_id === id ? { ...t, ...updated } : t)));
      } else {
        setTrips(prev => prev.map(t => (t.trip_id === id ? { ...t, ...data } : t)));
      }

      const refreshedTrips = await api.getTrips();
      if (refreshedTrips && Array.isArray(refreshedTrips)) {
        setTrips(refreshedTrips);
      }
      await fetchAllData();
      if (data.gate_status === 'DISPATCHED') {
        showNotification('Gate OUT confirmed: Vehicle departure authorized and marked In Transit.', 'success');
      } else if (data.gate_status === 'COMPLETED' && data.gate_in_time) {
        showNotification('Gate IN confirmed: Vehicle return verified and trip completed.', 'success');
      } else if (data.gate_status === 'PENDING_ENTRY') {
        showNotification('Trip closed: Vehicle return submitted, awaiting Gate IN security verification.', 'success');
      } else {
        showNotification('Trip updated successfully.', 'success');
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to update trip record.', 'error');
      throw err;
    }
  };

  const handleDeleteTrip = async (id: string) => {
    try {
      await api.deleteTrip(id);
      showNotification('Trip record deleted from Google Sheets and application.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete trip.', 'error');
      throw err;
    }
  };

  const handleAddFuel = async (data: Partial<FuelRecord>) => {
    await api.createFuel(data);
    await fetchAllData();
  };

  const handleUpdateFuel = async (id: string, data: Partial<FuelRecord>) => {
    await api.updateFuel(id, data);
    await fetchAllData();
  };

  const handleDeleteFuel = async (id: string) => {
    try {
      await api.deleteFuel(id);
      showNotification('Fuel record deleted from Google Sheets and application.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete fuel record.', 'error');
      throw err;
    }
  };

  const handleAddMaintenance = async (data: Partial<MaintenanceRecord>) => {
    await api.createMaintenance(data);
    await fetchAllData();
  };

  const handleUpdateMaintenance = async (id: string, data: Partial<MaintenanceRecord>) => {
    await api.updateMaintenance(id, data);
    await fetchAllData();
  };

  const handleDeleteMaintenance = async (id: string) => {
    try {
      await api.deleteMaintenance(id);
      showNotification('Maintenance record deleted from Google Sheets and application.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete maintenance record.', 'error');
      throw err;
    }
  };

  const handleAddDocument = async (data: Partial<DocumentRecord>) => {
    await api.createDocument(data);
    await fetchAllData();
  };

  const handleUpdateDocument = async (id: string, data: Partial<DocumentRecord>) => {
    await api.updateDocument(id, data);
    await fetchAllData();
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await api.deleteDocument(id);
      showNotification('Document deleted from Google Sheets and application.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete document.', 'error');
      throw err;
    }
  };

  const handleAddExpense = async (data: Partial<ExpenseRecord>) => {
    await api.createExpense(data);
    await fetchAllData();
  };

  const handleUpdateExpense = async (id: string, data: Partial<ExpenseRecord>) => {
    await api.updateExpense(id, data);
    await fetchAllData();
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await api.deleteExpense(id);
      showNotification('Expense record deleted from Google Sheets and application.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete expense record.', 'error');
      throw err;
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    await api.dismissAlert(alertId);
    setAlerts(prev => prev.map(a => (a.id === alertId ? { ...a, dismissed: true } : a)));
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    await api.updateSetting(key, value);
    const updated = await api.getSettings();
    setSettings(updated);
  };

  const handleExportCSV = (type: string) => {
    window.open(api.getExportUrl(type), '_blank');
  };

  const handleQRSelectVehicle = (vehicleId: string, action: 'view' | 'trip') => {
    setIsQRScannerOpen(false);
    if (action === 'view') {
      setVehicleFromTab('vehicles');
      setSelectedVehicleId(vehicleId);
      window.history.replaceState({ tab: 'vehicles', vehicleId }, '', `#vehicles/${vehicleId}`);
    } else {
      // Open trips tab with vehicle pre-selected for quick trip entry
      setSelectedVehicleId(null);
      setPreselectedTripVehicleId(vehicleId);
      setCurrentTab('trips');
      window.history.replaceState({ tab: 'trips', vehicleId: null }, '', '#trips');
    }
  };

  const activeAlertCount = alerts.filter(a => a.severity === 'critical' && !a.dismissed).length;

  // Browser notifications for critical alerts
  useAlertNotifications(alerts);

  // If user is not authenticated, render Login Page
  if (!currentUser) {
    const gatePinSetting = settings.find(s => s.key === 'SECURITY_GATE_PIN')?.value;
    const driverPinSetting = settings.find(s => s.key === 'DRIVER_PIN')?.value;
    let customUsers: typeof DEFAULT_USERS | undefined = undefined;
    const usersSetting = settings.find(s => s.key === 'APP_USERS_JSON')?.value;
    if (usersSetting) {
      try {
        const parsed = JSON.parse(usersSetting);
        if (Array.isArray(parsed) && parsed.length > 0) customUsers = parsed;
      } catch {}
    }

    return (
      <LoginPage
        onLogin={handleLogin}
        gatePin={gatePinSetting}
        driverPin={driverPinSetting}
        customUsers={customUsers}
      />
    );
  }

  const tabTitles: Record<NavTab, string> = {
    dashboard: 'Executive Fleet Dashboard',
    vehicles: 'Fleet Vehicles Management',
    trips: 'Trip Registry & Logbook',
    fuel: 'Fuel Consumption & Spend Register',
    expenses: 'Operational Expense Ledger',
    maintenance: 'Maintenance, Repairs & Tyres',
    documents: 'Statutory Compliance Documents',
    alerts: 'Automatic Service & Document Alerts',
    analytics: 'All-Fleet Operations Analytics',
    reports: 'Audit Reports & CSV Data Export',
    settings: 'System Settings & Integration',
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Deep Navy Sidebar with Mobile Drawer & User Profile Card */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleTabChange}
        alertCount={activeAlertCount}
        isOpen={isMobileMenuOpen}
        onClose={handleCloseMobileMenu}
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation */}
        <Navbar
          syncStatus={syncStatus}
          isSyncing={isSyncing}
          onRefreshSync={handleManualSync}
          onOpenQRScanner={handleOpenQRScanner}
          onQuickAddTrip={() => {
            handleTabChange('trips');
          }}
          title={selectedVehicleId ? 'Vehicle History & Analytics' : tabTitles[currentTab]}
          onOpenMobileMenu={handleOpenMobileMenu}
          currentUser={currentUser}
          onSwitchRole={handleSwitchRole}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Global critical alert banner */}
            {activeAlertCount > 0 && !selectedVehicleId && currentTab !== 'alerts' && (
              <div
                onClick={() => handleTabChange('alerts')}
                className="mb-4 flex items-center gap-3 bg-rose-600 text-white px-4 py-2.5 rounded-xl shadow-lg cursor-pointer hover:bg-rose-700 transition-colors text-xs font-semibold"
              >
                <span className="animate-pulse">🔴</span>
                <span>{activeAlertCount} critical alert{activeAlertCount > 1 ? 's' : ''} require attention — click to view</span>
              </div>
            )}
            {selectedVehicleId ? (
              <VehicleDetail
                vehicleId={selectedVehicleId}
                onBack={handleBackFromVehicle}
                onEditVehicle={v => {
                  setSelectedVehicleId(null);
                  setCurrentTab('vehicles');
                }}
                onAddTripForVehicle={vId => {
                  setSelectedVehicleId(null);
                  setPreselectedTripVehicleId(vId);
                  setCurrentTab('trips');
                  window.history.pushState({ tab: 'trips', vehicleId: null }, '', '#trips');
                }}
                onAddFuelForVehicle={vId => {
                  setSelectedVehicleId(null);
                  setPreselectedFuelVehicleId(vId);
                  setCurrentTab('fuel');
                  window.history.pushState({ tab: 'fuel', vehicleId: null }, '', '#fuel');
                }}
                onAddMaintForVehicle={vId => {
                  setSelectedVehicleId(null);
                  setPreselectedMaintVehicleId(vId);
                  setCurrentTab('maintenance');
                  window.history.pushState({ tab: 'maintenance', vehicleId: null }, '', '#maintenance');
                }}
              />
            ) : currentTab === 'dashboard' ? (
              <Dashboard
                vehicles={vehicles}
                trips={trips}
                alerts={alerts}
                analytics={analytics}
                onSelectVehicle={handleSelectVehicle}
                onNavigateTab={handleTabChange}
                onAddTrip={() => setCurrentTab('trips')}
                onOpenQRScanner={handleOpenQRScanner}
                currentUser={currentUser}
              />
            ) : currentTab === 'vehicles' ? (
              <Vehicles
                vehicles={vehicles}
                onSelectVehicle={handleSelectVehicle}
                onAddVehicle={handleAddVehicle}
                onUpdateVehicle={handleUpdateVehicle}
                onDeleteVehicle={handleDeleteVehicle}
                currentUser={currentUser}
              />
            ) : currentTab === 'trips' ? (
              <Trips
                trips={trips}
                vehicles={vehicles}
                onAddTrip={handleAddTrip}
                onUpdateTrip={handleUpdateTrip}
                onDeleteTrip={handleDeleteTrip}
                onExportCSV={() => handleExportCSV('trips')}
                preselectedVehicleId={preselectedTripVehicleId}
                onPreselectedConsumed={() => setPreselectedTripVehicleId(null)}
                currentUser={currentUser}
              />
            ) : currentTab === 'fuel' ? (
              <FuelPage
                fuelRecords={fuel}
                vehicles={vehicles}
                onAddFuel={handleAddFuel}
                onUpdateFuel={handleUpdateFuel}
                onDeleteFuel={handleDeleteFuel}
                onExportCSV={() => handleExportCSV('fuel')}
                preselectedVehicleId={preselectedFuelVehicleId}
                onPreselectedConsumed={() => setPreselectedFuelVehicleId(null)}
                currentUser={currentUser}
              />
            ) : currentTab === 'maintenance' ? (
              <MaintenancePage
                maintenanceRecords={maintenance}
                vehicles={vehicles}
                onAddMaintenance={handleAddMaintenance}
                onUpdateMaintenance={handleUpdateMaintenance}
                onDeleteMaintenance={handleDeleteMaintenance}
                onExportCSV={() => handleExportCSV('maintenance')}
                preselectedVehicleId={preselectedMaintVehicleId}
                onPreselectedConsumed={() => setPreselectedMaintVehicleId(null)}
              />
            ) : currentTab === 'documents' ? (
              <DocumentsPage
                documentRecords={documents}
                vehicles={vehicles}
                onAddDocument={handleAddDocument}
                onUpdateDocument={handleUpdateDocument}
                onDeleteDocument={handleDeleteDocument}
              />
            ) : currentTab === 'expenses' ? (
              <ExpensesPage
                expenseRecords={expenses}
                vehicles={vehicles}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
                onExportCSV={() => handleExportCSV('expenses')}
                currentUser={currentUser}
              />
            ) : currentTab === 'alerts' ? (
              <ServiceAlertsPage
                alerts={alerts}
                onDismissAlert={handleDismissAlert}
                onSelectVehicle={handleSelectVehicle}
              />
            ) : currentTab === 'analytics' ? (
              <AnalyticsPage
                vehicles={vehicles}
                onSelectVehicle={handleSelectVehicle}
                onExportCSV={() => handleExportCSV('fleet')}
              />
            ) : currentTab === 'reports' ? (
              <ReportsPage vehicles={vehicles} />
            ) : currentTab === 'settings' ? (
              <SettingsPage
                settings={settings}
                syncStatus={syncStatus}
                onUpdateSetting={handleUpdateSetting}
              />
            ) : null}
          </div>
        </main>
      </div>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={handleCloseQRScanner}
        vehicles={vehicles}
        trips={trips}
        onSelectVehicle={handleQRSelectVehicle}
      />


      {/* Global Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold backdrop-blur-md border ${
              notification.type === 'error'
                ? 'bg-rose-900/95 text-rose-100 border-rose-700/50'
                : 'bg-emerald-950/95 text-emerald-100 border-emerald-700/50'
            }`}
          >
            <span>{notification.type === 'error' ? '❌' : '✅'}</span>
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

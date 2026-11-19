import { v4 as uuidv4 } from 'uuid';
import { Vehicle, Trip, GateStatus, TripStatus, FuelRecord, MaintenanceRecord, DocumentRecord, ExpenseRecord, SettingRecord, SyncStatus } from './types/index.js';
import { GoogleSheetsClient } from './googleSheets.js';
import { config } from './config.js';

export const REQUIRED_TRIP_COLUMNS = [
  'DATE',
  'FROM',
  'TO',
  'START KM',
  'END KM',
  'DISTANCE',
  'REMARK',
  'AMOUNT',
  'EMPLOYEE',
  'DRIVER',
  'PURPOSE',
  'TRIP STATUS',
  'GATE STATUS',
  'GATE OUT TIME',
  'GATE OUT BY',
  'GATE IN TIME',
  'GATE IN BY',
  'ENROUTE',
  'TRIP ID',
];

export function mapTripToRow(headers: string[], trip: Trip): (string | number)[] {
  return headers.map(rawHeader => {
    const h = (rawHeader || '').toString().trim().toUpperCase();
    if (h === 'DATE') return trip.date || '';
    if (h === 'FROM' || h === 'ORIGIN' || h === 'SOURCE') return trip.from || '';
    if (h === 'TO' || h === 'DESTINATION') return trip.to || '';
    if (h.includes('ENROUTE') || h.includes('VIA') || h.includes('STOPS')) return trip.enroute || '';
    if (h === 'START KM' || h === 'START_KM' || h === 'START ODOMETER') return Number(trip.start_km) || 0;
    if (h === 'END KM' || h === 'END_KM' || h === 'END ODOMETER') return trip.end_km !== null && trip.end_km !== undefined ? Number(trip.end_km) : '';
    if (h === 'DISTANCE' || h === 'KM RUN' || h === 'TOTAL KM') return trip.distance !== null && trip.distance !== undefined ? Number(trip.distance) : '';
    if (h === 'REMARK' || h === 'REMARKS' || h === 'NOTES') return trip.remark || '';
    if (h === 'PURPOSE') return trip.remark || '';
    if (h === 'AMOUNT' || h === 'COST' || h === 'EXPENSE') return Number(trip.amount) || 0;
    if (h === 'EMPLOYEE' || h === 'STAFF' || h === 'PASSENGER' || h === 'USER') return trip.employee || '';
    if (h === 'DRIVER' || h === 'DRIVER NAME') return trip.driver || '';
    if (h === 'TRIP STATUS' || h === 'STATUS') return trip.status || trip.trip_status || '';
    if (h === 'GATE STATUS') return trip.gate_status || '';
    if (h === 'GATE OUT TIME' || h === 'OUT TIME' || h.includes('DEPARTURE TIME')) return trip.gate_out_time || '';
    if (h === 'GATE OUT BY' || h === 'OUT BY' || h.includes('SECURITY GUARD OUT')) return trip.gate_out_by || trip.security_guard_out || '';
    if (h === 'GATE IN TIME' || h === 'IN TIME' || h.includes('ARRIVAL TIME')) return trip.gate_in_time || '';
    if (h === 'GATE IN BY' || h === 'IN BY' || h.includes('SECURITY GUARD IN')) return trip.gate_in_by || trip.security_guard_in || '';
    if (h === 'TRIP ID' || h === 'TRIP_ID' || h === 'ID') return trip.trip_id || '';
    if (h === 'VEHICLE' || h === 'VEHICLE ID' || h === 'VEHICLE_ID') return trip.vehicle_id || '';
    return '';
  });
}

export function parseTripFromRow(
  headers: string[],
  r: any[],
  candidateTab: string,
  rowIndex: number,
  vehicleId: string
): Trip | null {
  if (!r || r.length === 0) return null;
  const firstCol = (r[0] || '').toString().trim();
  if (!firstCol || firstCol.toUpperCase().includes('TOTAL')) return null;

  const valByHeader = (pattern: RegExp): string => {
    const idx = headers.findIndex(h => pattern.test(h.trim().toUpperCase()));
    return idx !== -1 && r[idx] !== undefined && r[idx] !== null ? r[idx].toString().trim() : '';
  };

  const date = valByHeader(/^DATE$/) || (r[0] || '').toString().trim();
  if (!date) return null;

  const from = valByHeader(/^(FROM|ORIGIN|SOURCE)$/) || (r[1] || '').toString().trim();
  const to = valByHeader(/^(TO|DESTINATION)$/) || (r[2] || '').toString().trim();
  
  const rawStartKm = valByHeader(/^(START KM|START_KM|START ODOMETER)$/);
  const startKm = rawStartKm !== '' ? parseFloat(rawStartKm) : (parseFloat(r[3]) || 0);

  const rawEndKm = valByHeader(/^(END KM|END_KM|END ODOMETER)$/);
  const endKmStr = rawEndKm !== '' ? rawEndKm : (r[4] !== undefined && r[4] !== null ? r[4].toString().trim() : '');
  const endKm = endKmStr !== '' && !isNaN(parseFloat(endKmStr)) ? parseFloat(endKmStr) : null;

  const rawDist = valByHeader(/^(DISTANCE|KM RUN|TOTAL KM)$/);
  const dist = rawDist !== '' ? parseFloat(rawDist) : (parseFloat(r[5]) || (endKm !== null && endKm >= startKm ? endKm - startKm : 0));

  const remark = valByHeader(/^(REMARK|REMARKS|NOTES)$/) || valByHeader(/^PURPOSE$/) || (r[6] || '').toString().trim();
  const rawAmount = valByHeader(/^(AMOUNT|COST|EXPENSE)$/);
  const amount = rawAmount !== '' ? parseFloat(rawAmount) : (parseFloat(r[7]) || 0);

  const employee = valByHeader(/^(EMPLOYEE|STAFF|PASSENGER|USER)$/) || (headers[8] === 'EMPLOYEE' ? (r[8] || '').toString().trim() : '');
  const driver = valByHeader(/^(DRIVER|DRIVER NAME)$/) || (headers[9] === 'DRIVER' ? (r[9] || '').toString().trim() : '');

  const rawTripStatus = valByHeader(/^(TRIP STATUS|STATUS)$/);
  const tripStatus: TripStatus = (rawTripStatus === 'COMPLETED' || rawTripStatus === 'IN_TRANSIT' || rawTripStatus === 'UNFINISHED')
    ? (rawTripStatus as TripStatus)
    : (endKm !== null && endKm >= startKm ? 'COMPLETED' : 'UNFINISHED');

  const rawGate = valByHeader(/^GATE STATUS$/) as GateStatus;
  const defaultGate: GateStatus = endKm !== null && endKm >= startKm ? 'COMPLETED' : 'PENDING_EXIT';
  const gateStatus: GateStatus = ['PENDING_EXIT', 'DISPATCHED', 'PENDING_ENTRY', 'COMPLETED'].includes(rawGate)
    ? rawGate
    : defaultGate;

  const gateOutTime = valByHeader(/^(GATE OUT TIME|OUT TIME|DEPARTURE TIME)$/) || undefined;
  const gateOutBy = valByHeader(/^(GATE OUT BY|OUT BY|SECURITY GUARD OUT)$/) || undefined;
  const gateInTime = valByHeader(/^(GATE IN TIME|IN TIME|ARRIVAL TIME)$/) || undefined;
  const gateInBy = valByHeader(/^(GATE IN BY|IN BY|SECURITY GUARD IN)$/) || undefined;
  const enroute = valByHeader(/(ENROUTE|VIA|STOPS)/) || undefined;
  const idFromSheet = valByHeader(/^(TRIP ID|ID)$/);
  const rawVeh = valByHeader(/^(VEHICLE|VEHICLE ID|VEHICLE_ID|REGISTRATION|REG NO)$/);
  const resolvedVehicleId = rawVeh || vehicleId;

  return {
    trip_id: idFromSheet || `trip-s-${candidateTab}-${rowIndex}`,
    vehicle_id: resolvedVehicleId,
    date,
    from,
    to,
    enroute: enroute ? enroute.trim() : undefined,
    start_km: startKm,
    end_km: endKm,
    distance: dist,
    remark,
    amount,
    employee: employee || undefined,
    driver: driver || undefined,
    status: tripStatus,
    trip_status: tripStatus,
    gate_status: gateStatus,
    sheet_name: candidateTab,
    row_index: rowIndex,
    gate_out_time: gateOutTime || undefined,
    gate_out_by: gateOutBy || undefined,
    gate_in_time: gateInTime || undefined,
    gate_in_by: gateInBy || undefined,
    sheets_synced: true,
  };
}

export class DataStore {
  private sheetsClient: GoogleSheetsClient;
  private vehicles: Vehicle[] = [];
  private trips: Trip[] = [];
  private fuelRecords: FuelRecord[] = [];
  private maintenanceRecords: MaintenanceRecord[] = [];
  private documentRecords: DocumentRecord[] = [];
  private expenseRecords: ExpenseRecord[] = [];
  private settings: SettingRecord[] = [];
  private dismissedAlertIds: Set<string> = new Set();

  // Write-lock: timestamp of last write (POST/PUT/DELETE). Background pull
  // is skipped for WRITE_COOLDOWN_MS after any write to prevent stale Sheets
  // data from overwriting a just-saved trip before Google propagates the row.
  private lastWriteTimestamp = 0;
  private readonly WRITE_COOLDOWN_MS = 10000; // 10 s cooldown after any write
  
  private syncStatus: SyncStatus = {
    last_synced_at: null,
    sync_state: 'idle',
    source: 'mock_fallback',
    message: 'Initializing fleet data...',
    spreadsheet_id: config.spreadsheetId,
  };

  private isSyncing = false;
  private activeSyncPromise: Promise<SyncStatus> | null = null;
  private initialTabsEnsured = false;
  private pollingTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.sheetsClient = new GoogleSheetsClient();
    this.initDefaultData();
    this.startPolling();
  }

  private initDefaultData() {
    // Initial company vehicle fleet for Saravanan Electricals & Engineering
    this.vehicles = [
      {
        vehicle_id: 'veh-001',
        vehicle_name: 'BMW',
        registration_number: 'TN87E5753',
        vehicle_type: 'Luxury Sedan',
        fuel_type: 'Diesel',
        photo_url: '',
        sheet_tab_name: 'BMW TN87E5753',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-002',
        vehicle_name: 'BENZ',
        registration_number: 'PYCT018600',
        vehicle_type: 'Luxury Sedan',
        fuel_type: 'Diesel',
        photo_url: '',
        sheet_tab_name: 'BENZ PYCT018600',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-003',
        vehicle_name: 'INNOVA CRYSTA',
        registration_number: 'TN87E1604',
        vehicle_type: 'MUV',
        fuel_type: 'Diesel',
        photo_url: '',
        sheet_tab_name: 'INNOVA TN87E1604',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-004',
        vehicle_name: 'HUNDAI VENUE',
        registration_number: 'TN87E2192',
        vehicle_type: 'Compact SUV',
        fuel_type: 'Petrol',
        photo_url: '',
        sheet_tab_name: 'VENUE TN87E2192',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-005',
        vehicle_name: 'TOYOTA GLANZA CNG',
        registration_number: 'TN87D6036',
        vehicle_type: 'Hatchback',
        fuel_type: 'CNG',
        photo_url: '',
        sheet_tab_name: 'GLANZA TN87D6036',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-006',
        vehicle_name: 'MARUTI ECO',
        registration_number: 'TN87H1779',
        vehicle_type: 'Van',
        fuel_type: 'CNG',
        photo_url: '',
        sheet_tab_name: 'ECO TN87H1779',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-007',
        vehicle_name: 'HUNDAI ALCAZAR',
        registration_number: 'TN19BD5586',
        vehicle_type: 'SUV',
        fuel_type: 'Diesel',
        photo_url: '',
        sheet_tab_name: 'ALCAZAR TN19BD5586',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-008',
        vehicle_name: 'BIG EICHER',
        registration_number: 'TN87C4650',
        vehicle_type: 'Heavy Truck',
        fuel_type: 'Diesel',
        photo_url: '',
        sheet_tab_name: 'BIG EICHER TN87C4650',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-009',
        vehicle_name: 'SMALL EICHER CNG',
        registration_number: 'TN87C7419',
        vehicle_type: 'LCV',
        fuel_type: 'CNG',
        photo_url: '',
        sheet_tab_name: 'SMALL EICHER TN87C7419',
        active: true,
        notes: '',
      },
      {
        vehicle_id: 'veh-010',
        vehicle_name: 'BOLERO PICKUP',
        registration_number: 'TN87E2623',
        vehicle_type: 'Pickup Truck',
        fuel_type: 'Diesel',
        photo_url: '',
        sheet_tab_name: 'BOLERO TN87E2623',
        active: true,
        notes: '',
      },
    ];

    // Operational registers start clean with zero sample data
    this.trips = [];
    this.fuelRecords = [];
    this.maintenanceRecords = [];
    this.documentRecords = [];
    this.expenseRecords = [];

    this.settings = [
      { key: 'SERVICE_ALERT_DAYS', value: '30,15,7', description: 'Alert warning thresholds in days before document/service due' },
      { key: 'SERVICE_ALERT_KM', value: '10000,500', description: 'Alert warning thresholds in kilometres before service due' },
      { key: 'SYNC_INTERVAL_SEC', value: '20', description: 'Background polling interval for Google Sheets sync' },
      { key: 'COMPANY_NAME', value: 'Saravanan Electricals & Engineering Pvt Ltd', description: 'Company legal display name' },
      { key: 'CURRENCY', value: 'INR', description: 'Currency symbol formatting' },
      { key: 'SECURITY_GATE_PIN', value: '9999', description: '4-digit PIN for Security Gate tablet access' },
      { key: 'DRIVER_PIN', value: '1234', description: '4-digit PIN for driver terminal sign-in' },
    ];

    if (this.sheetsClient.isConfigured()) {
      this.syncStatus.source = 'google_sheets';
      this.syncStatus.message = 'Connected to Google Sheets';
    } else {
      this.syncStatus.source = 'mock_fallback';
      this.syncStatus.message = 'Running in offline/local mode. Google Sheets credentials not yet configured in .env.';
    }
  }

  private startPolling() {
    // In serverless environments (like Vercel), persistent intervals keep the execution context alive or get frozen.
    // Sync will be triggered on-demand by API operations, initial requests, or /api/sync/refresh.
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (isServerless) {
      // Trigger an initial asynchronous sync on cold start without holding the process open
      if (this.sheetsClient.isConfigured()) {
        this.syncWithGoogleSheets().catch(err => console.error('[DataStore] Initial serverless sync error:', err));
      }
      return;
    }

    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = setInterval(async () => {
      // Skip background pull if a write happened recently — the new row may
      // not have propagated to Sheets yet, and pulling now would overwrite the
      // local cache with stale (pre-write) Sheets data.
      const msSinceLastWrite = Date.now() - this.lastWriteTimestamp;
      if (msSinceLastWrite < this.WRITE_COOLDOWN_MS) {
        console.log(`[DataStore] Background sync skipped — write cooldown active (${Math.round(msSinceLastWrite / 1000)}s / ${this.WRITE_COOLDOWN_MS / 1000}s)`);
        return;
      }
      if (this.sheetsClient.isConfigured() && !this.isSyncing) {
        await this.syncWithGoogleSheets();
      }
    }, config.syncIntervalMs);
  }

  public async syncWithGoogleSheets(): Promise<SyncStatus> {
    if (this.activeSyncPromise) {
      return this.activeSyncPromise;
    }
    this.activeSyncPromise = this._executeSyncWithGoogleSheets();
    try {
      return await this.activeSyncPromise;
    } finally {
      this.activeSyncPromise = null;
    }
  }

  private async _executeSyncWithGoogleSheets(): Promise<SyncStatus> {
    if (!this.sheetsClient.isConfigured()) {
      this.syncStatus.last_synced_at = new Date().toISOString();
      this.syncStatus.sync_state = 'idle';
      this.syncStatus.source = 'mock_fallback';
      this.syncStatus.message = 'Local cache active. Set GOOGLE_SPREADSHEET_ID and service account credentials to sync live.';
      return this.syncStatus;
    }

    this.isSyncing = true;
    this.syncStatus.sync_state = 'syncing';
    this.syncStatus.message = 'Synchronising with Google Sheets...';

    try {
      // 1. Discover available tabs once with cached metadata
      const allTabs = await this.sheetsClient.getSheetsMetadata();
      const coreTabs = ['Vehicles', 'Fuel', 'Maintenance', 'Documents', 'Expenses'];

      // 2. Ensure required tabs exist only if missing
      if (!this.initialTabsEnsured) {
        const missingCore = coreTabs.filter(ct => !allTabs.some(t => t.toLowerCase() === ct.toLowerCase()));
        if (missingCore.length > 0) {
          const creationPromises: Promise<boolean>[] = [];
          if (missingCore.includes('Vehicles')) {
            creationPromises.push(this.sheetsClient.ensureTabExists('Vehicles', [
              'vehicle_id', 'vehicle_name', 'registration_number', 'vehicle_type', 'fuel_type', 'photo_url', 'sheet_tab_name', 'active', 'notes'
            ]));
          }
          if (missingCore.includes('Fuel')) {
            creationPromises.push(this.sheetsClient.ensureTabExists('Fuel', [
              'fuel_id', 'date', 'vehicle_id', 'odometer', 'fuel_type', 'litres', 'amount', 'vendor', 'remarks', 'recorded_by', 'receipt_url'
            ]));
          }
          if (missingCore.includes('Maintenance')) {
            creationPromises.push(this.sheetsClient.ensureTabExists('Maintenance', [
              'maintenance_id', 'service_date', 'vehicle_id', 'odometer', 'category', 'description', 'workshop', 'cost', 'next_service_due_km', 'next_service_due_date', 'notes', 'recorded_by'
            ]));
          }
          if (missingCore.includes('Documents')) {
            creationPromises.push(this.sheetsClient.ensureTabExists('Documents', [
              'document_id', 'vehicle_id', 'document_type', 'document_number', 'issue_date', 'expiry_date', 'issuer', 'file_url', 'notes', 'recorded_by'
            ]));
          }
          if (missingCore.includes('Expenses')) {
            creationPromises.push(this.sheetsClient.ensureTabExists('Expenses', [
              'expense_id', 'date', 'vehicle_id', 'category', 'description', 'amount', 'vendor', 'receipt_url', 'notes', 'recorded_by'
            ]));
          }
          await Promise.all(creationPromises);
        }
        this.initialTabsEnsured = true;
      }

      // Fetch all spreadsheet tabs in a single batch call to ensure every tab is available
      const batchData = await this.sheetsClient.batchGetSheetValues(allTabs);

      // 3. Parse Vehicles tab
      const vehicleTabKey = allTabs.find(t => t.toLowerCase() === 'vehicles') || 'Vehicles';
      const vehicleRows = batchData.get(vehicleTabKey) || batchData.get('Vehicles') || [];
      if (vehicleRows.length > 1) {
        const parsedVehicles: Vehicle[] = [];
        for (let i = 1; i < vehicleRows.length; i++) {
          const row = vehicleRows[i];
          if (!row[0] && !row[2]) continue;
          parsedVehicles.push({
            vehicle_id: (row[0] || uuidv4()).toString(),
            vehicle_name: (row[1] || '').toString(),
            registration_number: (row[2] || '').toString(),
            vehicle_type: (row[3] || 'Car').toString(),
            fuel_type: (row[4] || 'Diesel').toString(),
            photo_url: (row[5] || '').toString(),
            sheet_tab_name: (row[6] || '').toString(),
            active: (row[7] || '').toString().toLowerCase() !== 'false',
            notes: (row[8] || '').toString(),
          });
        }
        if (parsedVehicles.length > 0) {
          this.vehicles = parsedVehicles;
        }
      }

      // 4. Parse Trips from vehicle-specific tabs and general Trips tab
      const loadedTrips: Trip[] = [];
      const processedTabs = new Set<string>();

      // A. Parse from each vehicle's matched tab
      for (const v of this.vehicles) {
        const candidateTab = this.findTabForVehicle(v, allTabs);
        if (!candidateTab) continue;
        processedTabs.add(candidateTab.toLowerCase());

        const tabRows = batchData.get(candidateTab) || [];
        if (tabRows.length > 1) {
          const headers = (tabRows[0] || []).map((h: any) => (h || '').toString().trim());
          for (let i = 1; i < tabRows.length; i++) {
            const r = tabRows[i];
            const parsedTrip = parseTripFromRow(headers, r, candidateTab, i + 1, v.vehicle_id);
            if (parsedTrip) {
              loadedTrips.push(parsedTrip);
            }
          }
        }
      }

      // B. Parse from general "Trips" tab if it exists
      const generalTripsTab = allTabs.find(t => t.trim().toLowerCase() === 'trips');
      if (generalTripsTab && !processedTabs.has(generalTripsTab.toLowerCase())) {
        processedTabs.add(generalTripsTab.toLowerCase());
        const tabRows = batchData.get(generalTripsTab) || [];
        if (tabRows.length > 1) {
          const headers = (tabRows[0] || []).map((h: any) => (h || '').toString().trim());
          const vColIdx = headers.findIndex(h => /^(VEHICLE|VEHICLE ID|VEHICLE_ID|REGISTRATION|REG NO)$/i.test(h.trim()));
          for (let i = 1; i < tabRows.length; i++) {
            const r = tabRows[i];
            let vId = this.vehicles[0]?.vehicle_id || 'veh-default';
            if (vColIdx !== -1 && r[vColIdx]) {
              const matchV = this.getVehicleById(String(r[vColIdx]));
              if (matchV) vId = matchV.vehicle_id;
            }
            const parsedTrip = parseTripFromRow(headers, r, generalTripsTab, i + 1, vId);
            if (parsedTrip) {
              loadedTrips.push(parsedTrip);
            }
          }
        }
      }

      // C. Also check any other non-core tabs in the spreadsheet that look like vehicle trip logs
      for (const tab of allTabs) {
        const lower = tab.toLowerCase();
        if (coreTabs.some(ct => ct.toLowerCase() === lower) || processedTabs.has(lower) || lower === 'settings') {
          continue;
        }
        processedTabs.add(lower);
        const tabRows = batchData.get(tab) || [];
        if (tabRows.length > 1) {
          const headers = (tabRows[0] || []).map((h: any) => (h || '').toString().trim());
          const hasDate = headers.some(h => /^DATE$/i.test(h));
          const hasStart = headers.some(h => /^(START KM|START_KM|START ODOMETER)$/i.test(h));
          if (hasDate && hasStart) {
            const matchedV = this.vehicles.find(v => {
              const cleanReg = (v.registration_number || '').toLowerCase().replace(/[\s\-_]/g, '');
              const cleanName = (v.vehicle_name || '').toLowerCase().replace(/[\s\-_]/g, '');
              const cleanT = tab.toLowerCase().replace(/[\s\-_]/g, '');
              return (cleanReg && cleanT.includes(cleanReg)) || (cleanName && cleanT.includes(cleanName));
            });
            const vId = matchedV ? matchedV.vehicle_id : (this.vehicles[0]?.vehicle_id || 'veh-default');
            for (let i = 1; i < tabRows.length; i++) {
              const r = tabRows[i];
              const parsedTrip = parseTripFromRow(headers, r, tab, i + 1, vId);
              if (parsedTrip) {
                loadedTrips.push(parsedTrip);
              }
            }
          }
        }
      }

      // Safe merge: keep any locally-cached trips that were confirmed saved
      // but have not yet appeared in the Sheets read (e.g. Google's API propagation delay).
      const sheetsTripIds = new Set(loadedTrips.map(t => t.trip_id));
      const sheetsDateOdoKeys = new Set(loadedTrips.map(t => `${t.vehicle_id}|${t.date}|${t.start_km}`));

      const msSinceLastWrite = Date.now() - this.lastWriteTimestamp;
      const withinCooldown = msSinceLastWrite < this.WRITE_COOLDOWN_MS;
      const orphanedLocalTrips = withinCooldown
        ? this.trips.filter(t =>
            !sheetsTripIds.has(t.trip_id) &&
            !sheetsDateOdoKeys.has(`${t.vehicle_id}|${t.date}|${t.start_km}`)
          )
        : [];

      if (orphanedLocalTrips.length > 0) {
        console.log(`[DataStore] Preserving ${orphanedLocalTrips.length} locally confirmed trip(s) not yet visible in Sheets sync (cooldown active)`);
      }

      // Replace cache with merged result
      this.trips = [...orphanedLocalTrips, ...loadedTrips];

      // 5. Parse Fuel, Maintenance, Documents, Expenses from the batch data
      const fuelRows = batchData.get('Fuel') || [];
      const maintRows4 = batchData.get('Maintenance') || [];
      const docRows4 = batchData.get('Documents') || [];
      const expRows4 = batchData.get('Expenses') || [];

      const parsedFuel: FuelRecord[] = [];
      if (fuelRows.length > 1) {
        for (let i = 1; i < fuelRows.length; i++) {
          const r = fuelRows[i];
          if (!r[0] && !r[1]) continue;
          parsedFuel.push({
            fuel_id: (r[0] || uuidv4()).toString(),
            date: (r[1] || '').toString(),
            vehicle_id: (r[2] || '').toString(),
            odometer: parseFloat(r[3]) || 0,
            fuel_type: (r[4] || 'Diesel').toString(),
            litres: parseFloat(r[5]) || 0,
            amount: parseFloat(r[6]) || 0,
            vendor: (r[7] || '').toString(),
            remarks: (r[8] || '').toString(),
            recorded_by: (r[9] || '').toString(),
            receipt_url: (r[10] || '').toString(),
            row_index: i + 1,
          });
        }
      }
      this.fuelRecords = parsedFuel;

      // 5. Read Maintenance
      const maintRows = maintRows4;
      const parsedMaint: MaintenanceRecord[] = [];
      if (maintRows.length > 1) {
        for (let i = 1; i < maintRows.length; i++) {
          const r = maintRows[i];
          if (!r[0] && !r[1]) continue;
          parsedMaint.push({
            maintenance_id: (r[0] || uuidv4()).toString(),
            service_date: (r[1] || '').toString(),
            vehicle_id: (r[2] || '').toString(),
            odometer: parseFloat(r[3]) || 0,
            category: (r[4] || 'General Service').toString(),
            description: (r[5] || '').toString(),
            workshop: (r[6] || '').toString(),
            cost: parseFloat(r[7]) || 0,
            next_service_due_km: r[8] ? parseFloat(r[8]) : null,
            next_service_due_date: (r[9] || '').toString() || null,
            notes: (r[10] || '').toString(),
            recorded_by: (r[11] || '').toString(),
            row_index: i + 1,
          });
        }
      }
      this.maintenanceRecords = parsedMaint;

      // 6. Read Documents
      const docRows = docRows4;
      const parsedDocs: DocumentRecord[] = [];
      if (docRows.length > 1) {
        for (let i = 1; i < docRows.length; i++) {
          const r = docRows[i];
          if (!r[0] && !r[1]) continue;
          parsedDocs.push({
            document_id: (r[0] || uuidv4()).toString(),
            vehicle_id: (r[1] || '').toString(),
            document_type: (r[2] || 'Other') as any,
            document_number: (r[3] || '').toString(),
            issue_date: (r[4] || '').toString(),
            expiry_date: (r[5] || '').toString(),
            issuer: (r[6] || '').toString(),
            file_url: (r[7] || '').toString(),
            notes: (r[8] || '').toString(),
            recorded_by: (r[9] || '').toString(),
            row_index: i + 1,
          });
        }
      }
      this.documentRecords = parsedDocs;

      // 7. Read Expenses
      const expRows = expRows4;
      const parsedExp: ExpenseRecord[] = [];
      if (expRows.length > 1) {
        for (let i = 1; i < expRows.length; i++) {
          const r = expRows[i];
          if (!r[0] && !r[1]) continue;
          parsedExp.push({
            expense_id: (r[0] || uuidv4()).toString(),
            date: (r[1] || '').toString(),
            vehicle_id: (r[2] || '').toString(),
            category: (r[3] || 'Other') as any,
            description: (r[4] || '').toString(),
            amount: parseFloat(r[5]) || 0,
            vendor: (r[6] || '').toString(),
            receipt_url: (r[7] || '').toString(),
            notes: (r[8] || '').toString(),
            recorded_by: (r[9] || '').toString(),
            row_index: i + 1,
          });
        }
      }
      this.expenseRecords = parsedExp;

      this.syncStatus = {
        last_synced_at: new Date().toISOString(),
        sync_state: 'idle',
        source: 'google_sheets',
        message: 'Successfully synchronised with Google Sheets.',
        spreadsheet_id: config.spreadsheetId,
      };
    } catch (err: any) {
      console.error('[DataStore] Sync error:', err.message);
      this.syncStatus = {
        last_synced_at: this.syncStatus.last_synced_at,
        sync_state: 'error',
        source: this.sheetsClient.isConfigured() ? 'google_sheets' : 'mock_fallback',
        message: `Sync warning: ${err.message}. Preserved local data.`,
        spreadsheet_id: config.spreadsheetId,
      };
    } finally {
      this.isSyncing = false;
    }

    return this.syncStatus;
  }

  // Getters
  public getVehicles(): Vehicle[] {
    return this.vehicles;
  }

  public getVehicleById(id: string): Vehicle | undefined {
    if (!id) return undefined;
    const clean = id.trim().toLowerCase();
    const cleanNoSpace = clean.replace(/[\s\-_]/g, '');
    return this.vehicles.find(v => {
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
  }

  public getTrips(vehicleId?: string): Trip[] {
    if (!vehicleId) return this.trips;
    const v = this.getVehicleById(vehicleId);
    const targetId = v ? v.vehicle_id : vehicleId;
    return this.trips.filter(t => t.vehicle_id === targetId || t.vehicle_id === vehicleId);
  }

  public getActiveTripForVehicle(vehicleId: string): Trip | null {
    const v = this.getVehicleById(vehicleId);
    const targetId = v ? v.vehicle_id : vehicleId;
    const clean = vehicleId.trim().toLowerCase();
    const cleanNoSpace = clean.replace(/[\s\-_]/g, '');

    const matchingTrips = this.trips.filter(t => {
      const matchesVehicle =
        t.vehicle_id === targetId ||
        t.vehicle_id === vehicleId ||
        (v && (
          t.vehicle_id.toLowerCase() === v.vehicle_id.toLowerCase() ||
          t.vehicle_id.toLowerCase() === v.registration_number.toLowerCase() ||
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
        t.status === 'IN_TRANSIT' ||
        t.status === 'UNFINISHED';
      const isNotCompleted =
        t.trip_status !== 'COMPLETED' &&
        t.status !== 'COMPLETED' &&
        t.gate_status !== 'COMPLETED';

      return (hasNoEndKm || isTripStatusActive) && isNotCompleted;
    });

    return matchingTrips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;
  }

  public getFuelRecords(vehicleId?: string): FuelRecord[] {
    if (!vehicleId) return this.fuelRecords;
    const v = this.getVehicleById(vehicleId);
    const targetId = v ? v.vehicle_id : vehicleId;
    return this.fuelRecords.filter(f => f.vehicle_id === targetId || f.vehicle_id === vehicleId);
  }

  public getMaintenanceRecords(vehicleId?: string): MaintenanceRecord[] {
    if (!vehicleId) return this.maintenanceRecords;
    const v = this.getVehicleById(vehicleId);
    const targetId = v ? v.vehicle_id : vehicleId;
    return this.maintenanceRecords.filter(m => m.vehicle_id === targetId || m.vehicle_id === vehicleId);
  }

  public getDocumentRecords(vehicleId?: string): DocumentRecord[] {
    if (!vehicleId) return this.documentRecords;
    const v = this.getVehicleById(vehicleId);
    const targetId = v ? v.vehicle_id : vehicleId;
    return this.documentRecords.filter(d => d.vehicle_id === targetId || d.vehicle_id === vehicleId);
  }

  public getExpenseRecords(vehicleId?: string): ExpenseRecord[] {
    if (!vehicleId) return this.expenseRecords;
    const v = this.getVehicleById(vehicleId);
    const targetId = v ? v.vehicle_id : vehicleId;
    return this.expenseRecords.filter(e => e.vehicle_id === targetId || e.vehicle_id === vehicleId);
  }

  public getSettings(): SettingRecord[] {
    return this.settings;
  }

  public getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  // Mutators with Google Sheets two-way write
  public async addVehicle(vehicle: Omit<Vehicle, 'vehicle_id'>): Promise<Vehicle> {
    const newVehicle: Vehicle = {
      ...vehicle,
      vehicle_id: `veh-${Date.now().toString().slice(-4)}`,
    };
    this.vehicles.push(newVehicle);

    if (this.sheetsClient.isConfigured()) {
      try {
        await this.sheetsClient.appendRow('Vehicles', [
          newVehicle.vehicle_id,
          newVehicle.vehicle_name,
          newVehicle.registration_number,
          newVehicle.vehicle_type,
          newVehicle.fuel_type,
          newVehicle.photo_url,
          newVehicle.sheet_tab_name,
          newVehicle.active ? 'TRUE' : 'FALSE',
          newVehicle.notes,
        ]);
        this.syncStatus.last_synced_at = new Date().toISOString();
      } catch (err: any) {
        console.error('[DataStore] Failed writing vehicle to Google Sheets:', err.message);
      }
    }
    return newVehicle;
  }

  public async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle | null> {
    const index = this.vehicles.findIndex(v => v.vehicle_id === id);
    if (index === -1) return null;
    this.vehicles[index] = { ...this.vehicles[index], ...updates };
    const updated = this.vehicles[index];

    if (this.sheetsClient.isConfigured()) {
      try {
        // Find row index by vehicle_id
        const rows = await this.sheetsClient.readSheetValues('Vehicles');
        const rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === id) + 1;
        if (rowIndex > 1) {
          await this.sheetsClient.updateRow('Vehicles', rowIndex, [
            updated.vehicle_id,
            updated.vehicle_name,
            updated.registration_number,
            updated.vehicle_type,
            updated.fuel_type,
            updated.photo_url,
            updated.sheet_tab_name,
            updated.active ? 'TRUE' : 'FALSE',
            updated.notes,
          ]);
        }
      } catch (err: any) {
        console.error('[DataStore] Error updating vehicle in Sheets:', err.message);
      }
    }
    return updated;
  }

  public findTabForVehicle(v: Vehicle, allTabs: string[]): string | undefined {
    if (!v) return undefined;
    if (v.sheet_tab_name) {
      const exact = allTabs.find(t => t === v.sheet_tab_name);
      if (exact) return exact;
      const ci = allTabs.find(t => t.trim().toLowerCase() === v.sheet_tab_name.trim().toLowerCase());
      if (ci) return ci;
    }
    const cleanReg = (v.registration_number || '').toLowerCase().replace(/[\s\-_]/g, '');
    const cleanName = (v.vehicle_name || '').toLowerCase().replace(/[\s\-_]/g, '');

    if (cleanReg) {
      const matchReg = allTabs.find(t => t.toLowerCase().replace(/[\s\-_]/g, '').includes(cleanReg));
      if (matchReg) return matchReg;
    }
    if (cleanName) {
      const matchName = allTabs.find(t => t.toLowerCase().replace(/[\s\-_]/g, '').includes(cleanName));
      if (matchName) return matchName;
    }

    return undefined;
  }

  public async resolveTargetTripTab(vehicleId: string): Promise<string> {
    const v = this.getVehicleById(vehicleId);
    if (!v) {
      if (this.sheetsClient.isConfigured()) {
        try {
          const allTabs = await this.sheetsClient.getSheetsMetadata();
          const defaultTrips = allTabs.find(t => t.trim().toLowerCase() === 'trips');
          if (defaultTrips) return defaultTrips;
        } catch {}
      }
      return 'Trips';
    }

    if (this.sheetsClient.isConfigured()) {
      try {
        const allTabs = await this.sheetsClient.getSheetsMetadata();
        const found = this.findTabForVehicle(v, allTabs);
        if (found) return found;

        // Check if general Trips tab exists
        const defaultTrips = allTabs.find(t => t.trim().toLowerCase() === 'trips');
        if (defaultTrips) return defaultTrips;
      } catch (err: any) {
        console.warn('[DataStore] resolveTargetTripTab metadata check error:', err.message);
      }
    }

    return v.sheet_tab_name || `${v.vehicle_name} ${v.registration_number}`.trim() || 'Trips';
  }

  public async addTrip(tripData: Omit<Trip, 'trip_id' | 'distance' | 'status'> & Partial<Pick<Trip, 'status' | 'trip_status'>> & { sheets_synced?: boolean; sheets_sync_error?: string }): Promise<Trip> {
    const startKm = Number(tripData.start_km);
    const endKm = tripData.end_km !== undefined && tripData.end_km !== null ? Number(tripData.end_km) : null;
    const distance = endKm !== null && endKm >= startKm ? endKm - startKm : 0;
    const status = tripData.status || tripData.trip_status || (endKm !== null && endKm >= startKm ? 'COMPLETED' : 'UNFINISHED');
    const gate_status: GateStatus = tripData.gate_status || (status === 'COMPLETED' ? 'COMPLETED' : 'PENDING_EXIT');

    // Canonical vehicle resolution
    const v = this.getVehicleById(tripData.vehicle_id);
    const canonicalVehicleId = v ? v.vehicle_id : tripData.vehicle_id;

    const newTrip: Trip = {
      ...tripData,
      trip_id: `trip-${Date.now().toString().slice(-6)}`,
      vehicle_id: canonicalVehicleId,
      start_km: startKm,
      end_km: endKm,
      distance,
      status,
      trip_status: status,
      gate_status,
      enroute: tripData.enroute ? tripData.enroute.trim() : undefined,
      gate_out_time: tripData.gate_out_time || undefined,
      gate_out_by: tripData.gate_out_by || undefined,
      gate_in_time: tripData.gate_in_time || undefined,
      gate_in_by: tripData.gate_in_by || undefined,
    };

    if (this.sheetsClient.isConfigured()) {
      try {
        const targetTab = await this.resolveTargetTripTab(newTrip.vehicle_id);
        if (!targetTab) {
          throw new Error(`Could not determine target Google Sheet tab for vehicle "${newTrip.vehicle_id}"`);
        }
        await this.sheetsClient.ensureTabExists(targetTab, REQUIRED_TRIP_COLUMNS);
        const headers = await this.sheetsClient.ensureColumnsExist(targetTab, REQUIRED_TRIP_COLUMNS);
        const rowValues = mapTripToRow(headers, newTrip);

        console.log(`======================================================`);
        console.log(`[POST /api/trips] Recording Trip ID: ${newTrip.trip_id}`);
        console.log(`[POST /api/trips] Target Google Sheet Tab: "${targetTab}"`);
        console.log(`[POST /api/trips] Row Values (${rowValues.length} columns):`, JSON.stringify(rowValues));

        const res = await this.sheetsClient.appendRow(targetTab, rowValues);

        console.log(`[POST /api/trips] Google API Response:`, JSON.stringify(res.apiResponse || res));
        console.log(`[POST /api/trips] Appended successfully at row: ${res.rowIndex}`);
        console.log(`======================================================`);

        newTrip.sheet_name = targetTab;
        newTrip.row_index = res.rowIndex;
        newTrip.sheets_synced = true;
        this.lastWriteTimestamp = Date.now();
        this.syncStatus.last_synced_at = new Date().toISOString();
      } catch (err: any) {
        console.error(`[POST /api/trips] Google Sheets Append Failed for trip ${newTrip.trip_id}:`, err.message, err);
        throw new Error(`Google Sheets append failed on tab "${newTrip.sheet_name || 'Trips'}": ${err.message}`);
      }
    } else {
      if (process.env.NODE_ENV === 'test') {
        newTrip.sheets_synced = true;
        this.lastWriteTimestamp = Date.now();
      } else {
        const errMsg = !config.spreadsheetId
          ? 'GOOGLE_SPREADSHEET_ID is missing or not configured in environment variables'
          : 'Google Sheets Service Account credentials are missing or could not be loaded';
        console.error(`[POST /api/trips] Cannot record trip: ${errMsg}`);
        throw new Error(errMsg);
      }
    }

    // On confirmed success: update in-memory cache immediately
    this.trips.unshift(newTrip);
    return newTrip;
  }

  public async updateTrip(tripId: string, updates: Partial<Trip> & Record<string, any>): Promise<Trip | null> {
    const decodedId = decodeURIComponent(tripId);
    const index = this.trips.findIndex(
      t => t.trip_id === tripId || t.trip_id === decodedId || decodeURIComponent(t.trip_id) === decodedId
    );
    if (index === -1) return null;
    
    const existing = this.trips[index];
    const merged = { ...existing, ...updates };

    // Support field aliases
    if (updates.security_guard_out && !updates.gate_out_by) {
      merged.gate_out_by = updates.security_guard_out;
    }
    if (updates.gate_out_by && !updates.security_guard_out) {
      merged.security_guard_out = updates.gate_out_by;
    }
    if (updates.security_guard_in && !updates.gate_in_by) {
      merged.gate_in_by = updates.security_guard_in;
    }
    if (updates.gate_in_by && !updates.security_guard_in) {
      merged.security_guard_in = updates.gate_in_by;
    }
    if (updates.remarks !== undefined && updates.remark === undefined) {
      merged.remark = updates.remarks;
    }

    if (updates.enroute !== undefined) {
      merged.enroute = updates.enroute ? updates.enroute.trim() : undefined;
    }
    
    const hasEndKm = merged.end_km !== null && merged.end_km !== undefined && String(merged.end_km).trim() !== '' && !isNaN(Number(merged.end_km));
    if (hasEndKm && Number(merged.end_km) >= Number(merged.start_km)) {
      merged.start_km = Number(merged.start_km);
      merged.end_km = Number(merged.end_km);
      merged.distance = merged.end_km - merged.start_km;
      if (updates.status) {
        merged.status = updates.status;
      } else if (updates.trip_status) {
        merged.status = updates.trip_status;
      } else if (merged.gate_status === 'COMPLETED') {
        merged.status = 'COMPLETED';
      } else if (updates.gate_status === 'PENDING_ENTRY' || merged.gate_status === 'PENDING_ENTRY') {
        merged.status = 'UNFINISHED';
      } else {
        merged.status = 'COMPLETED';
      }
    } else {
      merged.status = updates.status || updates.trip_status || (merged.gate_status === 'DISPATCHED' ? 'IN_TRANSIT' : 'UNFINISHED');
      merged.distance = 0;
    }

    if (!merged.gate_status) {
      merged.gate_status = merged.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING_EXIT';
    }
    merged.trip_status = merged.status;

    // Verify Google Sheets configuration
    const isMock = config.isMockMode || process.env.NODE_ENV === 'test';
    if (!isMock && !this.sheetsClient.isConfigured()) {
      const errMsg = !config.spreadsheetId
        ? 'GOOGLE_SPREADSHEET_ID is missing or empty in .env'
        : 'Google Sheets Service Account credentials are missing or could not be loaded';
      console.error(`[DataStore] Google Sheets configuration error: ${errMsg}`);
      throw new Error(errMsg);
    }

    if (this.sheetsClient.isConfigured()) {
      try {
        const targetTab = merged.sheet_name || await this.resolveTargetTripTab(merged.vehicle_id);
        await this.sheetsClient.ensureTabExists(targetTab, REQUIRED_TRIP_COLUMNS);
        const headers = await this.sheetsClient.ensureColumnsExist(targetTab, REQUIRED_TRIP_COLUMNS);

        let targetRowIndex = merged.row_index;
        const rows = await this.sheetsClient.readSheetValues(targetTab);

        // Find column indices in the sheet
        const idColIdx = headers.findIndex(h => /^(TRIP ID|TRIP_ID|ID)$/i.test((h || '').trim()));
        const dateColIdx = headers.findIndex(h => /^(DATE)$/i.test((h || '').trim()));
        const startKmColIdx = headers.findIndex(h => /^(START KM|START_KM|START ODOMETER)$/i.test((h || '').trim()));

        // Check if cached targetRowIndex matches
        let isValidCachedRow = false;
        if (targetRowIndex && targetRowIndex > 1 && rows[targetRowIndex - 1]) {
          const r = rows[targetRowIndex - 1];
          if (idColIdx !== -1 && (r[idColIdx] === existing.trip_id || r[idColIdx] === tripId)) {
            isValidCachedRow = true;
          } else {
            const rDate = (dateColIdx !== -1 ? r[dateColIdx] : r[0] || '').toString();
            const rStart = parseFloat(startKmColIdx !== -1 ? r[startKmColIdx] : r[3]) || 0;
            if (rDate === existing.date && Math.abs(rStart - existing.start_km) < 0.1) {
              isValidCachedRow = true;
            }
          }
        }

        if (!isValidCachedRow) {
          // Locate exact row in Google Sheets
          const foundIdx = rows.findIndex((r, idx) => {
            if (idx === 0) return false;
            if (idColIdx !== -1 && (r[idColIdx] === existing.trip_id || r[idColIdx] === tripId)) {
              return true;
            }
            const rDate = (dateColIdx !== -1 ? r[dateColIdx] : r[0] || '').toString();
            const rStart = parseFloat(startKmColIdx !== -1 ? r[startKmColIdx] : r[3]) || 0;
            return rDate === existing.date && Math.abs(rStart - existing.start_km) < 0.1;
          });
          if (foundIdx > 0) {
            targetRowIndex = foundIdx + 1;
            merged.row_index = targetRowIndex;
            merged.sheet_name = targetTab;
          }
        }

        const rowValues = mapTripToRow(headers, merged);

        if (targetRowIndex && targetRowIndex > 1) {
          console.log(`[GoogleSheets] Updating trip ${merged.trip_id} in tab "${targetTab}" row ${targetRowIndex}...`);
          await this.sheetsClient.updateRow(targetTab, targetRowIndex, rowValues);
          (merged as any).sheets_synced = true;
          this.lastWriteTimestamp = Date.now();
          this.syncStatus.last_synced_at = new Date().toISOString();
          console.log(`[GoogleSheets] Trip ${merged.trip_id} updated successfully in "${targetTab}" row ${targetRowIndex}`);
        } else {
          console.log(`[GoogleSheets] Row index not found for trip ${merged.trip_id}; appending to tab "${targetTab}"...`);
          const res = await this.sheetsClient.appendRow(targetTab, rowValues);
          merged.row_index = res.rowIndex;
          merged.sheet_name = targetTab;
          (merged as any).sheets_synced = true;
          this.lastWriteTimestamp = Date.now();
          this.syncStatus.last_synced_at = new Date().toISOString();
        }
      } catch (err: any) {
        console.error(`[GoogleSheets] Explicit update error for trip ${merged.trip_id}:`, err.message, err);
        throw new Error(`Google Sheets update failed: ${err.message || 'Unknown Google API error'}`);
      }
    } else {
      (merged as any).sheets_synced = true;
      this.lastWriteTimestamp = Date.now();
    }

    // On success: update in-memory cache
    this.trips[index] = merged;
    return merged;
  }

  public async addFuel(fuelData: Omit<FuelRecord, 'fuel_id'>): Promise<FuelRecord> {
    const newFuel: FuelRecord = {
      ...fuelData,
      fuel_id: `fuel-${Date.now().toString().slice(-6)}`,
    };
    this.fuelRecords.unshift(newFuel);

    if (this.sheetsClient.isConfigured()) {
      try {
        const res = await this.sheetsClient.appendRow('Fuel', [
          newFuel.fuel_id,
          newFuel.date,
          newFuel.vehicle_id,
          newFuel.odometer,
          newFuel.fuel_type,
          newFuel.litres,
          newFuel.amount,
          newFuel.vendor,
          newFuel.remarks,
          newFuel.recorded_by,
          newFuel.receipt_url || '',
        ]);
        newFuel.row_index = res.rowIndex;
      } catch (err: any) {
        console.error('[DataStore] Error appending fuel record in Sheets:', err.message);
      }
    }
    return newFuel;
  }

  public async updateFuel(fuelId: string, updates: Partial<FuelRecord>): Promise<FuelRecord | null> {
    const index = this.fuelRecords.findIndex(f => f.fuel_id === fuelId);
    if (index === -1) return null;
    this.fuelRecords[index] = { ...this.fuelRecords[index], ...updates };
    const updated = this.fuelRecords[index];

    if (this.sheetsClient.isConfigured() && updated.row_index) {
      try {
        await this.sheetsClient.updateRow('Fuel', updated.row_index, [
          updated.fuel_id,
          updated.date,
          updated.vehicle_id,
          updated.odometer,
          updated.fuel_type,
          updated.litres,
          updated.amount,
          updated.vendor,
          updated.remarks,
          updated.recorded_by,
          updated.receipt_url || '',
        ]);
      } catch (err: any) {
        console.error('[DataStore] Error updating fuel in Sheets:', err.message);
      }
    }
    return updated;
  }

  public async addMaintenance(data: Omit<MaintenanceRecord, 'maintenance_id'>): Promise<MaintenanceRecord> {
    const newMaint: MaintenanceRecord = {
      ...data,
      maintenance_id: `maint-${Date.now().toString().slice(-6)}`,
    };
    this.maintenanceRecords.unshift(newMaint);

    if (this.sheetsClient.isConfigured()) {
      try {
        const res = await this.sheetsClient.appendRow('Maintenance', [
          newMaint.maintenance_id,
          newMaint.service_date,
          newMaint.vehicle_id,
          newMaint.odometer,
          newMaint.category,
          newMaint.description,
          newMaint.workshop,
          newMaint.cost,
          newMaint.next_service_due_km ?? '',
          newMaint.next_service_due_date || '',
          newMaint.notes,
          newMaint.recorded_by,
        ]);
        newMaint.row_index = res.rowIndex;
      } catch (err: any) {
        console.error('[DataStore] Error appending maintenance in Sheets:', err.message);
      }
    }
    return newMaint;
  }

  public async updateMaintenance(id: string, updates: Partial<MaintenanceRecord>): Promise<MaintenanceRecord | null> {
    const idx = this.maintenanceRecords.findIndex(m => m.maintenance_id === id);
    if (idx === -1) return null;
    this.maintenanceRecords[idx] = { ...this.maintenanceRecords[idx], ...updates };
    const updated = this.maintenanceRecords[idx];

    if (this.sheetsClient.isConfigured() && updated.row_index) {
      try {
        await this.sheetsClient.updateRow('Maintenance', updated.row_index, [
          updated.maintenance_id,
          updated.service_date,
          updated.vehicle_id,
          updated.odometer,
          updated.category,
          updated.description,
          updated.workshop,
          updated.cost,
          updated.next_service_due_km ?? '',
          updated.next_service_due_date || '',
          updated.notes,
          updated.recorded_by,
        ]);
      } catch (err: any) {
        console.error('[DataStore] Error updating maintenance in Sheets:', err.message);
      }
    }
    return updated;
  }

  public async addDocument(data: Omit<DocumentRecord, 'document_id'>): Promise<DocumentRecord> {
    const newDoc: DocumentRecord = {
      ...data,
      document_id: `doc-${Date.now().toString().slice(-6)}`,
    };
    this.documentRecords.unshift(newDoc);

    if (this.sheetsClient.isConfigured()) {
      try {
        const res = await this.sheetsClient.appendRow('Documents', [
          newDoc.document_id,
          newDoc.vehicle_id,
          newDoc.document_type,
          newDoc.document_number,
          newDoc.issue_date,
          newDoc.expiry_date,
          newDoc.issuer,
          newDoc.file_url || '',
          newDoc.notes,
          newDoc.recorded_by,
        ]);
        newDoc.row_index = res.rowIndex;
      } catch (err: any) {
        console.error('[DataStore] Error appending document in Sheets:', err.message);
      }
    }
    return newDoc;
  }

  public async updateDocument(id: string, updates: Partial<DocumentRecord>): Promise<DocumentRecord | null> {
    const idx = this.documentRecords.findIndex(d => d.document_id === id);
    if (idx === -1) return null;
    this.documentRecords[idx] = { ...this.documentRecords[idx], ...updates };
    const updated = this.documentRecords[idx];

    if (this.sheetsClient.isConfigured() && updated.row_index) {
      try {
        await this.sheetsClient.updateRow('Documents', updated.row_index, [
          updated.document_id,
          updated.vehicle_id,
          updated.document_type,
          updated.document_number,
          updated.issue_date,
          updated.expiry_date,
          updated.issuer,
          updated.file_url || '',
          updated.notes,
          updated.recorded_by,
        ]);
      } catch (err: any) {
        console.error('[DataStore] Error updating document in Sheets:', err.message);
      }
    }
    return updated;
  }

  public async addExpense(data: Omit<ExpenseRecord, 'expense_id'>): Promise<ExpenseRecord> {
    const newExp: ExpenseRecord = {
      ...data,
      expense_id: `exp-${Date.now().toString().slice(-6)}`,
    };
    this.expenseRecords.unshift(newExp);

    if (this.sheetsClient.isConfigured()) {
      try {
        const res = await this.sheetsClient.appendRow('Expenses', [
          newExp.expense_id,
          newExp.date,
          newExp.vehicle_id,
          newExp.category,
          newExp.description,
          newExp.amount,
          newExp.vendor,
          newExp.receipt_url || '',
          newExp.notes,
          newExp.recorded_by,
        ]);
        newExp.row_index = res.rowIndex;
      } catch (err: any) {
        console.error('[DataStore] Error appending expense in Sheets:', err.message);
      }
    }
    return newExp;
  }

  public async updateExpense(id: string, updates: Partial<ExpenseRecord>): Promise<ExpenseRecord | null> {
    const idx = this.expenseRecords.findIndex(e => e.expense_id === id);
    if (idx === -1) return null;
    this.expenseRecords[idx] = { ...this.expenseRecords[idx], ...updates };
    const updated = this.expenseRecords[idx];

    if (this.sheetsClient.isConfigured() && updated.row_index) {
      try {
        await this.sheetsClient.updateRow('Expenses', updated.row_index, [
          updated.expense_id,
          updated.date,
          updated.vehicle_id,
          updated.category,
          updated.description,
          updated.amount,
          updated.vendor,
          updated.receipt_url || '',
          updated.notes,
          updated.recorded_by,
        ]);
      } catch (err: any) {
        console.error('[DataStore] Error updating expense in Sheets:', err.message);
      }
    }
    return updated;
  }

  // Deletion Mutators with Google Sheets Synchronized Row Removal
  public async deleteVehicle(vehicleId: string): Promise<boolean> {
    const index = this.vehicles.findIndex(v => v.vehicle_id === vehicleId);
    if (index === -1) return false;
    const vehicle = this.vehicles[index];

    if (this.sheetsClient.isConfigured()) {
      try {
        const rows = await this.sheetsClient.readSheetValues('Vehicles');
        const rowIndex = rows.findIndex((r, idx) => idx > 0 && (
          r[0] === vehicleId ||
          (vehicle.registration_number && r[2]?.toString().trim().toUpperCase() === vehicle.registration_number.trim().toUpperCase())
        )) + 1;
        if (rowIndex > 1) {
          await this.sheetsClient.deleteRow('Vehicles', rowIndex);
        }
      } catch (err: any) {
        console.error('[DataStore] Error deleting vehicle in Sheets:', err.message);
      }
    }
    this.vehicles.splice(index, 1);
    this.lastWriteTimestamp = Date.now();
    return true;
  }

  public async deleteTrip(tripId: string): Promise<boolean> {
    const trip = this.trips.find(t => t.trip_id === tripId);
    if (!trip) return false;

    if (this.sheetsClient.isConfigured()) {
      const vehicle = this.vehicles.find(v => v.vehicle_id === trip.vehicle_id);
      const targetTab = trip.sheet_name || vehicle?.sheet_tab_name || 'Trips';
      try {
        const rows = await this.sheetsClient.readSheetValues(targetTab);
        let targetRowIndex = trip.row_index || -1;
        // Verify if row_index matches the row in Google Sheets
        if (targetRowIndex > 1 && rows[targetRowIndex - 1]) {
          const r = rows[targetRowIndex - 1];
          const matchesDate = (r[0] || '').toString() === trip.date;
          const matchesStartKm = parseFloat(r[3]) === trip.start_km;
          if (!matchesDate && !matchesStartKm) {
            targetRowIndex = -1;
          }
        } else {
          targetRowIndex = -1;
        }

        if (targetRowIndex <= 1) {
          const foundIdx = rows.findIndex((r, idx) => {
            if (idx === 0) return false;
            const rDate = (r[0] || '').toString();
            const rStart = parseFloat(r[3]) || 0;
            return rDate === trip.date && rStart === trip.start_km;
          });
          if (foundIdx > 0) {
            targetRowIndex = foundIdx + 1;
          }
        }

        if (targetRowIndex > 1) {
          await this.sheetsClient.deleteRow(targetTab, targetRowIndex);
        }
      } catch (err: any) {
        console.error('[DataStore] Error deleting trip from Sheets:', err.message);
      }
    }
    this.trips = this.trips.filter(t => t.trip_id !== tripId);
    // Stamp write-lock so the next background pull doesn't bring the deleted
    // row back from Sheets before propagation completes.
    this.lastWriteTimestamp = Date.now();
    return true;
  }

  public async deleteFuel(fuelId: string): Promise<boolean> {
    const fuel = this.fuelRecords.find(f => f.fuel_id === fuelId);
    if (!fuel) return false;

    if (this.sheetsClient.isConfigured()) {
      try {
        const rows = await this.sheetsClient.readSheetValues('Fuel');
        let rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === fuelId) + 1;
        if (rowIndex <= 1 && fuel.row_index && fuel.row_index <= rows.length) {
          rowIndex = fuel.row_index;
        }
        if (rowIndex <= 1) {
          rowIndex = rows.findIndex((r, idx) => idx > 0 && (r[1] || '').toString() === fuel.date && (r[2] || '').toString() === fuel.vehicle_id && parseFloat(r[6]) === fuel.amount) + 1;
        }
        if (rowIndex > 1) {
          await this.sheetsClient.deleteRow('Fuel', rowIndex);
        }
      } catch (err: any) {
        console.error('[DataStore] Error deleting fuel from Sheets:', err.message);
      }
    }
    this.fuelRecords = this.fuelRecords.filter(f => f.fuel_id !== fuelId);
    this.lastWriteTimestamp = Date.now();
    return true;
  }

  public async deleteMaintenance(id: string): Promise<boolean> {
    const record = this.maintenanceRecords.find(m => m.maintenance_id === id);
    if (!record) return false;

    if (this.sheetsClient.isConfigured()) {
      try {
        const rows = await this.sheetsClient.readSheetValues('Maintenance');
        let rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === id) + 1;
        if (rowIndex <= 1 && record.row_index && record.row_index <= rows.length) {
          rowIndex = record.row_index;
        }
        if (rowIndex <= 1) {
          rowIndex = rows.findIndex((r, idx) => idx > 0 && (r[1] || '').toString() === record.service_date && (r[2] || '').toString() === record.vehicle_id && parseFloat(r[7]) === record.cost) + 1;
        }
        if (rowIndex > 1) {
          await this.sheetsClient.deleteRow('Maintenance', rowIndex);
        }
      } catch (err: any) {
        console.error('[DataStore] Error deleting maintenance from Sheets:', err.message);
      }
    }
    this.maintenanceRecords = this.maintenanceRecords.filter(m => m.maintenance_id !== id);
    this.lastWriteTimestamp = Date.now();
    return true;
  }

  public async deleteDocument(id: string): Promise<boolean> {
    const doc = this.documentRecords.find(d => d.document_id === id);
    if (!doc) return false;

    if (this.sheetsClient.isConfigured()) {
      try {
        const rows = await this.sheetsClient.readSheetValues('Documents');
        let rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === id) + 1;
        if (rowIndex <= 1 && doc.row_index && doc.row_index <= rows.length) {
          rowIndex = doc.row_index;
        }
        if (rowIndex <= 1) {
          rowIndex = rows.findIndex((r, idx) => idx > 0 && (r[1] || '').toString() === doc.vehicle_id && (r[3] || '').toString() === doc.document_number) + 1;
        }
        if (rowIndex > 1) {
          await this.sheetsClient.deleteRow('Documents', rowIndex);
        }
      } catch (err: any) {
        console.error('[DataStore] Error deleting document from Sheets:', err.message);
      }
    }
    this.documentRecords = this.documentRecords.filter(d => d.document_id !== id);
    this.lastWriteTimestamp = Date.now();
    return true;
  }

  public async deleteExpense(id: string): Promise<boolean> {
    const exp = this.expenseRecords.find(e => e.expense_id === id);
    if (!exp) return false;

    if (this.sheetsClient.isConfigured()) {
      try {
        const rows = await this.sheetsClient.readSheetValues('Expenses');
        let rowIndex = rows.findIndex((r, idx) => idx > 0 && r[0] === id) + 1;
        if (rowIndex <= 1 && exp.row_index && exp.row_index <= rows.length) {
          rowIndex = exp.row_index;
        }
        if (rowIndex <= 1) {
          rowIndex = rows.findIndex((r, idx) => idx > 0 && (r[1] || '').toString() === exp.date && (r[2] || '').toString() === exp.vehicle_id && parseFloat(r[5]) === exp.amount) + 1;
        }
        if (rowIndex > 1) {
          await this.sheetsClient.deleteRow('Expenses', rowIndex);
        }
      } catch (err: any) {
        console.error('[DataStore] Error deleting expense from Sheets:', err.message);
      }
    }
    this.expenseRecords = this.expenseRecords.filter(e => e.expense_id !== id);
    this.lastWriteTimestamp = Date.now();
    return true;
  }

  public updateSetting(key: string, value: string): void {
    const item = this.settings.find(s => s.key === key);
    if (item) {
      item.value = value;
    } else {
      this.settings.push({ key, value, description: '' });
    }
  }

  public dismissAlert(alertId: string): void {
    this.dismissedAlertIds.add(alertId);
  }

  public getDismissedAlerts(): Set<string> {
    return this.dismissedAlertIds;
  }
}

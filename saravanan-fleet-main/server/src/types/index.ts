export interface Vehicle {
  vehicle_id: string;
  vehicle_name: string;
  registration_number: string;
  vehicle_type: string; // Car, Bus, Truck, LCV, Van, etc.
  fuel_type: string; // Diesel, Petrol, CNG, EV
  photo_url: string;
  sheet_tab_name: string;
  active: boolean;
  notes: string;
}

export interface Trip {
  trip_id: string;
  vehicle_id: string;
  date: string; // YYYY-MM-DD
  from: string;
  to: string;
  start_km: number;
  end_km?: number | null;
  distance: number;
  remark: string;
  amount: number;
  driver?: string;
  employee?: string;
  status: 'COMPLETED' | 'UNFINISHED';
  sheet_name?: string;
  row_index?: number;
}

export interface FuelRecord {
  fuel_id: string;
  date: string; // YYYY-MM-DD
  vehicle_id: string;
  odometer: number;
  fuel_type: string;
  litres: number;
  amount: number;
  vendor: string;
  remarks: string;
  recorded_by: string;
  receipt_url?: string;
  row_index?: number;
}

export interface MaintenanceRecord {
  maintenance_id: string;
  vehicle_id: string;
  service_date: string; // YYYY-MM-DD
  odometer: number;
  category: string; // Scheduled Service, Oil Change, Tyres, Battery, Brakes, Electrical, Minor Repair, Emergency Repair, Other
  description: string;
  workshop: string;
  cost: number;
  next_service_due_km?: number | null;
  next_service_due_date?: string | null;
  notes: string;
  recorded_by: string;
  row_index?: number;
}

export interface DocumentRecord {
  document_id: string;
  vehicle_id: string;
  document_type: 'Insurance' | 'Registration' | 'PUC' | 'Fitness' | 'Permit' | 'Tax' | 'Other';
  document_number: string;
  issue_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  issuer: string;
  file_url?: string;
  notes: string;
  recorded_by: string;
  row_index?: number;
}

export interface ExpenseRecord {
  expense_id: string;
  date: string; // YYYY-MM-DD
  vehicle_id: string;
  category: 'Tolls' | 'Parking' | 'Permits & Taxes' | 'Cleaning/Washing' | 'Driver Allowance' | 'Fines' | 'Repairs' | 'Other';
  description: string;
  amount: number;
  vendor: string;
  receipt_url?: string;
  notes: string;
  recorded_by: string;
  row_index?: number;
}

export interface SettingRecord {
  key: string;
  value: string;
  description: string;
}

export interface AlertItem {
  id: string;
  type: 'SERVICE_KM' | 'SERVICE_DATE' | 'SERVICE_OVERDUE' | 'DOC_EXPIRED' | 'DOC_EXPIRING_SOON' | 'UNFINISHED_TRIP';
  severity: 'critical' | 'warning' | 'info';
  vehicle_id: string;
  vehicle_name: string;
  registration_number: string;
  title: string;
  description: string;
  due_date?: string | null;
  due_km?: number | null;
  remaining_days?: number | null;
  remaining_km?: number | null;
  suggested_action: string;
  dismissed?: boolean;
}

export interface SyncStatus {
  last_synced_at: string | null;
  sync_state: 'idle' | 'syncing' | 'error';
  source: 'google_sheets' | 'local_cache' | 'mock_fallback';
  message: string;
  spreadsheet_id?: string;
}

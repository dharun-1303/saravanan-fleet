export type UserRole =
  | 'super_admin'
  | 'operations_manager'
  | 'accounts_auditor'
  | 'security_gate'
  | 'driver';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  username?: string;
  role: UserRole;
  driverName?: string;
  gateStation?: string;
  canBypassQR?: boolean;
}

export interface RoleConfig {
  label: string;
  badgeLabel: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  super_admin: {
    label: 'Super Admin',
    badgeLabel: 'Super Admin',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-100 border-purple-300',
    badgeText: 'text-purple-800',
    description: 'Full access to all modules, settings, and user management',
  },
  operations_manager: {
    label: 'Fleet / Operations Manager',
    badgeLabel: 'Ops Manager',
    color: '#2563eb',
    badgeBg: 'bg-blue-100 border-blue-300',
    badgeText: 'text-blue-800',
    description: 'Manage vehicles, trips, fuel, maintenance, documents, and alerts',
  },
  accounts_auditor: {
    label: 'Accounts / Auditor',
    badgeLabel: 'Accounts / Auditor',
    color: '#f59e0b',
    badgeBg: 'bg-amber-100 border-amber-300',
    badgeText: 'text-amber-800',
    description: 'View & export access to trips, fuel, expenses, and audit reports',
  },
  security_gate: {
    label: 'Security Gate',
    badgeLabel: 'Security Gate',
    color: '#10b981',
    badgeBg: 'bg-emerald-100 border-emerald-300',
    badgeText: 'text-emerald-800',
    description: 'Gate In and Gate Out vehicle verification and approvals',
  },
  driver: {
    label: 'Driver',
    badgeLabel: 'Driver',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-100 border-cyan-300',
    badgeText: 'text-cyan-800',
    description: 'Quick trip log via vehicle QR code with departure/return readings',
  },
};

export const DEFAULT_USERS = [
  {
    id: 'u-admin',
    name: 'Saravanan Perumal',
    email: 'admin@saravanan.com',
    username: 'admin',
    password: 'admin123',
    role: 'super_admin' as UserRole,
  },
  {
    id: 'u-manager',
    name: 'Operations Manager',
    email: 'manager@saravanan.com',
    username: 'manager',
    password: 'manager123',
    role: 'operations_manager' as UserRole,
  },
  {
    id: 'u-auditor',
    name: 'Finance & Accounts Auditor',
    email: 'accounts@saravanan.com',
    username: 'accounts',
    password: 'accounts123',
    role: 'accounts_auditor' as UserRole,
  },
];

export const DEFAULT_SECURITY_GATE_PIN = '9999';
export const DEFAULT_DRIVER_PIN = '1234';

export const KNOWN_DRIVERS = [
  'Sathish',
  'Saravanan Perumal',
  'Gowtham',
  'Vignesh',
  'Ramesh',
  'Karthik',
];

export interface RolePermissions {
  allowedTabs: string[];
  canAddVehicle: boolean;
  canEditVehicle: boolean;
  canDeleteVehicle: boolean;
  canAddTrip: boolean;
  canEditTrip: boolean;
  canDeleteTrip: boolean;
  canGateApprove: boolean;
  canAddFuel: boolean;
  canEditFuel: boolean;
  canDeleteFuel: boolean;
  canAddExpense: boolean;
  canEditExpense: boolean;
  canDeleteExpense: boolean;
  canAddMaintenance: boolean;
  canEditMaintenance: boolean;
  canDeleteMaintenance: boolean;
  canAddDocument: boolean;
  canEditDocument: boolean;
  canDeleteDocument: boolean;
  canManageSettings: boolean;
  canExportCSV: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  super_admin: {
    allowedTabs: [
      'dashboard',
      'vehicles',
      'trips',
      'fuel',
      'expenses',
      'maintenance',
      'documents',
      'alerts',
      'analytics',
      'reports',
      'settings',
    ],
    canAddVehicle: true,
    canEditVehicle: true,
    canDeleteVehicle: true,
    canAddTrip: true,
    canEditTrip: true,
    canDeleteTrip: true,
    canGateApprove: true,
    canAddFuel: true,
    canEditFuel: true,
    canDeleteFuel: true,
    canAddExpense: true,
    canEditExpense: true,
    canDeleteExpense: true,
    canAddMaintenance: true,
    canEditMaintenance: true,
    canDeleteMaintenance: true,
    canAddDocument: true,
    canEditDocument: true,
    canDeleteDocument: true,
    canManageSettings: true,
    canExportCSV: true,
  },
  operations_manager: {
    allowedTabs: [
      'dashboard',
      'vehicles',
      'trips',
      'fuel',
      'maintenance',
      'documents',
      'alerts',
      'reports',
    ],
    canAddVehicle: true,
    canEditVehicle: true,
    canDeleteVehicle: false,
    canAddTrip: true,
    canEditTrip: true,
    canDeleteTrip: false,
    canGateApprove: true,
    canAddFuel: true,
    canEditFuel: true,
    canDeleteFuel: false,
    canAddExpense: false,
    canEditExpense: false,
    canDeleteExpense: false,
    canAddMaintenance: true,
    canEditMaintenance: true,
    canDeleteMaintenance: false,
    canAddDocument: true,
    canEditDocument: true,
    canDeleteDocument: false,
    canManageSettings: false,
    canExportCSV: true,
  },
  accounts_auditor: {
    allowedTabs: ['trips', 'fuel', 'expenses', 'reports'],
    canAddVehicle: false,
    canEditVehicle: false,
    canDeleteVehicle: false,
    canAddTrip: false,
    canEditTrip: false,
    canDeleteTrip: false,
    canGateApprove: false,
    canAddFuel: false,
    canEditFuel: false,
    canDeleteFuel: false,
    canAddExpense: false,
    canEditExpense: false,
    canDeleteExpense: false,
    canAddMaintenance: false,
    canEditMaintenance: false,
    canDeleteMaintenance: false,
    canAddDocument: false,
    canEditDocument: false,
    canDeleteDocument: false,
    canManageSettings: false,
    canExportCSV: true,
  },
  security_gate: {
    allowedTabs: ['trips'],
    canAddVehicle: false,
    canEditVehicle: false,
    canDeleteVehicle: false,
    canAddTrip: false,
    canEditTrip: false,
    canDeleteTrip: false,
    canGateApprove: true,
    canAddFuel: false,
    canEditFuel: false,
    canDeleteFuel: false,
    canAddExpense: false,
    canEditExpense: false,
    canDeleteExpense: false,
    canAddMaintenance: false,
    canEditMaintenance: false,
    canDeleteMaintenance: false,
    canAddDocument: false,
    canEditDocument: false,
    canDeleteDocument: false,
    canManageSettings: false,
    canExportCSV: false,
  },
  driver: {
    allowedTabs: ['trips'],
    canAddVehicle: false,
    canEditVehicle: false,
    canDeleteVehicle: false,
    canAddTrip: true,
    canEditTrip: true,
    canDeleteTrip: true,
    canGateApprove: false,
    canAddFuel: false,
    canEditFuel: false,
    canDeleteFuel: false,
    canAddExpense: false,
    canEditExpense: false,
    canDeleteExpense: false,
    canAddMaintenance: false,
    canEditMaintenance: false,
    canDeleteMaintenance: false,
    canAddDocument: false,
    canEditDocument: false,
    canDeleteDocument: false,
    canManageSettings: false,
    canExportCSV: false,
  },
};

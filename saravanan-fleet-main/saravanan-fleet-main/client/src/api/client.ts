import { Vehicle, Trip, FuelRecord, MaintenanceRecord, DocumentRecord, ExpenseRecord, SettingRecord, AlertItem, SyncStatus, AnalyticsSummary } from '../types';

// Support both VITE_API_URL and VITE_API_BASE_URL, with automatic slash/api cleanup
function resolveApiBase(): string {
  const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!envUrl) return '/api';
  const clean = envUrl.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

export const API_BASE = resolveApiBase();

function getAuthHeaders(): Record<string, string> {
  try {
    const saved = localStorage.getItem('saravanan_fleet_auth');
    if (saved) {
      const u = JSON.parse(saved);
      const headers: Record<string, string> = {};
      if (u.role) headers['x-user-role'] = encodeURIComponent(String(u.role));
      if (u.id) headers['x-user-id'] = encodeURIComponent(String(u.id));
      const dName = u.driverName || u.name;
      if (dName) headers['x-driver-name'] = encodeURIComponent(String(dName));
      return headers;
    }
  } catch {}
  return {};
}

export const api = {
  // Sync
  async getSyncStatus(): Promise<SyncStatus> {
    const res = await fetch(`${API_BASE}/sync/status`);
    return res.json();
  },

  async refreshSync(): Promise<{ success: boolean; status: SyncStatus }> {
    const res = await fetch(`${API_BASE}/sync/refresh`, { method: 'POST' });
    return res.json();
  },

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    const res = await fetch(`${API_BASE}/vehicles`);
    return res.json();
  },

  async getVehicle(id: string): Promise<Vehicle> {
    const res = await fetch(`${API_BASE}/vehicles/${id}`);
    if (!res.ok) throw new Error('Vehicle not found');
    return res.json();
  },

  async createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const res = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create vehicle');
    }
    return res.json();
  },

  async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const res = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update vehicle');
    return res.json();
  },

  async deleteVehicle(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/vehicles/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete vehicle');
    }
    return true;
  },

  // Trips
  async getTrips(vehicleId?: string): Promise<Trip[]> {
    const url = vehicleId ? `${API_BASE}/trips?vehicleId=${encodeURIComponent(vehicleId)}` : `${API_BASE}/trips`;
    const res = await fetch(url);
    return res.json();
  },

  async getActiveTrip(vehicleId: string): Promise<Trip | null> {
    const res = await fetch(`${API_BASE}/trips/active/${encodeURIComponent(vehicleId)}`);
    if (!res.ok) return null;
    return res.json();
  },

  async createTrip(data: Partial<Trip>): Promise<Trip> {
    const res = await fetch(`${API_BASE}/trips`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create trip');
    }
    const json = await res.json();
    return json.trip ? json.trip : json;
  },

  async gateOutTrip(id: string, data: { gate_out_by?: string; security_guard_out?: string; gate_out_time: string }): Promise<Trip> {
    const guard = data.security_guard_out || data.gate_out_by || 'Gate Security Guard';
    const payload = {
      trip_id: id,
      gate_out_by: guard,
      security_guard_out: guard,
      gate_out_time: data.gate_out_time,
      gate_status: 'DISPATCHED' as const,
      status: 'IN_TRANSIT' as const,
      trip_status: 'IN_TRANSIT' as const,
    };

    const res = await fetch(`${API_BASE}/trips/gate-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      return json.trip ? json.trip : json;
    }
    if (res.status !== 404 && res.status !== 405) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to approve Gate Out (${res.status})`);
    }

    return this.updateTrip(id, payload);
  },

  async closeActiveTrip(id: string, data: { end_km: number; distance?: number; enroute?: string; remarks?: string; remark?: string; gate_status?: string }): Promise<Trip> {
    const payload = {
      trip_id: id,
      end_km: data.end_km,
      distance: data.distance,
      enroute: data.enroute,
      remarks: data.remarks || data.remark,
      remark: data.remarks || data.remark,
      gate_status: 'PENDING_ENTRY' as const,
    };

    const res = await fetch(`${API_BASE}/trips/close-active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      return json.trip ? json.trip : json;
    }
    if (res.status !== 404 && res.status !== 405) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to close active trip (${res.status})`);
    }

    return this.updateTrip(id, payload);
  },

  async gateInTrip(id: string, data: { gate_in_by?: string; security_guard_in?: string; gate_in_time: string; end_km?: number | null; enroute?: string }): Promise<Trip> {
    const guard = data.security_guard_in || data.gate_in_by || 'Gate Security Guard';
    const payload = {
      trip_id: id,
      gate_in_by: guard,
      security_guard_in: guard,
      gate_in_time: data.gate_in_time,
      end_km: data.end_km,
      enroute: data.enroute,
      gate_status: 'COMPLETED' as const,
      status: 'COMPLETED' as const,
      trip_status: 'COMPLETED' as const,
    };

    const res = await fetch(`${API_BASE}/trips/gate-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      return json.trip ? json.trip : json;
    }
    if (res.status !== 404 && res.status !== 405) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to approve Gate In (${res.status})`);
    }

    return this.updateTrip(id, payload);
  },

  async updateTrip(id: string, data: Partial<Trip>): Promise<Trip> {
    const res = await fetch(`${API_BASE}/trips/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update trip');
    }
    const json = await res.json();
    return json.trip ? json.trip : json;
  },

  async deleteTrip(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/trips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete trip');
    }
    return true;
  },

  // Fuel
  async getFuel(vehicleId?: string): Promise<FuelRecord[]> {
    const url = vehicleId ? `${API_BASE}/fuel?vehicleId=${encodeURIComponent(vehicleId)}` : `${API_BASE}/fuel`;
    const res = await fetch(url);
    return res.json();
  },

  async createFuel(data: Partial<FuelRecord>): Promise<FuelRecord> {
    const res = await fetch(`${API_BASE}/fuel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create fuel log');
    }
    return res.json();
  },

  async updateFuel(id: string, data: Partial<FuelRecord>): Promise<FuelRecord> {
    const res = await fetch(`${API_BASE}/fuel/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update fuel log');
    return res.json();
  },

  async deleteFuel(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/fuel/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete fuel record');
    }
    return true;
  },

  // Maintenance
  async getMaintenance(vehicleId?: string): Promise<MaintenanceRecord[]> {
    const url = vehicleId ? `${API_BASE}/maintenance?vehicleId=${encodeURIComponent(vehicleId)}` : `${API_BASE}/maintenance`;
    const res = await fetch(url);
    return res.json();
  },

  async createMaintenance(data: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    const res = await fetch(`${API_BASE}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create maintenance record');
    }
    return res.json();
  },

  async updateMaintenance(id: string, data: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    const res = await fetch(`${API_BASE}/maintenance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update maintenance record');
    return res.json();
  },

  async deleteMaintenance(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/maintenance/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete maintenance record');
    }
    return true;
  },

  // Documents
  async getDocuments(vehicleId?: string): Promise<DocumentRecord[]> {
    const url = vehicleId ? `${API_BASE}/documents?vehicleId=${encodeURIComponent(vehicleId)}` : `${API_BASE}/documents`;
    const res = await fetch(url);
    return res.json();
  },

  async createDocument(data: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const res = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add document');
    }
    return res.json();
  },

  async updateDocument(id: string, data: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update document');
    return res.json();
  },

  async deleteDocument(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete document');
    }
    return true;
  },

  // Expenses
  async getExpenses(vehicleId?: string): Promise<ExpenseRecord[]> {
    const url = vehicleId ? `${API_BASE}/expenses?vehicleId=${encodeURIComponent(vehicleId)}` : `${API_BASE}/expenses`;
    const res = await fetch(url);
    return res.json();
  },

  async createExpense(data: Partial<ExpenseRecord>): Promise<ExpenseRecord> {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add expense');
    }
    return res.json();
  },

  async updateExpense(id: string, data: Partial<ExpenseRecord>): Promise<ExpenseRecord> {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update expense');
    return res.json();
  },

  async deleteExpense(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete expense record');
    }
    return true;
  },

  // Alerts
  async getAlerts(): Promise<AlertItem[]> {
    const res = await fetch(`${API_BASE}/alerts`);
    return res.json();
  },

  async dismissAlert(alertId: string): Promise<void> {
    await fetch(`${API_BASE}/alerts/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId }),
    });
  },

  // Analytics
  async getAnalytics(params: {
    type?: string;
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
    vehicleId?: string;
  }): Promise<AnalyticsSummary> {
    const query = new URLSearchParams();
    if (params.type) query.set('type', params.type);
    if (params.year) query.set('year', params.year.toString());
    if (params.month) query.set('month', params.month.toString());
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.vehicleId) query.set('vehicleId', params.vehicleId);

    const res = await fetch(`${API_BASE}/analytics?${query.toString()}`);
    return res.json();
  },

  // Settings
  async getSettings(): Promise<SettingRecord[]> {
    const res = await fetch(`${API_BASE}/settings`);
    return res.json();
  },

  async updateSetting(key: string, value: string): Promise<{ success: boolean; settings: SettingRecord[] }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    return res.json();
  },

  getExportUrl(type: string, vehicleId?: string): string {
    const query = new URLSearchParams({ type });
    if (vehicleId) query.set('vehicleId', vehicleId);
    return `${API_BASE}/reports/csv?${query.toString()}`;
  },

  // File Uploads
  async uploadPhoto(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/upload-photo`, { method: 'POST', body: form });
    if (!res.ok) {
      const fallback = await fetch(`${API_BASE}/upload/photo`, { method: 'POST', body: form });
      if (!fallback.ok) throw new Error('Photo upload failed');
      return fallback.json();
    }
    return res.json();
  },

  async uploadDocument(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    let res = await fetch(`${API_BASE}/upload-document`, { method: 'POST', body: form });
    if (!res.ok && res.status === 404) {
      res = await fetch(`${API_BASE}/upload/document`, { method: 'POST', body: form });
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || 'Document upload failed');
    }
    return res.json();
  },
};

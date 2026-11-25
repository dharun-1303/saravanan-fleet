import { Vehicle, Trip, FuelRecord, MaintenanceRecord, DocumentRecord, ExpenseRecord, SettingRecord, AlertItem, SyncStatus, AnalyticsSummary, AppUser, DriverRecord } from '../types';

// Support both VITE_API_URL and VITE_API_BASE_URL, with automatic slash/api cleanup
function resolveApiBase(): string {
  const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envUrl) {
    const clean = envUrl.replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }
  // When running locally in Vite dev mode (npm run dev), explicitly hit local backend
  if (import.meta.env.DEV) {
    return 'http://localhost:5001/api';
  }
  // In production (Vercel / deployed build), default cleanly to the live Render backend
  if (import.meta.env.PROD) {
    return 'https://saravanan-fleet.onrender.com/api';
  }
  return 'http://localhost:5001/api';
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
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to create trip (${res.status})`);
      } else {
        throw new Error(`Failed to create trip (${res.status}): Server returned non-JSON response`);
      }
    }
    if (!contentType.includes('application/json')) {
      throw new Error('Backend returned invalid response (HTML/non-JSON). Check API URL configuration.');
    }
    const json = await res.json();
    const trip = json.trip ? json.trip : json;
    if (!trip || !trip.trip_id) {
      throw new Error('Backend failed to confirm trip was saved to Google Sheets');
    }
    return trip;
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

  // Drivers
  async getDrivers(): Promise<DriverRecord[]> {
    try {
      const res = await fetch(`${API_BASE}/drivers`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('saravanan_fleet_drivers', JSON.stringify(data));
          return data;
        }
      }
    } catch {}

    try {
      const saved = localStorage.getItem('saravanan_fleet_drivers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    return [
      { driver_id: 'driver-satheesh', name: 'Satheesh', active: true },
      { driver_id: 'driver-saravanan-perumal', name: 'Saravanan Perumal', active: true },
      { driver_id: 'driver-ravi', name: 'Ravi', active: true },
    ];
  },

  async createDriver(data: {
    name: string;
    phone?: string;
    license_number?: string;
    assigned_vehicle?: string;
    active?: boolean;
  }): Promise<DriverRecord> {
    const cleanName = data.name.trim();
    const cleanPhone = (data.phone || '').trim();
    const cleanLicense = (data.license_number || '').trim();
    const cleanVehicle = (data.assigned_vehicle || '').trim();
    const payload = {
      name: cleanName,
      phone: cleanPhone,
      license_number: cleanLicense,
      assigned_vehicle: cleanVehicle,
      active: data.active !== false,
    };

    try {
      const res = await fetch(`${API_BASE}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        try {
          const current = await this.getDrivers();
          const updated = [...current.filter(d => d.driver_id !== created.driver_id), created];
          localStorage.setItem('saravanan_fleet_drivers', JSON.stringify(updated));
        } catch {}
        return created;
      }
    } catch (err: any) {
      console.warn('POST /api/drivers failed, falling back to local/settings persistence:', err.message);
    }

    // Fallback: When backend endpoint is not yet deployed or unreachable, persist seamlessly to settings & storage
    const newDriver: DriverRecord = {
      driver_id: `drv-${Date.now().toString().slice(-6)}`,
      name: cleanName,
      phone: cleanPhone,
      license_number: cleanLicense,
      assigned_vehicle: cleanVehicle,
      active: data.active !== false,
    };

    try {
      const current = await this.getDrivers();
      const updated = [...current, newDriver];
      localStorage.setItem('saravanan_fleet_drivers', JSON.stringify(updated));
      await this.updateSetting('APP_DRIVERS_JSON', JSON.stringify(updated)).catch(() => {});
    } catch {}

    return newDriver;
  },

  async updateDriver(id: string, data: Partial<DriverRecord>): Promise<DriverRecord> {
    const cleanId = (id || '').trim();
    try {
      const res = await fetch(`${API_BASE}/drivers/${encodeURIComponent(cleanId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        try {
          const current = await this.getDrivers();
          const nextList = current.map(d =>
            d.driver_id === cleanId || d.name === cleanId ? { ...d, ...updated } : d
          );
          localStorage.setItem('saravanan_fleet_drivers', JSON.stringify(nextList));
        } catch {}
        return updated;
      }
    } catch (err: any) {
      console.warn('PUT /api/drivers failed, falling back to local/settings persistence:', err.message);
    }

    // Fallback
    try {
      const current = await this.getDrivers();
      const existing = current.find(d => d.driver_id === cleanId || d.name === cleanId);
      const merged: DriverRecord = {
        driver_id: existing?.driver_id || cleanId,
        name: data.name !== undefined ? data.name.trim() : (existing?.name || cleanId),
        phone: data.phone !== undefined ? data.phone.trim() : existing?.phone,
        license_number: data.license_number !== undefined ? data.license_number.trim() : existing?.license_number,
        assigned_vehicle: data.assigned_vehicle !== undefined ? data.assigned_vehicle.trim() : existing?.assigned_vehicle,
        active: data.active !== undefined ? Boolean(data.active) : (existing?.active !== false),
      };
      const nextList = current.map(d =>
        d.driver_id === cleanId || d.name === cleanId ? merged : d
      );
      if (!current.some(d => d.driver_id === cleanId || d.name === cleanId)) {
        nextList.push(merged);
      }
      localStorage.setItem('saravanan_fleet_drivers', JSON.stringify(nextList));
      await this.updateSetting('APP_DRIVERS_JSON', JSON.stringify(nextList)).catch(() => {});
      return merged;
    } catch {}

    return {
      driver_id: cleanId,
      name: data.name || cleanId,
      ...data,
    };
  },

  async deleteDriver(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/drivers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        try {
          const current = await this.getDrivers();
          const updated = current.filter(d => d.driver_id !== id && d.name !== id);
          localStorage.setItem('saravanan_fleet_drivers', JSON.stringify(updated));
        } catch {}
        return true;
      }
    } catch (err: any) {
      console.warn('DELETE /api/drivers failed, falling back to local/settings persistence:', err.message);
    }

    try {
      const current = await this.getDrivers();
      const updated = current.filter(d => d.driver_id !== id && d.name !== id);
      localStorage.setItem('saravanan_fleet_drivers', JSON.stringify(updated));
      await this.updateSetting('APP_DRIVERS_JSON', JSON.stringify(updated)).catch(() => {});
    } catch {}

    return true;
  },

  // Users & Auth
  async getUsers(): Promise<AppUser[]> {
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {}
    return [];
  },

  async createUser(data: Partial<AppUser>): Promise<AppUser> {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      console.warn('POST /api/users failed, falling back to settings persistence:', err.message);
    }

    const newUser: AppUser = {
      id: `u-${Date.now().toString().slice(-6)}`,
      name: (data.name || '').trim(),
      username: (data.username || '').trim(),
      email: (data.email || `${data.username}@saravanan.com`).trim(),
      password: (data.password || '').trim(),
      role: data.role || 'operations_manager',
    };

    try {
      const current = await this.getUsers();
      const updated = [...current, newUser];
      await this.updateSetting('APP_USERS_JSON', JSON.stringify(updated)).catch(() => {});
    } catch {}

    return newUser;
  },

  async updateUserPassword(id: string, password: string): Promise<{ success: boolean; user?: AppUser }> {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      console.warn('PUT /api/users/:id/password failed, falling back to settings persistence:', err.message);
    }

    try {
      const users = await this.getUsers();
      const updated = users.map(u => u.id === id ? { ...u, password } : u);
      await this.updateSetting('APP_USERS_JSON', JSON.stringify(updated));
      const targetUser = updated.find(u => u.id === id);
      return { success: true, user: targetUser };
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update user password');
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        return true;
      }
    } catch (err: any) {
      console.warn('DELETE /api/users/:id failed, falling back to settings persistence:', err.message);
    }

    try {
      const current = await this.getUsers();
      const updated = current.filter(u => u.id !== id);
      await this.updateSetting('APP_USERS_JSON', JSON.stringify(updated));
      return true;
    } catch {}

    return true;
  },

  async login(credentials: {
    role?: string;
    driverName?: string;
    identifier?: string;
    username?: string;
    email?: string;
    password?: string;
    pin?: string;
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return res.json();
  },
};

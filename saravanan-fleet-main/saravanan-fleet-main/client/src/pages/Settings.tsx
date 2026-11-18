import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  ShieldCheck,
  Save,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Key,
  Users,
  Lock,
  Plus,
  Trash2,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  UserCheck,
} from 'lucide-react';
import {
  SettingRecord,
  SyncStatus,
  UserRole,
  DEFAULT_USERS,
  DEFAULT_SECURITY_GATE_PIN,
  DEFAULT_DRIVER_PIN,
  ROLE_CONFIGS,
} from '../types';

interface SettingsProps {
  settings: SettingRecord[];
  syncStatus: SyncStatus;
  onUpdateSetting: (key: string, value: string) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsProps> = ({
  settings,
  syncStatus,
  onUpdateSetting,
}) => {
  const [formValues, setFormValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    settings.forEach(s => {
      map[s.key] = s.value;
    });
    return map;
  });

  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Security Gate PIN State
  const [gatePin, setGatePin] = useState<string>(() => {
    const s = settings.find(x => x.key === 'SECURITY_GATE_PIN');
    return s ? s.value : DEFAULT_SECURITY_GATE_PIN;
  });

  // Driver PIN State
  const [driverPin, setDriverPin] = useState<string>(() => {
    const s = settings.find(x => x.key === 'DRIVER_PIN');
    return s ? s.value : DEFAULT_DRIVER_PIN;
  });

  // Staff User Management State
  const [staffUsers, setStaffUsers] = useState<typeof DEFAULT_USERS>(() => {
    const s = settings.find(x => x.key === 'APP_USERS_JSON');
    if (s && s.value) {
      try {
        const parsed = JSON.parse(s.value);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return DEFAULT_USERS;
  });

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('operations_manager');
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const map: Record<string, string> = {};
    settings.forEach(s => {
      map[s.key] = s.value;
    });
    setFormValues(map);

    const gPin = settings.find(x => x.key === 'SECURITY_GATE_PIN');
    if (gPin) setGatePin(gPin.value);

    const dPin = settings.find(x => x.key === 'DRIVER_PIN');
    if (dPin) setDriverPin(dPin.value);

    const uJson = settings.find(x => x.key === 'APP_USERS_JSON');
    if (uJson && uJson.value) {
      try {
        const parsed = JSON.parse(uJson.value);
        if (Array.isArray(parsed) && parsed.length > 0) setStaffUsers(parsed);
      } catch {}
    }
  }, [settings]);

  const handleSave = async (key: string, customVal?: string) => {
    const val = customVal !== undefined ? customVal : formValues[key];
    if (val !== undefined) {
      await onUpdateSetting(key, val);
      setSavedSuccess(`Setting "${key}" updated successfully.`);
      setTimeout(() => setSavedSuccess(null), 3000);
    }
  };

  const handleSaveGatePin = async () => {
    const clean = gatePin.trim();
    if (!/^\d{4}$/.test(clean)) {
      alert('Security Gate PIN must be exactly 4 digits.');
      return;
    }
    await onUpdateSetting('SECURITY_GATE_PIN', clean);
    setSavedSuccess('Security Gate 4-digit PIN updated successfully.');
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleSaveDriverPin = async () => {
    const clean = driverPin.trim();
    if (!/^\d{4}$/.test(clean)) {
      alert('Driver PIN must be exactly 4 digits.');
      return;
    }
    await onUpdateSetting('DRIVER_PIN', clean);
    setSavedSuccess('Driver 4-digit PIN updated successfully.');
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleAddStaffUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword.trim()) {
      alert('Please fill all required user fields.');
      return;
    }

    const newUser = {
      id: `u-${Date.now().toString().slice(-5)}`,
      name: newUserName.trim(),
      email: newUserEmail.trim() || `${newUserUsername.trim()}@saravanan.com`,
      username: newUserUsername.trim(),
      password: newUserPassword.trim(),
      role: newUserRole,
    };

    const updated = [...staffUsers, newUser];
    setStaffUsers(updated);
    await onUpdateSetting('APP_USERS_JSON', JSON.stringify(updated));

    setShowAddUserModal(false);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserUsername('');
    setNewUserPassword('');
    setSavedSuccess(`Staff user "${newUser.name}" added successfully.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleDeleteStaffUser = async (userId: string) => {
    const target = staffUsers.find(u => u.id === userId);
    if (!target) return;

    if (target.role === 'super_admin') {
      const superAdminCount = staffUsers.filter(u => u.role === 'super_admin').length;
      if (superAdminCount <= 1) {
        alert('Cannot remove the only Super Admin account.');
        return;
      }
    }

    if (window.confirm(`Are you sure you want to remove user "${target.name}"?`)) {
      const updated = staffUsers.filter(u => u.id !== userId);
      setStaffUsers(updated);
      await onUpdateSetting('APP_USERS_JSON', JSON.stringify(updated));
      setSavedSuccess(`User "${target.name}" removed successfully.`);
      setTimeout(() => setSavedSuccess(null), 3000);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900">System Configuration &amp; RBAC Access</h2>
        <p className="text-xs text-slate-500">
          Super Admin portal to manage Staff Accounts, Security Gate PIN, and Google Sheets synchronization.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {/* 1. USER & GATE PIN MANAGEMENT SECTION (Super Admin Exclusive) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">User &amp; Gate PIN Management</h3>
              <p className="text-xs text-slate-500">Manage credentials for the 5-tier Role-Based Access system</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddUserModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Staff User</span>
          </button>
        </div>

        {/* Quick PIN Configuration Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Gate PIN Card */}
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Security Gate 4-Digit PIN</span>
              </span>
              <span className="text-[10px] bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                Gate Tablet
              </span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Used by security guards on the gate tablet to approve Gate OUT and Gate IN.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                maxLength={4}
                value={gatePin}
                onChange={e => setGatePin(e.target.value.replace(/\D/g, ''))}
                placeholder="9999"
                className="w-24 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg font-mono font-bold text-center text-sm tracking-widest text-emerald-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleSaveGatePin}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors shadow-2xs"
              >
                Update PIN
              </button>
            </div>
          </div>

          {/* Driver PIN Card */}
          <div className="bg-cyan-50/60 p-4 rounded-xl border border-cyan-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-cyan-600" />
                <span>Driver 4-Digit PIN</span>
              </span>
              <span className="text-[10px] bg-cyan-200/60 text-cyan-800 px-2 py-0.5 rounded-full font-bold">
                Driver Mode
              </span>
            </div>
            <p className="text-[11px] text-cyan-800">
              Used for optional manual driver sign-in on shared terminals. (QR scan bypasses this automatically).
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                maxLength={4}
                value={driverPin}
                onChange={e => setDriverPin(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                className="w-24 px-3 py-1.5 bg-white border border-cyan-300 rounded-lg font-mono font-bold text-center text-sm tracking-widest text-cyan-950 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={handleSaveDriverPin}
                className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white font-bold rounded-lg transition-colors shadow-2xs"
              >
                Update PIN
              </button>
            </div>
          </div>
        </div>

        {/* Configured Staff Accounts Table */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold text-slate-800 block">Configured Staff Logins</span>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Username / Email</th>
                  <th className="py-2.5 px-3">Password</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffUsers.map(u => {
                  const roleCfg = ROLE_CONFIGS[u.role];
                  const showPass = showPasswordMap[u.id];
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">{u.name}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            roleCfg?.badgeBg || 'bg-slate-100 border-slate-200'
                          } ${roleCfg?.badgeText || 'text-slate-700'}`}
                        >
                          {roleCfg?.badgeLabel || u.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        <div>{u.email}</div>
                        <div className="text-slate-400 text-[10px]">@{u.username}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{showPass ? u.password : '••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="text-slate-400 hover:text-slate-600"
                            title={showPass ? 'Hide password' : 'Show password'}
                          >
                            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteStaffUser(u.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          title="Remove user"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. DATABASE & CLOUD SPREADSHEET STATUS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Google Sheets Database Status</h3>
              <p className="text-xs text-slate-500">Direct cloud spreadsheet integration</p>
            </div>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto ${
              syncStatus.source === 'google_sheets'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {syncStatus.source === 'google_sheets' ? 'Connected (Live Sheets)' : 'Local / Offline Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-slate-500 block mb-1">Configured Spreadsheet ID:</span>
            <div className="font-mono text-slate-800 font-semibold truncate select-all">
              {syncStatus.spreadsheet_id || 'Not set in .env (Using local fallback seed)'}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-slate-500 block mb-1">Connection Diagnostics:</span>
            <div className="text-slate-700 font-medium">{syncStatus.message}</div>
          </div>
        </div>
      </div>

      {/* 3. OPERATIONAL THRESHOLDS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
          Alert Rules &amp; Operational Thresholds
        </h3>

        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Document &amp; Service Alert Days Thresholds (comma-separated days before expiry):
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={formValues['SERVICE_ALERT_DAYS'] || '30,15,7'}
                onChange={e => setFormValues({ ...formValues, SERVICE_ALERT_DAYS: e.target.value })}
                className="w-full sm:max-w-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
              />
              <button
                type="button"
                onClick={() => handleSave('SERVICE_ALERT_DAYS')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Default 30 (Info), 15 (Warning), 7 (Critical/Urgent).</p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Service Due KM Advance Thresholds (kilometres before odometer due):
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={formValues['SERVICE_ALERT_KM'] || '1000,500'}
                onChange={e => setFormValues({ ...formValues, SERVICE_ALERT_KM: e.target.value })}
                className="w-full sm:max-w-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
              />
              <button
                type="button"
                onClick={() => handleSave('SERVICE_ALERT_KM')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Triggers alert when odometer is within this range.</p>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Google Sheets Background Sync Interval (seconds):
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="number"
                value={formValues['SYNC_INTERVAL_SEC'] || '20'}
                onChange={e => setFormValues({ ...formValues, SYNC_INTERVAL_SEC: e.target.value })}
                className="w-full sm:max-w-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium"
              />
              <button
                type="button"
                onClick={() => handleSave('SYNC_INTERVAL_SEC')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-2xs transition-colors self-start sm:self-auto"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Recommended 15–30 seconds for quota conservation.</p>
          </div>
        </div>
      </div>

      {/* Add Staff User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Add New Staff User</h3>
            <form onSubmit={handleAddStaffUser} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ramesh"
                    value={newUserUsername}
                    onChange={e => setNewUserUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="ramesh@saravanan.com"
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Password *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ramesh123"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Assigned Role *</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                >
                  <option value="super_admin">Super Admin (Full System Access)</option>
                  <option value="operations_manager">Fleet / Operations Manager</option>
                  <option value="accounts_auditor">Accounts / Auditor (View &amp; Export Only)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-xs"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

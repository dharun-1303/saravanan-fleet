import React, { useState } from 'react';
import {
  Zap,
  ShieldCheck,
  User,
  QrCode,
  ArrowRight,
  Lock,
  Truck,
  AlertCircle,
  Delete,
} from 'lucide-react';
import {
  AuthUser,
  DEFAULT_USERS,
  DEFAULT_SECURITY_GATE_PIN,
  DEFAULT_DRIVER_PIN,
  KNOWN_DRIVERS,
  DriverRecord,
  AppUser,
} from '../types';
import { api } from '../api/client';

interface LoginProps {
  onLogin: (user: AuthUser) => void;
  gatePin?: string;
  driverPin?: string;
  customUsers?: AppUser[];
  drivers?: DriverRecord[];
}

export const LoginPage: React.FC<LoginProps> = ({
  onLogin,
  gatePin = DEFAULT_SECURITY_GATE_PIN,
  driverPin = DEFAULT_DRIVER_PIN,
  customUsers,
  drivers,
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'gate' | 'driver'>('staff');

  const availableDrivers = drivers && drivers.length > 0 ? drivers.map(d => d.name) : KNOWN_DRIVERS;

  // Staff Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [staffError, setStaffError] = useState<string | null>(null);

  // Security Gate PIN State
  const [enteredGatePin, setEnteredGatePin] = useState('');
  const [guardName, setGuardName] = useState('Security Guard');
  const [gateError, setGateError] = useState<string | null>(null);

  // Driver Login State (Passwordless)
  const [selectedDriver, setSelectedDriver] = useState(availableDrivers[0] || KNOWN_DRIVERS[0]);
  const [driverError, setDriverError] = useState<string | null>(null);

  const allUsers = customUsers && customUsers.length > 0 ? customUsers : DEFAULT_USERS;

  // Handle Staff login
  const handleStaffLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStaffError(null);

    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    try {
      const res = await api.login({ identifier: cleanId, password: cleanPass, role: 'staff' });
      if (res.success && res.user) {
        onLogin(res.user);
        return;
      } else if (res.error) {
        setStaffError(res.error);
        return;
      }
    } catch {
      // Fallback to local check if backend is unreachable
    }

    const matchedUser = allUsers.find(
      u => (u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId) && u.password === cleanPass
    );

    if (matchedUser) {
      onLogin({
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        username: matchedUser.username,
        role: matchedUser.role,
      });
    } else {
      setStaffError('Invalid username/email or password.');
    }
  };

  // Handle Gate PIN Login
  const handleGatePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGateError(null);

    const targetPin = (gatePin || DEFAULT_SECURITY_GATE_PIN).trim();
    if (enteredGatePin.trim() === targetPin) {
      onLogin({
        id: 'user-security-gate',
        name: guardName.trim() || 'Gate Security Guard',
        role: 'security_gate',
        gateStation: 'Main Yard Gate',
      });
    } else {
      setGateError('Incorrect 4-digit Gate PIN.');
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'back') {
      setEnteredGatePin(prev => prev.slice(0, -1));
    } else if (val === 'clear') {
      setEnteredGatePin('');
    } else if (enteredGatePin.length < 4) {
      const next = enteredGatePin + val;
      setEnteredGatePin(next);
      if (next.length === 4) {
        const targetPin = (gatePin || DEFAULT_SECURITY_GATE_PIN).trim();
        if (next === targetPin) {
          setTimeout(() => {
            onLogin({
              id: 'user-security-gate',
              name: guardName.trim() || 'Gate Security Guard',
              role: 'security_gate',
              gateStation: 'Main Yard Gate',
            });
          }, 150);
        }
      }
    }
  };

  // Handle Driver login (Passwordless)
  const handleDriverLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDriverError(null);

    const driverName = (selectedDriver || availableDrivers[0] || 'Fleet Driver').trim();
    onLogin({
      id: `driver-${driverName.toLowerCase().replace(/\s+/g, '-')}`,
      name: driverName,
      role: 'driver',
      driverName: driverName,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* Brand Header */}
      <div className="text-center mb-6 max-w-md">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/25 mb-3.5">
          <Zap className="w-8 h-8 fill-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Saravanan Electricals & Engineering
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 mt-1 font-medium">
          Fleet Operations Management &amp; Statutory Compliance Portal
        </p>
        <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5 text-blue-400" />
          <span>Role-Based Access Control (RBAC) System</span>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Tab Switcher */}
        <div className="grid grid-cols-3 bg-slate-100/80 p-1.5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'staff'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Staff / Admin</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gate')}
            className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'gate'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Security Gate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('driver')}
            className={`py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'driver'
                ? 'bg-white text-cyan-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Driver / QR</span>
          </button>
        </div>

        {/* Tab 1: Staff / Admin Form */}
        {activeTab === 'staff' && (
          <div className="p-6 sm:p-7 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Staff Credentials Login</h2>
              <p className="text-xs text-slate-500">
                Sign in as Super Admin, Operations Manager, or Accounts Auditor.
              </p>
            </div>

            {staffError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleStaffLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email or Username</label>
                <input
                  type="text"
                  required
                  placeholder="Enter email or username"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Security Gate PIN Form */}
        {activeTab === 'gate' && (
          <div className="p-6 sm:p-7 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Security Gate Tablet Access</h2>
              <p className="text-xs text-slate-500">
                Fast 4-digit PIN for security guards to approve Gate OUT &amp; Gate IN.
              </p>
            </div>

            {gateError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{gateError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1 text-xs">Guard Name / Station</label>
                <input
                  type="text"
                  value={guardName}
                  onChange={e => setGuardName(e.target.value)}
                  placeholder="e.g. Guard Murugan"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* PIN Display Dots */}
              <div className="flex flex-col items-center justify-center py-2 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Enter 4-Digit Gate PIN
                </span>
                <div className="flex items-center gap-3">
                  {[0, 1, 2, 3].map(idx => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        enteredGatePin.length > idx
                          ? 'bg-emerald-600 border-emerald-600 scale-110'
                          : 'border-slate-300 bg-white'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Touchpad Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="py-3 bg-white hover:bg-slate-100 text-slate-800 font-bold text-lg rounded-xl border border-slate-200 shadow-2xs active:scale-95 transition-all"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('clear')}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl border border-slate-200 transition-all active:scale-95"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="py-3 bg-white hover:bg-slate-100 text-slate-800 font-bold text-lg rounded-xl border border-slate-200 shadow-2xs active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('back')}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-xl border border-slate-200 transition-all active:scale-95 flex items-center justify-center"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleGatePinSubmit()}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Authorize Gate Access</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Driver / QR Fast Access */}
        {activeTab === 'driver' && (
          <div className="p-6 sm:p-7 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Driver Quick-Log &amp; QR Bypass</h2>
              <p className="text-xs text-slate-500">
                Zero-friction trip recording for vehicle drivers.
              </p>
            </div>

            {/* Zero-friction QR notice banner */}
            <div className="p-3.5 bg-cyan-50 border border-cyan-200 rounded-2xl flex items-start gap-3 text-xs text-cyan-950">
              <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <QrCode className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <span className="font-bold block text-cyan-900">Zero-Friction QR Scan Bypass:</span>
                <p className="text-cyan-800 text-[11px] leading-relaxed">
                  Scanning any vehicle QR sticker with your phone automatically bypasses this login screen and takes you directly to the trip odometer entry for that vehicle.
                </p>
              </div>
            </div>

            {driverError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{driverError}</span>
              </div>
            )}

            <form onSubmit={handleDriverLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Select Driver Name</label>
                <select
                  value={selectedDriver}
                  onChange={e => setSelectedDriver(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                >
                  {availableDrivers.map(d => (
                    <option key={d} value={d}>
                      {d} (Fleet Driver)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl shadow-md shadow-cyan-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <Truck className="w-4 h-4" />
                <span>Continue as {selectedDriver}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-slate-400">
        Google Sheets Cloud Sync Active &bull; Saravanan Fleet v2.4 RBAC
      </div>
    </div>
  );
};

import React from 'react';
import {
  LayoutDashboard,
  Truck,
  MapPin,
  Fuel,
  Receipt,
  Wrench,
  FileText,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Settings as SettingsIcon,
  Zap,
  X,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'vehicles'
  | 'trips'
  | 'fuel'
  | 'expenses'
  | 'maintenance'
  | 'documents'
  | 'alerts'
  | 'analytics'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  alertCount: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, alertCount, isOpen = false, onClose }) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vehicles' as NavTab, label: 'Vehicles', icon: Truck },
    { id: 'trips' as NavTab, label: 'Trips', icon: MapPin },
    { id: 'fuel' as NavTab, label: 'Fuel', icon: Fuel },
    { id: 'expenses' as NavTab, label: 'Expenses', icon: Receipt },
    { id: 'maintenance' as NavTab, label: 'Maintenance', icon: Wrench },
    { id: 'documents' as NavTab, label: 'Documents', icon: FileText },
    { id: 'alerts' as NavTab, label: 'Service Alerts', icon: AlertTriangle, badge: alertCount },
    { id: 'analytics' as NavTab, label: 'Analytics', icon: BarChart3 },
    { id: 'reports' as NavTab, label: 'Reports', icon: FileSpreadsheet },
    { id: 'settings' as NavTab, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 text-slate-300 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Zap className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide leading-tight">SARAVANAN</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Electricals & Eng</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav list */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Fleet Operations
          </div>
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-blue-700' : 'bg-rose-500/90 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>Enterprise Fleet v2.4</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-[11px] text-slate-500 truncate">Google Sheets Database</p>
        </div>
      </aside>
    </>
  );
};

import React from 'react';
import { RefreshCw, QrCode, PlusCircle, CheckCircle2, AlertCircle, Database, Menu } from 'lucide-react';
import { SyncStatus } from '../types';

interface NavbarProps {
  syncStatus: SyncStatus;
  isSyncing: boolean;
  onRefreshSync: () => void;
  onOpenQRScanner: () => void;
  onQuickAddTrip: () => void;
  title: string;
  onOpenMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  syncStatus,
  isSyncing,
  onRefreshSync,
  onOpenQRScanner,
  onQuickAddTrip,
  title,
  onOpenMobileMenu,
}) => {
  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs gap-2">
      {/* Title & Hamburger Button */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate">{title}</h2>
      </div>

      {/* Actions & Sync Status */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Sync Status Badge */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">
            {syncStatus.source === 'google_sheets' ? 'Google Sheets' : 'Local Data'}
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            {isSyncing || syncStatus.sync_state === 'syncing' ? (
              <>
                <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                <span className="text-blue-600 font-medium">Syncing...</span>
              </>
            ) : syncStatus.sync_state === 'error' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-700" title={syncStatus.message}>Sync Warning</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-500">Synced: {formatSyncTime(syncStatus.last_synced_at)}</span>
              </>
            )}
          </div>
        </div>

        {/* Sync Refresh Button */}
        <button
          onClick={onRefreshSync}
          disabled={isSyncing}
          title="Force Two-way Refresh with Google Sheets"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        {/* Scan QR Code Button */}
        <button
          onClick={onOpenQRScanner}
          className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg shadow-2xs transition-all active:scale-95"
        >
          <QrCode className="w-4 h-4 text-blue-600" />
          <span className="hidden xs:inline">Scan QR</span>
        </button>

        {/* Quick Add Trip Button */}
        <button
          onClick={onQuickAddTrip}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden xs:inline">New Trip</span>
          <span className="xs:hidden">Trip</span>
        </button>
      </div>
    </header>
  );
};

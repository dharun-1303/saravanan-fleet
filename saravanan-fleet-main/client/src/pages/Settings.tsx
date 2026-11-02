import React, { useState } from 'react';
import { Settings as SettingsIcon, Database, ShieldCheck, Save, Clock, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { SettingRecord, SyncStatus } from '../types';

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

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (key: string) => {
    const val = formValues[key];
    if (val !== undefined) {
      await onUpdateSetting(key, val);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900">System Configuration & Integrations</h2>
        <p className="text-xs text-slate-500">
          Configure Google Sheets connection, alert thresholds, and operational parameters.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Setting updated successfully and persisted to backend.</span>
        </div>
      )}

      {/* Database Connection Status Card */}
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

        {/* How to attach Google Sheets instructions */}
        <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-blue-900 space-y-2">
          <div className="font-bold flex items-center gap-1.5">
            <Key className="w-4 h-4 text-blue-700" />
            <span>How to Link Your Google Sheet:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-blue-800 text-[11px] leading-relaxed">
            <li>Open the Google Cloud Console &amp; enable the <strong>Google Sheets API</strong>.</li>
            <li>Create a <strong>Service Account</strong> and download the JSON key.</li>
            <li>
              Share your fleet workbook with the service account email (e.g.{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded">fleet-manager@...iam.gserviceaccount.com</code>) with{' '}
              <strong>Editor</strong> permission.
            </li>
            <li>
              Add <code className="bg-blue-100 px-1 py-0.5 rounded">GOOGLE_SPREADSHEET_ID</code> and{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded">GOOGLE_CREDENTIALS_JSON</code> into{' '}
              <code className="bg-blue-100 px-1 py-0.5 rounded">server/.env</code>.
            </li>
          </ol>
        </div>
      </div>

      {/* Operational Thresholds */}
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
    </div>
  );
};

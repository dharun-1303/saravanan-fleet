import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, ShieldAlert, ArrowRight, EyeOff, Wrench, FileText, Check } from 'lucide-react';
import { AlertItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../utils/formatters';

interface ServiceAlertsProps {
  alerts: AlertItem[];
  onDismissAlert: (alertId: string) => Promise<void>;
  onSelectVehicle: (vehicleId: string) => void;
}

export const ServiceAlertsPage: React.FC<ServiceAlertsProps> = ({
  alerts,
  onDismissAlert,
  onSelectVehicle,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [showDismissed, setShowDismissed] = useState(false);

  const filteredAlerts = alerts.filter(a => {
    if (!showDismissed && a.dismissed) return false;
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    return true;
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.dismissed).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && !a.dismissed).length;
  const infoCount = alerts.filter(a => a.severity === 'info' && !a.dismissed).length;

  return (
    <div className="space-y-6">
      {/* Alert Severity Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterSeverity('critical')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            filterSeverity === 'critical'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
              : 'bg-white border-slate-200/80 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Critical & Overdue</span>
            <ShieldAlert className="w-5 h-5 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-900">{criticalCount}</div>
          <p className="text-[11px] text-rose-600 mt-1">Expired documents & overdue services (&le;7 days)</p>
        </div>

        <div
          onClick={() => setFilterSeverity('warning')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            filterSeverity === 'warning'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
              : 'bg-white border-slate-200/80 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Due Soon (8–15 Days)</span>
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-900">{warningCount}</div>
          <p className="text-[11px] text-amber-700 mt-1">Pending maintenance & upcoming renewals</p>
        </div>

        <div
          onClick={() => setFilterSeverity('info')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
            filterSeverity === 'info'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400'
              : 'bg-white border-slate-200/80 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Advance Notice (16–30 Days)</span>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-900">{infoCount}</div>
          <p className="text-[11px] text-blue-600 mt-1">Early compliance awareness pipeline</p>
        </div>
      </div>

      {/* Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-bold text-slate-700 mr-1">Filter Alerts:</span>
          {(['all', 'critical', 'warning', 'info'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filterSeverity === sev
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={e => setShowDismissed(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span>Show Acknowledged Alerts</span>
        </label>
      </div>

      {/* Alert Cards List */}
      <div className="space-y-3">
        {filteredAlerts.map(alert => {
          const isCritical = alert.severity === 'critical';
          const isWarning = alert.severity === 'warning';

          const cardBg = isCritical
            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
            : isWarning
            ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
            : 'bg-white border-slate-200/80 hover:border-blue-200';

          return (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${cardBg} ${
                alert.dismissed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 rounded-xl flex-shrink-0 ${
                    isCritical
                      ? 'bg-rose-100 text-rose-700'
                      : isWarning
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {alert.type.startsWith('DOC_') ? (
                    <FileText className="w-5 h-5" />
                  ) : alert.type.startsWith('SERVICE_') ? (
                    <Wrench className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-sm">{alert.title}</span>
                    <StatusBadge status={alert.severity} size="sm" />
                    {alert.dismissed && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                        Acknowledged
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 max-w-2xl">{alert.description}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {alert.vehicle_name} ({alert.registration_number})
                    </span>
                    {alert.due_date && (
                      <span className="text-slate-500">
                        Due Date: <strong className="text-slate-700">{formatDate(alert.due_date)}</strong>
                      </span>
                    )}
                    {alert.due_km && (
                      <span className="text-slate-500">
                        Due KM: <strong className="text-slate-700">{alert.due_km.toLocaleString('en-IN')} km</strong>
                      </span>
                    )}
                    <span className="text-emerald-700 font-medium">
                      Action: {alert.suggested_action}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                {!alert.dismissed && (
                  <button
                    onClick={() => onDismissAlert(alert.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors"
                    title="Acknowledge alert without modifying actual certificate records"
                  >
                    <Check className="w-3.5 h-3.5 text-slate-500" />
                    <span>Acknowledge</span>
                  </button>
                )}
                <button
                  onClick={() => onSelectVehicle(alert.vehicle_id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all active:scale-95"
                >
                  <span>Vehicle View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">All clear! No alerts matching filter.</p>
            <p className="text-xs text-slate-500 mt-1">Vehicle compliance certificates and services are within safe windows.</p>
          </div>
        )}
      </div>
    </div>
  );
};

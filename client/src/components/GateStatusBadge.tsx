import React from 'react';
import { GateStatus } from '../types';
import { formatDateTime } from '../utils/formatters';

interface GateStatusBadgeProps {
  status?: GateStatus;
  gateOutTime?: string;
  gateOutBy?: string;
  gateInTime?: string;
  gateInBy?: string;
  showDetails?: boolean;
}

export const GateStatusBadge: React.FC<GateStatusBadgeProps> = ({
  status,
  gateOutTime,
  gateOutBy,
  gateInTime,
  gateInBy,
  showDetails = true,
}) => {
  // If status is not explicitly set, deduce from timestamps or default to COMPLETED if already finished
  const effectiveStatus: GateStatus =
    status || (gateInTime ? 'COMPLETED' : gateOutTime ? 'DISPATCHED' : 'PENDING_EXIT');

  switch (effectiveStatus) {
    case 'PENDING_EXIT':
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block" />
            <span>Pending Exit</span>
          </span>
          {showDetails && (
            <span className="text-[10px] text-amber-700 font-medium pl-0.5">
              🟡 Waiting at gate
            </span>
          )}
        </div>
      );

    case 'DISPATCHED':
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-50 text-blue-800 border border-blue-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
            <span>In Transit / Out</span>
          </span>
          {showDetails && (
            <span className="text-[10px] text-slate-500 font-medium pl-0.5" title={gateOutTime}>
              🔵 {gateOutTime ? `Out: ${formatDateTime(gateOutTime)}` : 'Gate Out approved'}
              {gateOutBy ? ` (${gateOutBy})` : ''}
            </span>
          )}
        </div>
      );

    case 'PENDING_ENTRY':
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-orange-50 text-orange-800 border border-orange-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse inline-block" />
            <span>Pending Entry</span>
          </span>
          {showDetails && (
            <span className="text-[10px] text-orange-700 font-medium pl-0.5">
              🟠 Driver logged return • Waiting gate
            </span>
          )}
        </div>
      );

    case 'COMPLETED':
    default:
      return (
        <div className="inline-flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            <span>Completed & Verified</span>
          </span>
          {showDetails && (
            <span
              className="text-[10px] text-slate-500 font-medium pl-0.5"
              title={`Gate Out: ${gateOutTime || '—'} | Gate In: ${gateInTime || '—'}`}
            >
              🟢 {gateInTime ? `In: ${formatDateTime(gateInTime)}` : 'Both Gate Out & In verified'}
              {gateInBy ? ` (${gateInBy})` : ''}
            </span>
          )}
        </div>
      );
  }
};

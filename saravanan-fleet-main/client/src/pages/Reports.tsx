import React, { useState } from 'react';
import { FileSpreadsheet, Download, Printer, Filter, Calendar, Truck, CheckCircle2 } from 'lucide-react';
import { Vehicle } from '../types';
import { api } from '../api/client';

interface ReportsProps {
  vehicles: Vehicle[];
}

export const ReportsPage: React.FC<ReportsProps> = ({ vehicles }) => {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [reportType, setReportType] = useState<string>('trips');

  const handleDownload = (type: string) => {
    const vId = selectedVehicle !== 'all' ? selectedVehicle : undefined;
    const url = api.getExportUrl(type, vId);
    window.open(url, '_blank');
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const reportCards = [
    {
      id: 'trips',
      title: 'Trips & Distance Log',
      description: 'Complete odometer logs, routes, distances travelled, drivers and trip expenses.',
      color: 'border-blue-200 bg-blue-50/40 text-blue-700',
    },
    {
      id: 'fuel',
      title: 'Fuel Consumption & Spend Register',
      description: 'Litres refuelled, fuel types, fuel costs, station vendors and odometer readings.',
      color: 'border-emerald-200 bg-emerald-50/40 text-emerald-700',
    },
    {
      id: 'maintenance',
      title: 'Maintenance, Tyres & Repair History',
      description: 'Routine periodic services, workshops, replacement parts, cost invoices and due schedules.',
      color: 'border-amber-200 bg-amber-50/40 text-amber-700',
    },
    {
      id: 'expenses',
      title: 'Operational Expenses Ledger',
      description: 'Highway toll charges, parking slips, washing, cleaning, allowances and miscellaneous.',
      color: 'border-purple-200 bg-purple-50/40 text-purple-700',
    },
    {
      id: 'fleet',
      title: 'Fleet Comparison & Operating Summary',
      description: 'Cross-vehicle operational overview, total mileage, combined spending and cost per KM metrics.',
      color: 'border-slate-200 bg-slate-50 text-slate-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Reports & Audit Exports</h2>
          </div>
          <p className="text-xs text-slate-500">
            Export structured CSV data directly synchronised with your Google Sheets registers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
          <select
            value={selectedVehicle}
            onChange={e => setSelectedVehicle(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 shadow-2xs"
          >
            <option value="all">Entire Fleet (All Vehicles)</option>
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                {v.vehicle_name} ({v.registration_number})
              </option>
            ))}
          </select>

          <button
            onClick={handlePrintSummary}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reportCards.map(rc => (
          <div
            key={rc.id}
            className={`p-5 rounded-2xl border shadow-xs transition-all flex flex-col justify-between ${rc.color}`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900">{rc.title}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/80 border border-current">
                  CSV Export
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">{rc.description}</p>
            </div>

            <button
              onClick={() => handleDownload(rc.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition-all active:scale-95"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span>Download {rc.title} (CSV)</span>
            </button>
          </div>
        ))}
      </div>

      {/* Compliance Note */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 text-xs text-slate-600 space-y-2">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Accounting & Auditor Verification Notice</span>
        </div>
        <p>
          CSV exports generated by this portal reflect live records stored in the primary Google Sheets registers. All formulas, dates, odometer differences, and amount values are verified for accounting reconciliation.
        </p>
      </div>
    </div>
  );
};

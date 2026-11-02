import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    label?: string;
  };
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-blue-50',
  iconColor = 'text-blue-600',
  trend,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-3.5 sm:p-5 border border-slate-200/80 shadow-sm transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate mr-2">{title}</span>
        <div className={`p-1.5 sm:p-2.5 rounded-lg flex-shrink-0 ${iconBgColor}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconColor}`} />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">{value}</div>
      {(subtitle || trend) && (
        <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500">
          {trend && (
            <span
              className={`font-semibold px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] flex-shrink-0 ${
                trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
};

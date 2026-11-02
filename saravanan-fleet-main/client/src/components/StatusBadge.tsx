import React from 'react';

interface StatusBadgeProps {
  status: string;
  variant?: 'active' | 'inactive' | 'completed' | 'unfinished' | 'critical' | 'warning' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant, size = 'sm' }) => {
  let computedVariant = variant;

  if (!computedVariant) {
    const s = status.toLowerCase();
    if (s === 'active' || s === 'completed' || s === 'valid') computedVariant = 'active';
    else if (s === 'inactive' || s === 'unfinished' || s === 'overdue' || s === 'expired') computedVariant = 'critical';
    else if (s === 'warning' || s === 'expiring soon' || s === 'in transit') computedVariant = 'warning';
    else computedVariant = 'neutral';
  }

  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    inactive: 'bg-slate-100 text-slate-600 border-slate-200',
    unfinished: 'bg-amber-50 text-amber-700 border-amber-200/70 animate-pulse',
    critical: 'bg-rose-50 text-rose-700 border-rose-200/70',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/70',
    info: 'bg-blue-50 text-blue-700 border-blue-200/70',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border ${styles[computedVariant] || styles.neutral} ${
        sizeStyles[size]
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {status}
    </span>
  );
};

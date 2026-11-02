export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatKM(km: number | null | undefined): string {
  if (km === null || km === undefined || isNaN(km)) return '0 km';
  return `${new Intl.NumberFormat('en-IN').format(km)} km`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeDays(days: number | null | undefined): { text: string; status: 'overdue' | 'urgent' | 'warning' | 'normal' } {
  if (days === null || days === undefined) return { text: '—', status: 'normal' };
  if (days < 0) {
    return { text: `${Math.abs(days)}d overdue`, status: 'overdue' };
  }
  if (days === 0) {
    return { text: 'Due today', status: 'urgent' };
  }
  if (days <= 7) {
    return { text: `Due in ${days}d`, status: 'urgent' };
  }
  if (days <= 15) {
    return { text: `Due in ${days}d`, status: 'warning' };
  }
  return { text: `Due in ${days}d`, status: 'normal' };
}

import { useEffect, useRef } from 'react';
import { AlertItem } from '../types';

export function useAlertNotifications(alerts: AlertItem[]) {
  const notifiedIds = useRef<Set<string>>(new Set());
  const permissionRequested = useRef(false);

  // Request browser notification permission once on load
  useEffect(() => {
    if (!permissionRequested.current && 'Notification' in window && Notification.permission === 'default') {
      permissionRequested.current = true;
      Notification.requestPermission();
    }
  }, []);

  // Fire browser notifications for new critical alerts
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const criticalAlerts = alerts.filter(
      a => a.severity === 'critical' && !a.dismissed && !notifiedIds.current.has(a.id)
    );

    criticalAlerts.forEach(alert => {
      notifiedIds.current.add(alert.id);
      try {
        new Notification(`🚨 Fleet Alert — ${alert.vehicle_name}`, {
          body: `${alert.title}\n${alert.description}`,
          icon: '/favicon.ico',
          tag: alert.id,
        });
      } catch {
        // Notification API may be blocked
      }
    });
  }, [alerts]);
}

import { Vehicle, Trip, MaintenanceRecord, DocumentRecord, AlertItem, SettingRecord } from './types/index.js';

export class AlertEngine {
  public static generateAlerts(params: {
    vehicles: Vehicle[];
    trips: Trip[];
    maintenance: MaintenanceRecord[];
    documents: DocumentRecord[];
    settings: SettingRecord[];
    dismissedIds: Set<string>;
  }): AlertItem[] {
    const { vehicles, trips, maintenance, documents, settings, dismissedIds } = params;
    const alerts: AlertItem[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Get configurable day thresholds (default: 30, 15, 7)
    const alertDaysSetting = settings.find(s => s.key === 'SERVICE_ALERT_DAYS')?.value || '30,15,7';
    const dayThresholds = alertDaysSetting.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    const maxThresholdDays = Math.max(...dayThresholds, 30);

    // Vehicle lookup map
    const vehicleMap = new Map<string, Vehicle>();
    vehicles.forEach(v => vehicleMap.set(v.vehicle_id, v));

    // 1. Document Expiry Alerts
    documents.forEach(doc => {
      const v = vehicleMap.get(doc.vehicle_id);
      if (!v || !v.active) return;
      if (!doc.expiry_date) return;

      const expDate = new Date(doc.expiry_date);
      if (isNaN(expDate.getTime())) return;
      expDate.setHours(0, 0, 0, 0);

      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const alertId = `alert-doc-${doc.document_id}`;

      if (diffDays < 0) {
        alerts.push({
          id: alertId,
          type: 'DOC_EXPIRED',
          severity: 'critical',
          vehicle_id: v.vehicle_id,
          vehicle_name: v.vehicle_name,
          registration_number: v.registration_number,
          title: `${doc.document_type} Expired (${Math.abs(diffDays)} days ago)`,
          description: `${doc.document_type} certificate (#${doc.document_number || 'N/A'}) expired on ${doc.expiry_date}. Immediate renewal required.`,
          due_date: doc.expiry_date,
          remaining_days: diffDays,
          suggested_action: `Renew ${doc.document_type} with ${doc.issuer || 'competent authority'} immediately.`,
          dismissed: dismissedIds.has(alertId),
        });
      } else if (diffDays <= maxThresholdDays) {
        const severity = diffDays <= 7 ? 'critical' : diffDays <= 15 ? 'warning' : 'info';
        alerts.push({
          id: alertId,
          type: 'DOC_EXPIRING_SOON',
          severity,
          vehicle_id: v.vehicle_id,
          vehicle_name: v.vehicle_name,
          registration_number: v.registration_number,
          title: `${doc.document_type} Expiring in ${diffDays} days`,
          description: `${doc.document_type} (#${doc.document_number || 'N/A'}) is due for expiry on ${doc.expiry_date}.`,
          due_date: doc.expiry_date,
          remaining_days: diffDays,
          suggested_action: `Schedule inspection and renewal before ${doc.expiry_date}.`,
          dismissed: dismissedIds.has(alertId),
        });
      }
    });

    // 2. Service & Maintenance Due Alerts
    maintenance.forEach(maint => {
      const v = vehicleMap.get(maint.vehicle_id);
      if (!v || !v.active) return;

      // Due by date check
      if (maint.next_service_due_date) {
        const dueDate = new Date(maint.next_service_due_date);
        if (!isNaN(dueDate.getTime())) {
          dueDate.setHours(0, 0, 0, 0);
          const diffTime = dueDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const alertId = `alert-maint-date-${maint.maintenance_id}`;

          if (diffDays < 0) {
            alerts.push({
              id: alertId,
              type: 'SERVICE_OVERDUE',
              severity: 'critical',
              vehicle_id: v.vehicle_id,
              vehicle_name: v.vehicle_name,
              registration_number: v.registration_number,
              title: `Service Overdue by ${Math.abs(diffDays)} days`,
              description: `Routine service due on ${maint.next_service_due_date} has not been completed.`,
              due_date: maint.next_service_due_date,
              remaining_days: diffDays,
              suggested_action: 'Book vehicle for immediate maintenance check.',
              dismissed: dismissedIds.has(alertId),
            });
          } else if (diffDays <= maxThresholdDays) {
            const severity = diffDays <= 7 ? 'critical' : diffDays <= 15 ? 'warning' : 'info';
            alerts.push({
              id: alertId,
              type: 'SERVICE_DATE',
              severity,
              vehicle_id: v.vehicle_id,
              vehicle_name: v.vehicle_name,
              registration_number: v.registration_number,
              title: `Service Due in ${diffDays} days`,
              description: `Upcoming periodic service scheduled for ${maint.next_service_due_date}.`,
              due_date: maint.next_service_due_date,
              remaining_days: diffDays,
              suggested_action: 'Reserve garage slot with authorised workshop.',
              dismissed: dismissedIds.has(alertId),
            });
          }
        }
      }

      // Due by km check
      if (maint.next_service_due_km) {
        // Find current vehicle odometer
        const vTrips = trips.filter(t => t.vehicle_id === v.vehicle_id);
        const currentKm = Math.max(...vTrips.map(t => t.end_km || t.start_km || 0), maint.odometer || 0);
        const kmRemaining = maint.next_service_due_km - currentKm;
        const alertId = `alert-maint-km-${maint.maintenance_id}`;

        if (kmRemaining <= 1000) {
          const isOverdue = kmRemaining <= 0;
          alerts.push({
            id: alertId,
            type: isOverdue ? 'SERVICE_OVERDUE' : 'SERVICE_KM',
            severity: isOverdue ? 'critical' : kmRemaining <= 300 ? 'warning' : 'info',
            vehicle_id: v.vehicle_id,
            vehicle_name: v.vehicle_name,
            registration_number: v.registration_number,
            title: isOverdue ? `Service Overdue by ${Math.abs(kmRemaining)} km` : `Service Due in ${kmRemaining} km`,
            description: `Scheduled at ${maint.next_service_due_km.toLocaleString('en-IN')} km (Current: ${currentKm.toLocaleString('en-IN')} km).`,
            due_km: maint.next_service_due_km,
            remaining_km: kmRemaining,
            suggested_action: 'Perform oil and engine maintenance service.',
            dismissed: dismissedIds.has(alertId),
          });
        }
      }
    });

    // 3. Unfinished Trips Alert
    const unfinishedTrips = trips.filter(t => t.status === 'UNFINISHED');
    unfinishedTrips.forEach(trip => {
      const v = vehicleMap.get(trip.vehicle_id);
      if (!v) return;
      const alertId = `alert-trip-${trip.trip_id}`;
      alerts.push({
        id: alertId,
        type: 'UNFINISHED_TRIP',
        severity: 'warning',
        vehicle_id: v.vehicle_id,
        vehicle_name: v.vehicle_name,
        registration_number: v.registration_number,
        title: `Unfinished Trip in Progress`,
        description: `Trip started on ${trip.date} from "${trip.from}" with start reading ${trip.start_km.toLocaleString('en-IN')} km is awaiting completion odometer.`,
        suggested_action: 'Update final odometer reading to close trip and record distance.',
        dismissed: dismissedIds.has(alertId),
      });
    });

    // Sort alerts by severity: critical > warning > info
    const severityWeight = { critical: 3, warning: 2, info: 1 };
    return alerts.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
  }
}

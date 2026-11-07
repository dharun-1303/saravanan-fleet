import { Router, Request, Response } from 'express';
import { DataStore } from './dataStore.js';
import { AnalyticsEngine, DateFilter } from './analytics.js';
import { AlertEngine } from './alerts.js';

export function createFleetRouter(dataStore: DataStore): Router {
  const router = Router();

  // --- SYNC STATUS & REFRESH ---
  router.get('/sync/status', (_req: Request, res: Response) => {
    res.json(dataStore.getSyncStatus());
  });

  router.post('/sync/refresh', async (_req: Request, res: Response) => {
    try {
      const status = await dataStore.syncWithGoogleSheets();
      res.json({ success: true, status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- VEHICLES ---
  router.get('/vehicles', (_req: Request, res: Response) => {
    res.json(dataStore.getVehicles());
  });

  router.get('/vehicles/:id', (req: Request, res: Response) => {
    const vehicle = dataStore.getVehicleById(String(req.params.id));
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    res.json(vehicle);
  });

  router.post('/vehicles', async (req: Request, res: Response) => {
    try {
      const { vehicle_name, registration_number, vehicle_type, fuel_type, photo_url, sheet_tab_name, active, notes } = req.body;
      if (!vehicle_name || !registration_number) {
        res.status(400).json({ error: 'Vehicle name and registration number are required' });
        return;
      }
      const existing = dataStore.getVehicles().find(v => v.registration_number.toLowerCase() === registration_number.trim().toLowerCase());
      if (existing) {
        res.status(409).json({ error: 'Vehicle with this registration number already exists.' });
        return;
      }
      const newVehicle = await dataStore.addVehicle({
        vehicle_name: vehicle_name.trim(),
        registration_number: registration_number.trim().toUpperCase(),
        vehicle_type: vehicle_type || 'Car',
        fuel_type: fuel_type || 'Diesel',
        photo_url: photo_url || '',
        sheet_tab_name: sheet_tab_name || `${vehicle_name.trim()} ${registration_number.trim()}`,
        active: active !== false,
        notes: notes || '',
      });
      res.status(201).json(newVehicle);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/vehicles/:id', async (req: Request, res: Response) => {
    try {
      const updated = await dataStore.updateVehicle(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/vehicles/:id', async (req: Request, res: Response) => {
    try {
      const success = await dataStore.deleteVehicle(String(req.params.id));
      if (!success) {
        res.status(404).json({ error: 'Vehicle not found' });
        return;
      }
      res.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- TRIPS ---
  router.get('/trips', (req: Request, res: Response) => {
    const vehicleId = req.query.vehicleId as string | undefined;
    res.json(dataStore.getTrips(vehicleId));
  });

  router.post('/trips', async (req: Request, res: Response) => {
    try {
      const {
        vehicle_id,
        date,
        from,
        to,
        start_km,
        end_km,
        remark,
        amount,
        driver,
        employee,
        gate_status,
        gate_out_time,
        gate_out_by,
        gate_in_time,
        gate_in_by,
      } = req.body;

      if (!vehicle_id || !date || start_km === undefined) {
        res.status(400).json({ error: 'vehicle_id, date, and start_km are required' });
        return;
      }
      const numStart = Number(start_km);
      const numEnd = end_km !== undefined && end_km !== null && end_km !== '' ? Number(end_km) : null;
      if (numEnd !== null && numEnd < numStart) {
        res.status(400).json({ error: 'End KM cannot be less than Start KM' });
        return;
      }

      const trip = await dataStore.addTrip({
        vehicle_id,
        date,
        from: from || '',
        to: to || '',
        start_km: numStart,
        end_km: numEnd,
        remark: remark || '',
        amount: Number(amount) || 0,
        driver: driver || '',
        employee: employee || '',
        gate_status: gate_status || (numEnd !== null && numEnd >= numStart ? 'COMPLETED' : 'PENDING_EXIT'),
        gate_out_time: gate_out_time || undefined,
        gate_out_by: gate_out_by || undefined,
        gate_in_time: gate_in_time || undefined,
        gate_in_by: gate_in_by || undefined,
      });
      res.status(201).json(trip);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/trips/:id', async (req: Request, res: Response) => {
    try {
      const updated = await dataStore.updateTrip(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/trips/:id', async (req: Request, res: Response) => {
    try {
      const success = await dataStore.deleteTrip(String(req.params.id));
      if (!success) {
        res.status(404).json({ error: 'Trip not found' });
        return;
      }
      res.json({ success: true, message: 'Trip deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- FUEL ---
  router.get('/fuel', (req: Request, res: Response) => {
    const vehicleId = req.query.vehicleId as string | undefined;
    res.json(dataStore.getFuelRecords(vehicleId));
  });

  router.post('/fuel', async (req: Request, res: Response) => {
    try {
      const { date, vehicle_id, odometer, fuel_type, litres, amount, vendor, remarks, recorded_by, receipt_url } = req.body;
      if (!vehicle_id || !date || !amount) {
        res.status(400).json({ error: 'vehicle_id, date, and amount are required' });
        return;
      }
      const newFuel = await dataStore.addFuel({
        date,
        vehicle_id,
        odometer: Number(odometer) || 0,
        fuel_type: fuel_type || 'Diesel',
        litres: Number(litres) || 0,
        amount: Number(amount) || 0,
        vendor: vendor || '',
        remarks: remarks || '',
        recorded_by: recorded_by || 'Staff',
        receipt_url: receipt_url || '',
      });
      res.status(201).json(newFuel);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/fuel/:id', async (req: Request, res: Response) => {
    try {
      const updated = await dataStore.updateFuel(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Fuel record not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/fuel/:id', async (req: Request, res: Response) => {
    try {
      const success = await dataStore.deleteFuel(String(req.params.id));
      if (!success) {
        res.status(404).json({ error: 'Fuel record not found' });
        return;
      }
      res.json({ success: true, message: 'Fuel record deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- MAINTENANCE ---
  router.get('/maintenance', (req: Request, res: Response) => {
    const vehicleId = req.query.vehicleId as string | undefined;
    res.json(dataStore.getMaintenanceRecords(vehicleId));
  });

  router.post('/maintenance', async (req: Request, res: Response) => {
    try {
      const { service_date, vehicle_id, odometer, category, description, workshop, cost, next_service_due_km, next_service_due_date, notes, recorded_by } = req.body;
      if (!vehicle_id || !service_date) {
        res.status(400).json({ error: 'vehicle_id and service_date are required' });
        return;
      }
      const record = await dataStore.addMaintenance({
        service_date,
        vehicle_id,
        odometer: Number(odometer) || 0,
        category: category || 'Scheduled Service',
        description: description || '',
        workshop: workshop || '',
        cost: Number(cost) || 0,
        next_service_due_km: next_service_due_km ? Number(next_service_due_km) : null,
        next_service_due_date: next_service_due_date || null,
        notes: notes || '',
        recorded_by: recorded_by || 'Staff',
      });
      res.status(201).json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/maintenance/:id', async (req: Request, res: Response) => {
    try {
      const updated = await dataStore.updateMaintenance(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Maintenance record not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/maintenance/:id', async (req: Request, res: Response) => {
    try {
      const success = await dataStore.deleteMaintenance(String(req.params.id));
      if (!success) {
        res.status(404).json({ error: 'Maintenance record not found' });
        return;
      }
      res.json({ success: true, message: 'Maintenance record deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- DOCUMENTS ---
  router.get('/documents', (req: Request, res: Response) => {
    const vehicleId = req.query.vehicleId as string | undefined;
    res.json(dataStore.getDocumentRecords(vehicleId));
  });

  router.post('/documents', async (req: Request, res: Response) => {
    try {
      const { vehicle_id, document_type, document_number, issue_date, expiry_date, issuer, file_url, notes, recorded_by } = req.body;
      if (!vehicle_id || !document_type) {
        res.status(400).json({ error: 'vehicle_id and document_type are required' });
        return;
      }
      const doc = await dataStore.addDocument({
        vehicle_id,
        document_type,
        document_number: document_number || '',
        issue_date: issue_date || '',
        expiry_date: expiry_date || '',
        issuer: issuer || '',
        file_url: file_url || '',
        notes: notes || '',
        recorded_by: recorded_by || 'Staff',
      });
      res.status(201).json(doc);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/documents/:id', async (req: Request, res: Response) => {
    try {
      const updated = await dataStore.updateDocument(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/documents/:id', async (req: Request, res: Response) => {
    try {
      const success = await dataStore.deleteDocument(String(req.params.id));
      if (!success) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }
      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- EXPENSES ---
  router.get('/expenses', (req: Request, res: Response) => {
    const vehicleId = req.query.vehicleId as string | undefined;
    res.json(dataStore.getExpenseRecords(vehicleId));
  });

  router.post('/expenses', async (req: Request, res: Response) => {
    try {
      const { date, vehicle_id, category, description, amount, vendor, receipt_url, notes, recorded_by } = req.body;
      if (!vehicle_id || !date || !amount) {
        res.status(400).json({ error: 'vehicle_id, date, and amount are required' });
        return;
      }
      const exp = await dataStore.addExpense({
        date,
        vehicle_id,
        category: category || 'Other',
        description: description || '',
        amount: Number(amount) || 0,
        vendor: vendor || '',
        receipt_url: receipt_url || '',
        notes: notes || '',
        recorded_by: recorded_by || 'Staff',
      });
      res.status(201).json(exp);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/expenses/:id', async (req: Request, res: Response) => {
    try {
      const updated = await dataStore.updateExpense(String(req.params.id), req.body);
      if (!updated) {
        res.status(404).json({ error: 'Expense record not found' });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/expenses/:id', async (req: Request, res: Response) => {
    try {
      const success = await dataStore.deleteExpense(String(req.params.id));
      if (!success) {
        res.status(404).json({ error: 'Expense record not found' });
        return;
      }
      res.json({ success: true, message: 'Expense record deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- ALERTS ---
  router.get('/alerts', (_req: Request, res: Response) => {
    const alerts = AlertEngine.generateAlerts({
      vehicles: dataStore.getVehicles(),
      trips: dataStore.getTrips(),
      maintenance: dataStore.getMaintenanceRecords(),
      documents: dataStore.getDocumentRecords(),
      settings: dataStore.getSettings(),
      dismissedIds: dataStore.getDismissedAlerts(),
    });
    res.json(alerts);
  });

  router.post('/alerts/dismiss', (req: Request, res: Response) => {
    const { alertId } = req.body;
    if (alertId) {
      dataStore.dismissAlert(alertId);
    }
    res.json({ success: true, alertId });
  });

  // --- ANALYTICS ENGINE ENDPOINT ---
  router.get('/analytics', (req: Request, res: Response) => {
    const filterType = (req.query.type as any) || 'all';
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const vehicleId = req.query.vehicleId as string | undefined;

    const filter: DateFilter = {
      type: filterType,
      year,
      month,
      startDate,
      endDate,
    };

    const analytics = AnalyticsEngine.calculateAnalytics({
      vehicles: dataStore.getVehicles(),
      trips: dataStore.getTrips(),
      fuel: dataStore.getFuelRecords(),
      maintenance: dataStore.getMaintenanceRecords(),
      expenses: dataStore.getExpenseRecords(),
      filter,
      targetVehicleId: vehicleId,
    });

    res.json(analytics);
  });

  // --- REPORTS & CSV EXPORT ---
  router.get('/reports/csv', (req: Request, res: Response) => {
    const type = req.query.type as string; // 'trips' | 'fuel' | 'maintenance' | 'expenses' | 'fleet'
    const vehicleId = req.query.vehicleId as string | undefined;
    const vehicles = dataStore.getVehicles();
    const vehicleMap = new Map(vehicles.map(v => [v.vehicle_id, `${v.vehicle_name} (${v.registration_number})`]));

    let csvContent = '';
    let fileName = `fleet_export_${type}_${Date.now()}.csv`;

    if (type === 'trips') {
      const trips = dataStore.getTrips(vehicleId);
      const headers = [
        'Trip ID',
        'Vehicle',
        'Date',
        'From',
        'To',
        'Start KM',
        'End KM',
        'Distance (KM)',
        'Remark',
        'Amount (INR)',
        'Status',
        'Driver',
        'Employee',
        'Gate Status',
        'Gate Out Time',
        'Gate Out By',
        'Gate In Time',
        'Gate In By',
      ];
      const rows = trips.map(t => [
        t.trip_id,
        vehicleMap.get(t.vehicle_id) || t.vehicle_id,
        t.date,
        `"${(t.from || '').replace(/"/g, '""')}"`,
        `"${(t.to || '').replace(/"/g, '""')}"`,
        t.start_km,
        t.end_km ?? '',
        t.distance,
        `"${(t.remark || '').replace(/"/g, '""')}"`,
        t.amount,
        t.status,
        `"${(t.driver || '').replace(/"/g, '""')}"`,
        `"${(t.employee || '').replace(/"/g, '""')}"`,
        t.gate_status || '',
        t.gate_out_time || '',
        `"${(t.gate_out_by || '').replace(/"/g, '""')}"`,
        t.gate_in_time || '',
        `"${(t.gate_in_by || '').replace(/"/g, '""')}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (type === 'fuel') {
      const fuel = dataStore.getFuelRecords(vehicleId);
      const headers = ['Fuel ID', 'Vehicle', 'Date', 'Odometer (KM)', 'Fuel Type', 'Litres', 'Amount (INR)', 'Vendor', 'Remarks', 'Recorded By'];
      const rows = fuel.map(f => [
        f.fuel_id,
        vehicleMap.get(f.vehicle_id) || f.vehicle_id,
        f.date,
        f.odometer,
        f.fuel_type,
        f.litres,
        f.amount,
        `"${(f.vendor || '').replace(/"/g, '""')}"`,
        `"${(f.remarks || '').replace(/"/g, '""')}"`,
        `"${(f.recorded_by || '').replace(/"/g, '""')}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else if (type === 'maintenance') {
      const maint = dataStore.getMaintenanceRecords(vehicleId);
      const headers = ['Maintenance ID', 'Vehicle', 'Service Date', 'Odometer (KM)', 'Category', 'Description', 'Workshop', 'Cost (INR)', 'Next Due KM', 'Next Due Date', 'Notes', 'Recorded By'];
      const rows = maint.map(m => [
        m.maintenance_id,
        vehicleMap.get(m.vehicle_id) || m.vehicle_id,
        m.service_date,
        m.odometer,
        `"${(m.category || '').replace(/"/g, '""')}"`,
        `"${(m.description || '').replace(/"/g, '""')}"`,
        `"${(m.workshop || '').replace(/"/g, '""')}"`,
        m.cost,
        m.next_service_due_km ?? '',
        m.next_service_due_date || '',
        `"${(m.notes || '').replace(/"/g, '""')}"`,
        `"${(m.recorded_by || '').replace(/"/g, '""')}"`,
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    } else {
      // Default: fleet summary comparison
      const analytics = AnalyticsEngine.calculateAnalytics({
        vehicles: dataStore.getVehicles(),
        trips: dataStore.getTrips(),
        fuel: dataStore.getFuelRecords(),
        maintenance: dataStore.getMaintenanceRecords(),
        expenses: dataStore.getExpenseRecords(),
        filter: { type: 'all' },
      });
      const headers = ['Vehicle ID', 'Vehicle Name', 'Registration Number', 'Distance (KM)', 'Trip Count', 'Fuel Cost (INR)', 'Maintenance Cost (INR)', 'Other Expenses (INR)', 'Total Cost (INR)', 'Cost Per KM (INR)'];
      const rows = (analytics.vehicleComparisons || []).map(vc => [
        vc.vehicle_id,
        `"${vc.vehicle_name}"`,
        vc.registration_number,
        vc.distance,
        vc.tripCount,
        vc.fuelCost,
        vc.maintenanceCost,
        vc.otherExpenseCost,
        vc.totalCost,
        vc.costPerKm ?? 'N/A',
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  });

  // --- SETTINGS ---
  router.get('/settings', (_req: Request, res: Response) => {
    res.json(dataStore.getSettings());
  });

  router.put('/settings', (req: Request, res: Response) => {
    const { key, value } = req.body;
    if (key) {
      dataStore.updateSetting(key, value);
    }
    res.json({ success: true, settings: dataStore.getSettings() });
  });

  return router;
}

import { DataStore } from './dataStore.js';
import { AnalyticsEngine } from './analytics.js';
import { AlertEngine } from './alerts.js';

async function runFleetVerificationTests() {
  console.log('🧪 Starting Saravanan Fleet Management Integration Tests...\n');

  const store = new DataStore();

  // Test 1: Initial vehicles reconciliation
  const vehicles = store.getVehicles();
  console.log(`[Test 1] Vehicle Count Check: Expected 10 vehicles, Found ${vehicles.length}`);
  if (vehicles.length !== 10) throw new Error(`Expected 10 vehicles, found ${vehicles.length}`);
  
  const bmw = store.getVehicleById('veh-001');
  if (!bmw || bmw.registration_number !== 'TN87E5753') throw new Error('BMW TN87E5753 not reconciled!');
  console.log('✅ Test 1 Passed: Initial 10 vehicles accurately initialized.\n');

  // Test 2: Add and calculate trip
  console.log('[Test 2] Adding Trip and verifying distance calculations...');
  const newTrip = await store.addTrip({
    vehicle_id: 'veh-001',
    date: '2026-10-28',
    from: 'Tirupattur Yard',
    to: 'Hosur Electrical Substation',
    start_km: 12400,
    end_km: 12585,
    remark: 'Site inspection',
    amount: 1450,
  });

  if (newTrip.distance !== 185) {
    throw new Error(`Distance calculation failed. Expected 185, got ${newTrip.distance}`);
  }
  if (newTrip.status !== 'COMPLETED') {
    throw new Error(`Expected status COMPLETED, got ${newTrip.status}`);
  }
  console.log(`✅ Test 2 Passed: Trip added successfully with distance = ${newTrip.distance} km.\n`);

  // Test 3: Unfinished trip
  console.log('[Test 3] Adding Unfinished Trip without End KM...');
  const unfinishedTrip = await store.addTrip({
    vehicle_id: 'veh-002',
    date: '2026-10-28',
    from: 'Puducherry Office',
    to: 'Chennai Head Office',
    start_km: 67200,
    end_km: null,
    remark: 'MD transit in progress',
    amount: 500,
  });

  if (unfinishedTrip.status !== 'UNFINISHED' || unfinishedTrip.distance !== 0) {
    throw new Error('Unfinished trip not correctly marked!');
  }
  console.log('✅ Test 3 Passed: In-transit trip marked UNFINISHED with 0 km recorded distance.\n');

  // Test 4: Analytics Engine
  console.log('[Test 4] Verifying Shared Analytics Engine...');
  await store.addFuel({
    vehicle_id: 'veh-001',
    date: '2026-10-28',
    odometer: 12585,
    fuel_type: 'Diesel',
    litres: 20,
    amount: 1900,
    vendor: 'Test Station',
    remarks: 'Test fuel refill',
    recorded_by: 'Test Runner',
  });

  const analytics = AnalyticsEngine.calculateAnalytics({
    vehicles: store.getVehicles(),
    trips: store.getTrips(),
    fuel: store.getFuelRecords(),
    maintenance: store.getMaintenanceRecords(),
    expenses: store.getExpenseRecords(),
    filter: { type: 'all' },
  });

  console.log(`- Total Fleet Distance: ${analytics.totalDistance} km`);
  console.log(`- Total Recorded Cost: ₹${analytics.totalRecordedExpenditure}`);
  console.log(`- Cost per KM: ₹${analytics.costPerKm}/km`);
  console.log(`- Monthly Trends Count: ${analytics.monthlyTrends.length} months`);

  if (analytics.totalDistance <= 0 || analytics.totalRecordedExpenditure <= 0) {
    throw new Error('Analytics totals calculation failed!');
  }
  console.log('✅ Test 4 Passed: Analytics aggregation verified.\n');

  // Test 5: Alert Generation Engine
  console.log('[Test 5] Verifying Statutory Document & Service Alerts...');
  await store.addDocument({
    vehicle_id: 'veh-010',
    document_type: 'Permit',
    document_number: 'TP-STATE-TEST-001',
    issue_date: '2021-10-15',
    expiry_date: '2026-10-15', // Expired
    issuer: 'Transport Commissioner, TN',
    notes: 'Test expired permit verification',
    recorded_by: 'Test Runner',
  });

  const alerts = AlertEngine.generateAlerts({
    vehicles: store.getVehicles(),
    trips: store.getTrips(),
    maintenance: store.getMaintenanceRecords(),
    documents: store.getDocumentRecords(),
    settings: store.getSettings(),
    dismissedIds: new Set(),
  });

  console.log(`- Generated Alerts: ${alerts.length}`);
  const expiredPermitAlert = alerts.find(a => a.type === 'DOC_EXPIRED');
  if (!expiredPermitAlert) {
    throw new Error('Expected expired document alert for Bolero permit!');
  }
  console.log(`- Detected expired document: ${expiredPermitAlert.title}`);
  console.log('✅ Test 5 Passed: Alerts successfully generated.\n');

  console.log('🎉 ALL INTEGRATION TESTS PASSED CLEANLY!');
}

runFleetVerificationTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

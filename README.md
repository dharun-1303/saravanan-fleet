# Saravanan Electricals & Engineering - Fleet Management & Analytics System

A production-grade, full-stack Fleet Management and Analytics Web Application built specifically for **Saravanan Electricals & Engineering Pvt Ltd**.

The system utilizes **Google Sheets as its single source of truth**, featuring bi-directional synchronization, vehicle QR code access, real-time statutory compliance tracking, fuel and expense monitoring, maintenance scheduling, and a shared analytics engine for both individual vehicle histories and whole-fleet analysis.

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│     React UI + TypeScript       │ (Vite, TailwindCSS, Lucide, Recharts, HTML5-QRCode)
└──────────────┬──────────────────┘
               │ Local REST API calls
┌──────────────▼──────────────────┐
│    Express.js + TypeScript      │ (Port 5001 - In-memory Cache, Reconciler, Analytics Engine)
└──────────────┬──────────────────┘
               │ Authenticated Service Account JWT (Backend Only)
┌──────────────▼──────────────────┐
│      Google Sheets API v4       │ (Targeted row updates, schema auto-creation)
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│  Saravanan Fleet Google Sheets  │ (Vehicles, Trips, Fuel, Maintenance, Documents, Expenses)
└─────────────────────────────────┘
```

> **Security Note:** Service account credentials, private keys, and Sheets API calls remain exclusively on the Express backend. The frontend never makes direct Google Sheets API calls and never exposes private credentials.

---

## 🚗 Reconciled Fleet Vehicles

The system comes pre-reconciled with the 10 company vehicles:

| Vehicle Model | Registration Number | Category | Fuel Type | Primary Tab Name |
|---|---|---|---|---|
| **BMW** | `TN87E5753` | Luxury Sedan | Diesel | `BMW TN87E5753` |
| **BENZ** | `PYCT018600` | Luxury Sedan | Diesel | `BENZ PYCT018600` |
| **INNOVA CRYSTA** | `TN87E1604` | MUV | Diesel | `INNOVA TN87E1604` |
| **HUNDAI VENUE** | `TN87E2192` | Compact SUV | Petrol | `VENUE TN87E2192` |
| **TOYOTA GLANZA CNG** | `TN87D6036` | Hatchback | CNG | `GLANZA TN87D6036` |
| **MARUTI ECO** | `TN87H1779` | Van | CNG | `ECO TN87H1779` |
| **HUNDAI ALCAZAR** | `TN19BD5586` | SUV | Diesel | `ALCAZAR TN19BD5586` |
| **BIG EICHER** | `TN87C4650` | Heavy Truck | Diesel | `BIG EICHER TN87C4650` |
| **SMALL EICHER CNG** | `TN87C7419` | LCV | CNG | `SMALL EICHER TN87C7419` |
| **BOLERO PICKUP** | `TN87E2623` | Pickup Truck | Diesel | `BOLERO TN87E2623` |

---

## 📊 Google Sheets Data Schemas

The backend dynamically checks for existing vehicle tabs and ensures new register tabs are created automatically with proper headers:

### 1. Existing Trip Sheets (Per-Vehicle or Unified)
Preserves existing columns, historical records, and formula safety:
- `DATE`: Date of travel (`YYYY-MM-DD`)
- `FROM`: Journey start location
- `TO`: Destination
- `START KM`: Opening odometer reading
- `END KM`: Closing odometer reading (or empty if trip is in transit)
- `DISTANCE`: Calculated distance in kilometres
- `REMARK`: Purpose / material transit note
- `AMOUNT`: Associated trip expenses (INR)

### 2. `Vehicles` Tab
`vehicle_id, vehicle_name, registration_number, vehicle_type, fuel_type, photo_url, sheet_tab_name, active, notes`

### 3. `Fuel` Tab
`fuel_id, date, vehicle_id, odometer, fuel_type, litres, amount, vendor, remarks, recorded_by, receipt_url`

### 4. `Maintenance` Tab
`maintenance_id, vehicle_id, service_date, odometer, category, description, workshop, cost, next_service_due_km, next_service_due_date, notes, recorded_by`

### 5. `Documents` Tab (Statutory Compliance)
`document_id, vehicle_id, document_type, document_number, issue_date, expiry_date, issuer, file_url, notes, recorded_by`

### 6. `Expenses` Tab (Operational Ledger)
`expense_id, date, vehicle_id, category, description, amount, vendor, receipt_url, notes, recorded_by`

### 7. `Settings` Tab
`key, value, description`

---

## 🔄 Two-Way Synchronisation & Safety

- **Safe Row Updates & Appends:** When records are written, the backend checks for formula totals rows (`TOTAL`) at the bottom of sheets. If a totals row is detected, new rows are safely inserted *above* the totals row to protect spreadsheet formulas.
- **Bi-Directional Polling:** Background polling checks Google Sheets every 20 seconds (`SYNC_INTERVAL_MS`), refreshing the web application if changes were made directly in the Google Sheet.
- **Immediate Write Refresh:** Updates in the web application write directly to Google Sheets and immediately refresh local cache.
- **Live Sync Bar:** Top navbar displays live connection mode (`Google Sheets` vs `Local Data`), last synced timestamp, and a manual **Sync Now** trigger.
- **Offline / Local Fallback:** If Google Sheets credentials are not configured yet in `.env`, the app automatically operates in high-fidelity local cache mode, allowing complete evaluation and testing without errors.

---

## 🚀 Quick Start & Local Execution

### Prerequisites
- Node.js (v18+ or v24+)
- npm (v9+)

### Installation
```bash
# Clone or navigate to the project directory:
cd C:\Users\amdha\.gemini\antigravity\scratch\saravanan-fleet

# Install backend dependencies:
cd server
npm install

# Install frontend dependencies:
cd ../client
npm install
```

### Running in Development Mode
In two separate terminal windows:
```bash
# Terminal 1 - Backend (starts on http://localhost:5001):
cd server
npm run dev

# Terminal 2 - Frontend (starts on http://localhost:5173):
cd client
npm run dev
```

### Running Single-Port Production Mode
```bash
# Build frontend and server:
npm run build

# Start production server (serves both API and Frontend at http://localhost:5001):
npm start
```

---

## 🔑 Google Cloud Service Account Setup

To connect to your live Google Sheets workbook:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project, then navigate to **APIs & Services > Library**.
3. Search for and enable **Google Sheets API**.
4. Navigate to **APIs & Services > Credentials** and click **Create Credentials > Service Account**.
5. Give the service account a name (e.g. `saravanan-fleet-service`).
6. Click on the created service account, go to the **Keys** tab, click **Add Key > Create new key > JSON**, and download the file.
7. Open your Google Sheets fleet workbook and click **Share**. Share it with the service account email (found in the JSON key, e.g. `saravanan-fleet-service@...iam.gserviceaccount.com`) with **Editor** permissions.
8. Copy the Spreadsheet ID from the URL of your Google Sheet:
   ```
   https://docs.google.com/spreadsheets/d/<YOUR_SPREADSHEET_ID>/edit
   ```
9. Open `server/.env` and update:
   ```env
   PORT=5001
   GOOGLE_SPREADSHEET_ID=YOUR_SPREADSHEET_ID
   GOOGLE_CREDENTIALS_PATH=./service-account-key.json
   SYNC_INTERVAL_MS=20000
   ```
10. Place the downloaded JSON key file as `server/service-account-key.json`.
11. Restart the server. The navbar will display **Google Sheets (Connected)**!

---

## 📱 QR Code Vehicle Access

- **Vehicle QR Pass:** Every vehicle has a unique QR code accessible on its card and detail page.
- **Print & Download:** Export high-resolution QR badges ready for printing and windshield placement.
- **In-Browser Scanner:** Mobile and webcam scanner using `html5-qrcode` to verify vehicle IDs on site and open trip logs immediately.
- **Fallback Search:** Searchable vehicle selector by registration number when camera access is restricted.

---

## 🧪 Integration Testing Suite

Run the automated integration tests:
```bash
cd server
npx tsx src/testFleet.ts
```
Verifies:
- 10 Initial fleet vehicles reconciliation
- Accurate distance calculations ($EndKM - StartKM$) and rejecting invalid readings
- Unfinished trip identification
- Shared analytics engine (monthly aggregations and cost per KM)
- Statutory document expiry checks (30, 15, 7 day bands)

---

## 🏢 Organization
**Saravanan Electricals & Engineering Pvt Ltd**  
Enterprise Fleet Operations & Analytics Platform.

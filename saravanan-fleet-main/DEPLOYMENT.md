# Deployment Guide – Fleet Management on Vercel (Multi-Service Project)

This guide provides complete instructions for deploying the **Fleet Management Web Application** to **Vercel** using **Vercel Services** (monorepo architecture hosting both the React + Vite frontend and Node.js + Express backend within a single project and domain).

---

## 1. Project Architecture on Vercel

The application is configured using a root-level `vercel.json` with two isolated services:

| Service Name | Framework | Root Directory | Public Path | Destination Rewrite |
| :--- | :--- | :--- | :--- | :--- |
| **`server`** | Express (Node.js) | `server/` | `/api/*`, `/uploads/*` | `{ "service": "server" }` |
| **`client`** | Vite (React SPA) | `client/` | `/*` (All other routes) | `{ "service": "client" }` |

- **No CORS Issues**: Both frontend and backend share the same deployment domain.
- **SPA Routing**: Handled seamlessly by client-level `client/vercel.json` and top-level rewrites.
- **Google Sheets Database**: Remains the persistent central database across all invocations.

---

## 2. Required Environment Variables

All sensitive credentials and database connection strings must be configured in **Vercel Project Settings > Environment Variables**.

> [!IMPORTANT]
> **Never** prefix these backend variables with `VITE_`. They are consumed exclusively by the backend service at runtime.

| Variable Name | Required | Target Service | Description | Example / Format |
| :--- | :---: | :---: | :--- | :--- |
| `GOOGLE_SPREADSHEET_ID` | **Yes** | `server` | The unique ID from your Google Sheet URL | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` |
| `GOOGLE_CREDENTIALS_JSON` | **Yes** *(Option A)* | `server` | Full JSON content of your Google Cloud Service Account key | `{"type":"service_account","project_id":"...","private_key":"..."}` |
| `GOOGLE_CLIENT_EMAIL` | *(Option B)* | `server` | Service Account email (if not using JSON) | `fleet-manager@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | *(Option B)* | `server` | Service Account private key string (with `\n` or multiline) | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` |
| `PORT` | Optional | `server` | Internal port fallback (defaults to 5001) | `5001` |
| `NODE_ENV` | Optional | `server` | Deployment environment | `production` |
| `SYNC_INTERVAL_MS` | Optional | `server` | Internal sync throttle interval in milliseconds | `20000` |

---

## 3. Google Sheets Database Setup

1. **Enable the API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/).
   - Create a project or select an existing one.
   - Go to **APIs & Services > Library** and enable **Google Sheets API**.

2. **Create Service Account**:
   - Go to **APIs & Services > Credentials**.
   - Click **Create Credentials > Service Account**.
   - Name it `fleet-sheets-service` and click **Done**.
   - Click on the newly created service account, go to the **Keys** tab, and click **Add Key > Create new key > JSON**.
   - Download the generated JSON key file to your local computer.

3. **Share Google Sheet**:
   - Open your Google Sheet in your browser.
   - Click the green **Share** button at the top-right.
   - Paste the service account's `client_email` (e.g., `fleet-sheets-service@your-project.iam.gserviceaccount.com`).
   - Grant permission as **Editor** and click **Share**.
   - Copy the Sheet ID from the URL (`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).

---

## 4. Step-by-Step Vercel Deployment

### Method A: Deploy via Vercel Web Dashboard (Recommended)

1. **Push to GitHub**:
   Ensure all changes are committed and pushed to your GitHub repository:
   ```bash
   git add .
   git commit -m "Configure Vercel multi-service deployment"
   git push origin main
   ```

2. **Import Project into Vercel**:
   - Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
   - Click **Add New... > Project**.
   - Select your GitHub repository (`saravanan-fleet`).
   - **Root Directory**: Leave as the project root (`./`), because `vercel.json` automatically manages the `client/` and `server/` service roots.

3. **Configure Environment Variables**:
   In the **Environment Variables** section before deploying, add:
   - `GOOGLE_SPREADSHEET_ID`: `<Your-Google-Sheet-ID>`
   - `GOOGLE_CREDENTIALS_JSON`: Paste the entire content of the downloaded JSON key file as a single line.

4. **Deploy**:
   - Click **Deploy**.
   - Vercel will build both the `client` and `server` services and output your live deployment URL (e.g. `https://saravanan-fleet.vercel.app`).

---

### Method B: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Preview**:
   ```bash
   vercel
   ```

3. **Add Environment Variables**:
   ```bash
   vercel env add GOOGLE_SPREADSHEET_ID production
   vercel env add GOOGLE_CREDENTIALS_JSON production
   ```

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

---

## 5. Verification & Testing

Once deployed, verify your application:

1. **Health Check**:
   Navigate to `https://<your-vercel-domain>/api/health`. You should receive a JSON response with `"status": "ok"` and sync details:
   ```json
   {
     "status": "ok",
     "company": "Saravanan Electricals & Engineering Pvt Ltd",
     "sync": {
       "source": "google_sheets",
       "sync_state": "idle"
     }
   }
   ```

2. **Frontend UI Navigation**:
   - Open `https://<your-vercel-domain>/` in your browser.
   - Check all 10 fleet vehicles on the **Dashboard** and **Vehicles** registry.
   - Click **QR Code** on any vehicle to verify that the Vehicle QR Pass popup displays and the top-right exit button closes it smoothly.
   - Test adding a trip or fuel record to verify write access to your Google Sheet.
   - Refresh on any sub-route (e.g., direct navigation to `/vehicles`) to confirm that SPA routing doesn't throw a 404.

---

## 6. Troubleshooting & Diagnostics

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| `Local / Offline Cache` shown in settings | Missing or invalid Google credentials | Verify that `GOOGLE_SPREADSHEET_ID` and `GOOGLE_CREDENTIALS_JSON` are set in Vercel project environment variables. |
| `The caller does not have permission` | Sheet not shared with service account | In Google Sheets, click **Share** and add your service account email with **Editor** access. |
| 404 on page refresh | SPA fallback missing | Verified: `client/vercel.json` rewrites all non-asset requests to `/index.html`. |
| Uploaded photo not persisting permanently | Serverless ephemeral disk (`/tmp`) | File uploads are temporarily stored in `/tmp/fleet-uploads`. For long-term external asset hosting across cold starts, link Google Drive or public URLs in the vehicle/document forms. |

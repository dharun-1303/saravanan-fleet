import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

// Robustly locate and load .env from multiple possible directory structures
const candidateEnvFiles = [
  path.join(serverDir, '.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'server', '.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}
dotenv.config();

export interface AppConfig {
  port: number;
  spreadsheetId: string;
  driveFolderId?: string;
  credentialsPath?: string;
  credentialsJson?: string;
  clientEmail?: string;
  privateKey?: string;
  syncIntervalMs: number;
  isMockMode: boolean;
}

const PORT = parseInt(process.env.PORT || '5001', 10);
const SPREADSHEET_ID = (process.env.GOOGLE_SPREADSHEET_ID || '').trim();
const DRIVE_FOLDER_ID = (process.env.GOOGLE_DRIVE_FOLDER_ID || '1cJAu7H0d3m64mkIeG11Shi5spdcBDzZa').trim();
let rawCredentialsPath = (process.env.GOOGLE_CREDENTIALS_PATH || '').trim();
if ((rawCredentialsPath.startsWith('"') && rawCredentialsPath.endsWith('"')) ||
    (rawCredentialsPath.startsWith("'") && rawCredentialsPath.endsWith("'"))) {
  rawCredentialsPath = rawCredentialsPath.slice(1, -1).trim();
}
const CREDENTIALS_JSON = (process.env.GOOGLE_CREDENTIALS_JSON || '').trim();
const CLIENT_EMAIL = (process.env.GOOGLE_CLIENT_EMAIL || '').trim();
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '60000', 10);

// Resolve credentials path against env path, server dir, cwd, or local fleet-manager-credentials.json
let resolvedCredentialsPath = '';
const candidateCredPaths = [
  rawCredentialsPath,
  rawCredentialsPath ? path.resolve(serverDir, rawCredentialsPath) : '',
  rawCredentialsPath ? path.resolve(process.cwd(), rawCredentialsPath) : '',
  path.resolve(serverDir, 'fleet-manager-credentials.json'),
  path.resolve(process.cwd(), 'fleet-manager-credentials.json'),
  path.resolve(process.cwd(), 'server', 'fleet-manager-credentials.json'),
  path.resolve(serverDir, 'service-account.json'),
  path.resolve(process.cwd(), 'service-account.json'),
].filter(Boolean);

for (const p of candidateCredPaths) {
  if (p && fs.existsSync(p)) {
    resolvedCredentialsPath = p;
    break;
  }
}

// Check if credentials are validly provided
let hasCredentials = false;
if (resolvedCredentialsPath && fs.existsSync(resolvedCredentialsPath)) {
  hasCredentials = true;
} else if (CREDENTIALS_JSON) {
  try {
    JSON.parse(CREDENTIALS_JSON);
    hasCredentials = true;
  } catch {
    hasCredentials = false;
  }
} else if (CLIENT_EMAIL && PRIVATE_KEY) {
  hasCredentials = true;
}

if (!hasCredentials) {
  console.warn('[Config] No Google Service Account credentials found. Running in offline/mock cache mode.');
} else {
  console.log(`[Config] Google Credentials loaded: ${resolvedCredentialsPath || 'JSON string / Service Account'}`);
}

export const config: AppConfig = {
  port: PORT,
  spreadsheetId: SPREADSHEET_ID,
  driveFolderId: DRIVE_FOLDER_ID,
  credentialsPath: resolvedCredentialsPath || rawCredentialsPath,
  credentialsJson: CREDENTIALS_JSON,
  clientEmail: CLIENT_EMAIL,
  privateKey: PRIVATE_KEY,
  syncIntervalMs: SYNC_INTERVAL_MS,
  isMockMode: !hasCredentials || !SPREADSHEET_ID || process.env.NODE_ENV === 'test',
};

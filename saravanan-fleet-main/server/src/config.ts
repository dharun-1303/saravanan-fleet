import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(serverDir, '.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  spreadsheetId: string;
  credentialsPath?: string;
  credentialsJson?: string;
  clientEmail?: string;
  privateKey?: string;
  syncIntervalMs: number;
  isMockMode: boolean;
}

const PORT = parseInt(process.env.PORT || '5001', 10);
const SPREADSHEET_ID = (process.env.GOOGLE_SPREADSHEET_ID || '').trim();
let rawCredentialsPath = (process.env.GOOGLE_CREDENTIALS_PATH || '').trim();
const CREDENTIALS_JSON = (process.env.GOOGLE_CREDENTIALS_JSON || '').trim();
const CLIENT_EMAIL = (process.env.GOOGLE_CLIENT_EMAIL || '').trim();
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '20000', 10);

// Resolve relative credentials path against server directory or cwd
let resolvedCredentialsPath = '';
if (rawCredentialsPath) {
  if (path.isAbsolute(rawCredentialsPath) && fs.existsSync(rawCredentialsPath)) {
    resolvedCredentialsPath = rawCredentialsPath;
  } else if (fs.existsSync(path.resolve(serverDir, rawCredentialsPath))) {
    resolvedCredentialsPath = path.resolve(serverDir, rawCredentialsPath);
  } else if (fs.existsSync(path.resolve(process.cwd(), rawCredentialsPath))) {
    resolvedCredentialsPath = path.resolve(process.cwd(), rawCredentialsPath);
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

export const config: AppConfig = {
  port: PORT,
  spreadsheetId: SPREADSHEET_ID,
  credentialsPath: resolvedCredentialsPath || rawCredentialsPath,
  credentialsJson: CREDENTIALS_JSON,
  clientEmail: CLIENT_EMAIL,
  privateKey: PRIVATE_KEY,
  syncIntervalMs: SYNC_INTERVAL_MS,
  isMockMode: !hasCredentials || !SPREADSHEET_ID,
};

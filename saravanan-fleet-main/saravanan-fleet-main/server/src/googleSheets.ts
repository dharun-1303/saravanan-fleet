import { google, sheets_v4 } from 'googleapis';
import fs from 'fs';
import { config } from './config.js';

export function getColumnLetter(colIndex1Based: number): string {
  let temp = colIndex1Based;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets | null = null;
  private authClient: any = null;
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = config.spreadsheetId;
    this.initAuth();
  }

  private initAuth() {
    try {
      if (config.credentialsPath && fs.existsSync(config.credentialsPath)) {
        this.authClient = new google.auth.GoogleAuth({
          keyFile: config.credentialsPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.authClient });
      } else if (config.credentialsJson) {
        const credentials = JSON.parse(config.credentialsJson);
        this.authClient = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key?.replace(/\\n/g, '\n'),
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.authClient });
      } else if (config.clientEmail && config.privateKey) {
        this.authClient = new google.auth.JWT({
          email: config.clientEmail,
          key: config.privateKey,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        this.sheets = google.sheets({ version: 'v4', auth: this.authClient });
      } else {
        this.sheets = null;
      }
    } catch (err) {
      console.error('[GoogleSheetsClient] Error initializing auth:', err);
      this.sheets = null;
    }
  }

  private knownTabs: Set<string> = new Set();
  private metadataFetched = false;
  private lastMetadataTime = 0;
  private metadataPromise: Promise<string[]> | null = null;
  private readonly METADATA_TTL_MS = 60000; // Cache metadata for 60 seconds

  public isConfigured(): boolean {
    return this.sheets !== null && Boolean(this.spreadsheetId) && !config.isMockMode;
  }

  public async getSheetsMetadata(forceRefresh = false): Promise<string[]> {
    if (!this.sheets || !this.spreadsheetId) return [];
    const now = Date.now();
    if (!forceRefresh && this.metadataFetched && now - this.lastMetadataTime < this.METADATA_TTL_MS) {
      return Array.from(this.knownTabs);
    }
    if (this.metadataPromise) {
      return this.metadataPromise;
    }
    this.metadataPromise = (async () => {
      try {
        const res = await this.sheets!.spreadsheets.get({
          spreadsheetId: this.spreadsheetId,
        });
        const titles = res.data.sheets?.map(s => s.properties?.title || '').filter(Boolean) || [];
        this.knownTabs = new Set(titles);
        this.metadataFetched = true;
        this.lastMetadataTime = Date.now();
        return titles;
      } catch (err: any) {
        console.error('[GoogleSheetsClient] getSheetsMetadata error:', err.message);
        throw err;
      } finally {
        this.metadataPromise = null;
      }
    })();
    return this.metadataPromise;
  }

  public async readSheetValues(sheetName: string): Promise<any[][]> {
    if (!this.sheets || !this.spreadsheetId) return [];
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A:Z`,
      });
      return res.data.values || [];
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] readSheetValues error for ${sheetName}:`, err.message);
      return [];
    }
  }

  public async batchGetSheetValues(sheetNames: string[]): Promise<Map<string, any[][]>> {
    const result = new Map<string, any[][]>();
    if (!this.sheets || !this.spreadsheetId || sheetNames.length === 0) return result;
    try {
      const ranges = sheetNames.map(name => `'${name}'!A:Z`);
      const res = await this.sheets.spreadsheets.values.batchGet({
        spreadsheetId: this.spreadsheetId,
        ranges,
      });
      const valueRanges = res.data.valueRanges || [];
      sheetNames.forEach((name, idx) => {
        result.set(name, valueRanges[idx]?.values || []);
      });
      return result;
    } catch (err: any) {
      console.error('[GoogleSheetsClient] batchGetSheetValues error:', err.message);
      return result;
    }
  }

  public async ensureTabExists(sheetName: string, headers: string[]): Promise<boolean> {
    if (!this.sheets || !this.spreadsheetId) return false;
    try {
      if (this.knownTabs.has(sheetName)) return true;

      if (!this.metadataFetched) {
        await this.getSheetsMetadata();
        if (this.knownTabs.has(sheetName)) return true;
      }

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetName },
              },
            },
          ],
        },
      });
      // Write header row using accurate column letter
      const endCol = getColumnLetter(headers.length);
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:${endCol}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headers] },
      });
      this.knownTabs.add(sheetName);
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] ensureTabExists error for ${sheetName}:`, err.message, err);
      return false;
    }
  }

  public async ensureColumnsExist(sheetName: string, requiredColumns: string[]): Promise<string[]> {
    if (!this.sheets || !this.spreadsheetId) return requiredColumns;
    try {
      const rows = await this.readSheetValues(sheetName);
      if (rows.length === 0 || !rows[0] || rows[0].length === 0) {
        // Tab has no rows; write required headers
        const endCol = getColumnLetter(requiredColumns.length);
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'${sheetName}'!A1:${endCol}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [requiredColumns] },
        });
        return [...requiredColumns];
      }

      const existingHeaders: string[] = rows[0].map(h => (h || '').toString());
      const normalizedExisting = existingHeaders.map(h => h.trim().toUpperCase());
      const missingColumns: string[] = [];

      for (const reqCol of requiredColumns) {
        const norm = reqCol.trim().toUpperCase();
        const exists = normalizedExisting.some(ex => {
          if (ex === norm) return true;
          if ((norm.includes('ENROUTE') || norm.includes('VIA')) && (ex.includes('ENROUTE') || ex.includes('VIA'))) return true;
          if (norm.includes('GATE STATUS') && ex.includes('GATE STATUS')) return true;
          if (norm.includes('GATE OUT TIME') && (ex.includes('GATE OUT TIME') || ex === 'OUT TIME')) return true;
          if (norm.includes('GATE OUT BY') && (ex.includes('GATE OUT BY') || ex === 'OUT BY')) return true;
          if (norm.includes('GATE IN TIME') && (ex.includes('GATE IN TIME') || ex === 'IN TIME')) return true;
          if (norm.includes('GATE IN BY') && (ex.includes('GATE IN BY') || ex === 'IN BY')) return true;
          if (norm.includes('TRIP STATUS') && (ex === 'TRIP STATUS' || ex === 'STATUS')) return true;
          return false;
        });
        if (!exists) {
          missingColumns.push(reqCol);
        }
      }

      if (missingColumns.length > 0) {
        const newHeaders = [...existingHeaders, ...missingColumns];
        const endCol = getColumnLetter(newHeaders.length);
        console.log(`[GoogleSheetsClient] Dynamically appending missing column headers to "${sheetName}":`, missingColumns);
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'${sheetName}'!A1:${endCol}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [newHeaders] },
        });
        return newHeaders;
      }

      return existingHeaders;
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] ensureColumnsExist error for "${sheetName}":`, err.message, err);
      return requiredColumns;
    }
  }

  public async updateRow(sheetName: string, rowIndex: number, values: (string | number)[]): Promise<boolean> {
    if (!this.sheets || !this.spreadsheetId) {
      throw new Error('Google Sheets client or GOOGLE_SPREADSHEET_ID is not configured');
    }
    try {
      const endCol = getColumnLetter(values.length);
      const range = `'${sheetName}'!A${rowIndex}:${endCol}${rowIndex}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      });
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] updateRow error for ${sheetName} row ${rowIndex}:`, err.message, err);
      throw err;
    }
  }

  public async appendRow(sheetName: string, values: (string | number)[]): Promise<{ success: boolean; rowIndex: number; apiResponse?: any }> {
    if (!this.sheets || !this.spreadsheetId) {
      throw new Error('Google Sheets client or GOOGLE_SPREADSHEET_ID is not configured');
    }
    try {
      // First, read current sheet to check for totals row or existing rows
      const currentRows = await this.readSheetValues(sheetName);
      let insertIndex = currentRows.length + 1;

      // Find if there is a 'Total' row at the bottom
      let totalsRowIndex = -1;
      for (let i = currentRows.length - 1; i >= 0; i--) {
        const row = currentRows[i];
        const firstCol = (row[0] || '').toString().trim().toUpperCase();
        const secondCol = (row[1] || '').toString().trim().toUpperCase();
        if (firstCol === 'TOTAL' || firstCol.startsWith('TOTAL ') || (firstCol === '' && (secondCol === 'TOTAL' || secondCol.startsWith('TOTAL ')))) {
          totalsRowIndex = i + 1; // 1-based row index in spreadsheet
          break;
        }
      }

      if (totalsRowIndex > 0) {
        // Insert row above the totals row to protect formula integrity
        insertIndex = totalsRowIndex;
        // Batch update to insert dimension row
        const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
        const sheet = meta.data.sheets?.find(s => s.properties?.title?.toLowerCase() === sheetName.toLowerCase());
        const sheetId = sheet?.properties?.sheetId || 0;

        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                insertDimension: {
                  range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: insertIndex - 1,
                    endIndex: insertIndex,
                  },
                  inheritFromBefore: true,
                },
              },
            ],
          },
        });

        // Now write values at insertIndex
        await this.updateRow(sheetName, insertIndex, values);
        return { success: true, rowIndex: insertIndex };
      }

      // No totals row, standard append
      const endCol = getColumnLetter(Math.max(values.length, 26));
      const res = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A:${endCol}`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
      });

      const updatedRange = res.data.updates?.updatedRange || '';
      const match = updatedRange.match(/!A(\d+):/);
      const parsedRowIndex = match ? parseInt(match[1], 10) : insertIndex;
      return { success: true, rowIndex: parsedRowIndex, apiResponse: res.data };
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] appendRow error for ${sheetName}:`, err.message, err);
      throw err;
    }
  }

  public async deleteRow(sheetName: string, rowIndex: number): Promise<boolean> {
    if (!this.sheets || !this.spreadsheetId) {
      throw new Error('Google Sheets client or GOOGLE_SPREADSHEET_ID is not configured');
    }
    if (rowIndex <= 0) return false;
    try {
      const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheet = meta.data.sheets?.find(s => s.properties?.title?.toLowerCase() === sheetName.toLowerCase());
      if (!sheet || sheet.properties?.sheetId === undefined || sheet.properties?.sheetId === null) {
        console.error(`[GoogleSheetsClient] Sheet "${sheetName}" not found for deletion`);
        return false;
      }
      const sheetId = sheet.properties.sheetId;
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // 0-based inclusive
                  endIndex: rowIndex,       // 0-based exclusive
                },
              },
            },
          ],
        },
      });
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] deleteRow error for ${sheetName} row ${rowIndex}:`, err.message);
      throw err;
    }
  }
}

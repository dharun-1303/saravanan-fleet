import { google, sheets_v4 } from 'googleapis';
import fs from 'fs';
import { config } from './config.js';

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
          key: credentials.private_key,
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

  public isConfigured(): boolean {
    return this.sheets !== null && Boolean(this.spreadsheetId);
  }

  public async getSheetsMetadata(): Promise<string[]> {
    if (!this.sheets || !this.spreadsheetId) return [];
    try {
      const res = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      return res.data.sheets?.map(s => s.properties?.title || '').filter(Boolean) || [];
    } catch (err: any) {
      console.error('[GoogleSheetsClient] getSheetsMetadata error:', err.message);
      throw err;
    }
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

  public async ensureTabExists(sheetName: string, headers: string[]): Promise<boolean> {
    if (!this.sheets || !this.spreadsheetId) return false;
    try {
      const existing = await this.getSheetsMetadata();
      if (!existing.includes(sheetName)) {
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
        // Write header row
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `'${sheetName}'!A1:${String.fromCharCode(64 + headers.length)}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [headers] },
        });
      }
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] ensureTabExists error for ${sheetName}:`, err.message);
      return false;
    }
  }

  public async updateRow(sheetName: string, rowIndex: number, values: (string | number)[]): Promise<boolean> {
    if (!this.sheets || !this.spreadsheetId) return false;
    try {
      const endCol = String.fromCharCode(64 + values.length);
      const range = `'${sheetName}'!A${rowIndex}:${endCol}${rowIndex}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
      });
      return true;
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] updateRow error for ${sheetName} row ${rowIndex}:`, err.message);
      throw err;
    }
  }

  public async appendRow(sheetName: string, values: (string | number)[]): Promise<{ success: boolean; rowIndex: number }> {
    if (!this.sheets || !this.spreadsheetId) return { success: false, rowIndex: -1 };
    try {
      // First, read current sheet to check for totals row or existing rows
      const currentRows = await this.readSheetValues(sheetName);
      let insertIndex = currentRows.length + 1;

      // Find if there is a 'Total' row at the bottom
      let totalsRowIndex = -1;
      for (let i = currentRows.length - 1; i >= 0; i--) {
        const row = currentRows[i];
        const firstCol = (row[0] || '').toString().toUpperCase();
        const secondCol = (row[1] || '').toString().toUpperCase();
        if (firstCol.includes('TOTAL') || secondCol.includes('TOTAL')) {
          totalsRowIndex = i + 1; // 1-based row index in spreadsheet
          break;
        }
      }

      if (totalsRowIndex > 0) {
        // Insert row above the totals row to protect formula integrity
        insertIndex = totalsRowIndex;
        // Batch update to insert dimension row
        const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
        const sheet = meta.data.sheets?.find(s => s.properties?.title === sheetName);
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
      const res = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A:Z`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
      });

      const updatedRange = res.data.updates?.updatedRange || '';
      const match = updatedRange.match(/!A(\d+):/);
      const parsedRowIndex = match ? parseInt(match[1], 10) : insertIndex;
      return { success: true, rowIndex: parsedRowIndex };
    } catch (err: any) {
      console.error(`[GoogleSheetsClient] appendRow error for ${sheetName}:`, err.message);
      throw err;
    }
  }

  public async deleteRow(sheetName: string, rowIndex: number): Promise<boolean> {
    if (!this.sheets || !this.spreadsheetId) return false;
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

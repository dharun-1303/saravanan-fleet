import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';
import { config } from './config.js';

export class GoogleDriveClient {
  private drive: drive_v3.Drive | null = null;
  private authClient: any = null;
  private defaultFolderId: string;

  constructor() {
    this.defaultFolderId = config.driveFolderId || '1cJAu7H0d3m64mkIeG11Shi5spdcBDzZa';
    this.initAuth();
  }

  private initAuth() {
    try {
      const scopes = [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
      ];

      if (config.credentialsPath && fs.existsSync(config.credentialsPath)) {
        this.authClient = new google.auth.GoogleAuth({
          keyFile: config.credentialsPath,
          scopes,
        });
        this.drive = google.drive({ version: 'v3', auth: this.authClient });
      } else if (config.credentialsJson) {
        const credentials = JSON.parse(config.credentialsJson);
        this.authClient = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key?.replace(/\\n/g, '\n'),
          scopes,
        });
        this.drive = google.drive({ version: 'v3', auth: this.authClient });
      } else if (config.clientEmail && config.privateKey) {
        this.authClient = new google.auth.JWT({
          email: config.clientEmail,
          key: config.privateKey,
          scopes,
        });
        this.drive = google.drive({ version: 'v3', auth: this.authClient });
      } else {
        this.drive = null;
      }
    } catch (err: any) {
      console.error('[GoogleDriveClient] Auth initialization error:', err.message);
      this.drive = null;
    }
  }

  public isConfigured(): boolean {
    return this.drive !== null && Boolean(this.defaultFolderId);
  }

  public getFolderId(): string {
    return this.defaultFolderId;
  }

  /**
   * Upload a file from a local path or Buffer directly into the Google Drive folder.
   */
  public async uploadFile(
    fileSource: string | Buffer,
    fileName: string,
    mimeType: string,
    folderIdOverride?: string
  ): Promise<{ fileId: string; webViewLink: string; webContentLink?: string }> {
    if (!this.drive) {
      throw new Error('Google Drive client is not authenticated');
    }

    const folderId = folderIdOverride || this.defaultFolderId || '1cJAu7H0d3m64mkIeG11Shi5spdcBDzZa';
    let fileStream: Readable;

    if (typeof fileSource === 'string') {
      if (!fs.existsSync(fileSource)) {
        throw new Error(`File not found at path: ${fileSource}`);
      }
      fileStream = fs.createReadStream(fileSource);
    } else {
      fileStream = new Readable();
      fileStream.push(fileSource);
      fileStream.push(null);
    }

    try {
      const requestBody: drive_v3.Schema$File = {
        name: fileName,
        parents: [folderId],
      };

      const res = await this.drive.files.create({
        requestBody,
        media: {
          mimeType,
          body: fileStream,
        },
        fields: 'id, name, webViewLink, webContentLink',
      });

      const fileId = res.data.id;
      if (!fileId) {
        throw new Error('Google Drive did not return a file ID');
      }

      // Set public viewing permission (anyone with link can view)
      try {
        await this.drive.permissions.create({
          fileId,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        });
      } catch (permErr: any) {
        console.warn(`[GoogleDriveClient] Permission warning for ${fileId}:`, permErr.message);
      }

      const webViewLink =
        res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

      return {
        fileId,
        webViewLink,
        webContentLink: res.data.webContentLink || undefined,
      };
    } catch (err: any) {
      console.error(`[GoogleDriveClient] Failed to upload ${fileName}:`, err.message);
      throw err;
    }
  }
}

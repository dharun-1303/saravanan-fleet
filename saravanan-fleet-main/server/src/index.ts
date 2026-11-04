import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import os from 'os';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { DataStore } from './dataStore.js';
import { GoogleDriveClient } from './googleDrive.js';
import { createFleetRouter } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
// Restrict CORS to the configured client origin in production
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- File Upload Setup ---
// In serverless environments (like Vercel), project directories are read-only.
// Use os.tmpdir() when running in production/serverless, otherwise use local uploads folder.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDir = isServerless 
  ? path.join(os.tmpdir(), 'fleet-uploads')
  : path.resolve(__dirname, '../../uploads');

const photosDir = path.join(uploadsDir, 'photos');
const docsDir = path.join(uploadsDir, 'documents');
try {
  [uploadsDir, photosDir, docsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
} catch (e) {
  console.warn('[Storage] Warning creating upload directories:', e);
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, photosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `photo-${Date.now()}${ext}`);
  },
});
const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, docsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `doc-${Date.now()}${ext}`);
  },
});

const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// Initialize Google Drive Client
const driveClient = new GoogleDriveClient();

// Photo upload endpoint
app.post(['/api/upload/photo', '/api/upload-photo'], uploadPhoto.single('file'), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  if (driveClient.isConfigured()) {
    try {
      const driveResult = await driveClient.uploadFile(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        config.driveFolderId || '1cJAu7H0d3m64mkIeG11Shi5spdcBDzZa'
      );
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore error deleting temp file
      }
      res.json({
        url: driveResult.webViewLink,
        filename: req.file.originalname,
        driveFileId: driveResult.fileId,
        storage: 'google_drive',
      });
      return;
    } catch (err: any) {
      console.error('[Upload] Google Drive photo upload failed, falling back to local:', err.message);
    }
  }

  const url = `/uploads/photos/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, storage: 'local' });
});

// Document upload endpoint (supports both /api/upload-document and /api/upload/document)
const handleDocumentUpload = async (req: express.Request, res: express.Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

  if (driveClient.isConfigured()) {
    try {
      const driveResult = await driveClient.uploadFile(
        req.file.path,
        req.file.originalname,
        req.file.mimetype,
        config.driveFolderId || '1cJAu7H0d3m64mkIeG11Shi5spdcBDzZa'
      );
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore error deleting temp file
      }
      res.json({
        url: driveResult.webViewLink,
        filename: req.file.originalname,
        driveFileId: driveResult.fileId,
        storage: 'google_drive',
      });
      return;
    } catch (err: any) {
      console.error('[Upload] Google Drive document upload failed, falling back to local:', err.message);
    }
  }

  const url = `/uploads/documents/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, storage: 'local' });
};

app.post('/api/upload-document', uploadDoc.single('file'), handleDocumentUpload);
app.post('/api/upload/document', uploadDoc.single('file'), handleDocumentUpload);

// Initialize central DataStore
const dataStore = new DataStore();

// Mount Fleet REST API
app.use('/api', createFleetRouter(dataStore));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    company: 'Saravanan Electricals & Engineering Pvt Ltd',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    sync: dataStore.getSyncStatus(),
    drive: {
      configured: driveClient.isConfigured(),
      folderId: driveClient.getFolderId() || null,
    },
  });
});

// Serve frontend build if present
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Start Server locally if not running as serverless function
if (!isServerless && process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`⚡ Saravanan Electricals Fleet Backend Online!`);
    console.log(`📡 URL: http://localhost:${config.port}`);
    console.log(`📊 Sheets Mode: ${config.isMockMode ? 'Local / Offline Cache' : 'Live Google Sheets Connected'}`);
    console.log(`📁 Drive Storage: ${driveClient.isConfigured() ? 'Active (Folder ID: ' + driveClient.getFolderId() + ')' : 'Local Disk Only'}`);
    console.log(`======================================================\n`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

// Export default for Vercel Serverless Function & testing
export default app;

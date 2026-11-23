import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
// Workaround for Windows permissions on system temp directories (e.g. C:\temp or %TEMP%)
// Ensures esbuild writes temporary chunks to local .tmp where the user has full permissions
const localTemp = path.resolve(__dirname, '.tmp');
try {
  if (!fs.existsSync(localTemp)) {
    fs.mkdirSync(localTemp, { recursive: true });
  }
  process.env.TEMP = localTemp;
  process.env.TMP = localTemp;
} catch (e) {
  // fallback if already exists
}
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // API keys moved to backend - NEVER expose them in client bundle!
      define: {
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || 'http://localhost:3001'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

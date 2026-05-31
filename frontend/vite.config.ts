import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      // Resolve schemas from TS source so Vite always sees changes immediately
      '@portlog/schemas': path.resolve(__dirname, '../packages/schemas/src/index.ts'),
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          if (
            id.includes('@mantine/core') ||
            id.includes('@mantine/hooks') ||
            id.includes('@mantine/dates')
          ) {
            return 'mantine';
          }
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/react-router')) {
            return 'tanstack';
          }
        },
      },
    },
  },
});

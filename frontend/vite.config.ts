import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
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

// The demo needs no backend: the drive is kept in the page.

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5181, strictPort: true },
});

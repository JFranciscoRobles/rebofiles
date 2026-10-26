// The page of the window: served by Vite while it is made (`npm run dev`
// starts both), and built into `dist` for Tauri to bundle.

import { defineConfig } from 'vite';

export default defineConfig({
  // Tauri waits on this port; another would leave the window empty.
  server: { port: 5190, strictPort: true },
  // As the web views of the Mac and of Windows read it.
  build: { target: ['safari16', 'chrome110'] },
  clearScreen: false,
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site at https://<user>.github.io/polify/
// Override with VITE_BASE if deploying elsewhere (e.g. a custom domain).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/polify/',
});

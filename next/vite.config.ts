import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/bonsai-app/',
  plugins: [react()],
  build: {
    target: ['es2020', 'safari14'],
    sourcemap: true,
    cssCodeSplit: true
  }
});

import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Configuração do Vite para o frontend (React + TypeScript + Tailwind).
 *
 * `base: './'` é obrigatório para o Capacitor, que carrega os assets a partir de
 * file:// dentro do WebView do Android.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    port: 5173,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { build as esbuild } from 'esbuild';

async function buildElectron() {
  const shared = {
    platform: 'node' as const,
    bundle: true,
    format: 'cjs' as const,
    target: 'node18',
    external: ['electron', 'electron-updater'],
    outdir: 'dist-electron',
  };
  await esbuild({
    ...shared,
    entryPoints: ['electron/setupMain.ts'],
    outfile: 'dist-electron/setupMain.js',
  });
  await esbuild({
    ...shared,
    entryPoints: ['electron/setupPreload.ts'],
    outfile: 'dist-electron/setupPreload.js',
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'build-setup-electron',
      async closeBundle() {
        await buildElectron();
      },
    },
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        setup: path.resolve(__dirname, 'setup.html'),
      },
    },
  },
});

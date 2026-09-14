import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'dist-electron/main',
            lib: {
                entry: resolve(__dirname, 'electron/main.ts'),
                formats: ['es'],
            },
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            outDir: 'dist-electron/preload',
            lib: {
                entry: resolve(__dirname, 'electron/preload.ts'),
                formats: ['cjs'],
            },
        },
    },
    renderer: {
        plugins: [react()],
        root: '.',
        base: './',
        server: {
            port: 1420,
            strictPort: true,
        },
        build: {
            outDir: 'dist',
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'index.html'),
                },
            },
        },
    },
});

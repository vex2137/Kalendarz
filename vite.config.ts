import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export default defineConfig(({ command }) => {
  const betaApk = process.env.CALENDAR_BETA_APK === 'true';
  const modelFree = process.env.CALENDAR_MODEL_FREE === 'true';
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const part1Beta = pkg.version === '1.5.0-part1-beta1' ? JSON.parse(readFileSync('beta-release.json', 'utf8')) : null;
  if (part1Beta && command === 'build' && (!modelFree || betaApk)) throw Error('Part 1 Beta 1 requires the explicit model-free distribution');
  if(betaApk&&modelFree)throw Error('Choose one distribution variant');
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const buildInfo = { commit: git('rev-parse', 'HEAD'), branch: process.env.GITHUB_REF_NAME || git('branch', '--show-current'),
    version: pkg.version + (betaApk ? ' beta 3' : ''), ...(part1Beta ? {channel:part1Beta.channel,releaseName:part1Beta.name} : {}), ...((betaApk||modelFree) ? {bundledModel:false} : {}), ...(modelFree ? {distribution:'model-free'} : {}), androidNative: process.env.CALENDAR_ANDROID_NATIVE === 'true', dirty: Boolean(git('status', '--porcelain', '--untracked-files=no')), builtAt: new Date().toISOString() };
  const modelHeaders = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  };
  return {
    base: './',
    publicDir: betaApk ? 'build/beta-public' : modelFree ? 'build/model-free-public' : 'public',
    define: { __CALENDAR_BUILD__: JSON.stringify(buildInfo) },
    plugins: [
      { name: 'calendar-build-provenance', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify(buildInfo) }); } },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          id: '/',
          name: part1Beta?.name || 'Calendar',
          lang: 'en',
          short_name: part1Beta ? 'Calendar Beta 1' : 'Calendar',
          description:
            'A private offline calendar with a local assistant and reminders',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: { enabled: false },
        workbox: {
          // Both CPU runtimes must be available after installation without contacting a CDN.
          globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}', 'models/*.{gguf,json,txt}', 'build-info.json'],
          maximumFileSizeToCacheInBytes: 600 * 1024 * 1024,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      headers: modelHeaders,
      // Cloud tasks may disable HMR and watching while applying edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: { headers: modelHeaders },
  };
});

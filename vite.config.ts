import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export default defineConfig(() => {
  const betaApk = process.env.CALENDAR_BETA_APK === 'true';
  const modelFree = process.env.CALENDAR_MODEL_FREE === 'true';
  if(betaApk&&modelFree)throw Error('Choose one distribution variant');
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const lifecycleDiagnostic = process.env.CALENDAR_ANDROID_LIFECYCLE_DIAGNOSTIC==='true';
  if(lifecycleDiagnostic&&(process.env.CALENDAR_PART4_BETA!=='true'||process.env.CALENDAR_PART4_BETA_NUMBER!=='3'||process.env.CALENDAR_ANDROID_NATIVE!=='true'))throw Error('Lifecycle diagnostic is Android Part 4 Beta 3 only');
  const buildInfo = { ...(lifecycleDiagnostic?{...JSON.parse(readFileSync('scripts/part4-beta3-lifecycle-version.json','utf8')),releaseChannel:'part4-beta3-lifecycle-diag1'}:process.env.CALENDAR_PART4_BETA==='true'?{...JSON.parse(readFileSync(`scripts/part4-beta${process.env.CALENDAR_PART4_BETA_NUMBER || '1'}-version.json`,'utf8')),releaseChannel:`part4-beta${process.env.CALENDAR_PART4_BETA_NUMBER || '1'}`}:process.env.CALENDAR_PART3_BETA==='true'?{releaseChannel:'part3-beta2',...JSON.parse(readFileSync('scripts/part3-beta2-version.json','utf8'))}:process.env.CALENDAR_PART2_STABLE==='true'?{releaseChannel:'part2-stable'}:{}), commit: git('rev-parse', 'HEAD'), branch: process.env.CALENDAR_APPLICATION_BRANCH || process.env.GITHUB_REF_NAME || git('branch', '--show-current'),
    workflowCommit: process.env.GITHUB_SHA, workflowRepository: process.env.GITHUB_REPOSITORY,
    version: JSON.parse(readFileSync('package.json', 'utf8')).version + (betaApk ? ' beta 3' : ''), ...((betaApk||modelFree) ? {bundledModel:false} : {}), ...(modelFree ? {distribution:'model-free'} : {}), androidNative: process.env.CALENDAR_ANDROID_NATIVE === 'true', dirty: Boolean(git('status', '--porcelain', '--untracked-files=no')), builtAt: new Date().toISOString() };
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
          name: 'Calendar',
          lang: 'en',
          short_name: 'Calendar',
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

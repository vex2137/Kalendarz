import fs from 'fs';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function releaseDownloadsPlugin(): Plugin {
  return {
    name: 'release-downloads',
    configureServer(server) {
      server.middlewares.use('/api/download/windows', (_req, res) => {
        const filePath = path.resolve(process.cwd(), 'release', 'Kalendarz Offline.exe');
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          res.writeHead(200, {
            'Content-Disposition': 'attachment; filename="Kalendarz-Offline.exe"',
            'Content-Type': 'application/vnd.microsoft.portable-executable',
            'Content-Length': stat.size,
          });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
          res.end('Plik Kalendarz Offline.exe nie został znaleziony w folderze release/.');
        }
      });

      server.middlewares.use('/api/download/windows-zip', (_req, res) => {
        const filePath = path.resolve(process.cwd(), 'release', 'Kalendarz Offline-1.0.0-win.zip');
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          res.writeHead(200, {
            'Content-Disposition': 'attachment; filename="Kalendarz-Offline-win.zip"',
            'Content-Type': 'application/zip',
            'Content-Length': stat.size,
          });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
          res.end('Plik Kalendarz Offline-win.zip nie został znaleziony.');
        }
      });

      server.middlewares.use('/api/download/linux', (_req, res) => {
        const filePath = path.resolve(process.cwd(), 'release', 'Kalendarz Offline-1.0.0.AppImage');
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          res.writeHead(200, {
            'Content-Disposition': 'attachment; filename="Kalendarz-Offline.AppImage"',
            'Content-Type': 'application/x-executable',
            'Content-Length': stat.size,
          });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
          res.end('Plik Kalendarz Offline-1.0.0.AppImage nie został znaleziony w folderze release/.');
        }
      });

      server.middlewares.use('/api/releases', (_req, res) => {
        const releaseDir = path.resolve(process.cwd(), 'release');
        let files: {name: string; sizeBytes: number; sizeMb: string; downloadUrl: string}[] = [];
        if (fs.existsSync(releaseDir)) {
          const fileNames = fs.readdirSync(releaseDir);
          files = fileNames
            .filter(f => f.endsWith('.exe') || f.endsWith('.AppImage') || f.endsWith('.zip'))
            .map(f => {
              const fullPath = path.join(releaseDir, f);
              const stat = fs.statSync(fullPath);
              let downloadUrl = '';
              if (f.endsWith('.exe')) downloadUrl = '/api/download/windows';
              else if (f.endsWith('.zip')) downloadUrl = '/api/download/windows-zip';
              else if (f.endsWith('.AppImage')) downloadUrl = '/api/download/linux';
              return {
                name: f,
                sizeBytes: stat.size,
                sizeMb: `${(stat.size / (1024 * 1024)).toFixed(1)} MB`,
                downloadUrl,
              };
            });
        }
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({releaseDir, files}));
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      releaseDownloadsPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'Kalendarz',
          short_name: 'Kalendarz',
          description: 'Prywatny kalendarz w stylu Google Calendar z lokalnym modelem AI i powiadomieniami',
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
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

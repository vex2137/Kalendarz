import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kalendarz.offline',
  appName: 'Kalendarz Offline',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

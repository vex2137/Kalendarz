import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kalendarz.ai.offline',
  appName: 'Kalendarz AI Offline',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

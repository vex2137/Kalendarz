import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppLanguage } from './i18n';
import type { PluginListenerHandle } from '@capacitor/core';

interface CalendarDevicePlugin {
  diagnosticsBuildInfo(): Promise<{ commit: string; applicationId: string; version: string }>;
  setLanguage(options: { language: AppLanguage }): Promise<void>;
  notificationStatus(): Promise<{ enabled: boolean; channel: 'ready' | 'silent' | 'blocked' }>;
  openNotificationSettings(): Promise<void>;
  addListener(event: 'notificationSettingsChanged', listener: () => void): Promise<PluginListenerHandle>;
}

export const CalendarDevice = registerPlugin<CalendarDevicePlugin>('CalendarDevice');
export async function updateNativeAppName(language: AppLanguage): Promise<void> {
  if (Capacitor.getPlatform() === 'android') await CalendarDevice.setLanguage({ language });
}

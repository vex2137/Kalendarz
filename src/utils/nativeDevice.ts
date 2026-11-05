import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppLanguage } from './i18n';
import type { PluginListenerHandle } from '@capacitor/core';

interface CalendarDevicePlugin {
  exportDiagnostics(options:{json:string}):Promise<{status:'saved'|'cancelled'}>;
  benchmarkTelemetry(): Promise<Record<string, number|string|boolean|null>>;
  diagnosticsBuildInfo(): Promise<{ commit: string; applicationId: string; version: string }>;
  setLanguage(options: { language: AppLanguage }): Promise<void>;
  biometricStatus(): Promise<{ available: boolean }>;
  authenticateBiometric(options: { title: string; cancel: string }): Promise<{ authenticated: boolean }>;
  setSystemBarColors(options: { background: string; darkIcons: boolean }): Promise<void>;
  notificationStatus(): Promise<{ enabled: boolean; channel: 'ready' | 'silent' | 'blocked' }>;
  openNotificationSettings(): Promise<void>;
  addListener(event: 'notificationSettingsChanged', listener: () => void): Promise<PluginListenerHandle>;
}

export const CalendarDevice = registerPlugin<CalendarDevicePlugin>('CalendarDevice');
export async function updateNativeAppName(language: AppLanguage): Promise<void> {
  if (Capacitor.getPlatform() === 'android') await CalendarDevice.setLanguage({ language });
}
export async function updateNativeSystemBars(background: string): Promise<void> {
  if (Capacitor.getPlatform() !== 'android' || !/^#[0-9a-f]{6}$/i.test(background)) return;
  const rgb = background.slice(1).match(/../g)!.map(part => parseInt(part, 16));
  const darkIcons = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 140;
  await CalendarDevice.setSystemBarColors({ background, darkIcons });
}

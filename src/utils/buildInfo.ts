export interface BuildInfo { commit: string; branch: string; version: string; dirty: boolean; builtAt: string; bundledModel?:boolean; androidNative?:boolean }
declare const __CALENDAR_BUILD__: BuildInfo;
export const BUILD_INFO: BuildInfo = typeof __CALENDAR_BUILD__ === 'undefined'
  ? { commit: 'development', branch: 'unknown', version: 'development', dirty: true, builtAt: 'unknown' }
  : __CALENDAR_BUILD__;

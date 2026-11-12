export interface BuildInfo { releaseChannel?:string; versionCode?:number; versionName?:string; workflowCommit?:string; workflowRepository?:string; commit: string; branch: string; version: string; dirty: boolean; builtAt: string; bundledModel?:boolean; androidNative?:boolean; distribution?:'model-free' }
declare const __CALENDAR_BUILD__: BuildInfo;
export const BUILD_INFO: BuildInfo = typeof __CALENDAR_BUILD__ === 'undefined'
  ? { commit: 'development', branch: 'unknown', version: 'development', dirty: true, builtAt: 'unknown' }
  : __CALENDAR_BUILD__;

// Catalogue metadata and a preferred model are not proof of packaged weights.
// model-free takes precedence, including older/conflicting bundledModel flags.
export const buildBundlesModel = (build: Pick<BuildInfo,'distribution'|'bundledModel'>) =>
  build.distribution !== 'model-free' && build.bundledModel !== false;

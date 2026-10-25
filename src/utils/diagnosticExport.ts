import { Capacitor } from '@capacitor/core';
import { CalendarDevice } from './nativeDevice';
import { recordDiagnosticAction } from './modelDiagnostics';
export async function exportDiagnosticsJson(report:unknown):Promise<'saved'|'cancelled'|'download-started'> {
  const json=JSON.stringify(report,null,2);
  if (Capacitor.getPlatform()==='android') {
    recordDiagnosticAction('export-json','bridge-call');
    if(!Capacitor.isPluginAvailable('CalendarDevice'))throw Error('diagnostics-native-unavailable');
    const result=await CalendarDevice.exportDiagnostics({json});
    if(result.status!=='saved'&&result.status!=='cancelled')throw Error('diagnostics-export-response');
    return result.status;
  }
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='calendar-ai-diagnostics.json';
  try { document.body.append(link);link.click(); }
  finally { link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000); }
  // Browsers acknowledge download dispatch, not successful writing on disk.
  return 'download-started';
}

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Download, ShieldCheck, CalendarDays } from 'lucide-react';
import { p3 } from '../utils/part3Text';
import type { AppLanguage } from '../utils/i18n';
import { version } from '../../package.json';
import { BUILD_INFO } from '../utils/buildInfo';
import { publicRelease } from '../utils/releaseVersion';
type Release=ReturnType<typeof publicRelease>;
const endpoint='https://api.github.com/repos/vex2137/Kalendarz/releases/latest';
export function UpdateSettings({language,autoCheck=false}:{language:AppLanguage;autoCheck?:boolean}) {
 const [status,setStatus]=useState<'idle'|'checking'|'current'|'available'|'error'|'unavailable'>('idle'),[release,setRelease]=useState<Release>(),[error,setError]=useState('');
 const [checked,setChecked]=useState(()=>{try{const saved=Number(localStorage.getItem('calendar-last-public-update-check'));return saved>0&&saved<=Date.now()?saved:0;}catch{return 0;}});
 const request=useRef<AbortController|undefined>(undefined),channel=BUILD_INFO.releaseChannel||'development';
 const privateBeta=/^part\d+-beta\d+$/.test(channel),current=privateBeta?`${version}-${channel.replace(/beta(\d+)$/,'beta.$1')}`:version;
 const check=async()=>{if(request.current)return;const c=new AbortController();request.current=c;setStatus('checking');setRelease(undefined);setError('');const timeout=setTimeout(()=>c.abort(),10000);
  try{const response=await fetch(endpoint,{signal:c.signal,headers:{Accept:'application/vnd.github+json'}});if(response.status===404){if(request.current===c)setStatus('unavailable');return;}if(!response.ok)throw Error(`HTTP ${response.status}`);const next=publicRelease(await response.json(),current);if(request.current!==c)return;setRelease(next);setStatus(next.available?'available':'current');const at=Date.now();setChecked(at);try{localStorage.setItem('calendar-last-public-update-check',String(at));}catch{/* A cache failure does not invalidate the network response. */}
  }catch(e){if(request.current===c){setStatus('error');setError(e instanceof Error?e.message:String(e));}}finally{clearTimeout(timeout);if(request.current===c)request.current=undefined;}
 };
 useEffect(()=>{if(autoCheck)void check();return()=>{const c=request.current;request.current=undefined;c?.abort();};},[autoCheck]);
 const label={idle:'Public stable channel',checking:'Checking…',current:'No newer public stable release',available:'Update available',error:'Update check failed',unavailable:'No public stable release is available'}[status];
 return <section className="space-y-4" data-testid="update-center">
  <div className="theme-subtle theme-border border rounded-2xl p-4 flex items-center gap-3"><span className="theme-primary p-3 rounded-xl shrink-0"><CalendarDays size={24} aria-hidden="true"/></span><div className="min-w-0"><strong>Calendar {version}</strong><p className="text-sm">{privateBeta?channel.replace(/^part(\d+)-beta(\d+)$/,'Part $1 Beta $2'):channel}</p><p className="text-xs theme-muted break-all">{BUILD_INFO.versionCode!==undefined&&<>#{BUILD_INFO.versionCode} · </>}{BUILD_INFO.commit.slice(0,12)} · {BUILD_INFO.branch} · {BUILD_INFO.builtAt}</p></div></div>
  <div className="theme-border border rounded-xl p-4 space-y-3"><button type="button" className="theme-primary rounded-xl p-3 inline-flex items-center gap-2" disabled={status==='checking'} onClick={()=>void check()}><RefreshCw size={18} aria-hidden="true"/>{p3(language,status==='checking'?'Checking…':'Check updates')}</button>
   <p role="status">{p3(language,label)}{error&&<span className="block text-xs break-words">{error}</span>}</p>
   {checked>0&&<p className="text-xs theme-muted">{p3(language,'Last successful public check')}: {new Date(checked).toLocaleString(language)}</p>}
   {privateBeta&&<p className="text-xs theme-muted">{p3(language,'Private beta updates cannot be checked without authorized access. Public releases are checked separately.')}</p>}
   {release?.available&&<div className="space-y-2"><strong>{release.version}</strong><p className="whitespace-pre-wrap text-sm">{release.notes}</p><a className="underline" href={release.url} target="_blank" rel="noopener noreferrer">{p3(language,'Open release')}</a></div>}
  </div>
  <div className="grid grid-cols-2 gap-3"><a className="theme-input theme-hover theme-border border rounded-xl p-4 flex items-center gap-2" href="https://github.com/vex2137/Kalendarz/releases" target="_blank" rel="noopener noreferrer"><Download size={18} className="shrink-0"/>GitHub Releases</a><a className="theme-input theme-hover theme-border border rounded-xl p-4 flex items-center gap-2" href="https://github.com/vex2137/Kalendarz/blob/main/LICENSE" target="_blank" rel="noopener noreferrer"><ShieldCheck size={18} className="shrink-0"/>MIT</a></div>
 </section>;
}

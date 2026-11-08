import { useEffect, useRef, useState } from 'react';
import { p3 } from '../utils/part3Text';
import type { AppLanguage } from '../utils/i18n';
import { version } from '../../package.json';
export function UpdateSettings({language,autoCheck=false}:{language:AppLanguage;autoCheck?:boolean}) {
 const [result,setResult]=useState(''),[busy,setBusy]=useState(false),request=useRef<AbortController|undefined>(undefined);
 const check=async()=>{if(request.current)return;const c=new AbortController();request.current=c;setBusy(true);setResult('');const timeout=setTimeout(()=>c.abort(),10000);
  try{const response=await fetch('https://api.github.com/repos/vex2137/Kalendarz/releases/latest',{signal:c.signal,headers:{Accept:'application/vnd.github+json'}});if(!response.ok)throw Error(`HTTP ${response.status}`);const release=await response.json();if(typeof release.tag_name!=='string'||release.draft||release.prerelease)throw Error('Invalid stable release metadata');setResult(`${release.tag_name} · ${release.name||'Kalendarz'} · ${version}`);
  }catch(error){if(request.current===c)setResult(`${p3(language,'Update check failed')}: ${String(error)}`);}finally{clearTimeout(timeout);if(request.current===c){request.current=undefined;setBusy(false);}}
 };
 useEffect(()=>{if(autoCheck)void check();return()=>{const c=request.current;request.current=undefined;c?.abort();};},[autoCheck]);
 return <section className="space-y-3"><p>Calendar {version} · MIT</p><p role="status" className="break-words">{result}</p><button type="button" className="theme-primary rounded p-3" disabled={busy} onClick={()=>void check()}>{p3(language,busy?'Checking…':'Check updates')}</button><a className="block underline" href="https://github.com/vex2137/Kalendarz/releases/latest" target="_blank" rel="noopener noreferrer">GitHub Releases</a><a className="block underline" href="https://github.com/vex2137/Kalendarz/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a></section>;
}

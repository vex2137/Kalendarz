import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { AppLanguage } from '../utils/i18n';

export function MessageCopy({text,language,children}:{text:string;language:AppLanguage;children:React.ReactNode}){
  const [menu,setMenu]=useState<{x:number;y:number}>(),[result,setResult]=useState<'copied'|'error'>();
  const root=useRef<HTMLDivElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout>>(undefined),reset=useRef<ReturnType<typeof setTimeout>>(undefined),origin=useRef({x:0,y:0});
  const labels={en:['Copy','Copied','Could not copy'],pl:['Kopiuj','Skopiowano','Nie udało się skopiować'],de:['Kopieren','Kopiert','Kopieren fehlgeschlagen'],ru:['Копировать','Скопировано','Не удалось скопировать']}[language];
  const position=(x:number,y:number)=>({x:Math.max(8,Math.min(x,window.innerWidth-150)),y:Math.max(8,Math.min(y,window.innerHeight-70))});
  const clear=()=>clearTimeout(timer.current);
  useEffect(()=>()=>{clear();clearTimeout(reset.current);},[]);
  useEffect(()=>{if(!menu)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();setMenu(undefined);}};window.addEventListener('keydown',escape,true);return()=>window.removeEventListener('keydown',escape,true);},[menu]);
  const copy=async()=>{setMenu(undefined);try{await navigator.clipboard.writeText(text);setResult('copied');}catch{setResult('error');}clearTimeout(reset.current);reset.current=setTimeout(()=>setResult(undefined),1800);};
  return <div ref={root} className="message-copy min-w-0" data-testid="message-copy" onPointerDown={e=>{if(e.target instanceof Element&&e.target.closest('button,a,input'))return;origin.current={x:e.clientX,y:e.clientY};clear();timer.current=setTimeout(()=>setMenu(position(e.clientX,e.clientY)),550);}} onPointerMove={e=>{if(Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>10)clear();}} onPointerUp={clear} onPointerCancel={clear} onContextMenu={e=>{e.preventDefault();clear();setMenu(position(e.clientX,e.clientY));}} onKeyDown={e=>{if(e.key==='Escape')setMenu(undefined);}}>
    {children}
    <div className="message-copy-tools"><span className="sr-only" role="status">{result==='copied'?labels[1]:result==='error'?labels[2]:''}</span><button type="button" data-testid="copy-message" aria-label={labels[0]} title={labels[0]} className="message-copy-action" onClick={()=>void copy()}><span className="message-copy-visual" aria-hidden="true">{result==='copied'?<Check size={14} strokeWidth={1.6}/>:<Copy size={14} strokeWidth={1.6}/>}</span></button></div>
    {menu&&createPortal(<div role="menu" style={{left:menu.x,top:menu.y}} className="fixed z-60 rounded-lg theme-surface theme-text theme-border border shadow-lg"><button type="button" role="menuitem" className="p-3 min-h-11" autoFocus onPointerDown={event=>event.preventDefault()} onBlur={()=>setMenu(undefined)} onClick={()=>void copy()}>{labels[0]}</button></div>,root.current?.closest('[role=dialog]')||document.body)}
  </div>;
}

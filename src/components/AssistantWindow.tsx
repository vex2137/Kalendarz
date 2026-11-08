import { useEffect, useRef, useState, type ReactNode } from 'react';
export function AssistantWindow({children,expanded=false}:{children:ReactNode;expanded?:boolean}) {
 const root=useRef<HTMLDivElement>(null),drag=useRef<{id:number;x:number;y:number;left:number;top:number}|undefined>(undefined);
 const [position,setPosition]=useState<{left:number;top:number}|undefined>(undefined);
 useEffect(()=>{const resize=()=>{drag.current=undefined;if(innerWidth<768){setPosition(undefined);return;}setPosition(old=>{
  if(!old||!root.current)return old;const box=root.current.getBoundingClientRect();return {left:Math.max(8,Math.min(old.left,innerWidth-box.width-8)),top:Math.max(8,Math.min(old.top,innerHeight-box.height-8))};
 });};window.addEventListener('resize',resize);const observer=new ResizeObserver(resize);if(root.current)observer.observe(root.current);return()=>{window.removeEventListener('resize',resize);observer.disconnect();};},[]);
 return <div ref={root} data-testid="assistant-window" className={`assistant-window ${expanded?'assistant-with-history':''}`} style={position} onPointerDown={e=>{
  if(innerWidth<768||e.pointerType!=='mouse'||e.button!==0||!(e.target instanceof Element)||!e.target.closest('#ai-assistant-header')||e.target.closest('button,input,a,select'))return;
  const box=e.currentTarget.getBoundingClientRect();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,left:box.left,top:box.top};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
 }} onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const box=e.currentTarget.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(d.left+e.clientX-d.x,innerWidth-box.width-8)),top:Math.max(8,Math.min(d.top+e.clientY-d.y,innerHeight-box.height-8))});}}
 onPointerUp={()=>{drag.current=undefined;}} onPointerCancel={()=>{drag.current=undefined;}} onLostPointerCapture={()=>{drag.current=undefined;}}>{children}</div>;
}

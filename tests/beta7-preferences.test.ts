import test from 'node:test';
import assert from 'node:assert/strict';
import { naturalChatSystemPrompt } from '../src/utils/assistantPrompts';
import {assistantBackgroundEnabled,keepModelLoaded,setAssistantBackground,setKeepModelLoaded} from '../src/utils/assistantBackground';

test('background generation and RAM residency remain independent and preserve the legacy preference',()=>{
 const values=new Map<string,string>([['calendar_ai_panel_background_v1','true']]);
 const oldStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)}});
 Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
 try{assert.equal(assistantBackgroundEnabled(),true);assert.equal(keepModelLoaded(),false);setKeepModelLoaded(true);setAssistantBackground(false);assert.equal(keepModelLoaded(),true);assert.equal(assistantBackgroundEnabled(),false);setAssistantBackground(true);setKeepModelLoaded(false);assert.equal(assistantBackgroundEnabled(),true);assert.equal(keepModelLoaded(),false);}
 finally{if(oldStorage)Object.defineProperty(globalThis,'localStorage',oldStorage);else Reflect.deleteProperty(globalThis,'localStorage');if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');}
});
test('Polish and English prompts constrain verbosity and unavailable integrations without claiming a model quality score',()=>{
 for(const language of ['pl','en'] as const){const prompt=naturalChatSystemPrompt(language);assert.ok(prompt.includes(`(${language} is a hint)`));assert.ok(prompt.includes('1–3 sentences'));assert.ok(prompt.includes('Do not claim Google, Outlook, Apple'));assert.ok(prompt.includes('explicit confirmation'));assert.ok(prompt.includes('correct Polish'));}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStoredSettings,saveStoredSettings} from '../src/utils/settingsStorage';
import {defaultShortcuts} from '../src/utils/shortcuts';
import {DEFAULT_APP_SETTINGS} from '../src/utils/constants';
test('new preferences persist alongside legacy settings and reject ambiguous bindings before writing',()=>{
 const entries=new Map<string,string>();let fail=false;
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('quota');entries.set(key,value);}}});
 try{
  const settings={...structuredClone(DEFAULT_APP_SETTINGS),language:'pl' as const,desktop:{sidebar:true,width:310},lastSettingsCategory:'calendar',keyboardShortcuts:{...defaultShortcuts(),assistant:[]}};
  saveStoredSettings(settings);const loaded=loadStoredSettings();assert.deepEqual(loaded.desktop,settings.desktop);assert.deepEqual(loaded.keyboardShortcuts,settings.keyboardShortcuts);assert.equal(loaded.lastSettingsCategory,'calendar');assert.equal(loaded.language,'pl');assert.deepEqual(loaded.security,settings.security);assert.deepEqual(loaded.ai.planning,loadStoredSettings().ai.planning);
  const original=entries.get('offline_calendar_settings_v2');
  assert.throws(()=>saveStoredSettings({...settings,keyboardShortcuts:{...defaultShortcuts(),create:['a']}}),/Invalid shortcut/);assert.equal(entries.get('offline_calendar_settings_v2'),original);
  fail=true;assert.throws(()=>saveStoredSettings({...settings,theme:'ocean'}),/quota/);assert.equal(entries.get('offline_calendar_settings_v2'),original);fail=false;
  entries.set('offline_calendar_settings_v2',JSON.stringify({...settings,desktop:{sidebar:true,width:9999}}));assert.equal(loadStoredSettings().desktop?.width,360);
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete (globalThis as {localStorage?:unknown}).localStorage;}
});

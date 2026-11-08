import test from 'node:test';
import assert from 'node:assert/strict';
import { modelPresentationState } from '../src/utils/modelPresentationState';
import { modelStateText } from '../src/utils/modelStateText';
import type { ModelStatus } from '../src/utils/localModelRuntime';

const selected: ModelStatus = { modelId:'candidate', phase:'missing', progress:0, installed:false, loaded:false };

test('a selected catalogue entry cannot claim installation, loading or use', () => {
  const actual=modelPresentationState('candidate',100,selected);
  assert.equal(actual.selected,true); assert.equal(actual.installed,false); assert.equal(actual.loaded,false);
  assert.equal(actual.state,'catalogue'); assert.equal(actual.canUse,false); assert.equal(actual.canDownload,true); assert.equal(actual.canResume,false);
});

test('partial, queued and complete unverified transfers have distinct actions', () => {
  const partial=modelPresentationState('candidate',100,{...selected,resumeBytes:40});
  assert.equal(partial.installation,'partial'); assert.equal(partial.canResume,true); assert.equal(partial.canUse,false);
  const running=modelPresentationState('candidate',100,{...selected,phase:'downloading',resumeBytes:40});
  assert.equal(running.state,'downloading'); assert.equal(running.canResume,false); assert.equal(running.canDownload,false);
  const queued=modelPresentationState('candidate',100,{...selected,queued:true});
  assert.equal(queued.state,'queued'); assert.equal(queued.installed,false);
  const complete=modelPresentationState('candidate',100,{...selected,resumeBytes:100});
  assert.equal(complete.installation,'unverified'); assert.equal(complete.canVerify,true); assert.equal(complete.canDownload,false); assert.equal(complete.canResume,false);
});

test('verified installation and actual engine residency stay independent', () => {
  const installed=modelPresentationState('candidate',100,{...selected,installed:true,phase:'installed',installation:'verified'});
  assert.equal(installed.installed,true); assert.equal(installed.loaded,false); assert.equal(installed.state,'verified');
  const resident=modelPresentationState('candidate',100,{...selected,installed:true,loaded:true,phase:'ready',installation:'verified'});
  assert.equal(resident.loaded,true); assert.equal(resident.state,'loaded'); assert.equal(resident.canDownload,false);
  const other=modelPresentationState('another',100,{...selected,loaded:true,installed:true},{state:'verified',bytes:100});
  assert.equal(other.selected,false); assert.equal(other.installed,true); assert.equal(other.loaded,false); assert.equal(other.canUse,true);
});

test('unverified, damaged and inaccessible bytes never get a use action, even with stale loaded flags', () => {
  for (const installation of ['unverified','damaged','unavailable'] as const) {
    const actual=modelPresentationState('candidate',100,{...selected,installed:true,loaded:true,installation});
    assert.equal(actual.installed,false); assert.equal(actual.loaded,false); assert.equal(actual.canUse,false);
  }
});

test('failed replacement retains the verified installation without a resume button', () => {
  const actual=modelPresentationState('candidate',100,{...selected,phase:'error',installed:true,loaded:false,installation:'verified',resumeBytes:40});
  assert.equal(actual.installed,true); assert.equal(actual.canResume,false); assert.equal(actual.canDownload,false);
});

test('every displayed model state and action is available in all four application languages', () => {
  const keys=Object.keys(modelStateText('en')).sort();
  for(const language of ['en','pl','de','ru'] as const) {
    const text=modelStateText(language);
    assert.deepEqual(Object.keys(text).sort(),keys);
    for(const value of Object.values(text))assert.ok(value.trim());
  }
});

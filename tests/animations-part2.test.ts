import test from 'node:test';
import assert from 'node:assert/strict';
import { animationPreferences, DEFAULT_ANIMATIONS } from '../src/utils/animations';

test('motion settings migrate old or invalid data and preserve each explicit control', () => {
  assert.deepEqual(animationPreferences(undefined), DEFAULT_ANIMATIONS);
  assert.deepEqual(animationPreferences({level:'full', speed:200, confetti:true, pinUnlock:false, transitions:false, buttons:false}), {level:'full', speed:200, confetti:true, pinUnlock:false, transitions:false, buttons:false});
  assert.equal(animationPreferences({speed:1000}).speed, 200);
  assert.equal(animationPreferences({speed:1}).speed, 50);
  assert.equal(animationPreferences({speed:NaN, level:'invalid'}).level, 'subtle');
  assert.equal(animationPreferences({speed:NaN}).speed, 100);
});

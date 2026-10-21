import test from 'node:test';
import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermission, scheduleNativeReminders } from '../src/utils/notifications';

test('native notification permissions handle missing replies, denied access, and queue recovery', async () => {
  // Exercise the real Capacitor proxy with a controlled Android bridge response.
  const cap = Capacitor as any;
  const previous = { isNativePlatform: cap.isNativePlatform, PluginHeaders: cap.PluginHeaders, nativePromise: cap.nativePromise };
  let reply: unknown;
  let reject = false;
  const calls: string[] = [];
  cap.isNativePlatform = () => true;
  cap.PluginHeaders = [{ name: 'LocalNotifications', methods: ['checkPermissions', 'requestPermissions', 'getPending', 'cancel', 'schedule'].map(name => ({ name, rtype: 'promise' })) }];
  cap.nativePromise = async (_plugin: string, method: string) => {
    calls.push(method);
    if (reject) throw new Error('Native bridge unavailable');
    return method === 'getPending' ? { notifications: [] } : reply;
  };
  try {
    for (const value of [undefined, null, {}, { display: 'denied' }, { display: 'prompt' }]) {
      reply = value;
      calls.length = 0;
      await assert.doesNotReject(scheduleNativeReminders([]));
      assert.deepEqual(calls, ['checkPermissions']);
      assert.equal(await requestNotificationPermission(), 'denied');
    }
    reply = { display: 'granted' };
    calls.length = 0;
    assert.equal(await requestNotificationPermission(), 'granted');
    await scheduleNativeReminders([]);
    assert.deepEqual(calls, ['requestPermissions', 'checkPermissions', 'getPending']);
    reject = true;
    await assert.rejects(scheduleNativeReminders([]), /Native bridge unavailable/);
    reject = false;
    calls.length = 0;
    await assert.doesNotReject(scheduleNativeReminders([]));
    assert.deepEqual(calls, ['checkPermissions', 'getPending']);
  } finally {
    Object.assign(cap, previous);
  }
});

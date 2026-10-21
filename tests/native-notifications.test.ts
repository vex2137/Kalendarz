import test from 'node:test';
import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';

test('native notification permissions handle missing replies, denied access, and queue recovery', async () => {
  // Exercise the real Capacitor proxy with a controlled Android bridge response.
  const cap = Capacitor as any;
  const previous = { isNativePlatform: cap.isNativePlatform, PluginHeaders: cap.PluginHeaders, nativePromise: cap.nativePromise, getPlatform: cap.getPlatform };
  let reply: unknown;
  let reject = false;
  const calls: string[] = [];
  cap.isNativePlatform = () => true;
  cap.getPlatform = () => 'android';
  let deviceReply: unknown = { enabled: true, channel: 'ready' };
  cap.PluginHeaders = [{ name: 'LocalNotifications', methods: ['checkPermissions', 'requestPermissions', 'getPending', 'cancel', 'schedule'].map(name => ({ name, rtype: 'promise' })) }, { name: 'CalendarDevice', methods: ['notificationStatus', 'setLanguage', 'openNotificationSettings'].map(name => ({ name, rtype: 'promise' })) }];
  cap.nativePromise = async (_plugin: string, method: string) => {
    calls.push(method);
    if (reject) throw new Error('Native bridge unavailable');
    return method === 'getPending' ? { notifications: [] } : method === 'notificationStatus' ? deviceReply : reply;
  };
  const { requestNotificationPermission, scheduleNativeReminders, readSystemNotificationState } = await import('../src/utils/notifications');
  const { updateNativeAppName } = await import('../src/utils/nativeDevice');
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
    for (const [permission, expected] of [[undefined, 'unknown'], [{ display: 'denied' }, 'blocked'], [{ display: 'prompt' }, 'permission-required']]) {
      reply = permission;
      assert.equal(await readSystemNotificationState(), expected);
    }
    reply = { display: 'granted' };
    for (const [value, expected] of [
      [{ enabled: true, channel: 'ready' }, 'enabled'],
      [{ enabled: true, channel: 'silent' }, 'silent'],
      [{ enabled: true, channel: 'blocked' }, 'blocked'],
      [{ enabled: false, channel: 'ready' }, 'blocked'],
      [undefined, 'unknown'],
    ]) {
      deviceReply = value;
      assert.equal(await readSystemNotificationState(), expected);
    }
    deviceReply = { enabled: true, channel: 'ready' };
    assert.equal(await readSystemNotificationState(), 'enabled', 'rereads OS state after unmuting');
    calls.length = 0;
    await updateNativeAppName('de');
    assert.deepEqual(calls, ['setLanguage']);
  } finally {
    Object.assign(cap, previous);
  }
});

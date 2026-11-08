import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin } from '../src/utils/security';

test('PIN lengths 4–16 are salted, verified and recorded for unlock', async () => {
  for (let length = 4; length <= 16; length++) {
    const pin = '1234567890123456'.slice(0, length);
    const result = await hashPin(pin);
    const security = { ...result, pinEnabled: true, autoLockMinutes: 5, isLocked: false };
    assert.equal(result.pinLength, length);
    assert.equal(result.pinCode, '');
    assert.equal(await verifyPin(pin, security), true);
    assert.equal(await verifyPin('0'.repeat(length), security), false);
  }
  for (const invalid of ['123', '12345678901234567', '123a', '']) await assert.rejects(hashPin(invalid));
});

test('existing legacy four-digit plaintext and hash remain valid', async () => {
  const base = { pinEnabled: true, autoLockMinutes: 5, isLocked: false };
  assert.equal(await verifyPin('1234', { ...base, pinCode: '1234' }), true);
  assert.equal(await verifyPin('', { ...base, pinCode: '' }), false);
  const { pinLength: _, ...legacyHash } = await hashPin('1234');
  assert.equal(await verifyPin('1234', { ...base, ...legacyHash }), true);
});

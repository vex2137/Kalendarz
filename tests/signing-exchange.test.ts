import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import exchange from '../scripts/signing-exchange.cjs';
test('one-use signing exchange authenticates payload and binds it to the release run', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const payload = { password: 'test-only-password', keystore: 'test-only-key', alias: 'calendar-release' };
  const envelope = exchange.seal(payload, publicKey, 'repository/run/source');
  assert.deepEqual(exchange.open(envelope, privateKey, 'repository/run/source'), payload);
  assert.throws(() => exchange.open(envelope, privateKey, 'different-run'));
  assert.throws(() => exchange.open({ ...envelope, tag: Buffer.alloc(16).toString('base64') }, privateKey, 'repository/run/source'));
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
  assert.throws(() => exchange.open(envelope, other.privateKey, 'repository/run/source'));
  assert.ok(!JSON.stringify(envelope).includes(payload.password));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, verifyCurrentCredential } from '../src/utils/security';

test('passwords use salted hashes and accept 8–64 characters', async () => {
  for (const password of ['abcdefgh', 'x'.repeat(64), '🔒'.repeat(8)]) {
    const hash = await hashPassword(password);
    const security = { ...hash, pinCode:'', pinEnabled:true, autoLockMinutes:5, isLocked:false, authenticationMethod:'password' as const };
    assert.equal(await verifyPassword(password, security), true);
    assert.equal(await verifyCurrentCredential(password, security), true);
    assert.equal(await verifyPassword('wrong', security), false);
    assert.notEqual(hash.passwordHash, (await hashPassword(password)).passwordHash);
  }
  for (const invalid of ['', '1234567', 'x'.repeat(65)]) await assert.rejects(hashPassword(invalid));
});

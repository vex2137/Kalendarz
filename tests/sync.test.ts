import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {
  encodeSync,
  decodeSync,
  QRAssembler,
  validateSync,
} from '../src/utils/sync';
import { generateHolidayEvents } from '../src/utils/holidays';
import { hashPin, verifyPin } from '../src/utils/security';
import { event } from './fixtures';

test('default holidays fit into decodable multipart QR; empty reminders survive', async () => {
  const original = {
    v: 2 as const,
    app: 'cal-offline' as const,
    events: [...generateHolidayEvents(), event()],
    deletions: [{ id: 'deleted', updatedAt: 1 }],
    theme: 'dark' as const,
  };
  const encoded = await encodeSync(original, 'correct horse battery');
  assert.ok(encoded.frames.length > 0 && encoded.frames.length <= 256);
  for (const frame of encoded.frames)
    assert.doesNotThrow(() =>
      QRCode.create(frame, { errorCorrectionLevel: 'M' }),
    );
  const assembler = new QRAssembler();
  let code = '';
  for (const frame of [...encoded.frames].reverse()) {
    const progress = assembler.add(frame);
    if (progress.code) code = progress.code;
  }
  const restored = await decodeSync(code, 'correct horse battery');
  assert.deepEqual(restored, original);
  assert.deepEqual(restored.events.at(-1)!.reminders, []);
});
test('corrupted, oversized and invalid sync data are rejected', async () => {
  await assert.rejects(decodeSync('KAL2:' + '0'.repeat(64) + ':aGVsbG8='));
  assert.throws(() =>
    new QRAssembler().add('KAL2P:' + 'a'.repeat(64) + ':0:100000:AAA'),
  );
  assert.throws(() =>
    validateSync({
      v: 2,
      app: 'cal-offline',
      events: [{ id: 'bad' }],
      deletions: [],
    }),
  );
});
test('PIN is salted and verified without persisting plaintext', async () => {
  const a = await hashPin('1234'),
    b = await hashPin('1234');
  assert.equal(a.pinCode, '');
  assert.notEqual(a.pinHash, b.pinHash);
  const security = {
    ...a,
    pinEnabled: true,
    autoLockMinutes: 5,
    isLocked: false,
  };
  assert.equal(await verifyPin('1234', security), true);
  assert.equal(await verifyPin('0000', security), false);
});

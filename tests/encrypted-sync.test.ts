import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';
import { encodeSync, decodeSync, QRAssembler, SYNC_KDF_ITERATIONS, validateSync } from '../src/utils/sync';
import { DEFAULT_THEME_COLORS } from '../src/utils/themes';
import { event } from './fixtures';

const password = 'żółw Kalender Календарь 🔐';
const payload = { v: 2 as const, app: 'cal-offline' as const, events: [event({ title: 'Private meeting Иван' })], deletions: [{ id: 'gone', updatedAt: 1 }] };
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const sha = async (text: string) => Buffer.from(await crypto.subtle.digest('SHA-256', strToU8(text) as Uint8Array<ArrayBuffer>)).toString('hex');
const makeCode = async (bytes: Uint8Array) => { const text = base64(bytes); return `KAL3:${await sha(text)}:${text}`; };

test('encrypted sync uses fresh salt/IV and interoperable AES-256-GCM over gzip; passwords are absent', async () => {
  const a = await encodeSync(payload, password), b = await encodeSync(payload, password);
  assert.notEqual(a.code, b.code);
  const bytes = Uint8Array.from(Buffer.from(a.code.split(':')[2], 'base64'));
  const other = Uint8Array.from(Buffer.from(b.code.split(':')[2], 'base64'));
  assert.notDeepEqual(bytes.slice(0, 16), other.slice(0, 16));
  assert.notDeepEqual(bytes.slice(16, 28), other.slice(16, 28));
  assert.ok(!a.code.includes(password) && !a.code.includes('Private meeting'));
  // Independent receiver using only Web Crypto and gzip, rather than decodeSync.
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  assert.equal(SYNC_KDF_ITERATIONS, 600_000);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes.slice(0, 16), iterations: 600_000 }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(16, 28), tagLength: 128, additionalData: new TextEncoder().encode('Calendar QR v3|gzip|PBKDF2-SHA256|600000|AES-256-GCM') }, key, bytes.slice(28));
  assert.deepEqual(JSON.parse(strFromU8(gunzipSync(new Uint8Array(plain)))), payload);
  assert.deepEqual(await decodeSync(a.code, password), payload);
});

test('missing/wrong passwords, tampered ciphertext, IV, salt and truncated tags never decrypt', async () => {
  const encrypted = await encodeSync(payload, password);
  await assert.rejects(decodeSync(encrypted.code), /password is required/);
  await assert.rejects(decodeSync(encrypted.code, 'wrong password'), /Incorrect password/);
  const bytes = Uint8Array.from(Buffer.from(encrypted.code.split(':')[2], 'base64'));
  for (const index of [0, 16, 30, bytes.length - 1]) {
    const damaged = bytes.slice(); damaged[index] ^= 1;
    // Recompute the public framing checksum: GCM must still reject this packet.
    await assert.rejects(decodeSync(await makeCode(damaged), password), /Incorrect password/);
  }
  await assert.rejects(decodeSync(await makeCode(bytes.slice(0, -4)), password), /Incorrect password/);
  await assert.rejects(encodeSync(payload, 'short'), /at least 12/);
});

test('multipart encryption supports reversed/duplicate frames and rejects conflicting frame contents', async () => {
  const many = { ...payload, events: Array.from({ length: 200 }, (_, i) => event({ id: String(i), title: `Meeting ${i} ${crypto.randomUUID()}` })) };
  const encoded = await encodeSync(many, password);
  assert.ok(encoded.frames.length > 1);
  const assembler = new QRAssembler();
  assembler.add(encoded.frames.at(-1)!);
  let code = '';
  for (const frame of [...encoded.frames].reverse()) code = assembler.add(frame).code || code;
  assert.deepEqual(await decodeSync(code, password), many);
  const conflict = new QRAssembler(); conflict.add(encoded.frames[0]);
  const altered = encoded.frames[0].slice(0, -1) + (encoded.frames[0].endsWith('A') ? 'B' : 'A');
  assert.throws(() => conflict.add(altered), /Conflicting/);
  assert.throws(() => conflict.add(encoded.frames[0].replace('KAL3P:', 'KAL2P:')), /Conflicting/);
});

test('legacy JSON and KAL2 gzip remain readable; custom palettes are validated before importing', async () => {
  const json = JSON.stringify(payload);
  const legacy = `KAL2:${await sha(json)}:${base64(gzipSync(strToU8(json)))}`;
  assert.deepEqual(await decodeSync(legacy), payload);
  assert.deepEqual(await decodeSync(json), payload);
  const customTheme = { id: 'custom:shared' as const, name: 'Shared', colors: { ...DEFAULT_THEME_COLORS } };
  const custom = { ...payload, theme: customTheme.id, customTheme };
  assert.deepEqual(await decodeSync((await encodeSync(custom, password)).code, password), custom);
  assert.throws(() => validateSync({ ...custom, customTheme: { ...customTheme, colors: { ...customTheme.colors, background: 'url(https://example.com)' } } }));
  assert.throws(() => validateSync({ ...custom, customTheme: { ...customTheme, id: 'custom:another' } }));
});

test('gzip expansion is bounded before JSON parsing, including legacy packets', async () => {
  const compressed = gzipSync(new Uint8Array(10 * 1024 * 1024 + 1).fill(65));
  await assert.rejects(decodeSync(`KAL2:${'0'.repeat(64)}:${base64(compressed)}`), /Uncompressed sync too large/);
});

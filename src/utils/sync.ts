import { gzip, Gunzip, strToU8, strFromU8 } from 'fflate';
import { isCustomTheme, BUILTIN_THEMES } from './themes';
import type { AppTheme, CalendarEvent, CustomTheme } from '../types';
import type { Deletion } from './calendarStore';
import { MAX_IMPORT_BYTES, validateEvents } from './validation';
export interface SyncPayload {
  v: 2;
  app: 'cal-offline';
  events: CalendarEvent[];
  deletions: Deletion[];
  theme?: AppTheme;
  customTheme?: CustomTheme;
}
export function validateSync(value: unknown): SyncPayload {
  const p = value as SyncPayload;
  if (!p || p.app !== 'cal-offline' || p.v !== 2)
    throw new Error('Unsupported sync format / Nieobsługiwany format');
  validateEvents(p.events);
  if (
    !Array.isArray(p.deletions) ||
    p.deletions.length > 50000 ||
    p.deletions.some(
      (d) =>
        !d ||
        typeof d.id !== 'string' ||
        !d.id ||
        !Number.isFinite(d.updatedAt) ||
        d.updatedAt < 0 ||
        d.updatedAt > Date.now() + 86400000,
    )
  )
    throw new Error('Invalid deletions');
  if (p.theme && !(BUILTIN_THEMES as readonly string[]).includes(p.theme) &&
    !(isCustomTheme(p.customTheme) && p.customTheme.id === p.theme)) throw new Error('Invalid theme');
  if (p.customTheme && (!isCustomTheme(p.customTheme) || p.customTheme.id !== p.theme)) throw new Error('Invalid custom theme');
  return p;
}
async function checksum(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        strToU8(text) as Uint8Array<ArrayBuffer>,
      ),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
// KAL3 fixes the algorithm parameters, so untrusted input cannot weaken the KDF.
export const SYNC_KDF_ITERATIONS = 600_000;
const AAD = strToU8('Calendar QR v3|gzip|PBKDF2-SHA256|600000|AES-256-GCM');
export class SyncCryptoError extends Error {}
function cryptoReady() {
  if (!globalThis.crypto?.subtle) throw new SyncCryptoError('Encryption is unavailable in this environment.');
}
function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function fromBase64(data: string) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data) || !data)
    throw new SyncCryptoError('Invalid sync code.');
  return Uint8Array.from(atob(data), character => character.charCodeAt(0));
}
async function deriveSyncKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  cryptoReady();
  if (!password) throw new SyncCryptoError('A password is required.');
  const bytes = strToU8(password);
  if (bytes.length > 1024) throw new SyncCryptoError('Invalid sync code.');
  const material = await crypto.subtle.importKey('raw', bytes as Uint8Array<ArrayBuffer>, 'PBKDF2', false, ['deriveKey']);
  bytes.fill(0);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: SYNC_KDF_ITERATIONS, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
function decompress(bytes: Uint8Array) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const unzip = new Gunzip(chunk => {
    size += chunk.length;
    if (size > MAX_IMPORT_BYTES) throw new Error('Uncompressed sync too large');
    chunks.push(chunk);
  });
  // Feed bounded chunks so gzip bombs cannot allocate their entire output first.
  for (let offset = 0; offset < bytes.length; offset += 4096) {
    unzip.push(bytes.subarray(offset, offset + 4096), offset + 4096 >= bytes.length);
  }
  const output = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { output.set(chunk, at); at += chunk.length; }
  return strFromU8(output);
}
export function isEncryptedSync(code: string) { return code.startsWith('KAL3:'); }
export async function encodeSync(payload: SyncPayload, password: string) {
  cryptoReady();
  if (!password || password.length < 12) throw new SyncCryptoError('Use a password with at least 12 characters.');
  validateSync(payload);
  const bytes = strToU8(JSON.stringify(payload));
  if (bytes.length > MAX_IMPORT_BYTES) throw new Error('Sync too large: use a file / Użyj pliku');
  const compressed = await new Promise<Uint8Array>((resolve, reject) => gzip(bytes, (error, result) => error ? reject(error) : resolve(result)));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSyncKey(password, salt);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD as Uint8Array<ArrayBuffer>, tagLength: 128 }, key, compressed as Uint8Array<ArrayBuffer>));
  // Binary envelope: salt[16] || IV[12] || ciphertext || GCM authentication tag[16].
  const envelope = new Uint8Array(28 + encrypted.length);
  envelope.set(salt); envelope.set(iv, 16); envelope.set(encrypted, 28);
  const data = toBase64(envelope), id = await checksum(data);
  const parts = Math.ceil(data.length / 1000);
  const frames = parts <= 256 ? Array.from({ length: parts }, (_, i) => `KAL3P:${id}:${i}:${parts}:${data.slice(i * 1000, (i + 1) * 1000)}`) : [];
  return { code: `KAL3:${id}:${data}`, frames };
}
export async function decodeSync(code: string, password?: string): Promise<SyncPayload> {
  if (code.length > MAX_IMPORT_BYTES * 2) throw new Error('Sync too large');
  if (isEncryptedSync(code)) {
    cryptoReady();
    const match = /^KAL3:([a-f0-9]{64}):([A-Za-z0-9+/=]+)$/.exec(code);
    if (!match || await checksum(match[2]) !== match[1]) throw new SyncCryptoError('Incorrect password or damaged encrypted data.');
    const envelope = fromBase64(match[2]);
    if (envelope.length < 44) throw new SyncCryptoError('Invalid sync code.');
    const salt = envelope.slice(0, 16), iv = envelope.slice(16, 28);
    const key = await deriveSyncKey(password || '', salt);
    let decrypted: ArrayBuffer;
    try {
      decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD as Uint8Array<ArrayBuffer>, tagLength: 128 }, key, envelope.slice(28));
    } catch { throw new SyncCryptoError('Incorrect password or damaged encrypted data.'); }
    // Authentication must succeed before gzip expansion or JSON processing.
    return validateSync(JSON.parse(decompress(new Uint8Array(decrypted))));
  }
  if (code.startsWith('KAL2:')) {
    const match = /^KAL2:([a-f0-9]{64}):([A-Za-z0-9+/=]+)$/.exec(code);
    if (!match) throw new Error('Invalid sync code');
    const json = decompress(fromBase64(match[2]));
    if (await checksum(json) !== match[1]) throw new Error('Incomplete or corrupted sync / Uszkodzony pakiet');
    return validateSync(JSON.parse(json));
  }
  const p = JSON.parse(code);
  if (p.v === 2) return validateSync(p);
  if (p.app === 'cal-offline' && p.v === 1 && Array.isArray(p.e)) {
    return validateSync({
      v: 2,
      app: 'cal-offline',
      theme: p.th,
      deletions: [],
      events: p.e.map((e: Record<string, unknown>) => ({
        id: e.id,
        title: e.t,
        startDate: e.sd,
        endDate: e.ed || e.sd,
        startTime: e.st,
        endTime: e.et,
        allDay: !!e.ad,
        color: e.c || 'peacock',
        description: e.d,
        location: e.loc,
        reminders: e.r ?? [15],
        recurrence: e.rec || 'NONE',
        customRecurrence: e.cr,
        createdAt: e.u || Date.now(),
        updatedAt: e.u || Date.now(),
      })),
    });
  }
  throw new Error('Invalid sync format');
}
export class QRAssembler {
  private id = '';
  private version = '';
  private count = 0;
  private parts = new Map<number, string>();
  private started = 0;
  add(frame: string): { received: number; total: number; code?: string } {
    const match = /^KAL([23])P:([a-f0-9]{64}):(\d+):(\d+):([A-Za-z0-9+/=]+)$/.exec(
      frame,
    );
    if (!match || frame.length > 1200) throw new Error('Invalid QR frame');
    const [, version, id, indexText, countText, part] = match,
      index = Number(indexText),
      count = Number(countText);
    if (
      count < 1 ||
      count > 256 ||
      index >= count ||
      index < 0 ||
      part.length > 1000
    )
      throw new Error('Invalid QR frame count');
    if (this.id !== id || Date.now() - this.started > 10 * 60000) {
      this.id = id;
      this.version = version;
      this.count = count;
      this.parts.clear();
      this.started = Date.now();
    }
    if (count !== this.count || version !== this.version || (this.parts.has(index) && this.parts.get(index) !== part)) throw new Error('Conflicting QR frames');
    this.parts.set(index, part);
    return {
      received: this.parts.size,
      total: count,
      ...(this.parts.size === count
        ? {
            code: `KAL${version}:${id}:${Array.from({ length: count }, (_, i) => this.parts.get(i)).join('')}`,
          }
        : {}),
    };
  }
}

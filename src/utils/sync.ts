import { gzipSync, Gunzip, strToU8, strFromU8 } from 'fflate';
import type { AppTheme, CalendarEvent } from '../types';
import type { Deletion } from './calendarStore';
import { MAX_IMPORT_BYTES, validateEvents } from './validation';
export interface SyncPayload {
  v: 2;
  app: 'cal-offline';
  events: CalendarEvent[];
  deletions: Deletion[];
  theme?: AppTheme;
}
const themes = [
  'light',
  'dark',
  'nord',
  'emerald',
  'sunset',
  'lavender',
  'moka',
];
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
  if (p.theme && !themes.includes(p.theme)) throw new Error('Invalid theme');
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
export async function encodeSync(payload: SyncPayload) {
  validateSync(payload);
  const json = JSON.stringify(payload);
  if (strToU8(json).length > MAX_IMPORT_BYTES)
    throw new Error('Sync too large: use a file / Użyj pliku');
  const compressed = gzipSync(strToU8(json));
  let binary = '';
  for (let i = 0; i < compressed.length; i += 8192)
    binary += String.fromCharCode(...compressed.subarray(i, i + 8192));
  const data = btoa(binary),
    id = await checksum(json);
  const parts = Math.ceil(data.length / 1000);
  const frames =
    parts <= 256
      ? Array.from(
          { length: parts },
          (_, i) =>
            `KAL2P:${id}:${i}:${parts}:${data.slice(i * 1000, (i + 1) * 1000)}`,
        )
      : [];
  return { code: `KAL2:${id}:${data}`, frames };
}
export async function decodeSync(code: string): Promise<SyncPayload> {
  if (code.length > MAX_IMPORT_BYTES * 2) throw new Error('Sync too large');
  if (code.startsWith('KAL2:')) {
    const [, id, data] = code.split(':');
    if (!/^[a-f0-9]{64}$/.test(id) || !/^[A-Za-z0-9+/=]+$/.test(data || ''))
      throw new Error('Invalid sync code');
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const chunks: Uint8Array[] = [];
    let size = 0;
    const unzip = new Gunzip((chunk) => {
      size += chunk.length;
      if (size > MAX_IMPORT_BYTES)
        throw new Error('Uncompressed sync too large');
      chunks.push(chunk);
    });
    unzip.push(bytes, true);
    const output = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      output.set(chunk, at);
      at += chunk.length;
    }
    const json = strFromU8(output);
    if ((await checksum(json)) !== id)
      throw new Error('Incomplete or corrupted sync / Uszkodzony pakiet');
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
  private count = 0;
  private parts = new Map<number, string>();
  private started = 0;
  add(frame: string): { received: number; total: number; code?: string } {
    const match = /^KAL2P:([a-f0-9]{64}):(\d+):(\d+):([A-Za-z0-9+/=]+)$/.exec(
      frame,
    );
    if (!match || frame.length > 1200) throw new Error('Invalid QR frame');
    const [, id, indexText, countText, part] = match,
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
      this.count = count;
      this.parts.clear();
      this.started = Date.now();
    }
    if (count !== this.count) throw new Error('Conflicting QR frames');
    this.parts.set(index, part);
    return {
      received: this.parts.size,
      total: count,
      ...(this.parts.size === count
        ? {
            code: `KAL2:${id}:${Array.from({ length: count }, (_, i) => this.parts.get(i)).join('')}`,
          }
        : {}),
    };
  }
}

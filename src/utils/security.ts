import type { SecuritySettings } from '../types';
const encode = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
async function derive(pin: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return encode(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 210000,
        salt: new TextEncoder().encode(salt),
      },
      key,
      256,
    ),
  );
}
export async function hashPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN: 4 digits / 4 cyfry');
  const pinSalt = encode(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { pinCode: '', pinHash: await derive(pin, pinSalt), pinSalt };
}
export async function verifyPin(pin: string, security: SecuritySettings) {
  if (security.pinHash && security.pinSalt)
    return (await derive(pin, security.pinSalt)) === security.pinHash;
  return security.pinCode === pin;
}

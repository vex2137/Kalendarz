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
  if (!/^\d{4,16}$/.test(pin)) throw new Error('PIN: 4–16 digits / cyfr');
  const pinSalt = encode(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { pinCode: '', pinHash: await derive(pin, pinSalt), pinSalt, pinLength: pin.length };
}
export async function verifyPin(pin: string, security: SecuritySettings) {
  if (security.pinHash && security.pinSalt)
    return (await derive(pin, security.pinSalt)) === security.pinHash;
  return /^\d{4,16}$/.test(security.pinCode) && security.pinCode === pin;
}
export async function hashPassword(password: string) {
  const length = Array.from(password).length;
  if (length < 8 || length > 64) throw new Error('Password: 8–64 characters / znaków');
  const passwordSalt = encode(crypto.getRandomValues(new Uint8Array(16)).buffer);
  return { passwordHash: await derive(password, passwordSalt), passwordSalt };
}
export async function verifyPassword(password: string, security: SecuritySettings) {
  return Boolean(security.passwordHash && security.passwordSalt &&
    (await derive(password, security.passwordSalt)) === security.passwordHash);
}
export async function verifyCurrentCredential(value: string, security: SecuritySettings) {
  return security.authenticationMethod === 'password' ? verifyPassword(value, security) : verifyPin(value, security);
}

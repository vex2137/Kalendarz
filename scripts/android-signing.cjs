// Private key material stays outside the checkout. Never upload this directory as a release asset.
const { mkdirSync, existsSync, writeFileSync, readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const [command, input] = process.argv.slice(2);
if (!input || !['generate', 'upload'].includes(command)) throw new Error('Usage: node scripts/android-signing.cjs generate|upload /private/backup/directory');
const directory = resolve(input), store = join(directory, 'calendar-release.p12'), config = join(directory, 'signing.json');
if (command === 'generate') {
  if (existsSync(store) || existsSync(config)) throw new Error('Refusing to overwrite existing signing material');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const password = randomBytes(32).toString('base64url'), alias = 'calendar-release';
  const result = spawnSync(process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool', [
    '-genkeypair', '-keystore', store, '-storetype', 'PKCS12', '-alias', alias,
    '-keyalg', 'RSA', '-keysize', '4096', '-validity', '36500',
    '-dname', 'CN=Calendar Release, O=Calendar', '-storepass:env', 'CALENDAR_NEW_KEY_PASSWORD', '-keypass:env', 'CALENDAR_NEW_KEY_PASSWORD',
  ], { env: { ...process.env, CALENDAR_NEW_KEY_PASSWORD: password }, stdio: ['ignore', 'ignore', 'pipe'] });
  if (result.status !== 0) throw new Error('Key generation failed: ' + result.stderr);
  writeFileSync(config, JSON.stringify({ password, alias }), { mode: 0o600 });
  require('node:fs').chmodSync(store, 0o600);
  console.log('Permanent signing key created. Back up both files privately; do not commit them.');
} else {
  const { password, alias } = JSON.parse(readFileSync(config));
  const secrets = {
    CALENDAR_ANDROID_KEYSTORE_BASE64: readFileSync(store).toString('base64'),
    CALENDAR_ANDROID_STORE_PASSWORD: password,
    CALENDAR_ANDROID_KEY_ALIAS: alias,
    CALENDAR_ANDROID_KEY_PASSWORD: password,
  };
  for (const [name, value] of Object.entries(secrets)) {
    const result = spawnSync('gh', ['secret', 'set', name, '--repo', 'vex2137/Kalendarz'], { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (result.status !== 0) throw new Error(`Cannot configure ${name}: ${result.stderr}`);
    console.log(`Configured ${name}`);
  }
}

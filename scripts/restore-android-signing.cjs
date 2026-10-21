const { writeFileSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
for (const name of ['CALENDAR_ANDROID_KEYSTORE_BASE64', 'CALENDAR_KEYSTORE_PASSWORD', 'CALENDAR_KEY_ALIAS', 'CALENDAR_KEY_PASSWORD']) {
  if (!process.env[name]) throw new Error(`Missing ${name}: public APKs must use the permanent signing key, never a fresh debug key`);
}
const target = join(process.env.RUNNER_TEMP || require('node:os').tmpdir(), 'calendar-release.p12');
writeFileSync(target, Buffer.from(process.env.CALENDAR_ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
if (!process.env.GITHUB_ENV) throw new Error('This restore script runs inside GitHub Actions');
appendFileSync(process.env.GITHUB_ENV, `CALENDAR_KEYSTORE_PATH=${target}\n`);
console.log('Restored permanent Android signing key.');

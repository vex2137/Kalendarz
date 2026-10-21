// Supply signing values without placing passwords in command-line arguments or logs.
const { readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const [directory, command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Usage: node scripts/with-android-signing.cjs /private/directory command [args...]');
const { password, alias } = JSON.parse(readFileSync(join(resolve(directory), 'signing.json')));
const result = spawnSync(command, args, { stdio: 'inherit', env: {
  ...process.env, CALENDAR_REQUIRE_RELEASE_SIGNING: 'true',
  CALENDAR_KEYSTORE_PATH: join(resolve(directory), 'calendar-release.p12'),
  CALENDAR_KEYSTORE_PASSWORD: password, CALENDAR_KEY_PASSWORD: password, CALENDAR_KEY_ALIAS: alias,
} });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

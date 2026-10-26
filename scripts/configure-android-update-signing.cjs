// Read an existing private backup; never generate a key or print secret values.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const expected = 'ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143';
let configured = 0;
try {
  const [mode, input] = process.argv.slice(2);
  if (!['--dry-run', '--apply'].includes(mode) || !input) throw new Error();
  const directory = path.resolve(input);
  const store = path.join(directory, 'calendar-update-142.p12');
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'signing.json'), 'utf8'));
  if (config.certificateSha256 !== expected || typeof config.password !== 'string' || !config.password ||
      typeof config.alias !== 'string' || !config.alias || !fs.statSync(store).isFile()) throw new Error();
  const validator = [path.resolve(__dirname, '../.github/scripts/VerifyAndroidSigning.java'),
    path.join(__dirname, 'VerifyAndroidSigning.java')].find(p => fs.existsSync(p));
  if (!validator) throw new Error();
  const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
  const validation = spawnSync(java, [validator], { encoding: 'utf8', env: {
    ...process.env, CALENDAR_KEYSTORE_PATH: store, CALENDAR_KEYSTORE_PASSWORD: config.password,
    CALENDAR_KEY_PASSWORD: config.password, CALENDAR_KEY_ALIAS: config.alias,
    EXPECTED_ANDROID_CERTIFICATE: expected,
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  if (validation.status !== 0) throw new Error();
  console.log('Existing diagnostics update certificate and private key verified.');
  if (mode === '--dry-run') {
    console.log('Dry run: no GitHub secrets changed.');
  } else {
    // Check access before any write; the normal integration may not manage secrets.
    const access = spawnSync('gh', ['api', 'repos/vex2137/Kalendarz/actions/secrets/public-key'], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (access.status !== 0) throw new Error();
    const values = {
      CALENDAR_ANDROID_UPDATE_KEYSTORE_BASE64: fs.readFileSync(store).toString('base64'),
      CALENDAR_ANDROID_UPDATE_STORE_PASSWORD: config.password,
      CALENDAR_ANDROID_UPDATE_KEY_ALIAS: config.alias,
      CALENDAR_ANDROID_UPDATE_KEY_PASSWORD: config.password,
    };
    for (const [name, value] of Object.entries(values)) {
      const result = spawnSync('gh', ['secret', 'set', name, '--repo', 'vex2137/Kalendarz'], {
        input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (result.status !== 0) throw new Error();
      configured++;
      console.log('Configured ' + name);
    }
    console.log('Update signing configured. Existing production signing secrets were preserved.');
  }
} catch {
  console.error(`Update signing setup failed after ${configured} secret writes. Check the backup, Java 21 and GitHub CLI secret permissions. No secret values are printed.`);
  process.exitCode = 1;
}

// One-use runner handoff: only an ephemeral public key and authenticated ciphertext
// are committed. The permanent key/passwords never leave encryption outside the runner.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repository = 'vex2137/Kalendarz';
function seal(payload, publicKey, binding) {
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(binding));
  const data = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const wrapped = crypto.publicEncrypt({ key: publicKey, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, key);
  key.fill(0);
  return Object.fromEntries(Object.entries({ iv, wrapped, data, tag: cipher.getAuthTag() }).map(([k, v]) => [k, v.toString('base64')]));
}
function open(envelope, privateKey, binding) {
  const key = crypto.privateDecrypt({ key: privateKey, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(envelope.wrapped, 'base64'));
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from(binding));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString());
  } finally { key.fill(0); }
}
function api(method, endpoint, payload, optional = false) {
  const args = ['api', '--method', method, endpoint];
  if (payload) args.push('--input', '-');
  const r = spawnSync('gh', args, { input: payload ? JSON.stringify(payload) : undefined, encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (r.status !== 0) {
    if (optional && /HTTP 404/.test(r.stderr)) return undefined;
    throw new Error(`GitHub exchange request failed (${method} ${endpoint}): ${r.stderr}`);
  }
  return r.stdout.trim() ? JSON.parse(r.stdout) : undefined;
}
async function main() {
  const [mode, runId, directory, source] = process.argv.slice(2);
  if (!['send', 'receive'].includes(mode) || !/^\d+$/.test(runId) || !directory) throw new Error('Usage: signing-exchange.cjs send|receive RUN_ID PRIVATE_DIRECTORY [SOURCE_SHA]');
  const branch = `release-signing-${runId}`;
  const endpoint = `repos/${repository}/contents/.github/signing-exchange`;
  if (mode === 'receive') {
    if (process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_RUN_ID !== runId || !/^[a-f0-9]{40}$/.test(source)) throw new Error('Invalid runner identity/source');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
    const binding = JSON.stringify({ repository, runId, source });
    const publicName = `calendar-signing-public-${runId}.json`;
    const publicFile = path.join(process.env.RUNNER_TEMP, publicName);
    fs.writeFileSync(publicFile, JSON.stringify({ repository, runId, source, binding, publicKey: publicKey.export({ type: 'spki', format: 'pem' }) }));
    const publish = spawnSync('gh', ['release', 'upload', `v${require('../package.json').version}`, publicFile], { encoding: 'utf8' });
    if (publish.status !== 0) throw new Error('Cannot publish one-use public key: ' + publish.stderr);
    try {
      console.log(`Waiting for an encrypted signing envelope for run ${runId}; no private material is published.`);
      const deadline = Date.now() + 10 * 60_000;
      while (Date.now() < deadline) {
        const response = api('GET', `${endpoint}/envelope.json?ref=${branch}`, undefined, true);
        if (response) {
          const payload = open(JSON.parse(Buffer.from(response.content, 'base64').toString()), privateKey, binding);
          if (!payload.password || payload.alias !== 'calendar-release' || !payload.keystore) throw new Error('Invalid decrypted signing payload');
          fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
          fs.writeFileSync(path.join(directory, 'calendar-release.p12'), Buffer.from(payload.keystore, 'base64'), { mode: 0o600 });
          fs.writeFileSync(path.join(directory, 'signing.json'), JSON.stringify({ password: payload.password, alias: payload.alias }), { mode: 0o600 });
          console.log(`::add-mask::${payload.password}`);
          console.log('Permanent signing key decrypted only inside the runner.');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      throw new Error('Encrypted signing handoff timed out');
    } finally {
      const cleanup = spawnSync('gh', ['release', 'delete-asset', `v${require('../package.json').version}`, publicName, '--yes'], { encoding: 'utf8' });
      if (cleanup.status !== 0) console.error('Could not remove temporary public key asset');
      fs.rmSync(publicFile, { force: true });
    }
  } else {
    const response = spawnSync('gh', ['release', 'download', `v${require('../package.json').version}`, '--pattern', `calendar-signing-public-${runId}.json`, '--output', '-'], { encoding: 'utf8' });
    if (response.status !== 0) throw new Error('Runner public key is not ready: ' + response.stderr);
    const info = JSON.parse(response.stdout);
    if (info.repository !== repository || info.runId !== runId || info.source !== source || info.binding !== JSON.stringify({ repository, runId, source })) throw new Error('Runner public key does not match the expected run/source');
    const run = api('GET', `repos/${repository}/actions/runs/${runId}`);
    if (run.event !== 'workflow_dispatch' || run.status !== 'in_progress' || run.path !== '.github/workflows/release.yml') throw new Error('Signing runner is not an active manually dispatched release workflow');
    const config = JSON.parse(fs.readFileSync(path.join(directory, 'signing.json')));
    const envelope = seal({ ...config, keystore: fs.readFileSync(path.join(directory, 'calendar-release.p12')).toString('base64') }, info.publicKey, info.binding);
    const pushed = spawnSync('git', ['push', 'origin', `${source}:refs/heads/${branch}`], { encoding: 'utf8' });
    if (pushed.status !== 0) throw new Error('Cannot create encrypted transport branch: ' + pushed.stderr);
    api('PUT', `${endpoint}/envelope.json`, { branch, message: '[skip ci] Deliver encrypted one-use signing envelope', content: Buffer.from(JSON.stringify(envelope)).toString('base64') });
    console.log('Encrypted signing envelope delivered; no plaintext signing material was uploaded.');
  }
}
module.exports = { seal, open };
if (require.main === module) main().catch(error => {
  const message = String(error.message).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.error(process.env.GITHUB_ACTIONS ? `::error title=Signing exchange::${message}` : error.message);
  process.exitCode = 1;
});

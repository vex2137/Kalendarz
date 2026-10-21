const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const repo = 'vex2137/Kalendarz';
const api = endpoint => JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${endpoint}`], { encoding: 'utf8' }));
const source = process.env.CALENDAR_RELEASE_COMMIT;
assert.match(source || '', /^[a-f0-9]{40}$/);
for (const key of ['CALENDAR_PACKAGE_RUN', 'CALENDAR_ANDROID_RUN']) assert.match(process.env[key] || '', /^\d+$/);
const packages = api(`actions/runs/${process.env.CALENDAR_PACKAGE_RUN}`);
assert.equal(packages.head_repository.full_name, repo);
assert.equal(packages.head_sha, source, 'Packages must come from the exact release source');
const jobs = api(`actions/runs/${packages.id}/jobs?per_page=100`).jobs;
for (const name of ['web', 'flatpak', 'desktop (ubuntu-24.04, linux, --linux AppImage)', 'desktop (windows-2025, windows, --win nsis portable zip)']) {
  assert.equal(jobs.find(job => job.name === name)?.conclusion, 'success', `Required platform checks: ${name}`);
}
const android = api(`actions/runs/${process.env.CALENDAR_ANDROID_RUN}`);
assert.equal(android.head_repository.full_name, repo);
assert.equal(android.conclusion, 'success', 'Real Android model/language/functional checks must pass');
assert.match(android.head_sha, /^[a-f0-9]{40}$/);
execFileSync('git', ['diff', '--exit-code', source, android.head_sha, '--', 'src', 'electron', 'public', 'package.json', 'bun.lock', 'vite.config.ts', 'android/app/src/main', 'android/app/build.gradle', 'android/variables.gradle', 'scripts/prepare-model.cjs'], { stdio: 'inherit' });
const release = api('releases?per_page=100').find(item => item.tag_name === `v${require('../package.json').version}`);
assert.ok(release, 'Expected draft release is missing');
assert.equal(release.draft, true, 'Manual handoff only publishes an existing draft');
assert.equal(release.target_commitish, source, 'Draft target must match the checked source');
console.log('Verified platform checks, successful Android inference and identical application sources.');

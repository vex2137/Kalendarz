import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadMeter, downloadSummary } from '../src/utils/downloadProgress';

test('transfer metrics count actual bytes, smooth rate and calculate remaining time', () => {
 let time = 0;
 const sample = downloadMeter(10_000_000, () => time);
 assert.equal(sample(0).bytesPerSecond, undefined);
 time = 1000;
 const first = sample(2_000_000);
 assert.equal(first.bytesPerSecond, 2_000_000);
 assert.equal(first.remainingSeconds, 4);
 time = 2000;
 const next = sample(6_000_000);
 assert.ok(next.bytesPerSecond! > 2_000_000 && next.bytesPerSecond! < 4_000_000);
 assert.ok(Number.isFinite(next.remainingSeconds));
 assert.match(downloadSummary(next, 'en'), /6 \/ 10 MB.*MB\/s/);
 time = 3000;
 assert.equal(sample(10_000_000).remainingSeconds, 0);
});
test('unknown total, same-time chunks and restarted transfers do not invent speed or ETA', () => {
 let time = 0;
 const sample = downloadMeter(undefined, () => time);
 assert.equal(sample(100).remainingSeconds, undefined);
 assert.equal(sample(200).bytesPerSecond, undefined);
 time = 1000; sample(1000);
 assert.equal(sample(0).bytesPerSecond, undefined);
 time = 2000;
 assert.equal(sample(1000).bytesPerSecond, 1000);
 assert.equal(sample(1000).totalBytes, undefined);
});

import test from 'node:test';import assert from 'node:assert/strict';
import runner from '../scripts/android-beta5-signing-exchange.cjs';
test('one-use signing remains confined to explicitly audited private workflows',()=>{
 const repo='vex2137/Kalendarz-private-builds';
 assert.equal(runner.trustedWorkflowPath(repo,'.github/workflows/build-part2-stable.yml'),true);
 assert.equal(runner.trustedWorkflowPath(repo,'.github/workflows/build-part3-beta1.yml'),true);
 assert.equal(runner.trustedWorkflowPath(repo,'.github/workflows/build-part3-beta2.yml'),true);
 assert.equal(runner.trustedWorkflowPath(repo,'.github/workflows/build-part4-beta1.yml'),true);
 assert.equal(runner.trustedWorkflowPath(repo,'.github/workflows/build-part4-beta2.yml'),true);
 assert.equal(runner.trustedWorkflowPath(repo,'.github/workflows/build-android-beta5.yml'),true);
 for(const [r,p]of [[repo,'.github/workflows/unknown.yml'],['other/repo','.github/workflows/build-part2-stable.yml'],['vex2137/Kalendarz','.github/workflows/build-part2-stable.yml']])assert.equal(runner.trustedWorkflowPath(r,p),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {candidatePolicy}=createRequire(import.meta.url)('../scripts/verify-packaged-model.cjs');
test('Part 4 packaging selects its own strict provenance policy while retaining older channels',()=>{
 for(const [env,policy]of [[{CALENDAR_PART4_BETA:'true',CALENDAR_EXPECTED_COMMIT:'a'.repeat(40)},'part4_beta_guard'],[{CALENDAR_PART3_BETA:'true'},'part3_beta_guard'],[{CALENDAR_PART2_STABLE:'true'},'part2_stable_guard'],[{CALENDAR_PART2_BETA:'true'},'part2_artifact_guard'],[{CALENDAR_EXPECTED_COMMIT:'a'.repeat(40)},'part2_artifact_guard']] as const)assert.equal(candidatePolicy(env),'scripts/'+policy+'.py');
});
test('a Part 4 flag without a source still invokes verification instead of silently skipping it',()=>{assert.equal(candidatePolicy({CALENDAR_PART4_BETA:'true'}),'scripts/part4_beta_guard.py');assert.equal(candidatePolicy({}),undefined);});

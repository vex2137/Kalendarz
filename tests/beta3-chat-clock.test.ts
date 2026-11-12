import test from 'node:test';
import assert from 'node:assert/strict';
import {naturalChatSystemPrompt} from '../src/utils/assistantPrompts';
import {guardCalendarWriteClaim} from '../src/utils/calendarWriteClaim';
test('natural chat receives the same explicit local clock as calendar parsing; static SFT prompt remains stable',()=>{
 const date=new Date(2026,11,31,23,58);
 for(const language of ['pl','en','de','ru']as const){const prompt=naturalChatSystemPrompt(language,undefined,date);assert.match(prompt,/2026-12-31 23:58/);assert.ok(prompt.includes(Intl.DateTimeFormat().resolvedOptions().timeZone));assert.match(prompt,/authoritative/);assert.doesNotMatch(naturalChatSystemPrompt(language),/device-local date/);}
});
test('ordinary model replies need no save disclaimer while invented write confirmations remain blocked',()=>{
 const reply='Cześć! Jak mogę pomóc?';assert.equal(guardCalendarWriteClaim(reply,'pl'),reply);
 assert.match(guardCalendarWriteClaim('Dodałem wydarzenie Test do kalendarza.','pl'),/nie zmieniła kalendarza/);
 assert.match(guardCalendarWriteClaim('I saved the event.','en'),/No calendar changes were made/);
});

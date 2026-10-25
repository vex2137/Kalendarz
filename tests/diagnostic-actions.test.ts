import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticActions, recordDiagnosticAction, diagnosticErrorCode, diagnosticsReport } from '../src/utils/modelDiagnostics';
import { diagnosticActionText } from '../src/utils/diagnosticActionText';
test('action errors keep safe public codes without leaking document URIs or prompt contents',t=>{
  t.mock.method(console,'info',()=>{});
  recordDiagnosticAction('export-json','click');recordDiagnosticAction('export-json','bridge-call');
  recordDiagnosticAction('export-json','error',Error('diagnostics-export-write: content://private/secret JSON payload'));
  assert.equal(diagnosticActions().at(-1)?.code,'diagnostics-export-write');
  assert.ok(!JSON.stringify(diagnosticActions()).includes('secret'));
  assert.equal(diagnosticErrorCode(Error('raw private text')),'diagnostics-operation-failed');
  assert.equal(diagnosticErrorCode(Error('model-http-404')),'model-http-404');
});
test('diagnostic action history is bounded and every UI language has operation feedback',t=>{
  t.mock.method(console,'info',()=>{});
  for(let i=0;i<110;i++)recordDiagnosticAction('release-memory','success');
  assert.equal(diagnosticActions().length,100);
  for(const lang of ['pl','en','de','ru'] as const){const text=diagnosticActionText(lang);for(const key of ['saved','cancelled','releasing','released','already','exportError','releaseError','modelSuccess'] as const)assert.ok(text[key].length>5);}
});

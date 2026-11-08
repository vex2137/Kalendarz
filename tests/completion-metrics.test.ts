import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCompletionMetrics, type ModelMetric } from '../src/utils/modelDiagnostics';

test('empty native timings preserve reported usage instead of replacing counts with undefined/NaN',()=>{
  const metric:ModelMetric={route:'model',totalMs:2443,initMs:6015};
  applyCompletionMetrics(metric,{prompt_tokens:128,completion_tokens:32},{});
  assert.equal(metric.promptTokens,128);assert.equal(metric.completionTokens,32);
  assert.equal(metric.tokensPerSecond,undefined);assert.equal(metric.generationMs,undefined);
  assert.equal(metric.totalMs,2443);assert.equal(metric.initMs,6015,'Do not relabel a preload as current-request time');
});
test('real timing fields and cached input counts survive sparse later frames; usage has authoritative totals',()=>{
  const metric:ModelMetric={route:'model',totalMs:0};
  applyCompletionMetrics(metric,undefined,{prompt_ms:42,predicted_ms:1000,predicted_per_second:24,prompt_n:20,cache_n:80,predicted_n:24});
  applyCompletionMetrics(metric,{prompt_tokens:101,completion_tokens:25},{});
  assert.deepEqual([metric.promptMs,metric.generationMs,metric.tokensPerSecond,metric.promptTokens,metric.cachedTokens,metric.completionTokens],[42,1000,24,101,80,25]);
});
test('missing, null, negative and nonfinite data are not fabricated; zero is legitimate reported data',()=>{
  const metric:ModelMetric={route:'model',totalMs:0};
  applyCompletionMetrics(metric,undefined,{prompt_n:50,predicted_ms:NaN,predicted_per_second:Infinity,predicted_n:-1});
  assert.equal(metric.promptTokens,undefined,'Missing cache count does not imply zero cached tokens');
  assert.equal(metric.tokensPerSecond,undefined);assert.equal(metric.generationMs,undefined);assert.equal(metric.completionTokens,undefined);
  applyCompletionMetrics(metric,{prompt_tokens:0,completion_tokens:0},{prompt_ms:0});
  assert.equal(metric.promptTokens,0);assert.equal(metric.completionTokens,0);assert.equal(metric.promptMs,0);
});

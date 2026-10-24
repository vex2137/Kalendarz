import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBenchmarkRun } from '../src/utils/benchmarkStats';
import type { BenchmarkRun } from '../src/utils/assistantBenchmarks';
test('benchmark rates use native timings and never substitute RAM estimates for measurements',()=>{
  const run:BenchmarkRun={id:'fixture',createdAt:1,modelId:'lfm2.5-350m-q4-k-m',mode:'llm',preset:'smoke',status:'complete',nextIndex:1,conditions:{},samples:[],results:[{caseId:'001',language:'pl',route:'model',elapsedMs:500,checks:{intent:true},semanticReviewRequired:true,metric:{route:'model',modelId:'lfm2.5-350m-q4-k-m',totalMs:500,completionTokens:2,generationMs:100,tokensPerSecond:10,firstTokenMs:300,firstAnswerTokenMs:400}}]};
  const result=summarizeBenchmarkRun(run);
  assert.equal(result.nativeTokensPerSecondWeighted,10);assert.equal(result.firstTokenMs,300);assert.equal(result.firstAnswerTokenMs,400);assert.equal(result.appPeakPssKB,null);assert.equal(result.rendererPeakPssKB,null);assert.equal(result.totalInferenceCpuPercent,null);assert.equal(result.manualReviewPending,1);
});

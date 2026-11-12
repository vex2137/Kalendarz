import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBundlesModel } from '../src/utils/buildInfo';

test('model-free never treats catalogue metadata as physically bundled weights',()=>{
  for(const bundledModel of [undefined,false,true])assert.equal(buildBundlesModel({distribution:'model-free',bundledModel}),false);
  assert.equal(buildBundlesModel({bundledModel:false}),false);
  assert.equal(buildBundlesModel({bundledModel:true}),true);
  assert.equal(buildBundlesModel({}),true,'Historical bundled builds retain their contract');
});

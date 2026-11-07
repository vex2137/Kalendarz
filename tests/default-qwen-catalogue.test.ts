import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require=createRequire(import.meta.url);
test('model-free package requires the public Qwen catalogue while retaining pinned bytes and bundled release contract',async t=>{
  // Only test catalogue validation here; native runtime staging has its own tests.
  t.mock.method(require('node:child_process'),'execFileSync',()=>Buffer.alloc(0));
  const hook=require('../scripts/verify-packaged-model.cjs');
  const bundled=require('../src/utils/localModelManifest.json');
  const source=require('../src/utils/defaultModelSource.json');
  const optional=require('../src/utils/optionalModels.json');
  const root=mkdtempSync(join(tmpdir(),'calendar-qwen-catalogue-'));
  const previous=process.env.CALENDAR_MODEL_FREE;
  try {
    process.env.CALENDAR_MODEL_FREE='true';
    mkdirSync(join(root,'dist/models'),{recursive:true});
    writeFileSync(join(root,'dist/build-info.json'),JSON.stringify({distribution:'model-free',bundledModel:false,version:require('../package.json').version}));
    const descriptor={...bundled,...source};
    assert.equal(bundled.url,'','Historical private bundled release manifest is unchanged');
    assert.equal(descriptor.bytes,529297056);
    assert.equal(descriptor.sha256,'fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5');
    const context={electronPlatformName:'linux',arch:1,packager:{info:{appDir:root}}};
    writeFileSync(join(root,'dist/models/catalogue.json'),JSON.stringify([descriptor,...optional]));
    await hook(context);
    for(const changed of [{...descriptor,url:''},{...descriptor,sha256:'a'.repeat(64)},{...descriptor,bytes:1}]) {
      writeFileSync(join(root,'dist/models/catalogue.json'),JSON.stringify([changed,...optional]));
      await assert.rejects(hook(context),/Incorrect model catalogue/);
    }
  } finally {
    if(previous===undefined)delete process.env.CALENDAR_MODEL_FREE;else process.env.CALENDAR_MODEL_FREE=previous;
    rmSync(root,{recursive:true,force:true});
  }
});

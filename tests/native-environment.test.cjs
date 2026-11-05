const test=require('node:test'),assert=require('node:assert/strict');
const {nativeProcessEnvironment}=require('../electron/native-environment.cjs');
test('AppImage native tools use original CUDA library paths without internal loader libraries',()=>{
 const original={APPDIR:'/tmp/.mount_Calendar',LD_LIBRARY_PATH:'/tmp/.mount_Calendar/usr/lib',LD_LIBRARY_PATH_ORIG:'/usr/local/cuda/lib64:/tmp/.mount_Calendar/usr/lib:/usr/lib:/usr/lib',PATH:'/usr/bin'};
 const result=nativeProcessEnvironment(original);
 assert.equal(result.LD_LIBRARY_PATH,'/usr/local/cuda/lib64:/usr/lib');
 assert.equal(original.LD_LIBRARY_PATH,'/tmp/.mount_Calendar/usr/lib');
 assert.equal(result.PATH,original.PATH);
});
test('filtering respects directory boundaries and removes empty search entries',()=>{
 assert.equal(nativeProcessEnvironment({APPDIR:'/app',LD_LIBRARY_PATH:'/app/lib:/app2/lib::/usr/lib'}).LD_LIBRARY_PATH,'/app2/lib:/usr/lib');
 assert.equal(nativeProcessEnvironment({APPDIR:'/app',LD_LIBRARY_PATH:'/app/lib'}).LD_LIBRARY_PATH,undefined);
 assert.equal(nativeProcessEnvironment({APPDIR:'/app',LD_LIBRARY_PATH_ORIG:'',LD_LIBRARY_PATH:'/app/lib'}).LD_LIBRARY_PATH,undefined);
 assert.equal(nativeProcessEnvironment({LD_LIBRARY_PATH:'/usr/local/cuda/lib64'}).LD_LIBRARY_PATH,'/usr/local/cuda/lib64');
});

"""Build only the independent Vulkan helper; reuse the verified Beta 5 CPU engine."""
import argparse,hashlib,json,os,shutil,struct,subprocess,tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--host',action='store_true');p.add_argument('--corrupt-result-test',action='store_true');p.add_argument('--sdk',default=os.environ.get('ANDROID_HOME'));args=p.parse_args()
work=ROOT/'build/vulkan-probe';work.mkdir(parents=True,exist_ok=True)
def sha(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def run(*cmd):subprocess.run(list(map(str,cmd)),check=True)
# Obtain just nlohmann's header from the already-audited llama source archive.
archive=work/'upstream.tar.gz';expected='e9bf2b83a13e14b5577dcdb65bb18ff8c049143caab22106547d37ef8c54fbf3'
header=work/'vendor/nlohmann/json.hpp'
if not header.exists() or sha(header)!='08f19bbcc66ff3082f5caf58867b1232987dba98d82e2b29d870722fce42776b':
 if not archive.exists() or sha(archive)!=expected:
  run('curl','--fail','--location','--retry','2','--max-time','180','--output',archive,'https://codeload.github.com/ggml-org/llama.cpp/tar.gz/80d2c0c2c56e4a1bbf74be98f64b99927bf230bc')
 if sha(archive)!=expected:raise SystemExit('Upstream source checksum mismatch')
 with tarfile.open(archive) as tar:
  member=tar.getmember('llama.cpp-80d2c0c2c56e4a1bbf74be98f64b99927bf230bc/vendor/nlohmann/json.hpp')
  header.parent.mkdir(parents=True,exist_ok=True);header.write_bytes(tar.extractfile(member).read())
if sha(header)!='08f19bbcc66ff3082f5caf58867b1232987dba98d82e2b29d870722fce42776b':raise SystemExit('JSON header checksum mismatch')
if args.host:
 compiler=shutil.which('g++');glslc=shutil.which('glslc');output=work/('probe-corrupt' if args.corrupt_result_test else 'probe-host')
 flags=['-ldl']+(['-DCALENDAR_TEST_CORRUPT_RESULT'] if args.corrupt_result_test else [])
else:
 if args.corrupt_result_test:raise SystemExit('Fault injection is host-test only')
 if not args.sdk:raise SystemExit('Android SDK is required')
 ndk=Path(args.sdk)/'ndk/29.0.14206865'
 compiler=ndk/'toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android28-clang++'
 glslc=ndk/'shader-tools/linux-x86_64/glslc'
 output=ROOT/'build/android-jni/arm64-v8a/libcalendar_gpu_probe.so';output.parent.mkdir(parents=True,exist_ok=True)
 flags=['-fPIE','-pie','-static-libstdc++','-Wl,-z,max-page-size=16384','-ldl']
run(glslc,'--target-env=vulkan1.0',ROOT/'android/native/vector-add.comp','-o',work/'vector-add.spv')
data=(work/'vector-add.spv').read_bytes();assert len(data)%4==0 and data[:4]==b'\x03\x02\x23\x07'
(work/'vector-add.spv.h').write_text('#include <cstdint>\nstatic const uint32_t VECTOR_ADD_SPV[]={'+','.join(hex(x[0]) for x in struct.iter_unpack('<I',data))+'};\n')
run(compiler,'-std=c++17','-O2','-I'+str(work/'vendor'),'-I'+str(work),ROOT/'android/native/vulkan-probe.cpp','-o',output,*flags)
if not args.host:
 run(ndk/'toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip','--strip-unneeded',output)
 notices=ROOT/'build/android-native-assets';notices.mkdir(parents=True,exist_ok=True)
 manifest=dict(sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),shaderSourceSha256=sha(ROOT/'android/native/vector-add.comp'),probeSourceSha256=sha(ROOT/'android/native/vulkan-probe.cpp'),version=1,probeVersion='beta6-v1',abi='arm64-v8a',binarySha256=sha(output),shaderSha256=hashlib.sha256(data).hexdigest(),cpuInferenceUnchanged=True,computeElements=64,fenceTimeoutMs=2000,processTimeoutMs=6000)
 (notices/'android-vulkan-diagnostics.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps(manifest))
else:print('Host diagnostic built:',output.name)

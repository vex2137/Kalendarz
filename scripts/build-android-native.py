"""Build the pinned llama.cpp Android arm64 CPU/Vulkan server, never user weights.
Requires sdkmanager-installed NDK 29.0.14206865 and CMake 3.31.6, plus host g++/make.
All downloads use the inherited proxy and are verified before extraction.
"""
import argparse, hashlib, json, os, shutil, subprocess, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser()
parser.add_argument('--sdk',default=os.environ.get('ANDROID_SDK_ROOT') or os.environ.get('ANDROID_HOME'))
parser.add_argument('--jobs',type=int,default=2)
parser.add_argument('--profile',choices=['legacy','beta5','beta7'],default='legacy')
args=parser.parse_args()
if not args.sdk:parser.error('--sdk or ANDROID_SDK_ROOT is required')
modern=args.profile!='legacy'
vulkan=args.profile!='beta5'
commit='80d2c0c2c56e4a1bbf74be98f64b99927bf230bc' if modern else '620d2225cc436ab0b001e3200e590e3b286ef9ab'
version='b12189' if modern else 'b11669'
sdk=Path(args.sdk).resolve();work=ROOT/('build/android-b12189-vulkan' if args.profile=='beta7' else 'build/android-b12189-cpu' if modern else 'build');work.mkdir(parents=True,exist_ok=True)
cmake=sdk/'cmake/3.31.6/bin/cmake';ndk=sdk/'ndk/29.0.14206865'
if not cmake.is_file() or not ndk.is_dir():raise SystemExit('Install ndk;29.0.14206865 and cmake;3.31.6 with sdkmanager first')
sources=[
 ('llama-src','https://codeload.github.com/ggml-org/llama.cpp/tar.gz/620d2225cc436ab0b001e3200e590e3b286ef9ab','1d4a987d9bd048f6e93107e838026438df70fbde237fc0c69c63d600512b4bd9'),
 ('spirv-headers','https://codeload.github.com/KhronosGroup/SPIRV-Headers/tar.gz/vulkan-sdk-1.4.313.0','f68be549d74afb61600a1e3a7d1da1e6b7437758c8e77d664909f88f302c5ac1'),
 ('vulkan-headers','https://codeload.github.com/KhronosGroup/Vulkan-Headers/tar.gz/vulkan-sdk-1.4.335.0','269e95cc5138ea0a0d52fcb0ee19102add2560fedf5a43b1b5c17780c2775764'),
]
if modern:sources=[('llama-src','https://codeload.github.com/ggml-org/llama.cpp/tar.gz/'+commit,'e9bf2b83a13e14b5577dcdb65bb18ff8c049143caab22106547d37ef8c54fbf3')]+(sources[1:] if vulkan else [])
def run(*command):subprocess.run([str(x) for x in command],check=True,env={**os.environ,'PATH':str(cmake.parent)+os.pathsep+os.environ.get('PATH','')})
def sha(file):
 with file.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
for name,url,expected in sources:
 archive=work/(name+'.tar.gz');source=work/name
 if not archive.exists() or sha(archive)!=expected:
  partial=archive.with_suffix('.partial');run('curl','--fail','--location','--retry','2','--max-time','180','--output',partial,url)
  if sha(partial)!=expected:raise SystemExit('Source checksum mismatch: '+name)
  partial.replace(archive)
 if not source.exists():
  source.mkdir()
  with tarfile.open(archive) as tar:
   for member in tar.getmembers():
    parts=Path(member.name).parts[1:]
    if not parts:continue
    member.name=str(Path(*parts));tar.extract(member,source,filter='data')
if vulkan:
 # Upstream finds the headers package but omits its include target on Android.
 cm=work/'llama-src/ggml/src/ggml-vulkan/CMakeLists.txt'
 s=cm.read_text();s=s.replace('PRIVATE Vulkan::Vulkan)','PRIVATE Vulkan::Vulkan SPIRV-Headers::SPIRV-Headers)');cm.write_text(s)
 run(cmake,'-S',work/'spirv-headers','-B',work/'spirv-host',f'-DCMAKE_INSTALL_PREFIX={work}/spirv-install','-DSPIRV_HEADERS_ENABLE_TESTS=OFF')
 run(cmake,'--install',work/'spirv-host')
run(cmake,'-S',work/'llama-src','-B',work/'llama-android-arm64','-G','Ninja',
 f'-DCMAKE_MAKE_PROGRAM={cmake.parent}/ninja',f'-DCMAKE_TOOLCHAIN_FILE={ndk}/build/cmake/android.toolchain.cmake',
 '-DANDROID_ABI=arm64-v8a','-DANDROID_PLATFORM=android-28','-DANDROID_STL=c++_static','-DCMAKE_BUILD_TYPE=Release',
 '-DBUILD_SHARED_LIBS=OFF','-DGGML_OPENMP=OFF',f'-DGGML_VULKAN={"ON" if vulkan else "OFF"}','-DGGML_NATIVE=OFF',
 '-DLLAMA_BUILD_TESTS=OFF','-DLLAMA_BUILD_EXAMPLES=OFF','-DLLAMA_BUILD_TOOLS=ON','-DLLAMA_BUILD_SERVER=ON',
 '-DLLAMA_OPENSSL=OFF','-DLLAMA_CURL=OFF','-DLLAMA_SERVER_WEBUI=OFF',
 f'-DLLAMA_BUILD_NUMBER={version[1:]}',f'-DLLAMA_BUILD_COMMIT={commit}',
 f'-DVulkan_GLSLC_EXECUTABLE={ndk}/shader-tools/linux-x86_64/glslc',
 f'-DVulkan_INCLUDE_DIR={work}/vulkan-headers/include',f'-DSPIRV-Headers_DIR={work}/spirv-install/share/cmake/SPIRV-Headers')
run(cmake,'--build',work/'llama-android-arm64','--target','llama-server','-j',max(1,min(args.jobs,8)))
out=ROOT/'build/android-jni/arm64-v8a';out.mkdir(parents=True,exist_ok=True)
binary_name='libcalendar_llama_vulkan.so' if args.profile=='beta7' else 'libcalendar_llama.so'
shutil.copyfile(work/'llama-android-arm64/bin/llama-server',out/binary_name)
run(ndk/'toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip','--strip-unneeded',out/binary_name)
notices=ROOT/'build/android-native-assets';notices.mkdir(exist_ok=True)
shutil.copyfile(work/'llama-src/LICENSE',notices/'llama-cpp-LICENSE.txt')
if vulkan:
 shutil.copyfile(work/'vulkan-headers/LICENSE.md',notices/'Vulkan-Headers-LICENSE.md')
 shutil.copyfile(work/'spirv-headers/LICENSE',notices/'SPIRV-Headers-LICENSE.txt')
# llama.cpp generates a complete license collection for its vendored server dependencies.
licenses=list((work/'llama-android-arm64').rglob('*license*.txt'))
for i,license_file in enumerate(licenses):shutil.copyfile(license_file,notices/f'upstream-{i}-{license_file.name}')
for notice in (work/'llama-src').rglob('*'):
 if notice.is_file() and notice.name.upper().startswith(('LICENSE','COPYING','NOTICE')):
  target=notices/'llama-third-party'/notice.relative_to(work/'llama-src');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(notice,target)
if modern:
 arch=(work/'llama-src/src/llama-arch.cpp').read_text()
 assert all('"'+name+'"' in arch for name in ['lfm3','qwen35']), 'Missing architecture dispatch'
manifest={'llamaCommit':commit,'llamaVersion':version,'backends':['cpu-native','vulkan'] if vulkan else ['cpu-native'],'architectures':['lfm3','qwen35'] if modern else ['qwen35'],'abi':'arm64-v8a','minApi':28,'ndk':'29.0.14206865','experimental':True,'binarySha256':sha(out/binary_name),'sources':[{'url':url,'sha256':digest}for _,url,digest in sources]}
if args.profile=='beta7':
 (notices/'android-vulkan-runtime.json').write_text(json.dumps(manifest,indent=2)+'\n')
 cpu_manifest=notices/'android-native-runtime.json'
 if cpu_manifest.exists():
  cpu=json.loads(cpu_manifest.read_text());cpu['backends']=['cpu-native','vulkan'];cpu['vulkan']=manifest;cpu_manifest.write_text(json.dumps(cpu,indent=2)+'\n')
else:(notices/'android-native-runtime.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))

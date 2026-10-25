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
args=parser.parse_args()
if not args.sdk:parser.error('--sdk or ANDROID_SDK_ROOT is required')
sdk=Path(args.sdk).resolve();work=ROOT/'build';work.mkdir(exist_ok=True)
cmake=sdk/'cmake/3.31.6/bin/cmake';ndk=sdk/'ndk/29.0.14206865'
if not cmake.is_file() or not ndk.is_dir():raise SystemExit('Install ndk;29.0.14206865 and cmake;3.31.6 with sdkmanager first')
sources=[
 ('llama-src','https://codeload.github.com/ggml-org/llama.cpp/tar.gz/620d2225cc436ab0b001e3200e590e3b286ef9ab','1d4a987d9bd048f6e93107e838026438df70fbde237fc0c69c63d600512b4bd9'),
 ('spirv-headers','https://codeload.github.com/KhronosGroup/SPIRV-Headers/tar.gz/vulkan-sdk-1.4.313.0','f68be549d74afb61600a1e3a7d1da1e6b7437758c8e77d664909f88f302c5ac1'),
 ('vulkan-headers','https://codeload.github.com/KhronosGroup/Vulkan-Headers/tar.gz/vulkan-sdk-1.4.335.0','269e95cc5138ea0a0d52fcb0ee19102add2560fedf5a43b1b5c17780c2775764'),
]
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
# Upstream finds the headers package but omits its include target on Android.
cm=work/'llama-src/ggml/src/ggml-vulkan/CMakeLists.txt'
s=cm.read_text();s=s.replace('PRIVATE Vulkan::Vulkan)','PRIVATE Vulkan::Vulkan SPIRV-Headers::SPIRV-Headers)');cm.write_text(s)
run(cmake,'-S',work/'spirv-headers','-B',work/'spirv-host',f'-DCMAKE_INSTALL_PREFIX={work}/spirv-install','-DSPIRV_HEADERS_ENABLE_TESTS=OFF')
run(cmake,'--install',work/'spirv-host')
run(cmake,'-S',work/'llama-src','-B',work/'llama-android-arm64','-G','Ninja',
 f'-DCMAKE_MAKE_PROGRAM={cmake.parent}/ninja',f'-DCMAKE_TOOLCHAIN_FILE={ndk}/build/cmake/android.toolchain.cmake',
 '-DANDROID_ABI=arm64-v8a','-DANDROID_PLATFORM=android-28','-DANDROID_STL=c++_static','-DCMAKE_BUILD_TYPE=Release',
 '-DBUILD_SHARED_LIBS=OFF','-DGGML_OPENMP=OFF','-DGGML_VULKAN=ON','-DGGML_NATIVE=OFF',
 '-DLLAMA_BUILD_TESTS=OFF','-DLLAMA_BUILD_EXAMPLES=OFF','-DLLAMA_BUILD_TOOLS=ON','-DLLAMA_BUILD_SERVER=ON',
 '-DLLAMA_OPENSSL=OFF','-DLLAMA_CURL=OFF','-DLLAMA_SERVER_WEBUI=OFF',
 '-DLLAMA_BUILD_NUMBER=11669','-DLLAMA_BUILD_COMMIT=620d2225cc436ab0b001e3200e590e3b286ef9ab',
 f'-DVulkan_GLSLC_EXECUTABLE={ndk}/shader-tools/linux-x86_64/glslc',
 f'-DVulkan_INCLUDE_DIR={work}/vulkan-headers/include',f'-DSPIRV-Headers_DIR={work}/spirv-install/share/cmake/SPIRV-Headers')
run(cmake,'--build',work/'llama-android-arm64','--target','llama-server','-j',max(1,min(args.jobs,8)))
out=work/'android-jni/arm64-v8a';out.mkdir(parents=True,exist_ok=True)
shutil.copyfile(work/'llama-android-arm64/bin/llama-server',out/'libcalendar_llama.so')
run(ndk/'toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-strip','--strip-unneeded',out/'libcalendar_llama.so')
notices=work/'android-native-assets';notices.mkdir(exist_ok=True)
shutil.copyfile(work/'llama-src/LICENSE',notices/'llama-cpp-LICENSE.txt')
shutil.copyfile(work/'vulkan-headers/LICENSE.md',notices/'Vulkan-Headers-LICENSE.md')
shutil.copyfile(work/'spirv-headers/LICENSE',notices/'SPIRV-Headers-LICENSE.txt')
# llama.cpp generates a complete license collection for its vendored server dependencies.
licenses=list((work/'llama-android-arm64').rglob('*license*.txt'))
for i,license_file in enumerate(licenses):shutil.copyfile(license_file,notices/f'upstream-{i}-{license_file.name}')
for notice in (work/'llama-src').rglob('*'):
 if notice.is_file() and notice.name.upper().startswith(('LICENSE','COPYING','NOTICE')):
  target=notices/'llama-third-party'/notice.relative_to(work/'llama-src');target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(notice,target)
manifest={'llamaCommit':'620d2225cc436ab0b001e3200e590e3b286ef9ab','llamaVersion':'b11669','abi':'arm64-v8a','minApi':28,'ndk':'29.0.14206865','experimental':True,'binarySha256':sha(out/'libcalendar_llama.so'),'sources':[{'url':url,'sha256':digest}for _,url,digest in sources]}
(notices/'android-native-runtime.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))

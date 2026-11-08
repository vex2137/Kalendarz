"""Stage the private, immutable ARM64 GPU artifact; never replace the accepted CPU."""
import hashlib,json,os,re,shutil,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=Path(sys.argv[1]);assets=source/'android-native-assets'
digest=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
assert (assets/'vulkan-build-recipe.sha256').read_text().split()[0]==digest(root/'scripts/build-android-native.py'),'Vulkan build recipe changed; recompile before staging'
binary=source/'android-jni/arm64-v8a/libcalendar_llama_vulkan.so'
manifest=json.loads((assets/'android-vulkan-runtime.json').read_text())
assert manifest['llamaCommit']=='80d2c0c2c56e4a1bbf74be98f64b99927bf230bc' and manifest['llamaVersion']=='b12189' and manifest['abi']=='arm64-v8a'
assert manifest['binarySha256']==digest(binary)
elf=Path(os.environ['ANDROID_HOME'])/'ndk/29.0.14206865/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf'
details=subprocess.check_output([str(elf),'-h','-l','-d',str(binary)],text=True)
assert 'AArch64' in details and '/system/bin/linker64' in details
needed=set(re.findall(r'Shared library: \[(.*?)\]',details))
assert 'libvulkan.so' in needed and needed<={'libc.so','libm.so','libdl.so','libvulkan.so','liblog.so','libandroid.so'},needed
cpu=root/'build/android-jni/arm64-v8a/libcalendar_llama.so'
assert digest(cpu)=='83949aeb80b5f899e3b6297df2b547379e63570bffe8eb5276bc44516e034ed5','Accepted CPU changed'
target=root/'build/android-native-assets'
for path in assets.iterdir():
 if path.name=='android-native-runtime.json':continue
 if path.is_dir():shutil.copytree(path,target/path.name,dirs_exist_ok=True)
 else:shutil.copyfile(path,target/path.name)
shutil.copyfile(binary,cpu.with_name('libcalendar_llama_vulkan.so'))
base=json.loads((target/'android-native-runtime.json').read_text());base['backends']=['cpu-native','vulkan'];base['vulkan']=manifest
(target/'android-native-runtime.json').write_text(json.dumps(base,indent=2)+'\n')
print(json.dumps({'vulkanSha256':digest(binary),'bytes':binary.stat().st_size,'dependencies':sorted(needed),'cpuUnchanged':True}))

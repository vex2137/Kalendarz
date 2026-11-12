"""Run the real bundled CPU server inside the installed Flatpak sandbox."""
import hashlib,json,os,subprocess,time,urllib.request
from pathlib import Path
APP='com.vex2137.kalendarz'
root=Path.home()/'.var/app'/APP/'data/acceptance';root.mkdir(parents=True,exist_ok=True)
model=root/'test.gguf';source=Path(os.environ['CALENDAR_EXTERNAL_MODEL'])
with source.open('rb')as f:assert hashlib.file_digest(f,'sha256').hexdigest()=='fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5'
# Test data only, outside the Flatpak package/OSTree repository.
import shutil
shutil.copyfile(source,model)
log=Path('part4-artifacts/flatpak/cpu-smoke.log');process=None
try:
 with log.open('w')as stream:
  command=f'export LD_LIBRARY_PATH=/app/lib/{APP}/resources/native/cpu; exec /app/lib/{APP}/resources/native/cpu/llama-server -m "$XDG_DATA_HOME/acceptance/test.gguf" --host 127.0.0.1 --port 19677 --ctx-size 2048 --n-gpu-layers 0'
  process=subprocess.Popen(['flatpak','run','--user','--command=sh',APP,'-c',command],stdout=stream,stderr=stream)
  deadline=time.monotonic()+150
  while True:
   if process.poll() is not None:raise RuntimeError('Sandboxed CPU server exited: '+log.read_text()[-4000:])
   try:
    with urllib.request.urlopen('http://127.0.0.1:19677/health',timeout=2)as r:
     if r.status==200:break
   except Exception:pass
   if time.monotonic()>deadline:raise TimeoutError('Sandboxed CPU health timeout')
   time.sleep(.3)
  body=json.dumps({'messages':[{'role':'user','content':'Say hello briefly.'}],'max_tokens':64,'temperature':0,'chat_template_kwargs':{'enable_thinking':False}}).encode()
  with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:19677/v1/chat/completions',data=body,headers={'Content-Type':'application/json'}),timeout=120)as r:result=json.load(r)
  assert result['usage']['completion_tokens']>0 and result['choices'][0]['message'].get('content')
  report=dict(source=os.environ['CALENDAR_EXPECTED_COMMIT'],status='PASS',test='real CPU GGUF inference inside installed Flatpak sandbox',completionTokens=result['usage']['completion_tokens'],gpuVerified=False)
  Path('part4-artifacts/flatpak/cpu-smoke.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
finally:
 if process:
  process.terminate()
  try:process.wait(timeout=15)
  except subprocess.TimeoutExpired:process.kill();process.wait()
 model.unlink(missing_ok=True)

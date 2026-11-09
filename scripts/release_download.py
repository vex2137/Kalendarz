"""Build-time transport fallback; pinned bytes/SHA remain mandatory for both routes."""
import argparse,hashlib,json,re,subprocess,urllib.parse,urllib.request
from pathlib import Path

def download_pinned_release(url,output,expected_bytes,expected_sha):
 output=Path(output);output.parent.mkdir(parents=True,exist_ok=True);temporary=output.with_name(output.name+'.partial')
 if type(expected_bytes) is not int or expected_bytes<=0 or not re.fullmatch('[a-f0-9]{64}',expected_sha):raise ValueError('Missing pinned download identity')
 try:
  try:
   subprocess.run(['curl','--fail','--location','--retry','2','--max-time','300','--proto','=https','--proto-redir','=https','--output',str(temporary),url],check=True)
   route='release-url'
  except subprocess.CalledProcessError:
   match=re.fullmatch(r'https://github\.com/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/releases/download/([^/?#]+)/([^/?#]+)',url)
   if not match:raise ValueError('No approved GitHub REST fallback for this URL') from None
   repository,tag,name=match.groups();name=urllib.parse.unquote(name)
   headers={'User-Agent':'Kalendarz-pinned-build','Accept':'application/vnd.github+json'}
   endpoint=f'https://api.github.com/repos/{repository}/releases/tags/{urllib.parse.quote(urllib.parse.unquote(tag),safe="")}'
   with urllib.request.urlopen(urllib.request.Request(endpoint,headers=headers),timeout=60) as response:
    raw=response.read(2*1024*1024+1)
   if len(raw)>2*1024*1024:raise ValueError('Release metadata too large')
   assets=[a for a in json.loads(raw).get('assets',[]) if a.get('name')==name and a.get('size')==expected_bytes]
   if len(assets)!=1:raise ValueError('Pinned release asset missing/changed')
   asset_url=assets[0].get('url','')
   if not re.fullmatch(re.escape(f'https://api.github.com/repos/{repository}/releases/assets/')+r'[1-9][0-9]*',asset_url):raise ValueError('Unexpected release API origin')
   # Public assets only. No authorization header is sent or forwarded to redirects.
   request=urllib.request.Request(asset_url,headers={'User-Agent':'Kalendarz-pinned-build','Accept':'application/octet-stream'})
   with urllib.request.urlopen(request,timeout=300) as response,temporary.open('wb') as target:
    total=0
    while chunk:=response.read(1024*1024):
     total+=len(chunk)
     if total>expected_bytes:raise ValueError('Release asset exceeds pinned size')
     target.write(chunk)
   route='github-rest'
  with temporary.open('rb') as stream:actual=hashlib.file_digest(stream,'sha256').hexdigest()
  if temporary.stat().st_size!=expected_bytes or actual!=expected_sha:raise ValueError('Pinned release size/SHA-256 mismatch')
  temporary.replace(output)
  return route
 finally:
  temporary.unlink(missing_ok=True)

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('url');p.add_argument('output');p.add_argument('--bytes',type=int,required=True);p.add_argument('--sha256',required=True);a=p.parse_args()
 print(json.dumps({'verified':True,'transport':download_pinned_release(a.url,a.output,a.bytes,a.sha256),'bytes':a.bytes,'sha256':a.sha256}))

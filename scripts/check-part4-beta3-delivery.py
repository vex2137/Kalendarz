"""Re-download all five private packages; require identical clean application provenance."""
import hashlib,json,os,subprocess
from pathlib import Path
from part4_beta3_guard import ROOT,policy,CERT

def verify(directory,source):
 p=policy();results=[]
 for platform,key in [('android','androidFile'),('linux','linuxFile'),('flatpak','flatpakFile'),('windows','setupFile'),('windows','portableFile')]:
  artifact=directory/platform/p[key];report=json.loads(artifact.with_name(artifact.name+'.json').read_text())
  assert report['source']==source and report.get('channel')=='part4-beta3','Artifact source/channel mismatch'
  with artifact.open('rb')as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
  assert sha==report['sha256'] and artifact.stat().st_size==report['bytes'],'Downloaded bytes mismatch'
  if platform=='android':assert report['versionCode']==p['versionCode'] and report['package']=='com.kalendarz.offline.diagnostics' and report['certificateSha256']==CERT
  results.append(dict(platform=platform,file=artifact.name,bytes=report['bytes'],sha256=sha,source=source))
 return dict(channel=p['channel'],source=source,files=results)
def main():
 source=os.environ['CALENDAR_EXPECTED_COMMIT'];report=verify(ROOT/'downloaded',source)
 artifacts=json.loads(subprocess.check_output(['gh','api',f"repos/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/artifacts"],text=True))['artifacts']
 for item in report['files']:
  artifact=next(a for a in artifacts if a['name']=='Kalendarz-Part-4-Beta-3-'+item['platform']+'-'+source and not a['expired'])
  item['artifactUrl']=f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/artifacts/{artifact['id']}"
 out=ROOT/'part4-delivery';out.mkdir(exist_ok=True);(out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
 (out/'SHA256SUMS').write_text(''.join(f"{f['sha256']}  {f['file']}\n"for f in report['files']));print(json.dumps(report,indent=2))
if __name__=='__main__':main()

"""Re-download both private artifacts and verify one source and the signed update identity."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def verify(directory,source):
 policy=json.loads((ROOT/'scripts/part3-beta2-version.json').read_text());results=[]
 for platform,key in [('android','androidFile'),('linux','linuxFile')]:
  artifact=directory/platform/policy[key];report=json.loads(artifact.with_name(artifact.name+'.json').read_text())
  assert report['source']==source and report.get('channel')=='part3-beta2','Artifact source/channel mismatch'
  with artifact.open('rb') as stream:checksum=hashlib.file_digest(stream,'sha256').hexdigest()
  assert checksum==report['sha256'] and artifact.stat().st_size==report['bytes'],'Downloaded artifact bytes mismatch'
  if platform=='android':
   assert report['versionCode']==policy['versionCode'] and report['package']=='com.kalendarz.offline.diagnostics'
   assert report['certificateSha256']=='ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
  results.append(dict(platform=platform,file=artifact.name,bytes=report['bytes'],sha256=checksum,source=source))
 return dict(channel=policy['channel'],source=source,files=results)
def main():
 source=os.environ['CALENDAR_EXPECTED_COMMIT'];report=verify(ROOT/'downloaded',source)
 artifacts=json.loads(subprocess.check_output(['gh','api',f"repos/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/artifacts"],text=True))['artifacts']
 for item in report['files']:
  name='Kalendarz-Part-3-Beta-2-'+item['platform']+'-'+source
  artifact=next(a for a in artifacts if a['name']==name and not a['expired'])
  item['artifactUrl']=f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/artifacts/{artifact['id']}"
 out=ROOT/'part3-delivery';out.mkdir();(out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

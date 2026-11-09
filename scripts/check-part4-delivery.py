"""Re-download both private artifacts and verify one source and the signed update identity."""
import hashlib,json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def verify(directory,source):
 policy=json.loads((ROOT/'scripts/part4-beta1-version.json').read_text());results=[]
 for platform,key in [('android','androidFile'),('linux','linuxFile')]:
  artifact=directory/platform/policy[key];report=json.loads(artifact.with_name(artifact.name+'.json').read_text())
  assert report['source']==source and report.get('channel')=='part4-beta1','Artifact source/channel mismatch'
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
  name='Kalendarz-Part-4-Beta-1-'+item['platform']+'-'+source
  artifact=next(a for a in artifacts if a['name']==name and not a['expired'])
  item['artifactUrl']=f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}/artifacts/{artifact['id']}"
 evidence=ROOT/'manual-test-assets/part4'
 upgrade=json.loads((evidence/'upgrade-142.json').read_text());performance=json.loads((evidence/'performance.json').read_text())
 assert upgrade['status']=='PASS' and upgrade['source']['version']=='1.4.2' and upgrade['source']['commit']=='abb9f20157f333b9f2ee5a3a5a18c02a684dcb0c'
 assert upgrade['target']['commit']==source and upgrade['target']['dirty'] is False and upgrade['target']['releaseChannel']=='part4-beta1'
 assert upgrade['before']==upgrade['after'] and upgrade['before']['events']==6 and upgrade['before']['messages']>=8
 assert [item['events'] for item in performance['results']]==[10,500,5000]
 report['upgrade']=upgrade;report['performance']=performance
 out=ROOT/'part4-delivery';out.mkdir();
 (out/'AUDIT.md').write_text((ROOT/'docs/PART4-BETA1-AUDIT.md').read_text().replace('NOT TESTED — FINAL_CI_PENDING:', 'PASS — final candidate CI completed:')+'\n## Final CI delivery evidence\n\nPASS — private workflow completed validation, both platform jobs and downloaded byte/source checks.\n\n```json\n'+json.dumps(report,indent=2)+'\n```\n')
 (out/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

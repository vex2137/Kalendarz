"""Read-only public metadata/header probe; never guesses or changes catalogue checksums.
Network-denied probes report unverified; an observed integrity mismatch fails CI.
"""
import json
import urllib.request
import urllib.error
import struct
from pathlib import Path

catalogue=Path(__file__).resolve().parents[1]/'src/utils'
model={**json.loads((catalogue/'localModelManifest.json').read_text()),**json.loads((catalogue/'defaultModelSource.json').read_text())}
report={'url':model['url'],'expectedBytes':model['bytes'],'expectedSha256':model['sha256'],'verifiedMetadataAndHeader':False}
try:
    request=urllib.request.Request('https://huggingface.co/api/models/Vex909/Qwen-3.5-v2-Q4_K_M?blobs=true',headers={'User-Agent':'Kalendarz-source-check'})
    with urllib.request.urlopen(request,timeout=30) as response:
        meta=json.load(response)
    entry=next(f for f in meta['siblings'] if f['rfilename']==model['file'])
    lfs=entry.get('lfs',{})
    report.update(publicRevision=meta['sha'],publicBytes=lfs.get('size',entry.get('size')),publicSha256=lfs.get('sha256'))
    if report['publicBytes']!=model['bytes'] or report['publicSha256']!=model['sha256']:
        raise ValueError('public-metadata-does-not-match-pinned-model')
    request=urllib.request.Request(model['url'],headers={'Range':'bytes=0-7','Accept-Encoding':'identity','User-Agent':'Kalendarz-source-check'})
    with urllib.request.urlopen(request,timeout=30) as response:
        report['downloadHttpStatus']=response.status
        report['contentRange']=response.headers.get('Content-Range')
        header=response.read(8) # Never buffer/download all weights if Range is ignored.
        if response.status==206:
            if report['contentRange']!=f"bytes 0-7/{model['bytes']}":raise ValueError('invalid-header-range')
        elif response.status!=200:raise ValueError('unexpected-download-status')
        elif response.headers.get('Content-Length')!=str(model['bytes']):raise ValueError('invalid-download-length')
    if len(header)!=8 or header[:4]!=b'GGUF' or struct.unpack('<I',header[4:])[0] not in (2,3):raise ValueError('invalid-gguf-header')
    report['verifiedMetadataAndHeader']=True
except (urllib.error.URLError,TimeoutError,OSError) as error:
    report.update(networkResult='unverified',exceptionType=type(error).__name__)
    if isinstance(error,urllib.error.HTTPError):report['httpStatus']=error.code
except (ValueError,KeyError,StopIteration) as error:
    report['integrityFailure']=str(error)
    print(json.dumps(report,indent=2));raise SystemExit(1)
print(json.dumps(report,indent=2))

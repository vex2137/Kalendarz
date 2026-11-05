"""Download only the pinned public source model, and hash its files for provenance."""
import argparse
import hashlib
import json
from pathlib import Path
from huggingface_hub import snapshot_download

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--config',default='training/v142/rtx4060.json')
    parser.add_argument('--output',default='training/runs/source-model.json')
    args=parser.parse_args()
    config=json.loads(Path(args.config).read_text())
    if config['model']!='Qwen/Qwen3.5-0.8B' or len(config['revision'])!=40:
        raise ValueError('Expected the pinned public Qwen source checkpoint')
    root=Path(snapshot_download(repo_id=config['model'],revision=config['revision'],allow_patterns=['*.json','*.jinja','*.safetensors','*.model','*.txt','LICENSE*']))
    files={}
    for path in sorted(root.iterdir()):
        if path.is_file():
            digest=hashlib.sha256()
            with path.open('rb') as stream:
                for chunk in iter(lambda:stream.read(4*1024*1024),b''):digest.update(chunk)
            files[path.name]={'bytes':path.stat().st_size,'sha256':digest.hexdigest()}
    if not any(name.endswith('.safetensors') for name in files):raise ValueError('No source weights downloaded')
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'model':config['model'],'revision':config['revision'],'snapshot':str(root),'files':files},indent=2)+'\n')
    print('Pinned source checkpoint ready: '+str(root))

"""Read upstream model metadata; never infer hashes or silently change quants."""
import json
from pathlib import Path
import urllib.request

sources = {
    'LiquidAI/LFM2.5-2.6B-GGUF': ['LFM2.5-2.6B-Q4_K_M.gguf'],
    'Qwen/Qwen3.5-0.8B-GGUF': ['Qwen3.5-0.8B-Q4_K_M.gguf'],
    'bartowski/Qwen_Qwen3.5-0.8B-GGUF': ['Qwen3.5-0.8B-Q4_K_M.gguf', 'Qwen3.5-0.8B-IQ4_XS.gguf'],
    'mradermacher/Qwen3.5-0.8B-GGUF': ['Qwen3.5-0.8B.Q4_K_M.gguf', 'Qwen3.5-0.8B.IQ4_XS.gguf'],
}
results = []
for repo, names in sources.items():
    try:
        with urllib.request.urlopen(f'https://huggingface.co/api/models/{repo}?blobs=true', timeout=60) as r:
            metadata = json.load(r)
        files = []
        for entry in metadata['siblings']:
            if entry['rfilename'] not in names:
                continue
            lfs = entry.get('lfs', {})
            files.append({'file': entry['rfilename'], 'bytes': entry.get('size') or lfs.get('size'), 'sha256': lfs.get('sha256'), 'url': f'https://huggingface.co/{repo}/resolve/{metadata["sha"]}/{entry["rfilename"]}'})
        result = {'repo': repo, 'revision': metadata['sha'], 'license': metadata.get('cardData', {}).get('license'), 'files': files}
    except Exception as error:
        result = {'repo': repo, 'error': str(error)}
    results.append(result)
    print(json.dumps(result), flush=True)
Path('model-research.json').write_text(json.dumps(results, indent=2) + '\n')

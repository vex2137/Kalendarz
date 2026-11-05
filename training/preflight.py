"""Hardware and official-tokenizer audit before allocating training weights."""
import argparse
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path
from conversation_dataset import load_training_dataset
from train import encode_record


def inspect(config, tokenizer_check=False):
    import torch
    import psutil
    report = {'platform':platform.platform(), 'ram_bytes':psutil.virtual_memory().total,
              'cuda':torch.cuda.is_available(), 'versions':{p:importlib.metadata.version(p) for p in ['torch','transformers','peft','accelerate','datasets']}}
    limit=Path('/sys/fs/cgroup/memory.max')
    report['cgroup_memory_limit']=limit.read_text().strip() if limit.exists() else None
    if report['cuda']:
        free,total=torch.cuda.mem_get_info()
        report.update(gpu=torch.cuda.get_device_name(),vram_bytes=total,free_vram_bytes=free,bf16=torch.cuda.is_bf16_supported())
        if config['dtype']=='bfloat16' and not report['bf16']:
            raise ValueError('GPU does not support the selected BF16 profile')
    data,_=load_training_dataset(config)
    report['records']={k:len(v) for k,v in data.items()}
    report['tokenizer_checked']=False
    if tokenizer_check:
        from transformers import AutoTokenizer
        tokenizer=AutoTokenizer.from_pretrained(config['model'],revision=config['revision'],local_files_only=True,trust_remote_code=False)
        lengths={k:[len(encode_record(tokenizer,r['messages'],config['max_length'])['input_ids']) for r in rows] for k,rows in data.items()}
        report.update(tokenizer_checked=True,tokenizer_class=type(tokenizer).__name__,vocabulary=len(tokenizer),
                      chat_template_sha256=hashlib.sha256(tokenizer.chat_template.encode()).hexdigest(),
                      max_tokens={k:max(v) for k,v in lengths.items()},special_tokens=tokenizer.special_tokens_map)
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--config',default='training/v142/rtx4060.json')
    parser.add_argument('--tokenizer',action='store_true')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    report=inspect(json.loads(Path(args.config).read_text()),args.tokenizer)
    Path(args.output).parent.mkdir(parents=True,exist_ok=True)
    Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

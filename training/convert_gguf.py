"""Merge a real adapter and convert with exactly the application's llama.cpp revision.
Creation is not runtime acceptance. No application/catalogue is modified here.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

LLAMA_COMMIT='620d2225cc436ab0b001e3200e590e3b286ef9ab'


def sha(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(4*1024*1024),b''): digest.update(block)
    return digest.hexdigest()


def inspect_gguf(path, tokenizer, expected_type):
    from gguf import GGUFReader
    reader=GGUFReader(str(path))
    def field(name):
        if name not in reader.fields: raise ValueError('Missing GGUF field: '+name)
        return reader.fields[name].contents()
    if field('general.architecture')!='qwen35' or int(field('general.file_type'))!=expected_type:
        raise ValueError('Unexpected GGUF architecture/quantization')
    if field('tokenizer.chat_template')!=tokenizer.chat_template:
        raise ValueError('GGUF chat template differs from the official tokenizer')
    if int(field('tokenizer.ggml.eos_token_id'))!=tokenizer.eos_token_id:
        raise ValueError('GGUF EOS token mismatch')
    if not reader.tensors: raise ValueError('No GGUF tensors')
    return {'architecture':'qwen35','tensors':len(reader.tensors),
            'chat_template_sha256':hashlib.sha256(tokenizer.chat_template.encode()).hexdigest(),
            'eos_token_id':tokenizer.eos_token_id,'runtime_verified':False}


def convert(run, output, llama):
    from peft import PeftModel
    from train import load_components
    run,output,llama=Path(run),Path(output),Path(llama)
    metadata=json.loads((run/'run-metadata.json').read_text())
    config=metadata['config']
    if config['model']!='Qwen/Qwen3.5-0.8B' or config.get('train_limit') or config['max_steps']<3:
        raise ValueError('Export requires a real, non-smoke Qwen3.5-0.8B run')
    metrics=json.loads((run/'metrics.json').read_text())
    if not metrics.get('train',{}).get('train_loss',0)>0:
        raise ValueError('Real training metrics are required')
    for name in ['adapter_config.json','adapter_model.safetensors']:
        if not (run/'adapter'/name).is_file(): raise ValueError('Missing adapter: '+name)
    revision=subprocess.check_output(['git','-C',str(llama),'rev-parse','HEAD'],text=True).strip()
    if revision!=LLAMA_COMMIT: raise ValueError('Use the pinned application llama.cpp source')
    subprocess.run(['git','-C',str(llama),'diff','--exit-code','HEAD','--','conversion','convert_hf_to_gguf.py','gguf-py'],check=True,stdout=subprocess.DEVNULL)
    quantizer=llama/'build/bin/llama-quantize'
    if not quantizer.is_file(): raise ValueError('Build llama-quantize first')
    if output.exists(): raise ValueError('Destination exists; choose a new directory')
    output.mkdir(parents=True)
    # CPU BF16 merge avoids holding the training optimizer and export together in VRAM.
    config={**config,'dtype':'bfloat16'}
    model,tokenizer=load_components(config)
    model=PeftModel.from_pretrained(model,run/'adapter',is_trainable=False).merge_and_unload(safe_merge=True)
    model.config.use_cache=True
    merged=output/'Calendar-Qwen3.5-0.8B-1.4.2'
    model.save_pretrained(merged,safe_serialization=True)
    tokenizer.save_pretrained(merged)
    del model
    import gc
    gc.collect()
    full=output/'Calendar-Qwen3.5-0.8B-1.4.2-F16.gguf'
    quant=output/'Calendar-Qwen3.5-0.8B-1.4.2-Q4_K_M.gguf'
    subprocess.run([sys.executable,str(llama/'convert_hf_to_gguf.py'),str(merged),'--outfile',str(full),'--outtype','f16','--model-name','Calendar Qwen3.5 0.8B FT 1.4.2'],check=True)
    inspect_gguf(full,tokenizer,1)
    subprocess.run([str(quantizer),str(full),str(quant),'Q4_K_M'],check=True)
    inspection=inspect_gguf(quant,tokenizer,15)
    provenance={'status':'converted-awaiting-runtime-and-quality-validation','llama_commit':revision,
                'training':metadata,'metrics':metrics,'adapter_sha256':sha(run/'adapter/adapter_model.safetensors'),
                'files':{p.name:{'sha256':sha(p),'bytes':p.stat().st_size} for p in [full,quant]},
                'inspection':inspection}
    (output/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    (output/'SHA256SUMS.txt').write_text(''.join(f"{info['sha256']}  {name}\n" for name,info in provenance['files'].items()))
    # Identical bytes get an independent imported identity through the existing UI.
    print(json.dumps({'gguf':str(quant),'sha256':sha(quant),'runtime_verified':False},indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--run',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--llama-dir',required=True)
    args=parser.parse_args()
    convert(args.run,args.output,args.llama_dir)

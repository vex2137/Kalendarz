"""Unconstrained, offline paired evaluation. Text quality requires blinded review."""
import argparse
from collections import defaultdict
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import statistics
import threading
import time
from conversation_dataset import load_training_dataset
from evaluate import score_predictions
from train import load_components


def generate(config, records, adapter=None):
    import torch
    import psutil
    from transformers.generation.streamers import BaseStreamer
    process=psutil.Process()
    peak=[process.memory_info().rss]
    stopped=threading.Event()
    def sample():
        while not stopped.wait(.05):
            peak[0]=max(peak[0],process.memory_info().rss)
    worker=threading.Thread(target=sample,daemon=True)
    worker.start()
    try:
        start=time.perf_counter()
        model,tokenizer=load_components(config)
        if adapter:
            from peft import PeftModel
            model=PeftModel.from_pretrained(model,adapter,is_trainable=False)
        device=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model.to(device).eval()
        model.config.use_cache=True
        if device.type=='cuda':
            torch.cuda.reset_peak_memory_stats()
        load_ms=(time.perf_counter()-start)*1000
        class Timer(BaseStreamer):
            def __init__(self): self.first=None; self.prompt=True
            def put(self,value):
                if self.prompt: self.prompt=False
                elif self.first is None: self.first=time.perf_counter()
            def end(self): pass
        results=[]
        for index,row in enumerate(records):
            inputs=tokenizer.apply_chat_template(row['messages'][:-1],tokenize=True,add_generation_prompt=True,enable_thinking=False,return_dict=True,return_tensors='pt').to(device)
            maximum=256 if row.get('output_mode','command')=='command' else 96
            if inputs['input_ids'].shape[-1]+maximum>config['max_length']:
                raise ValueError('Evaluation context budget exceeded: '+row['id'])
            timer=Timer()
            if device.type=='cuda': torch.cuda.synchronize()
            start=time.perf_counter()
            with torch.inference_mode():
                output=model.generate(**inputs,max_new_tokens=maximum,do_sample=False,pad_token_id=tokenizer.pad_token_id,streamer=timer)
            if device.type=='cuda': torch.cuda.synchronize()
            end=time.perf_counter()
            generated=output[0,inputs['input_ids'].shape[-1]:]
            results.append({'id':row['id'],'prediction':tokenizer.decode(generated,skip_special_tokens=True),
                            'tokens':len(generated),'elapsed_ms':(end-start)*1000,
                            'ttft_ms':(timer.first-start)*1000 if timer.first else None,
                            'decode_tokens_per_second':(len(generated)-1)/(end-timer.first) if timer.first and len(generated)>1 else None,
                            'sample': 'first-inference' if index==0 else 'warm',
                            'truncated':len(generated)>=maximum and int(generated[-1])!=tokenizer.eos_token_id})
        return results,{'load_ms':load_ms,'peak_rss_bytes':peak[0],
                        'peak_cuda_allocated_bytes':torch.cuda.max_memory_allocated() if device.type=='cuda' else None,
                        'device':str(device),'gpu':torch.cuda.get_device_name() if device.type=='cuda' else None,
                        'cpu':platform.processor(),'threads':torch.get_num_threads(),'platform':platform.platform(),
                        'versions':{p:importlib.metadata.version(p) for p in ['torch','transformers','peft']},
                        'chat_template_sha256':hashlib.sha256(tokenizer.chat_template.encode()).hexdigest()}
    finally:
        stopped.set()
        worker.join()


def report(records, results, schema):
    if [r['id'] for r in records]!=[r['id'] for r in results]:
        raise ValueError('Prediction IDs/order differ from the locked evaluation corpus')
    commands=[i for i,r in enumerate(records) if r.get('output_mode','command')=='command']
    scored=score_predictions([records[i] for i in commands],[results[i]['prediction'] for i in commands],schema)
    text=[]
    for row,result in zip(records,results):
        if row.get('output_mode')=='text':
            text.append({'id':row['id'],'category':row['category'],'language':row['language'],
                         'prompt':row['messages'][:-1],'prediction':result['prediction'],
                         'reference':row['messages'][-1]['content'],
                         'review_required':['language','grammar','relevance','grounding','safety']})
    return {'command_scores':scored['scores'],'command_results':scored['results'],'text_review':text,
            'measurements':results,'calendar_writes':0,'quality_review_complete':not text}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--config',default='training/v142/rtx4060.json')
    parser.add_argument('--adapter')
    parser.add_argument('--regression',action='store_true')
    parser.add_argument('--predictions',help='JSON list of {id,prediction}; no invented timing values')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    config=json.loads(Path(args.config).read_text())
    data,schema=load_training_dataset(config)
    records=json.loads(Path('training/v142/regression.json').read_text()) if args.regression else data['test']
    if args.predictions:
        results=json.loads(Path(args.predictions).read_text()); hardware=None
    else:
        results,hardware=generate(config,records,args.adapter)
    output=report(records,results,schema)
    output.update(base_model=config['model'],revision=config['revision'],adapter=args.adapter,hardware=hardware,
                  corpus_sha256=hashlib.sha256(json.dumps(records,sort_keys=True,ensure_ascii=False).encode()).hexdigest(),
                  backend='transformers',constrained_decoding=False,enable_thinking=False,config=config)
    destination=Path(args.output)
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'commands':output['command_scores'],'text_reviews_required':len(output['text_review'])},indent=2))

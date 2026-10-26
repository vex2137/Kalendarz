"""Bounded SFT/LoRA for the unquantized checkpoint; never trains a GGUF."""
import argparse
import importlib.metadata
import json
from pathlib import Path
from conversation_dataset import load_training_dataset

def encode_record(tokenizer, messages, max_length):
    # Mask the entire prompt. Refuse truncation or template boundary mismatch.
    prompt = tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True, enable_thinking=False)
    full = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=False, enable_thinking=False)
    if hasattr(prompt, 'input_ids'):
        prompt, full = prompt.input_ids, full.input_ids
    if not isinstance(prompt, list) or full[:len(prompt)] != prompt or len(full) <= len(prompt):
        raise ValueError('Chat template prefix is not aligned; assistant-only labels cannot be proven')
    if len(full) > max_length:
        raise ValueError('Record exceeds context; shorten the source instead of truncating its JSON')
    return {'input_ids': full, 'attention_mask': [1] * len(full), 'labels': [-100] * len(prompt) + full[len(prompt):]}

def load_components(config):
    import torch
    from transformers import AutoConfig, AutoTokenizer, AutoModelForCausalLM, AutoModelForImageTextToText
    source = config['model']
    if str(source).lower().endswith('.gguf'):
        raise ValueError('Use the original Transformers checkpoint, not GGUF')
    options = {'revision': config.get('revision'), 'local_files_only': config.get('local_files_only', True), 'trust_remote_code': False}
    dtype = getattr(torch, config['dtype'])
    model_config = AutoConfig.from_pretrained(source, **options)
    if config['loader'] == 'image-text-to-text':
        if model_config.model_type != 'qwen3_5':
            raise ValueError('Expected the reviewed Qwen3.5 multimodal checkpoint')
        loader = AutoModelForImageTextToText
    elif config['loader'] == 'causal-lm':
        loader = AutoModelForCausalLM
    else:
        raise ValueError('Unknown loader')
    tokenizer = AutoTokenizer.from_pretrained(source, **options)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = loader.from_pretrained(source, dtype=dtype, attn_implementation='eager', **options)
    return model, tokenizer

def train(config, resume=None, overwrite=False):
    import torch
    from datasets import Dataset
    from transformers import Trainer, TrainingArguments, DataCollatorForSeq2Seq, set_seed
    from peft import LoraConfig, get_peft_model, TaskType
    if config.get('require_cuda') and not torch.cuda.is_available():
        raise ValueError('This production profile requires CUDA; no real Qwen training was started')
    if torch.cuda.is_available():
        torch.cuda.reset_peak_memory_stats()
    if config['max_steps'] < 1 or config['max_steps'] > 5000:
        raise ValueError('Training must have an explicit 1..5000 step budget')
    output = Path(config['output_dir'])
    if output.exists() and any(output.iterdir()) and not resume and not overwrite:
        raise ValueError('Output already exists; use --resume or choose a new directory')
    data, _ = load_training_dataset(config)
    manifest = json.loads((Path(config['dataset']) / 'manifest.json').read_text())
    if resume:
        resume_path=Path(resume).resolve()
        if output.resolve() not in resume_path.parents or not (resume_path/'trainer_state.json').is_file():
            raise ValueError('Resume requires a checkpoint within this run directory')
        previous=json.loads((output/'run-metadata.json').read_text())
        immutable=[key for key in config if key not in ['max_steps','output_dir']]
        if previous['dataset_manifest']!=manifest or any(previous['config'].get(key)!=config.get(key) for key in immutable):
            raise ValueError('Resume model/configuration or dataset differs from the original run')
    set_seed(config['seed'])
    model, tokenizer = load_components(config)
    model.config.use_cache = False
    if config.get('gradient_checkpointing', True):
        model.enable_input_require_grads()
    # Match only language-model attention modules, never the vision encoder.
    targets = [name for name, module in model.named_modules() if name.rsplit('.', 1)[-1] in config['target_modules'] and isinstance(module, torch.nn.Linear) and not any(part in name for part in ['visual', 'vision'])]
    if not targets:
        raise ValueError('No reviewed language-model LoRA target modules found')
    model = get_peft_model(model, LoraConfig(task_type=TaskType.CAUSAL_LM, r=config['lora_r'], lora_alpha=config['lora_alpha'], lora_dropout=config['lora_dropout'], target_modules=targets, bias='none'))
    encoded = {split: Dataset.from_list([encode_record(tokenizer, r['messages'], config['max_length']) for r in data[split][:config.get(split + '_limit') or None]]) for split in ['train', 'validation']}
    output.mkdir(parents=True, exist_ok=True)
    import hashlib
    run_metadata = {'config': config, 'versions': {p: importlib.metadata.version(p) for p in ['torch', 'transformers', 'peft', 'datasets', 'accelerate']}, 'device': 'cuda' if torch.cuda.is_available() else 'cpu', 'trainable_parameters': sum(p.numel() for p in model.parameters() if p.requires_grad), 'targets': targets, 'dataset_manifest': manifest, 'chat_template_sha256':hashlib.sha256(tokenizer.chat_template.encode()).hexdigest()}
    run_metadata['config_sha256'] = hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()
    run_metadata['training_script_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    (output / 'run-metadata.json').write_text(json.dumps(run_metadata, indent=2) + '\n')
    arguments = TrainingArguments(output_dir=str(output), seed=config['seed'], learning_rate=config['learning_rate'], per_device_train_batch_size=config['batch_size'], per_device_eval_batch_size=1, gradient_accumulation_steps=config['gradient_accumulation_steps'], num_train_epochs=config['epochs'], max_steps=config['max_steps'], save_strategy='steps', save_steps=config['save_steps'], save_total_limit=2, eval_strategy='steps', eval_steps=config['eval_steps'], logging_steps=1, report_to=[], bf16=config['dtype'] == 'bfloat16', fp16=config['dtype'] == 'float16', gradient_checkpointing=config.get('gradient_checkpointing', True), gradient_checkpointing_kwargs={'use_reentrant': False}, remove_unused_columns=False, dataloader_num_workers=0, optim='adamw_torch')
    trainer = Trainer(model=model, args=arguments, train_dataset=encoded['train'], eval_dataset=encoded['validation'], processing_class=tokenizer, data_collator=DataCollatorForSeq2Seq(tokenizer=tokenizer, padding=True, label_pad_token_id=-100))
    result = trainer.train(resume_from_checkpoint=resume)
    metrics = trainer.evaluate()
    adapter = output / 'adapter'
    model.save_pretrained(adapter, safe_serialization=True)
    tokenizer.save_pretrained(adapter)
    trainer.save_state()
    trainer.save_metrics('train', result.metrics)
    trainer.save_metrics('eval', metrics)
    (output / 'metrics.json').write_text(json.dumps({'train': result.metrics, 'validation': metrics, 'peak_cuda_allocated_bytes':torch.cuda.max_memory_allocated() if torch.cuda.is_available() else None}, indent=2) + '\n')
    print(json.dumps({'adapter': str(adapter), 'metrics': metrics, 'trained_production_model': config['model'] == 'Qwen/Qwen3.5-0.8B'}, indent=2))
    return trainer

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='training/lora-config.json')
    parser.add_argument('--resume', help='Exact checkpoint directory; retains optimizer and scheduler state')
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args()
    train(json.loads(Path(args.config).read_text()), args.resume, args.overwrite)

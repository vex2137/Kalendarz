"""Evaluate raw extraction, separately from application routing and write gates."""
import argparse
import json
from collections import defaultdict
from pathlib import Path
from train import load_components
from validate_dataset import load_dataset, parse_json, validate_command

def score_predictions(records, predictions, schema):
    if len(records) != len(predictions):
        raise ValueError('Prediction count mismatch')
    scores = defaultdict(lambda: {'records': 0, 'valid_json': 0, 'valid_command': 0, 'intent': 0, 'exact': 0})
    fields = defaultdict(lambda: {'total': 0, 'correct': 0})
    rows = []
    for record, prediction in zip(records, predictions):
        expected = parse_json(record['messages'][-1]['content'])
        valid, syntactic, parsed = False, False, None
        try:
            parsed = parse_json(prediction)
            syntactic = True
            parsed = validate_command(parsed, schema)
            valid = True
        except (ValueError, TypeError, KeyError):
            pass
        normalized = lambda value: {k: v for k, v in value.items() if v is not None}
        exact = valid and normalized(parsed) == normalized(expected)
        intent = valid and parsed['action'] == expected['action']
        for category in ['all', record['category'], 'language:' + record['language']]:
            entry = scores[category]
            entry['records'] += 1
            entry['valid_json'] += syntactic
            entry['valid_command'] += valid
            entry['intent'] += intent
            entry['exact'] += exact
        for key in ['date', 'endDate', 'time', 'endTime', 'query', 'title', 'sourceDate', 'recurrence', 'reminderMinutes']:
            if key in expected:
                fields[key]['total'] += 1
                fields[key]['correct'] += valid and parsed.get(key) == expected[key]
        rows.append({'id': record['id'], 'valid_json': valid, 'intent': intent, 'exact': exact, 'prediction': prediction, 'expected': expected})
    return {'scores': dict(scores), 'fields': dict(fields), 'results': rows, 'calendar_writes': 0}

def generate_predictions(config, records, adapter=None):
    import torch
    model, tokenizer = load_components(config)
    if adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, adapter, is_trainable=False)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device).eval()
    model.config.use_cache = True
    result = []
    for row in records:
        inputs = tokenizer.apply_chat_template(row['messages'][:-1], tokenize=True, add_generation_prompt=True, enable_thinking=False, return_tensors='pt', return_dict=True).to(device)
        if inputs['input_ids'].shape[-1] + 256 > config['max_length']:
            raise ValueError('Evaluation prompt exceeds the application context budget')
        with torch.inference_mode():
            output = model.generate(**inputs, max_new_tokens=256, do_sample=False, pad_token_id=tokenizer.pad_token_id)
        result.append(tokenizer.decode(output[0, inputs['input_ids'].shape[-1]:], skip_special_tokens=True))
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='training/lora-config.json')
    parser.add_argument('--adapter')
    parser.add_argument('--limit', type=int, default=0, help='0 means the complete test split')
    parser.add_argument('--predictions', help='JSON list of strings for scoring existing model output without loading weights')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    data, schema = load_dataset(config['dataset'])
    if args.limit < 0:
        raise ValueError('Limit must not be negative')
    records = data['test'][:args.limit or None]
    predictions = json.loads(Path(args.predictions).read_text()) if args.predictions else generate_predictions(config, records, args.adapter)
    report = score_predictions(records, predictions, schema)
    report.update({'base_model': config['model'], 'revision': config['revision'], 'adapter': args.adapter, 'constrained_decoding': False, 'production_default_changed': False})
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'scores': report['scores'], 'output': args.output}, indent=2))

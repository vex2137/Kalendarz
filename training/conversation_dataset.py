"""Validate mixed natural-dialogue/command SFT; never load application/user data."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from validate_dataset import parse_json, validate_command


def fingerprint(messages):
    # Current date/timezone in the system message are part of a date task.
    return unicodedata.normalize('NFKC', json.dumps(messages[:-1], ensure_ascii=False, sort_keys=True)).casefold()


def load_conversation_dataset(directory):
    directory = Path(directory)
    manifest = parse_json((directory / 'manifest.json').read_text())
    schema = parse_json((directory / 'command-schema.json').read_text())
    result, ids, prompts, families = {}, set(), set(), {}
    for split in ['train', 'validation', 'test']:
        raw = (directory / (split + '.jsonl')).read_bytes()
        rows = [parse_json(line) for line in raw.decode().splitlines() if line]
        expected = manifest['splits'][split]
        if len(rows) != expected['records'] or hashlib.sha256(raw).hexdigest() != expected['sha256']:
            raise ValueError('Dataset checksum/count mismatch: ' + split)
        for row in rows:
            if row['id'] in ids or row['split'] != split or row['language'] not in ['pl', 'en']:
                raise ValueError('Invalid or duplicate record')
            ids.add(row['id'])
            messages = row['messages']
            roles = ['system'] + ['user' if i % 2 == 0 else 'assistant' for i in range(len(messages)-1)]
            if len(messages) < 3 or len(messages) % 2 != 1 or [m['role'] for m in messages] != roles:
                raise ValueError('Invalid role sequence')
            if any(not isinstance(m['content'], str) or not m['content'].strip() or len(m['content']) > 20000 for m in messages):
                raise ValueError('Invalid content')
            prompt = fingerprint(messages)
            if prompt in prompts:
                raise ValueError('Duplicate conversation: ' + row['id'])
            prompts.add(prompt)
            if row['family'] in families and families[row['family']] != split:
                raise ValueError('Semantic family leakage: ' + row['family'])
            families[row['family']] = split
            if row['output_mode'] == 'command':
                validate_command(parse_json(messages[-1]['content']), schema)
            elif row['output_mode'] != 'text' or messages[-1]['content'].lstrip().startswith('{'):
                raise ValueError('Invalid output mode')
        result[split] = rows
    if sum(map(len, result.values())) != manifest['records']:
        raise ValueError('Manifest total mismatch')
    # Regression fixtures are never loaded as training data. Reject verbatim reuse.
    regression = Path('training/v142/regression.json')
    if regression.exists():
        for row in parse_json(regression.read_text()):
            if fingerprint(row['messages']) in prompts:
                raise ValueError('Independent regression leakage: ' + row['id'])
    return result, schema


def load_training_dataset(config):
    if config.get('dataset_format') == 'conversation-v142':
        return load_conversation_dataset(config['dataset'])
    from validate_dataset import load_dataset
    return load_dataset(config['dataset'])


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', nargs='?', default='training/v142/data')
    args = parser.parse_args()
    data, _ = load_conversation_dataset(args.directory)
    print(json.dumps({split:len(rows) for split, rows in data.items()}, indent=2))

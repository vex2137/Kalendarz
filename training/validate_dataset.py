"""Validate generated JSONL, its contract, checksums and split isolation."""
import argparse
import hashlib
import json
from datetime import date, datetime
from pathlib import Path
import re
from zoneinfo import ZoneInfo

def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: ' + key)
        result[key] = value
    return result

def parse_json(text):
    return json.loads(text, object_pairs_hook=unique_object)

def validate_command(command, schema):
    if not isinstance(command, dict) or set(command) - schema['properties'].keys():
        raise ValueError('Unknown command fields')
    if not set(schema['required']) <= command.keys():
        raise ValueError('Missing required command fields')
    for key, value in command.items():
        rule = schema['properties'][key]
        actual = 'null' if value is None else 'boolean' if isinstance(value, bool) else 'integer' if isinstance(value, int) else 'number' if isinstance(value, float) else 'string' if isinstance(value, str) else 'other'
        types = rule['type'] if isinstance(rule['type'], list) else [rule['type']]
        if actual not in types or ('enum' in rule and value not in rule['enum']):
            raise ValueError('Invalid command field: ' + key)
        if isinstance(value, str):
            if len(value) > 2000 or ('pattern' in rule and not re.fullmatch(rule['pattern'], value)):
                raise ValueError('Invalid string field: ' + key)
            if key in ['date', 'endDate', 'sourceDate']:
                date.fromisoformat(value)
        if actual == 'integer' and not rule.get('minimum', value) <= value <= rule.get('maximum', value):
            raise ValueError('Invalid reminder offset')
    action = command.get('action')
    if action == 'chat' or command.get('reply'):
        raise ValueError('Calendar SFT does not train execution claims')
    if action == 'create' and (not command.get('title') or not command.get('date') or not (command.get('allDay') is True or command.get('time'))):
        raise ValueError('Incomplete creation target')
    if action in ['update', 'delete'] and not command.get('query'):
        raise ValueError('Event identity required')
    if action == 'clarify' and not command.get('question', '').strip():
        raise ValueError('Clarification question required')
    return command

def load_dataset(directory, verify_manifest=True):
    directory = Path(directory)
    schema = parse_json((directory / 'command-schema.json').read_text())
    manifest = parse_json((directory / 'manifest.json').read_text()) if verify_manifest else None
    ids, prompts, families = set(), set(), {}
    result = {}
    for split in ['train', 'validation', 'test']:
        raw = (directory / (split + '.jsonl')).read_bytes()
        records = [parse_json(line) for line in raw.decode('utf-8').splitlines() if line.strip()]
        if not records:
            raise ValueError('Empty split: ' + split)
        if manifest:
            expected = manifest['splits'][split]
            if len(records) != expected['records'] or hashlib.sha256(raw).hexdigest() != expected['sha256']:
                raise ValueError('Dataset checksum/count mismatch: ' + split)
        for row in records:
            if row['id'] in ids or row['split'] != split or row['language'] not in ['pl', 'en'] or not row['category']:
                raise ValueError('Invalid or duplicate record: ' + row['id'])
            ids.add(row['id'])
            instant = datetime.fromisoformat(row['current_time'].replace('Z', '+00:00'))
            if instant.tzinfo is None:
                raise ValueError('Current time must include an offset')
            instant.astimezone(ZoneInfo(row['timezone']))
            messages = row['messages']
            if [m['role'] for m in messages] != ['system', 'user', 'assistant'] or any(not isinstance(m['content'], str) or not m['content'].strip() or len(m['content']) > 20000 for m in messages):
                raise ValueError('Invalid messages: ' + row['id'])
            fingerprint = (row['current_time'], row['timezone'], messages[1]['content'].casefold())
            if fingerprint in prompts:
                raise ValueError('Duplicate prompt: ' + row['id'])
            prompts.add(fingerprint)
            if row['family'] in families and families[row['family']] != split:
                raise ValueError('Family leakage: ' + row['family'])
            families[row['family']] = split
            validate_command(parse_json(messages[-1]['content']), schema)
        result[split] = records
    if manifest and sum(map(len, result.values())) != manifest['records']:
        raise ValueError('Total record count mismatch')
    return result, schema

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', nargs='?', default='training/data')
    args = parser.parse_args()
    data, _ = load_dataset(args.directory)
    print(json.dumps({'validated': sum(map(len, data.values())), 'splits': {k: len(v) for k, v in data.items()}, 'families': len({r['family'] for rows in data.values() for r in rows})}, indent=2))

"""Export a trained PEFT adapter with provenance; never replace application weights."""
import argparse
import json
from pathlib import Path
import shutil

def export_adapter(run, destination):
    run, destination = Path(run), Path(destination)
    source = run / 'adapter'
    for name in ['adapter_config.json', 'adapter_model.safetensors']:
        if not (source / name).is_file():
            raise ValueError('Missing adapter file: ' + name)
    metadata = json.loads((run / 'run-metadata.json').read_text())
    if destination.exists():
        raise ValueError('Export directory already exists; choose a new destination')
    shutil.copytree(source, destination)
    (destination / 'training-provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
    if (run / 'metrics.json').is_file():
        shutil.copyfile(run / 'metrics.json', destination / 'training-metrics.json')
    return destination

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('run')
    parser.add_argument('destination')
    args = parser.parse_args()
    print(export_adapter(args.run, args.destination))

"""Offline plumbing tests. Tiny random weights are NOT a tuned Calendar model."""
import copy
import hashlib
import json
import math
from pathlib import Path
import tempfile
import unittest
from validate_dataset import load_dataset, validate_command
from evaluate import score_predictions
from train import encode_record, train
from export_adapter import export_adapter

class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.schema = load_dataset('training/data')

    def test_validator_and_scorer_reject_bad_outputs(self):
        for patch in [{'action': 'execute'}, {'action': 'create', 'date': '2026-02-30'}, {'action': 'clarify'}, {'action': 'delete'}, {'action': 'create', 'reminderMinutes': True}]:
            with self.assertRaises(ValueError):
                validate_command(patch, self.schema)
        rows = self.data['test'][:2]
        report = score_predictions(rows, [r['messages'][-1]['content'] for r in rows], self.schema)
        self.assertEqual(report['scores']['all']['exact'], 2)
        invalid = score_predictions(rows, ['{', '{"action":"chat","reply":"I saved the event"}'], self.schema)
        self.assertEqual(invalid['scores']['all']['valid_command'], 0)
        self.assertEqual(invalid['calendar_writes'], 0)

    def test_split_leakage_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix='calendar-bad-data-') as directory:
            directory = Path(directory)
            (directory / 'command-schema.json').write_text(json.dumps(self.schema))
            for split, rows in self.data.items():
                row = copy.deepcopy(rows[0]); row['family'] = 'leaked'
                (directory / (split + '.jsonl')).write_text(json.dumps(row) + '\n')
            with self.assertRaisesRegex(ValueError, 'leakage'):
                load_dataset(directory, verify_manifest=False)

    def test_random_qwen_architecture_train_resume_evaluate_and_export(self):
        import torch
        from tokenizers import Tokenizer, models, pre_tokenizers
        from transformers import PreTrainedTokenizerFast, Qwen3_5Config, Qwen3_5ForConditionalGeneration
        torch.set_num_threads(2)
        with tempfile.TemporaryDirectory(prefix='calendar-lora-plumbing-') as directory:
            root = Path(directory); checkpoint = root / 'random-base'; checkpoint.mkdir()
            vocab = {'<unk>': 0, '<pad>': 1, '<eos>': 2, '<|system|>': 3, '<|user|>': 4, '<|assistant|>': 5}
            for rows in self.data.values():
                for row in rows[:2]:
                    for message in row['messages']:
                        for word in message['content'].split():
                            if word not in vocab:
                                vocab[word] = len(vocab)
            raw = Tokenizer(models.WordLevel(vocab, unk_token='<unk>')); raw.pre_tokenizer = pre_tokenizers.WhitespaceSplit()
            tokenizer = PreTrainedTokenizerFast(tokenizer_object=raw, unk_token='<unk>', pad_token='<pad>', eos_token='<eos>', additional_special_tokens=['<|system|>', '<|user|>', '<|assistant|>'])
            tokenizer.chat_template = "{% for m in messages %}{{ '<|' + m['role'] + '|>\\n' + m['content'] + '<eos>\\n' }}{% endfor %}{% if add_generation_prompt %}{{ '<|assistant|>\\n' }}{% endif %}"
            tokenizer.save_pretrained(checkpoint)
            config = Qwen3_5Config(text_config={'vocab_size': len(tokenizer), 'hidden_size': 32, 'intermediate_size': 64, 'num_hidden_layers': 2, 'num_attention_heads': 2, 'num_key_value_heads': 1, 'head_dim': 16, 'layer_types': ['linear_attention', 'full_attention'], 'linear_key_head_dim': 8, 'linear_value_head_dim': 8, 'linear_num_key_heads': 2, 'linear_num_value_heads': 2, 'linear_conv_kernel_dim': 4, 'max_position_embeddings': 2048, 'rope_parameters': {'rope_type': 'default', 'rope_theta': 10000, 'partial_rotary_factor': 1.0, 'mrope_section': [2, 3, 3]}, 'pad_token_id': 1, 'eos_token_id': 2}, vision_config={'depth': 1, 'hidden_size': 16, 'intermediate_size': 32, 'num_heads': 2, 'out_hidden_size': 32, 'num_position_embeddings': 16, 'patch_size': 2, 'spatial_merge_size': 2, 'temporal_patch_size': 1}, image_token_id=len(tokenizer)-1, video_token_id=len(tokenizer)-2, vision_start_token_id=len(tokenizer)-3, vision_end_token_id=len(tokenizer)-4)
            model = Qwen3_5ForConditionalGeneration(config); model.save_pretrained(checkpoint)
            dataset = root / 'data'; dataset.mkdir(); manifest = {'records': 0, 'splits': {}}
            (dataset / 'command-schema.json').write_text(json.dumps(self.schema))
            for split, rows in self.data.items():
                selected = copy.deepcopy(rows[:2])
                for row in selected:
                    row['output_mode'] = 'command'
                # Exercise natural conversation and masked history in the same run.
                selected[1]['output_mode'] = 'text'
                selected[1]['messages'] += [{'role':'user','content':'Explain briefly.'}, {'role':'assistant','content':'Review the proposal before confirming.'}]
                raw_data = '\n'.join(json.dumps(r) for r in selected) + '\n'
                (dataset / (split + '.jsonl')).write_text(raw_data)
                manifest['records'] += len(selected); manifest['splits'][split] = {'records': len(selected), 'sha256': hashlib.sha256(raw_data.encode()).hexdigest()}
            (dataset / 'manifest.json').write_text(json.dumps(manifest))
            encoded = encode_record(tokenizer, self.data['train'][0]['messages'], 2048)
            self.assertEqual(encoded['labels'][0], -100)
            self.assertTrue(any(label != -100 for label in encoded['labels']))
            with self.assertRaisesRegex(ValueError, 'exceeds context'):
                encode_record(tokenizer, self.data['train'][0]['messages'], 4)
            settings = json.loads(Path('training/v142/rtx4060.json').read_text())
            settings.update(model=str(checkpoint), revision=None, dataset=str(dataset), dataset_format='conversation-v142', output_dir=str(root / 'run'), dtype='float32', require_cuda=False, max_steps=1, save_steps=1, eval_steps=1, gradient_accumulation_steps=1, gradient_checkpointing=False)
            trainer = train(settings)
            self.assertEqual(trainer.state.global_step, 1)
            first_metrics = json.loads((root / 'run' / 'metrics.json').read_text())
            self.assertTrue(math.isfinite(first_metrics['validation']['eval_loss']))
            self.assertTrue((root / 'run' / 'checkpoint-1' / 'optimizer.pt').is_file())
            settings['max_steps'] = 2
            trainer = train(settings, resume=str(root / 'run' / 'checkpoint-1'))
            self.assertEqual(trainer.state.global_step, 2)
            changed=copy.deepcopy(settings);changed['seed']=143
            with self.assertRaisesRegex(ValueError,'differs'):
                train(changed,resume=str(root/'run'/'checkpoint-2'))
            output = export_adapter(root / 'run', root / 'export')
            self.assertTrue((output / 'adapter_model.safetensors').is_file())
            from safetensors.torch import load_file
            weights = load_file(output / 'adapter_model.safetensors')
            self.assertTrue(any(tensor.abs().sum() > 0 for name,tensor in weights.items() if 'lora_B' in name))
            provenance = json.loads((output / 'training-provenance.json').read_text())
            self.assertFalse(any('visual' in name for name in provenance['targets']))
            self.assertTrue(any('linear_attn' in name for name in provenance['targets']))
            self.assertTrue(any('.mlp.' in name for name in provenance['targets']))
            trainer.model.eval()
            tokens = torch.tensor([encoded['input_ids'][:12]])
            with torch.inference_mode():
                before = trainer.model(input_ids=tokens).logits
                merged = trainer.model.merge_and_unload(safe_merge=True)
                after = merged(input_ids=tokens).logits
            torch.testing.assert_close(before, after, rtol=1e-4, atol=1e-5)
            with self.assertRaisesRegex(ValueError, 'already exists'):
                export_adapter(root / 'run', root / 'export')

if __name__ == '__main__':
    unittest.main(verbosity=2)

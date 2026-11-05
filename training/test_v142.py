"""Offline guards for data isolation, evaluation integrity and acceptance evidence."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from conversation_dataset import load_conversation_dataset
from evaluate_v142 import report
from compare_v142 import compare
from train import encode_record


class DatasetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.data,cls.schema=load_conversation_dataset('training/v142/data')

    def test_source_balance_and_holdout(self):
        rows=sum(self.data.values(),[])
        self.assertEqual(len(rows),388)
        self.assertEqual(sum(r['language']=='pl' for r in rows),266)
        self.assertEqual(sum(len(r['messages'])>3 for r in rows),24)
        self.assertEqual(len(json.loads(Path('training/v142/regression.json').read_text())),28)
        families={}
        for split,items in self.data.items():
            for row in items:
                self.assertEqual(families.setdefault(row['family'],split),split)

    def test_final_response_only_masking_and_no_truncation(self):
        class Tokenizer:
            def apply_chat_template(self,messages,tokenize,add_generation_prompt,**options):
                text=''.join(m['role']+':'+m['content']+'\n' for m in messages)
                if add_generation_prompt:text+='assistant:'
                return list(text.encode())
        row=next(r for r in self.data['train'] if len(r['messages'])>3)
        encoded=encode_record(Tokenizer(),row['messages'],20000)
        boundary=next(i for i,x in enumerate(encoded['labels']) if x!=-100)
        self.assertGreater(boundary,len(row['messages'][1]['content']))
        self.assertEqual(bytes(encoded['labels'][boundary:]).decode(),row['messages'][-1]['content']+'\n')
        with self.assertRaisesRegex(ValueError,'exceeds context'):
            encode_record(Tokenizer(),row['messages'],10)

    def test_manifest_tampering_and_semantic_leakage(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for f in Path('training/v142/data').glob('*'): (root/f.name).write_bytes(f.read_bytes())
            manifest=json.loads((root/'manifest.json').read_text())
            rows=[json.loads(line) for line in (root/'validation.jsonl').read_text().splitlines()]
            rows[0]['family']=self.data['train'][0]['family']
            raw=''.join(json.dumps(r)+'\n' for r in rows).encode()
            (root/'validation.jsonl').write_bytes(raw)
            with self.assertRaisesRegex(ValueError,'checksum'):load_conversation_dataset(root)
            manifest['splits']['validation']['sha256']=hashlib.sha256(raw).hexdigest()
            (root/'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'leakage'):load_conversation_dataset(root)

    def test_evaluation_never_calls_reference_match_text_quality(self):
        rows=self.data['test']
        results=[{'id':r['id'],'prediction':r['messages'][-1]['content']} for r in rows]
        scored=report(rows,results,self.schema)
        self.assertTrue(scored['text_review'])
        self.assertFalse(scored['quality_review_complete'])
        self.assertEqual(scored['calendar_writes'],0)
        with self.assertRaisesRegex(ValueError,'IDs'):report(rows,results[::-1],self.schema)
        scored.update(corpus_sha256='fixture',revision='fixture',backend='fixture',config={})
        comparison=compare(scored,copy.deepcopy(scored))
        self.assertFalse(comparison['accepted_for_device_testing'])
        self.assertTrue(any('review' in v for v in comparison['acceptance_failures']))
        changed=copy.deepcopy(scored);changed['corpus_sha256']='other'
        with self.assertRaisesRegex(ValueError,'differ'):compare(scored,changed)


if __name__=='__main__':unittest.main()

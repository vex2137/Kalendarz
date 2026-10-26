"""Compare paired held-out results. Missing review/device evidence prevents acceptance."""
import argparse
import json
import statistics
from pathlib import Path


def compare(base,tuned):
    if base['corpus_sha256']!=tuned['corpus_sha256'] or base['revision']!=tuned['revision'] or base['backend']!=tuned['backend'] or base['config']!=tuned['config']:
        raise ValueError('Evaluation corpus, model revision, settings or backend differ')
    if [r['id'] for r in base['measurements']]!=[r['id'] for r in tuned['measurements']]:
        raise ValueError('Paired record IDs differ')
    rows=[]; failures=[]
    for category,b in base['command_scores'].items():
        t=tuned['command_scores'][category]
        if b['records']!=t['records']: raise ValueError('Category counts differ')
        before=b['exact']/b['records']; after=t['exact']/t['records']
        rows.append({'category':category,'n':b['records'],'base_exact':before,'tuned_exact':after,'delta':after-before})
        if after<before-.02: failures.append('Command regression: '+category)
    # Natural language needs explicit human review, not exact-reference matching.
    for tag,data in [('base',base),('tuned',tuned)]:
        for row in data['text_review']:
            review=row.get('review',{})
            if set(review)!=set(row['review_required']) or any(type(v) is not bool for v in review.values()):
                failures.append('Missing complete human review: '+tag);break
    reviewed=[]
    for language in ['pl','en']:
        sets=[[r for r in data['text_review'] if r['language']==language] for data in [base,tuned]]
        rates=[sum(all(r.get('review',{}).get(k) is True for k in r['review_required']) for r in rows)/len(rows) if rows else None for rows in sets]
        reviewed.append({'language':language,'base':rates[0],'tuned':rates[1]})
        if rates[0] is None or rates[1] is None: failures.append('No text review samples: '+language)
        elif rates[1]<rates[0]-.02: failures.append('Text regression: '+language)
        if language=='pl' and rates[0] is not None and rates[1]<rates[0]+.05:
            failures.append('Polish improvement below 5 percentage points')
    hardware=[data.get('hardware') for data in [base,tuned]]
    if not all(hardware): failures.append('Missing measured hardware evidence')
    elif any(hardware[0].get(k)!=hardware[1].get(k) for k in ['platform','device','gpu','cpu','threads','chat_template_sha256','versions']):
        failures.append('Hardware/template conditions differ')
    speeds=[]
    for data in [base,tuned]:
        values=[r.get('decode_tokens_per_second') for r in data['measurements'] if r.get('sample')=='warm' and r.get('decode_tokens_per_second')]
        speeds.append(statistics.median(values) if values else None)
    if not all(speeds): failures.append('Missing warm inference timings')
    elif speeds[1]<speeds[0]*.9: failures.append('Decode speed regression above 10%')
    if all(hardware):
        for key in ['peak_rss_bytes','peak_cuda_allocated_bytes']:
            values=[h.get(key) for h in hardware]
            if all(values) and values[1]>values[0]*1.15: failures.append('Memory regression above 15%: '+key)
    return {'commands':rows,'human_review':reviewed,'median_warm_decode_tps':speeds,'acceptance_failures':failures,
            'accepted_for_device_testing':not failures,'android_verified':False,
            'note':'Small held-out samples have uncertainty. Thresholds are experiment gates, not proof of statistical significance.'}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('base');parser.add_argument('tuned');parser.add_argument('--output',required=True)
    args=parser.parse_args()
    result=compare(json.loads(Path(args.base).read_text()),json.loads(Path(args.tuned).read_text()))
    Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))

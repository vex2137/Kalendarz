import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {generateRecords} from '../generate';
import {ASSISTANT_SCHEMA,assistantSystemPrompt,parseModelCommand} from '../../src/utils/modelCommand';
import {naturalChatSystemPrompt} from '../../src/utils/assistantPrompts';
import {CURATED} from './curated';
// Reused calendar paraphrases remain in their original semantic family/split.
const related:Record<string,string>={
 'week-offset':'relative-offset','next-friday':'weekday-next',
 'tomorrow-reminder':'reminder-offset','after-tomorrow-range':'relative-days',
 'missing-title-dialogue':'missing-title','missing-time-dialogue':'missing-time',
 'ambiguous-clock':'ambiguous-clock','casual-command':'relative-days',
 'destructive-ambiguous':'missing-reference','typo-date-clarify':'uncertain-date-typo',
};
const previous=process.env.TZ;
try {
 const directory=resolve(process.argv[2]||'training/v142/data');
 const legacy=generateRecords();
 const records:any[]=legacy.filter(r=>r.language==='pl'||r.id.endsWith('-0')).map(r=>({...r,output_mode:'command',source:'1.4.1-synthetic',review:'schema-and-source-reviewed'}));
 process.env.TZ='Europe/Warsaw';
 const current_time='2026-10-26T09:00:00Z',timezone='Europe/Warsaw';
 for(const [i,entry] of CURATED.entries())for(const language of ['pl','en'] as const){
  const family=related[entry.family]||'dialogue-'+entry.family;
  const split=legacy.find(r=>r.family===family)?.split || (i%10===7?'validation':i%10>=8?'test':'train');
  const target=language==='pl'?entry.targetPl:(entry.targetEn??entry.targetPl);
  const content=typeof target==='string'?target:JSON.stringify(target);
  if(entry.mode==='command')parseModelCommand(content);
  records.push({id:`v142-${entry.family}-${language}`,family,split,category:entry.category,language,current_time,timezone,output_mode:entry.mode,source:'v142-curated-synthetic',review:'schema-and-source-reviewed',messages:[
   {role:'system',content:entry.mode==='text'?naturalChatSystemPrompt(language):assistantSystemPrompt(language,new Date(current_time))},
   ...entry[language].map((content,index)=>({role:index%2===0?'user':'assistant',content})),{role:'assistant',content},
  ]});
 }
 await mkdir(directory,{recursive:true});
 const manifest:any={version:'1.4.2-seed-1',records:records.length,synthetic:true,privateData:false,review:'Source review and automated checks; independent linguistic review and model validation pending.',splits:{},languages:{},categories:{},output_modes:{}};
 for(const split of ['train','validation','test']){
  const rows=records.filter(r=>r.split===split),raw=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';
  await writeFile(resolve(directory,split+'.jsonl'),raw);
  manifest.splits[split]={records:rows.length,sha256:createHash('sha256').update(raw).digest('hex')};
 }
 for(const [field,key] of [['language','languages'],['category','categories'],['output_mode','output_modes']])for(const row of records)manifest[key][row[field]]=(manifest[key][row[field]]||0)+1;
 manifest.families=new Set(records.map(r=>r.family)).size;
 manifest.multiturn=records.filter(r=>r.messages.length>3).length;
 manifest.sources={};
 for(const file of ['training/scenarios.ts','training/v142/curated.ts','training/v142/generate.ts','src/utils/modelCommand.ts','src/utils/assistantPrompts.ts'])manifest.sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
 await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile(resolve(directory,'command-schema.json'),JSON.stringify(ASSISTANT_SCHEMA,null,2)+'\n');
 console.log(JSON.stringify(manifest,null,2));
} finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}

import { parseModelCommand } from '../src/utils/modelCommand';
export interface SFTRecord{
  id:string;family:string;category:string;language:'pl'|'en';split:'train'|'validation'|'test';current_time:string;timezone:string;
  messages:{role:'system'|'user'|'assistant';content:string}[];
}
export function validateRecords(records:SFTRecord[]){
  const ids=new Set<string>(),messages=new Set<string>(),families=new Map<string,string>();
  for(const row of records){
    if(!row.id||ids.has(row.id))throw Error('Duplicate record id');ids.add(row.id);
    if(!['pl','en'].includes(row.language)||!['train','validation','test'].includes(row.split)||!row.family||!row.category)throw Error('Invalid record metadata');
    if(!Number.isFinite(Date.parse(row.current_time))||!/(?:Z|[+-]\d\d:\d\d)$/.test(row.current_time))throw Error('Invalid current time');
    new Intl.DateTimeFormat('en',{timeZone:row.timezone}).format(new Date(row.current_time));
    if(row.messages.length!==3||row.messages.map(m=>m.role).join(',')!=='system,user,assistant'||row.messages.some(m=>typeof m.content!=='string'||!m.content.trim()||m.content.length>20000))throw Error('Invalid messages');
    const fingerprint=row.current_time+'|'+row.timezone+'|'+row.messages[1].content.toLocaleLowerCase();if(messages.has(fingerprint))throw Error('Duplicate prompt');messages.add(fingerprint);
    if(families.has(row.family)&&families.get(row.family)!==row.split)throw Error('Family leakage across splits');families.set(row.family,row.split);
    const target=parseModelCommand(row.messages[2].content);
    if(target.action==='chat'||target.reply)throw Error('SFT calendar targets must not claim an operation succeeded');
    if(target.action==='create'&&(!target.title||!target.date||(!target.allDay&&!target.time)))throw Error('Incomplete create target');
    if(['update','delete'].includes(target.action)&&!target.query)throw Error('Missing event identity');
    if(target.action==='clarify'&&!target.question?.trim())throw Error('Missing clarification');
  }
  return {records:records.length,families:families.size};
}

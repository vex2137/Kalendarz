import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { SCENARIOS,scenarioGroup } from './scenarios';
import { ASSISTANT_SCHEMA,calendarSystemPrompt,parseModelCommand } from '../src/utils/modelCommand';
import { addDays,localDate,timeString,minutes } from '../src/utils/dates';
import { validateRecords,type SFTRecord } from './validate';

const questions={
  pl:{recurrenceQuestion:'Wybierz regułę powtarzania w edytorze wydarzenia; jaki dzień i godzina rozpoczęcia?',reminderQuestion:'Ile minut przed wydarzeniem mam przypomnieć?',timeQuestion:'O której godzinie ma być wydarzenie, czy ma trwać cały dzień?',dateQuestion:'Jaka jest data wydarzenia?',titleQuestion:'Jaki tytuł ma mieć wydarzenie?',eventQuestion:'Podaj tytuł i pierwotną datę wydarzenia.',dateTimeQuestion:'Podaj dokładną datę i godzinę wydarzenia.',validDateQuestion:'Ta data nie istnieje. Podaj poprawną datę.',validTimeQuestion:'Ta godzina jest niepoprawna. Podaj godzinę od 00:00 do 23:59.',noChangeQuestion:'Nie przygotowuję usunięcia. Jak mogę pomóc?',hypotheticalQuestion:'Czy chcesz przygotować propozycję wydarzenia, czy tylko omówić pomysł?',safeDeleteQuestion:'Podaj jedno wydarzenie do usunięcia. Usunięcie wymaga potwierdzenia.',multiQuestion:'Zacznijmy od jednego polecenia. Jaką zmianę mam przygotować i na kiedy?',unsupportedQuestion:'Nie wysyłam wiadomości. Podaj nową datę lub godzinę wydarzenia.',intentQuestion:'Czy chcesz usunąć to wydarzenie? Nic nie zostało zmienione.'},
  en:{recurrenceQuestion:'Choose a recurrence rule in the event editor; what is the starting date and time?',reminderQuestion:'How many minutes before the event should the reminder be?',timeQuestion:'What time should the event start, or is it all day?',dateQuestion:'What is the event date?',titleQuestion:'What is the event title?',eventQuestion:'Specify the event title and original date.',dateTimeQuestion:'Specify the exact event date and time.',validDateQuestion:'That date does not exist. Specify a valid date.',validTimeQuestion:'That time is invalid. Specify a time from 00:00 to 23:59.',noChangeQuestion:'I am not preparing a deletion. How can I help?',hypotheticalQuestion:'Would you like an event proposal or just to discuss the idea?',safeDeleteQuestion:'Specify one event to delete. Deletion requires confirmation.',multiQuestion:'Let us start with one command. What change should I prepare and for when?',unsupportedQuestion:'I cannot send messages. Specify the new event date or time.',intentQuestion:'Do you want to delete this event? Nothing has been changed.'},
};
const contexts=[
  {current_time:'2026-12-31T22:30:00Z',timezone:'Europe/Warsaw',title:'Projekt Atlas',newTitle:'Przegląd Atlas',time:'09:30'},
  {current_time:'2028-02-28T23:30:00Z',timezone:'America/New_York',title:'Badanie Orion',newTitle:'Kontrola Orion',time:'15:05'},
  {current_time:'2026-10-24T22:30:00Z',timezone:'Europe/Warsaw',title:'Review Vega',newTitle:'Planning Vega',time:'23:15'},
];
export function generateRecords():SFTRecord[]{
  const previous=process.env.TZ,records:SFTRecord[]=[];
  try{for(const scenario of SCENARIOS)for(const [index,context] of contexts.entries())for(const language of ['pl','en'] as const){
    process.env.TZ=context.timezone;const now=new Date(context.current_time),today=localDate(now);
    const variables:Record<string,string>={...questions[language],...context,today,tomorrow:addDays(today,1),dayAfter:addDays(today,2),in3:addDays(today,3),in14:addDays(today,14),date:addDays(today,7),sourceDate:addDays(today,2),end:timeString(minutes(context.time)+45)};
    const fill=(text:string)=>text.replace(/\{(\w+)\}/g,(_,key)=>{if(!(key in variables))throw Error('Unknown template variable: '+key);return variables[key];});
    const target=Object.fromEntries(Object.entries(scenario.command).map(([key,value])=>[key,typeof value==='string'?fill(value):value]));
    parseModelCommand(JSON.stringify(target));
    const {family,split}=scenarioGroup(scenario);
    records.push({id:`${scenario.family}-${language}-${index}`,family,category:scenario.category,language,split,current_time:context.current_time,timezone:context.timezone,messages:[{role:'system',content:calendarSystemPrompt(language,now)},{role:'user',content:fill(scenario[language])},{role:'assistant',content:JSON.stringify(target)}]});
  }}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
  validateRecords(records);return records;
}
export async function writeDataset(directory:string){
  const records=generateRecords();await mkdir(directory,{recursive:true});
  const report:Record<string,unknown>={version:1,synthetic:true,records:records.length,families:new Set(records.map(r=>r.family)).size,sourceTemplates:SCENARIOS.length,privateData:false,splits:{},categories:{}};
  for(const split of ['train','validation','test']){
    const selected=records.filter(r=>r.split===split),data=selected.map(r=>JSON.stringify(r)).join('\n')+'\n';await writeFile(resolve(directory,split+'.jsonl'),data);
    (report.splits as Record<string,unknown>)[split]={records:selected.length,sha256:createHash('sha256').update(data).digest('hex')};
  }
  for(const category of new Set(records.map(r=>r.category)))(report.categories as Record<string,number>)[category]=records.filter(r=>r.category===category).length;
  await writeFile(resolve(directory,'command-schema.json'),JSON.stringify(ASSISTANT_SCHEMA,null,2)+'\n');
  await writeFile(resolve(directory,'manifest.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))console.log(JSON.stringify(await writeDataset(resolve(process.argv[2]||'training/data')),null,2));

import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_MODELS,DEFAULT_MODEL,OPTIONAL_FALLBACK,registerImportedModel,persistModelSelection,activeModel,modelChoices} from '../src/utils/modelRegistry';
import {naturalChatSystemPrompt} from '../src/utils/assistantPrompts';
import {createChat,saveChat,chatMessages,getChat} from '../src/utils/chatHistory';
const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,String(v))}});
test('a separately imported tuned variant preserves original choices and conversation',async()=>{
 const original=DEFAULT_MODEL.id;
 assert.ok(AI_MODELS.some(m=>m.id===original));assert.equal(OPTIONAL_FALLBACK.id,'lfm2.5-350m-q4-k-m');
 assert.ok(!AI_MODELS.some(m=>m.id.includes('finetuned')),'No nonexistent weights or download URLs');
 // Synthetic descriptor exercises identity/storage only; it is not inference evidence.
 const checksum='a'.repeat(64);
 const variant={...DEFAULT_MODEL,id:'imported-'+checksum,sha256:checksum,name:'Calendar Qwen3.5 0.8B FT test',url:'',bytes:128,bundled:false,imported:true};
 const chat=await createChat('Model switch',original);
 const messages=[{id:'switch-user',role:'user' as const,content:'Zachowaj tę rozmowę.',timestamp:1}];
 await saveChat(chat.id,messages,{},original);
 registerImportedModel(variant);persistModelSelection(variant);
 assert.equal(activeModel().id,variant.id);assert.ok(modelChoices().some(m=>m.id===original));
 await saveChat(chat.id,[],{},variant.id);
 assert.equal((await chatMessages(chat.id))[0].content,messages[0].content);
 assert.equal((await getChat(chat.id))?.selectedModelId,variant.id);
 persistModelSelection(OPTIONAL_FALLBACK);assert.equal(activeModel().id,OPTIONAL_FALLBACK.id);
});
test('shared conversation prompt retains current-language and confirmation requirements',()=>{
 assert.match(naturalChatSystemPrompt('pl'),/user's actual language/);
 assert.match(naturalChatSystemPrompt('en',{kind:'create',title:'Test'}),/only last confirmed calendar action.*Test/);
});

// Keep conversational output short on mobile CPUs. Explicit benchmark limits win.
export function completionTokenLimit(modelId:string,prompt:string,structured:boolean,override?:number) {
  return override ?? (!structured ? 96 : modelId==='lfm2.5-2.6b-q4-k-m' ? 768 : /opis|description|описан|beschreib/iu.test(prompt) ? 384 : 256);
}

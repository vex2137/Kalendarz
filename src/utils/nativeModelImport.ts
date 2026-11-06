import { Capacitor, registerPlugin } from '@capacitor/core';
export interface NativeModelFile { token: string; name: string; bytes: number; cancelled?: boolean }
const importer = registerPlugin<{
  pick: () => Promise<NativeModelFile>;
  open: (options: { token: string; bytes: number }) => Promise<void>;
  read: (options: { token: string }) => Promise<{data:string;done:boolean;received:number}>;
  close: (options: { token: string }) => Promise<void>;
  release: (options: { token: string }) => Promise<void>;
}>('CalendarModelImport');
export const pickNativeModel = () => importer.pick();
export const releaseNativeModel = (token: string) => importer.release({ token });
export function nativeModelUrl(token: string) {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error('model-import-file');
  return new URL(`/_calendar_model_import/${token}`, location.origin).href;
}

// A request interceptor can return 404 before ContentResolver is reached (or
// lose a transient token during Activity replacement). Read through the plugin
// directly, one bounded chunk at a time; OPFS keeps the same transactional path.
export async function nativeModelResponse(url:string, signal:AbortSignal, bytes=-1):Promise<Response|undefined> {
  const source=new URL(url,location.origin);
  if(Capacitor.getPlatform()!=='android'||source.origin!==location.origin||!/^\/_calendar_model_import\/[a-f0-9-]{36}$/.test(source.pathname))return;
  const token=source.pathname.slice(source.pathname.lastIndexOf('/')+1);
  signal.throwIfAborted();
  const close=()=>importer.close({token}).catch(()=>{});
  const abort=()=>{void close();};
  signal.addEventListener('abort',abort,{once:true});
  let finished=false;
  const finish=async()=>{if(!finished){finished=true;signal.removeEventListener('abort',abort);await close();}};
  try {
    await importer.open({token,bytes});
    signal.throwIfAborted();
    return new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          signal.throwIfAborted();
          const chunk=await importer.read({token});
          signal.throwIfAborted();
          if(chunk.done){await finish();controller.close();return;}
          if(!chunk.data||chunk.data.length>Math.ceil(256*1024/3)*4)throw Error('model-import-read');
          const binary=atob(chunk.data),data=new Uint8Array(binary.length);
          for(let i=0;i<binary.length;i++)data[i]=binary.charCodeAt(i);
          controller.enqueue(data);
        } catch(error) {await finish();controller.error(error);}
      },
      async cancel(){await finish();},
    },{highWaterMark:0}),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});
  } catch(error) {await finish();throw error;}
}

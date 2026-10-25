import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AppLanguage } from '../utils/i18n';
import { desktopAI, type ModelFolderSnapshot } from '../utils/nativeDesktopAI';
import { DEFAULT_MODEL, registerExternalModels } from '../utils/modelRegistry';
import { modelStatus, selectLocalModel, subscribeModel, unloadLocalModel } from '../utils/localModelRuntime';
import { modelErrorText } from '../utils/aiSettingsText';

const copy={
  en:{title:'GGUF model folders',add:'Add folder',refresh:'Refresh folders',remove:'Remove folder',select:'Use model',empty:'No GGUF models found.',hint:'Files stay in their original folders, including LM Studio folders. Removing a folder only removes its registration. Local models require native llama.cpp; compatibility depends on their architecture and chat template.',scan:'Scanning folders…',warning:'Some files or folders could not be read. Check access permissions and refresh.',changed:'A model moved or changed. Refresh its folder before loading.',limit:'Scan limit reached. Choose a more specific folder.',config:'Cannot read the folder configuration. The existing file was preserved.'},
  pl:{title:'Foldery modeli GGUF',add:'Dodaj folder',refresh:'Odśwież foldery',remove:'Usuń folder z listy',select:'Użyj modelu',empty:'Nie znaleziono modeli GGUF.',hint:'Pliki pozostają w swoich folderach, także w folderach LM Studio. Usunięcie folderu usuwa tylko wpis z listy. Modele lokalne wymagają natywnego llama.cpp; zgodność zależy od architektury i szablonu rozmowy.',scan:'Skanowanie folderów…',warning:'Nie można odczytać części plików lub folderów. Sprawdź uprawnienia i odśwież.',changed:'Model przeniesiono lub zmieniono. Odśwież folder przed uruchomieniem.',limit:'Osiągnięto limit skanowania. Wybierz bardziej szczegółowy folder.',config:'Nie można odczytać konfiguracji folderów. Istniejący plik został zachowany.'},
  de:{title:'GGUF-Modellordner',add:'Ordner hinzufügen',refresh:'Ordner aktualisieren',remove:'Ordner austragen',select:'Modell verwenden',empty:'Keine GGUF-Modelle gefunden.',hint:'Dateien bleiben in ihren Ordnern, auch bei LM Studio. Austragen entfernt nur den Listeneintrag. Lokale Modelle erfordern natives llama.cpp; Kompatibilität hängt von Architektur und Chatvorlage ab.',scan:'Ordner werden durchsucht…',warning:'Einige Dateien oder Ordner sind nicht lesbar. Zugriffsrechte prüfen und aktualisieren.',changed:'Modell verschoben oder geändert. Ordner vor dem Laden aktualisieren.',limit:'Scanlimit erreicht. Einen kleineren Ordner wählen.',config:'Ordnerkonfiguration nicht lesbar. Bestehende Datei wurde erhalten.'},
  ru:{title:'Папки моделей GGUF',add:'Добавить папку',refresh:'Обновить папки',remove:'Убрать папку из списка',select:'Использовать модель',empty:'Модели GGUF не найдены.',hint:'Файлы остаются в своих папках, включая папки LM Studio. Удаляется только запись о папке. Требуется нативный llama.cpp; совместимость зависит от архитектуры и шаблона чата.',scan:'Сканирование папок…',warning:'Некоторые файлы или папки недоступны. Проверьте права и обновите список.',changed:'Модель перемещена или изменена. Обновите папку перед загрузкой.',limit:'Достигнут предел сканирования. Выберите меньшую папку.',config:'Не удалось прочитать настройки папок. Существующий файл сохранён.'},
};
export function ModelFoldersPanel({language,busy}:{language:AppLanguage;busy:boolean}){
  const bridge=desktopAI()?.platform==='android'?undefined:desktopAI(),text=copy[language],status=useSyncExternalStore(subscribeModel,modelStatus);
  const [snapshot,setSnapshot]=useState<ModelFolderSnapshot>(),[working,setWorking]=useState(false),[error,setError]=useState<string>();
  const accept=async(next:ModelFolderSnapshot)=>{
    registerExternalModels(next.models);setSnapshot(next);
    const selected=modelStatus().modelId;
    if(selected.startsWith('external-')&&!next.models.some(m=>m.id===selected))await selectLocalModel(DEFAULT_MODEL.id);
  };
  useEffect(()=>{if(bridge)void bridge.folders().then(accept).catch(e=>setError(e.message));},[bridge]);
  if(!bridge)return null;
  const perform=async(action:()=>Promise<ModelFolderSnapshot>)=>{
    setWorking(true);setError(undefined);
    try{await unloadLocalModel();await accept(await action());}catch(e){setError(e instanceof Error?e.message:'model-folder-read');}finally{setWorking(false);}
  };
  const incompatible={en:'This GGUF is invalid, multipart or has unsupported metadata. Choose a complete compatible single-file model.',pl:'Ten GGUF jest uszkodzony, podzielony na części lub ma nieobsługiwane metadane. Wybierz kompletny, zgodny model w jednym pliku.',de:'GGUF ungültig, mehrteilig oder mit nicht unterstützten Metadaten. Ein vollständiges kompatibles Einzeldatei-Modell wählen.',ru:'GGUF повреждён, разбит на части или имеет неподдерживаемые метаданные. Выберите совместимую модель в одном полном файле.'}[language];
  const message=(code:string)=>code.startsWith('model-gguf')?incompatible:code==='model-folder-limit'?text.limit:code==='model-folder-config'?text.config:code==='model-folder-changed'?text.changed:text.warning;
  return <section className="theme-border border rounded-xl p-3 space-y-3 text-xs" data-testid="model-folders">
    <h4 className="font-semibold">{text.title}</h4><p className="theme-muted">{text.hint}</p>
    <div className="flex gap-2"><button type="button" className="ai-action rounded-lg p-2 min-h-11" disabled={busy||working} onClick={()=>void perform(()=>bridge.addFolder())}>{text.add}</button><button type="button" className="ai-action rounded-lg p-2 min-h-11" disabled={busy||working} onClick={()=>void perform(()=>bridge.refreshFolders())}>{text.refresh}</button></div>
    {working&&<p role="status">{text.scan}</p>}
    {snapshot?.folders.map(folder=><div key={folder.id} className="theme-border border rounded-lg p-2 flex items-center gap-2"><span className="break-all flex-1">{folder.path}</span><button type="button" className="ai-action p-2 rounded-lg min-h-11" disabled={busy||working} aria-label={`${text.remove}: ${folder.path}`} onClick={()=>void perform(()=>bridge.removeFolder(folder.id))}>{text.remove}</button></div>)}
    {snapshot?.models.map(model=><div key={model.id} data-external-model-id={model.id} className="theme-border border rounded-lg p-2 flex gap-2 items-center"><div className="flex-1 min-w-0"><p className="break-words font-semibold">{model.name}</p><p className="theme-muted">{model.architecture} · {(model.bytes/1_000_000).toFixed(1)} MB · GGUF</p></div><button type="button" className="ai-action p-2 rounded-lg min-h-11" disabled={busy||working||status.modelId===model.id} onClick={()=>{setError(undefined);void selectLocalModel(model.id).catch(e=>setError(e.message));}}>{status.modelId===model.id?'✓':text.select}</button></div>)}
    {snapshot&&!snapshot.models.length&&<p>{text.empty}</p>}
    {snapshot?.warnings.map((warning,index)=><p key={index} role="status" className="theme-muted">{message(warning.code)} {warning.file}</p>)}
    {error&&<p role="alert">{error.startsWith('model-folder')?message(error):modelErrorText(error,language)}</p>}
  </section>;
}

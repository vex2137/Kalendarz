import {useEffect,useSyncExternalStore} from 'react';
import type {AppLanguage} from '../utils/i18n';
import {gpuDiagnosticsAvailable,gpuDiagnosticsSnapshot,subscribeGpuDiagnostics,runGpuDiagnostic,vulkanInferenceState} from '../utils/androidGpuDiagnostics';
import {backendStatus,subscribeBackend} from '../utils/nativeDesktopAI';
const labels={
 en:['GPU hardware / Vulkan','Inference backend','Vulkan Compute test','Test Vulkan Compute','Refresh GPU discovery','GPU detected — the Vulkan inference backend is not installed yet.','Unknown','No hardware GPU confirmed. See the discovery status.','Compute verified','Not run','Shared Vulkan heaps/budgets are not confirmed dedicated VRAM.','This tests 64 integer additions; it does not enable GGUF inference on the GPU.'],
 pl:['Sprzęt GPU / Vulkan','Backend inferencji','Test Vulkan Compute','Przetestuj Vulkan Compute','Odśwież wykrywanie GPU','GPU wykryte — backend inferencji Vulkan nie jest jeszcze zainstalowany.','Nieznane','Nie potwierdzono sprzętowego GPU. Sprawdź status wykrywania.','Wynik Compute zweryfikowany','Nie uruchomiono','Współdzielone sterty i budżety Vulkan nie oznaczają potwierdzonego, dedykowanego VRAM.','Test obejmuje 64 dodawania liczb całkowitych; nie włącza inferencji GGUF na GPU.'],
 de:['GPU-Hardware / Vulkan','Inferenz-Backend','Vulkan-Compute-Test','Vulkan Compute testen','GPU-Erkennung aktualisieren','GPU erkannt — das Vulkan-Inferenz-Backend ist noch nicht installiert.','Unbekannt','Keine Hardware-GPU bestätigt. Erkennungsstatus prüfen.','Compute-Ergebnis verifiziert','Nicht ausgeführt','Gemeinsame Vulkan-Heaps/Budgets sind kein bestätigter dedizierter VRAM.','Testet 64 Ganzzahladditionen; aktiviert keine GGUF-Inferenz auf der GPU.'],
 ru:['Оборудование GPU / Vulkan','Бэкенд инференса','Тест Vulkan Compute','Проверить Vulkan Compute','Обновить обнаружение GPU','GPU обнаружен — бэкенд инференса Vulkan ещё не установлен.','Неизвестно','Аппаратный GPU не подтверждён. См. статус обнаружения.','Результат Compute проверен','Не запускался','Общие кучи/бюджеты Vulkan не означают выделенную VRAM.','Проверяются 64 сложения целых чисел; инференс GGUF на GPU не включается.']
};
export function AndroidGpuDiagnostics({language}:{language:AppLanguage}){
 const report=useSyncExternalStore(subscribeGpuDiagnostics,gpuDiagnosticsSnapshot);
 const backend=useSyncExternalStore(subscribeBackend,backendStatus),text=labels[language];
 const available=gpuDiagnosticsAvailable();
 useEffect(()=>{if(available&&!gpuDiagnosticsSnapshot().discovery)void runGpuDiagnostic();},[available]);
 if(!available)return null;
 const d=report.discovery,c=report.computeTest,device=d?.physicalDevices?.find(d=>['integrated','discrete','virtual'].includes(d.deviceType))||d?.selectedDevice||d?.physicalDevices?.[0];
 const vendor=(id?:number)=>id===undefined?text[6]:({[0x5143]:'Qualcomm',[0x13b5]:'Arm',[0x10de]:'NVIDIA',[0x1002]:'AMD',[0x8086]:'Intel',[0x1010]:'Imagination',[0x144d]:'Samsung'}[id]||text[6])+` (0x${id.toString(16)})`;
 return <section data-testid="android-gpu-diagnostics" className="mt-3 space-y-3 theme-border border rounded-xl p-3 break-words">
  <h4 className="font-semibold">{text[0]}</h4>
  <p>{device?.deviceName||text[6]} · {vendor(device?.vendorID)} · {device?.deviceType||text[6]}</p>
  <p>Vulkan API: {device?.apiVersion||text[6]} · Loader API: {d?.loader?.apiVersion||text[6]}</p>
  <p>Driver: {device?.driverProperties?.driverName||text[6]} · {device?.driverProperties?.driverInfo||text[6]} · raw: {device?.driverVersionRaw??text[6]}</p>
  <p>Compute queue: {device?String(device.computeQueueAvailable):text[6]} · {d?.stage||text[9]} {d?.errorCode} {d?.vkResult!==undefined?`VkResult: ${d.vkResult}`:''}</p>
  <p className="theme-muted">{text[10]}</p>
  <button type="button" data-testid="gpu-discover" disabled={Boolean(report.pending)} className="theme-border border rounded p-2 disabled:opacity-50" onClick={()=>void runGpuDiagnostic()}>{text[4]}</button>
  <h4 className="font-semibold">{text[1]}</h4>
  <p data-testid="gpu-backend-separation">{vulkanInferenceState(d,backend.packagedBackends)==='gpu-backend-not-packaged'?text[5]:device?.softwareDevice?`${device.deviceName} (${device.deviceType})`:d?.hardwareGpuDetected?device?.deviceName:text[7]}</p>
  <p>Packaged: {backend.packagedBackends?.join(', ')||text[6]} · Available: {backend.availableBackends?.join(', ')||'—'}</p>
  <p>Active: {backend.backend} · Mode: {backend.mode} · Offload: {backend.offloadedLayers??0} · {backend.errorCode||backend.fallbackReason}</p>
  <h4 className="font-semibold">{text[2]}</h4><p className="theme-muted">{text[11]}</p>
  <button type="button" data-testid="gpu-compute-test" disabled={Boolean(report.pending)} className="theme-border border rounded p-2 disabled:opacity-50" onClick={()=>void runGpuDiagnostic(true)}>{report.pending==='compute'?'…':text[3]}</button>
  <p role="status" data-testid="gpu-compute-status">{report.pending==='compute'?({pl:'Test w toku…',en:'Test running…',de:'Test läuft…',ru:'Тест выполняется…'})[language]:c?(c.success&&c.compute?.verified?text[8]:`${c.stage} · ${c.errorCode} · VkResult: ${c.vkResult??'—'}`):text[9]} {c?`${Math.round(c.durationMs??c.processDurationMs??0)} ms`:''}</p>
  {c?.selectedDevice && <p data-testid="gpu-compute-device">{c.selectedDevice.deviceName} · {c.selectedDevice.deviceType} {c.selectedDevice.softwareDevice?({pl:'Programowy Vulkan — nie potwierdza sprzętowego GPU.',en:'Software Vulkan — not evidence of hardware GPU compute.',de:'Software-Vulkan — kein Nachweis einer Hardware-GPU.',ru:'Программный Vulkan — аппаратный GPU не подтверждён.'})[language]:''}</p>}
  <p className="theme-muted">Probe: {d?.probeVersion||c?.probeVersion||text[6]} · llama.cpp: {backend.nativeRuntime?.version||text[6]}</p>
 </section>;
}

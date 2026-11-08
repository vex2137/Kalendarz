package com.kalendarz.offline;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.*;

/** User-started dataSync work owns the network and disk, independently of Activity/WebView. */
public class CalendarModelTransferService extends Service {
    private static final String CHANNEL="calendar-model-downloads", PAUSE="com.kalendarz.offline.MODEL_TRANSFER_PAUSE";
    private static final int NOTIFICATION=15702;
    private static final Set<ModelTransferCore.Observer> observers=new CopyOnWriteArraySet<>();
    private static ModelTransferCore active;
    private static ModelTransferCore.Model activeModel;
    private static volatile CalendarModelTransferService instance;
    private static volatile JSONObject latest;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private PowerManager.WakeLock wakeLock;
    private String language="en";
    private boolean running;
    static void listen(ModelTransferCore.Observer observer){observers.add(observer);}
    static void unlisten(ModelTransferCore.Observer observer){observers.remove(observer);}
    private static void publish(JSONObject state){
        try{state=withActivity(state);}catch(Exception impossible){throw new IllegalStateException(impossible);}
        latest=state;for(ModelTransferCore.Observer observer:observers)try{observer.changed(state);}catch(RuntimeException ignored){}
        CalendarModelTransferService service=instance;if(service!=null)try{service.progress(state);}catch(RuntimeException ignored){android.util.Log.w("CalendarModelTransfer","notification update unavailable");}
    }
    // A terminal core result is durable before Service.onDestroy runs. Keep the
    // slot reserved through that teardown so its stopSelf cannot stop a new run.
    static synchronized boolean busy(){return active!=null||instance!=null;}
    private static synchronized JSONObject withActivity(JSONObject state)throws Exception{
        JSONObject result=new JSONObject(state.toString());result.put("active",busy());return result;
    }
    static synchronized JSONObject start(Context context,ModelTransferCore.Model model,String language)throws Exception{
        if(model.url.isEmpty())throw new Exception("model-input");
        if(busy())throw new Exception("model-busy");
        ModelTransferCore core=new ModelTransferCore(context.getFilesDir(),model,CalendarModelTransferService::publish);
        File directory=new File(context.getFilesDir(),"calendar-model-transfers");directory.mkdirs();ModelTransferCore.atomicJson(new File(directory,"current.json"),model.json());
        active=core;activeModel=model;latest=new JSONObject().put("modelId",model.id).put("phase","downloading").put("receivedBytes",0).put("totalBytes",model.bytes).put("resumeBytes",0).put("bytesPerSecond",0).put("installed",false).put("verified",false).put("active",true);
        Intent intent=new Intent(context,CalendarModelTransferService.class).putExtra("model",model.json().toString()).putExtra("language",language);
        try{androidx.core.content.ContextCompat.startForegroundService(context,intent);}catch(Exception failure){active=null;activeModel=null;latest=null;throw new Exception("model-download-background",failure);}
        return latest;
    }
    static synchronized JSONObject status(Context context,ModelTransferCore.Model model)throws Exception{
        if(active!=null&&(model==null||activeModel.key.equals(model.key)))return withActivity(latest!=null?latest:active.snapshot());
        if(model==null){
            File current=new File(new File(context.getFilesDir(),"calendar-model-transfers"),"current.json");
            if(!current.isFile()||current.length()>16384)return new JSONObject().put("phase","missing").put("active",busy());
            byte[] data=new byte[(int)current.length()];try(DataInputStream in=new DataInputStream(new FileInputStream(current))){in.readFully(data);}model=new ModelTransferCore.Model(new JSONObject(new String(data,StandardCharsets.UTF_8)));
        }
        return withActivity(new ModelTransferCore(context.getFilesDir(),model,state->{}).storedState());
    }
    static synchronized JSONObject pause(Context context,String modelId)throws Exception{
        if(active!=null&&(modelId==null||activeModel.id.equals(modelId)))active.pause();
        return status(context,null);
    }
    /** Bridge I/O-thread acknowledgement; notification/main-thread pause stays immediate. */
    static JSONObject awaitPause(Context context,String modelId,long timeoutMs)throws Exception{
        if(Looper.myLooper()==Looper.getMainLooper())throw new IllegalStateException("Pause acknowledgement cannot block the main thread");
        long deadline=System.nanoTime()+Math.max(0,timeoutMs)*1_000_000L;
        synchronized(CalendarModelTransferService.class){
            boolean matches=modelId==null||activeModel!=null&&activeModel.id.equals(modelId)||latest!=null&&modelId.equals(latest.optString("modelId"));
            pause(context,modelId);
            while(matches&&busy()){
                long remaining=deadline-System.nanoTime();if(remaining<=0)break;
                try{TimeUnit.NANOSECONDS.timedWait(CalendarModelTransferService.class,remaining);}
                catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new Exception("model-cancelled",interrupted);}
            }
            return status(context,null);
        }
    }
    @Override public void onCreate(){
        super.onCreate();instance=this;
        if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(CHANNEL,label("Model downloads","Pobieranie modeli","Modelldownloads","Загрузка моделей"),NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);getSystemService(NotificationManager.class).createNotificationChannel(channel);}
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent==null){stopSelf(startId);return START_NOT_STICKY;}
        if(PAUSE.equals(intent.getAction())){try{pause(this,null);}catch(Exception ignored){}synchronized(CalendarModelTransferService.class){if(active==null)stopSelf();}return START_NOT_STICKY;}
        if(running)return START_NOT_STICKY;
        language=intent.getStringExtra("language");if(language==null)language="en";
        ModelTransferCore core;
        try{
            synchronized(CalendarModelTransferService.class){
                if(active==null){activeModel=new ModelTransferCore.Model(new JSONObject(intent.getStringExtra("model")));active=new ModelTransferCore(getFilesDir(),activeModel,CalendarModelTransferService::publish);}
                core=active;
            }
            Notification notification=notification(latest!=null?latest:core.snapshot());
            if(Build.VERSION.SDK_INT>=29)startForeground(NOTIFICATION,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);else startForeground(NOTIFICATION,notification);
            PowerManager power=(PowerManager)getSystemService(POWER_SERVICE);wakeLock=power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,getPackageName()+":model-transfer");wakeLock.setReferenceCounted(false);wakeLock.acquire(6L*60*60*1000);
            running=true;
            worker.execute(()->{
                JSONObject result=core.run();
                synchronized(CalendarModelTransferService.class){if(active==core){active=null;activeModel=null;latest=result;}CalendarModelTransferService.class.notifyAll();}
                releaseWakeLock();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();
            });
        }catch(Exception failure){
            synchronized(CalendarModelTransferService.class){active=null;activeModel=null;CalendarModelTransferService.class.notifyAll();}
            JSONObject result=new JSONObject();try{result.put("phase","error").put("error","model-download-background");}catch(Exception ignored){}publish(result);releaseWakeLock();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf(startId);
        }
        // Explicit resume uses the durable journal. A killed/force-stopped process is not silently restarted.
        return START_NOT_STICKY;
    }
    private String label(String en,String pl,String de,String ru){return "pl".equals(language)?pl:"de".equals(language)?de:"ru".equals(language)?ru:en;}
    private Notification notification(JSONObject state){
        String phase=state.optString("phase","downloading");long bytes=state.optLong("receivedBytes"),total=state.optLong("totalBytes");int percent=total>0?(int)Math.min(100,bytes*100/total):0;
        String title=label("Downloading AI model","Pobieranie modelu AI","KI-Modell wird geladen","Загрузка модели ИИ");
        String body="verifying".equals(phase)?label("Verifying SHA-256","Weryfikowanie SHA-256","SHA-256 wird geprüft","Проверка SHA-256"):String.format(java.util.Locale.ROOT,"%.1f / %.1f MB · %d%%",bytes/1_000_000.0,total/1_000_000.0,percent);
        Intent open=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        PendingIntent pause=PendingIntent.getService(this,1,new Intent(this,CalendarModelTransferService.class).setAction(PAUSE),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle(title).setContentText(body).setContentIntent(content).setOnlyAlertOnce(true).setOngoing(true).setCategory(NotificationCompat.CATEGORY_PROGRESS).setProgress(100,percent,"verifying".equals(phase)||total<=0).addAction(android.R.drawable.ic_media_pause,label("Pause","Wstrzymaj","Pausieren","Пауза"),pause).build();
    }
    private void progress(JSONObject state){if(running&&("downloading".equals(state.optString("phase"))||"verifying".equals(state.optString("phase"))))getSystemService(NotificationManager.class).notify(NOTIFICATION,notification(state));}
    private synchronized void releaseWakeLock(){if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();wakeLock=null;}
    // Android 15+ limits dataSync foreground time; checkpoint then stop within the system grace period.
    @Override public void onTimeout(int startId,int foregroundServiceType){try{pause(this,null);}catch(Exception ignored){}releaseWakeLock();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf(startId);}
    @Override public void onDestroy(){
        try{pause(this,null);}catch(Exception ignored){}
        synchronized(CalendarModelTransferService.class){if(instance==this)instance=null;CalendarModelTransferService.class.notifyAll();}
        releaseWakeLock();worker.shutdown();super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}

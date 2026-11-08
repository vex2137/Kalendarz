package com.kalendarz.offline;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;

/** Only protects a user-started generation. No automatic restart after force-stop. */
public final class CalendarInferenceService extends Service {
    private static volatile Runnable cancel;
    static volatile boolean running;
    private PowerManager.WakeLock wake;
    static void begin(Context context,Runnable stop){
        cancel=stop;
        context.startForegroundService(new Intent(context,CalendarInferenceService.class));
    }
    static void finish(Context context){cancel=null;context.stopService(new Intent(context,CalendarInferenceService.class));}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(intent!=null&&"stop".equals(intent.getAction())){Runnable action=cancel;if(action!=null)action.run();stopSelf();return START_NOT_STICKY;}
        NotificationManager manager=getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("calendar-inference","Local AI generation",NotificationManager.IMPORTANCE_LOW));
        PendingIntent stop=PendingIntent.getService(this,0,new Intent(this,CalendarInferenceService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        String language=getSharedPreferences("launcher",0).getString("desiredLanguage","en");
        String label="pl".equals(language)?"Generowanie lokalne · Stop, aby anulować":"de".equals(language)?"Lokale Generierung · Stop zum Abbrechen":"ru".equals(language)?"Локальная генерация · Стоп для отмены":"Generating locally · Stop to cancel";
        Notification notification=new Notification.Builder(this,"calendar-inference").setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Kalendarz · AI").setContentText(label).setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Stop",stop).build()).build();
        if(Build.VERSION.SDK_INT>=34)startForeground(10518,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(10518,notification);
        running=true;
        if(wake==null){wake=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,getPackageName()+":inference");wake.acquire(10*60*1000L);}
        return START_NOT_STICKY;
    }
    @Override public void onDestroy(){running=false;if(wake!=null&&wake.isHeld())wake.release();wake=null;super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}

package com.kalendarz.offline;

import android.app.ActivityManager;
import android.app.Activity;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.net.Uri;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CalendarDevice")
public class CalendarDevicePlugin extends Plugin {
    @Override
    public void load() {
        // Capacitor registers plugins before loadWebView(), so isolation applies to
        // the first main document as well as WASM/worker subresources.
        bridge.setWebViewClient(new CalendarWebViewClient(bridge));
    }
    private final ExecutorService diagnosticIo = Executors.newSingleThreadExecutor();
    private boolean exportingDiagnostics;

    @PluginMethod
    public void exportDiagnostics(PluginCall call) {
        synchronized(this) {
            if(exportingDiagnostics) { call.reject("diagnostics-export-busy"); return; }
            exportingDiagnostics=true;
        }
        try {
            String json=call.getString("json");
            if(json==null||json.length()>512*1024||json.getBytes(StandardCharsets.UTF_8).length>512*1024)throw new IllegalArgumentException();
            new JSONObject(json); // Reject invalid/truncated reports before opening the picker.
        } catch(Exception error) { finishDiagnosticExport();call.reject("diagnostics-export-invalid",error);return; }
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json").putExtra(Intent.EXTRA_TITLE,"calendar-ai-diagnostics.json")
            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        Log.i("CalendarDiagnostics","export-json: opening document picker");
        try { startActivityForResult(call,intent,"diagnosticsSaved"); }
        catch(Exception error) { finishDiagnosticExport();Log.e("CalendarDiagnostics","export-json: picker failed");call.reject("diagnostics-export-picker",error); }
    }

    @ActivityCallback
    private void diagnosticsSaved(PluginCall call,ActivityResult result) {
        if(call==null) { finishDiagnosticExport();Log.e("CalendarDiagnostics","export-json: callback has no pending call");return; }
        if(result.getResultCode()!=Activity.RESULT_OK) {
            finishDiagnosticExport();JSObject response=new JSObject();response.put("status","cancelled");call.resolve(response);
            Log.i("CalendarDiagnostics","export-json: cancelled");return;
        }
        Uri uri=result.getData()==null?null:result.getData().getData();
        if(uri==null||!"content".equals(uri.getScheme())) { finishDiagnosticExport();call.reject("diagnostics-export-document");return; }
        diagnosticIo.execute(()->{
            try {
                Log.i("CalendarDiagnostics","export-json: writing selected document");
                // SAF grants write access to the chosen document. No storage-wide permissions.
                try(OutputStream out=getContext().getContentResolver().openOutputStream(uri,"wt")) {
                    if(out==null)throw new java.io.IOException("Document is not writable");
                    out.write(call.getString("json").getBytes(StandardCharsets.UTF_8));out.flush();
                }
                JSObject response=new JSObject();response.put("status","saved");call.resolve(response);
                Log.i("CalendarDiagnostics","export-json: saved");
            } catch(Exception error) { Log.e("CalendarDiagnostics","export-json: write failed");call.reject("diagnostics-export-write",error); }
            finally { finishDiagnosticExport(); }
        });
    }
    private synchronized void finishDiagnosticExport() { exportingDiagnostics=false; }
    @Override protected void handleOnDestroy() { diagnosticIo.shutdown(); }

    // Keep the existing notification channel: never bypass a user's mute choice.
    private static final String REMINDER_CHANNEL = "default";
    private static final String[] LANGUAGES = { "en", "pl", "ru", "de" };
    private static final String[] NAMES = { "Calendar", "Kalendarz", "Календарь", "Kalender" };

    @Override
    protected void handleOnResume() {
        notifyListeners("notificationSettingsChanged", new JSObject());
    }

    @PluginMethod
    public void benchmarkTelemetry(PluginCall call) {
        JSObject result = new JSObject();
        android.os.Debug.MemoryInfo processMemory = new android.os.Debug.MemoryInfo();
        android.os.Debug.getMemoryInfo(processMemory);
        ActivityManager.MemoryInfo systemMemory = new ActivityManager.MemoryInfo();
        ((ActivityManager)getContext().getSystemService(android.content.Context.ACTIVITY_SERVICE)).getMemoryInfo(systemMemory);
        result.put("appPssKB", processMemory.getTotalPss());
        result.put("availableMemoryBytes", systemMemory.availMem);
        result.put("totalMemoryBytes", systemMemory.totalMem);
        result.put("lowMemory", systemMemory.lowMemory);
        result.put("cpuTimeMs", android.os.Process.getElapsedCpuTime());
        result.put("elapsedRealtimeMs", android.os.SystemClock.elapsedRealtime());
        result.put("memoryScope", "app-process-only; excludes isolated WebView renderer");
        result.put("cpuScope", "app-process-only; excludes isolated WebView renderer");
        result.put("deviceModel", Build.MANUFACTURER + " " + Build.MODEL);
        result.put("androidSdk", Build.VERSION.SDK_INT);
        result.put("deviceTypeHint", Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("Emulator") ? "emulator" : "physical-unverified");
        if (Build.VERSION.SDK_INT >= 26 && android.webkit.WebView.getCurrentWebViewPackage() != null) result.put("webViewVersion", android.webkit.WebView.getCurrentWebViewPackage().versionName);
        Intent battery = getContext().registerReceiver(null, new android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        if (battery != null) {
            int temperature = battery.getIntExtra(android.os.BatteryManager.EXTRA_TEMPERATURE, Integer.MIN_VALUE);
            if (temperature != Integer.MIN_VALUE) result.put("batteryTemperatureC", temperature / 10.0);
            result.put("batteryLevel", battery.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, -1));
        }
        android.os.BatteryManager manager = (android.os.BatteryManager)getContext().getSystemService(android.content.Context.BATTERY_SERVICE);
        if (manager != null) {
            int current = manager.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
            if (current != Integer.MIN_VALUE) result.put("batteryCurrentMicroA", current);
            long charge = manager.getLongProperty(android.os.BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER);
            long energy = manager.getLongProperty(android.os.BatteryManager.BATTERY_PROPERTY_ENERGY_COUNTER);
            if (charge != Long.MIN_VALUE) result.put("batteryChargeMicroAh", charge);
            if (energy != Long.MIN_VALUE) result.put("batteryEnergyNanoWh", energy);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            android.os.PowerManager power = (android.os.PowerManager)getContext().getSystemService(android.content.Context.POWER_SERVICE);
            if (power != null) result.put("thermalStatus", power.getCurrentThermalStatus());
        }
        call.resolve(result);
    }

    @PluginMethod
    public void diagnosticsBuildInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("commit", getContext().getString(R.string.calendar_build_commit));
        result.put("applicationId", getContext().getPackageName());
        try {
            result.put("version", getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0).versionName);
            call.resolve(result);
        } catch (Exception error) { call.reject("Could not read diagnostic build info", error); }
    }

    @PluginMethod
    public void setLanguage(PluginCall call) {
        String language = call.getString("language", "en");
        int selected = -1;
        for (int i = 0; i < LANGUAGES.length; i++) {
            if (LANGUAGES[i].equals(language)) selected = i;
        }
        if (selected < 0) { call.reject("Unsupported language"); return; }
        final int index = selected;
        getActivity().runOnUiThread(() -> {
            try {
                // Never disable the alias that launched a visible activity. Some launchers
                // finish/restart the task even when DONT_KILL_APP is requested.
                getContext().getSharedPreferences("launcher", 0).edit()
                    .putString("desiredLanguage", LANGUAGES[index]).commit();
                getActivity().setTitle(NAMES[index]);
                getActivity().setTaskDescription(new ActivityManager.TaskDescription(NAMES[index]));
                call.resolve();
            } catch (Exception error) { call.reject("Could not update launcher name", error); }
        });
    }

    @Override
    protected void handleOnStop() {
        // Keep the side-by-side diagnostic installation visibly distinct.
        if (getContext().getPackageName().endsWith(".diagnostics")) return;
        if (getActivity().isChangingConfigurations()) return;
        String selected = getContext().getSharedPreferences("launcher", 0)
            .getString("desiredLanguage", null);
        if (selected == null) return;
        try {
            PackageManager manager = getContext().getPackageManager();
            if (Build.VERSION.SDK_INT >= 33) {
                java.util.List<PackageManager.ComponentEnabledSetting> changes = new java.util.ArrayList<>();
                for (String language : LANGUAGES) {
                    changes.add(new PackageManager.ComponentEnabledSetting(
                        new ComponentName(getContext(), getContext().getPackageName() + ".Launcher_" + language),
                        language.equals(selected) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                        PackageManager.DONT_KILL_APP));
                }
                // Commit all aliases atomically; keep exactly one launcher entry enabled.
                manager.setComponentEnabledSettings(changes);
            } else {
                setLauncher(manager, selected, true);
                for (String language : LANGUAGES) if (!language.equals(selected)) setLauncher(manager, language, false);
            }
        } catch (Exception error) {
            // Keep the desired value persisted and retry on the next background transition.
            android.util.Log.e("CalendarDevice", "Could not update background launcher name", error);
        }
    }

    private void setLauncher(PackageManager manager, String language, boolean enabled) {
        ComponentName component = new ComponentName(getContext(), getContext().getPackageName() + ".Launcher_" + language);
        int state = enabled ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
        int current = manager.getComponentEnabledSetting(component);
        // The English alias is enabled by default in the manifest.
        boolean currentlyEnabled = current == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
            (current == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && language.equals("en"));
        if (currentlyEnabled != enabled) manager.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP);
    }

    @PluginMethod
    public void notificationStatus(PluginCall call) {
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        String channelState = "ready";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = manager.getNotificationChannel(REMINDER_CHANNEL);
            if (channel != null) {
                if (channel.getImportance() == NotificationManager.IMPORTANCE_NONE) channelState = "blocked";
                else if (channel.getImportance() < NotificationManager.IMPORTANCE_DEFAULT || channel.getSound() == null) channelState = "silent";
            }
        }
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("channel", channelState);
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName()));
            }
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(REMINDER_CHANNEL) != null) {
                intent.setAction(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_CHANNEL_ID, REMINDER_CHANNEL);
            }
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) { call.reject("Could not open notification settings", error); }
    }
}

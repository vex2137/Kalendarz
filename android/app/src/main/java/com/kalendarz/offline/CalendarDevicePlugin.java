package com.kalendarz.offline;

import android.app.ActivityManager;
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
    // Keep the existing notification channel: never bypass a user's mute choice.
    private static final String REMINDER_CHANNEL = "default";
    private static final String[] LANGUAGES = { "en", "pl", "ru", "de" };
    private static final String[] NAMES = { "Calendar", "Kalendarz", "Календарь", "Kalender" };

    @Override
    protected void handleOnResume() {
        notifyListeners("notificationSettingsChanged", new JSObject());
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

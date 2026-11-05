package com.kalendarz.offline;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.LocaleManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.LocaleList;
import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.os.LocaleListCompat;
import java.util.ArrayList;
import java.util.List;

/** Keep the existing aliases, preference file and application/data identity. */
final class LauncherLanguage {
    static final String[] LANGUAGES = {"en", "pl", "ru", "de"};
    private static final String[] NAMES = {"Calendar", "Kalendarz", "Календарь", "Kalender"};

    static int index(String language) {
        for (int i = 0; i < LANGUAGES.length; i++) if (LANGUAGES[i].equals(language)) return i;
        throw new IllegalArgumentException("Unsupported language");
    }

    static String desired(Context context) {
        String value = context.getSharedPreferences("launcher", Context.MODE_PRIVATE).getString("desiredLanguage", "en");
        try { index(value); return value; } catch (IllegalArgumentException error) { return "en"; }
    }

    static void saveChoice(Context context, String language) {
        index(language);
        if (!context.getSharedPreferences("launcher", Context.MODE_PRIVATE).edit().putString("desiredLanguage", language).commit())
            throw new IllegalStateException("Could not persist launcher language");
    }

    static void updateActivity(Activity activity, String language) {
        String name = NAMES[index(language)];
        // Framework locales also inform OS surfaces on Android 13+. Older OS
        // settings/notification headers may still use the system language/cache.
        if (Build.VERSION.SDK_INT >= 33) {
            LocaleManager manager = activity.getSystemService(LocaleManager.class);
            LocaleList locales = LocaleList.forLanguageTags(language);
            if (manager != null && !manager.getApplicationLocales().equals(locales)) manager.setApplicationLocales(locales);
        } else {
            LocaleListCompat locales = LocaleListCompat.forLanguageTags(language);
            if (!AppCompatDelegate.getApplicationLocales().equals(locales)) AppCompatDelegate.setApplicationLocales(locales);
        }
        activity.setTitle(name);
        activity.setTaskDescription(new ActivityManager.TaskDescription(name));
    }

    static ComponentName alias(Context context, String language) {
        index(language);
        // Alias classes belong to the manifest namespace, NOT the suffixed
        // diagnostics applicationId. Do not rename existing components on upgrade.
        return new ComponentName(context.getPackageName(), MainActivity.class.getPackage().getName() + ".Launcher_" + language);
    }

    static void applyPending(Context context) {
        String selected = desired(context);
        PackageManager manager = context.getPackageManager();
        List<PackageManager.ComponentEnabledSetting> changes = new ArrayList<>();
        for (String language : LANGUAGES) {
            ComponentName component = alias(context, language);
            int state = manager.getComponentEnabledSetting(component);
            boolean enabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
                (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && language.equals("en"));
            if (enabled != language.equals(selected) && Build.VERSION.SDK_INT >= 33)
                changes.add(new PackageManager.ComponentEnabledSetting(component,
                    language.equals(selected) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP));
        }
        if (Build.VERSION.SDK_INT >= 33) {
            if (!changes.isEmpty()) manager.setComponentEnabledSettings(changes);
        } else {
            // Enable first, so a failure never leaves the app without an entry.
            setEnabled(manager, alias(context, selected), true, selected);
            for (String language : LANGUAGES) if (!language.equals(selected)) setEnabled(manager, alias(context, language), false, language);
        }
        // PackageManager emits the system component/package notifications used
        // by launchers. Do not send forged/protected PACKAGE_CHANGED broadcasts.
    }

    private static void setEnabled(PackageManager manager, ComponentName component, boolean enabled, String language) {
        int state = manager.getComponentEnabledSetting(component);
        boolean current = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
            (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && language.equals("en"));
        if (current != enabled) manager.setComponentEnabledSetting(component,
            enabled ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP);
    }
}

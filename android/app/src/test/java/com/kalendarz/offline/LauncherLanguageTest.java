package com.kalendarz.offline;

import static org.junit.Assert.*;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.app.Activity;
import android.app.LocaleManager;
import android.os.Build;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Robolectric;
import org.robolectric.annotation.Config;

/** Android JVM/resource tests, not evidence of a physical launcher refresh. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = {28, 33}, qualifiers = "en")
public class LauncherLanguageTest {
    private Context context;

    @Before public void reset() {
        context = RuntimeEnvironment.getApplication();
        context.getSharedPreferences("launcher", 0).edit().clear().commit();
        for (String language : LauncherLanguage.LANGUAGES) context.getPackageManager().setComponentEnabledSetting(
            LauncherLanguage.alias(context, language), PackageManager.COMPONENT_ENABLED_STATE_DEFAULT, PackageManager.DONT_KILL_APP);
    }

    private void assertLauncher(String expected, String name) throws Exception {
        Intent intent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(context.getPackageName());
        List<String> enabled = context.getPackageManager().queryIntentActivities(intent, 0).stream()
            .map(r -> r.activityInfo.name).collect(Collectors.toList());
        assertEquals(List.of(LauncherLanguage.alias(context, expected).getClassName()), enabled);
        assertEquals(name, context.getPackageManager().getActivityInfo(LauncherLanguage.alias(context, expected), 0).loadLabel(context.getPackageManager()).toString());
    }

    @Test public void defaultEnglishAndRealDiagnosticsNamespace() throws Exception {
        assertEquals("com.kalendarz.offline.diagnostics", context.getPackageName());
        assertEquals("com.kalendarz.offline.Launcher_en", LauncherLanguage.alias(context, "en").getClassName());
        assertEquals("en", LauncherLanguage.desired(context));
        LauncherLanguage.applyPending(context);
        assertLauncher("en", "Calendar");
    }

    @Test public void polishEnglishPolishUpdatesExactlyOneAliasWithoutReinstall() throws Exception {
        for (String language : new String[]{"pl", "en", "pl"}) {
            LauncherLanguage.saveChoice(context, language);
            LauncherLanguage.applyPending(context);
            assertLauncher(language, language.equals("pl") ? "Kalendarz" : "Calendar");
            LauncherLanguage.applyPending(context); // No-op resume/background must remain stable.
            assertLauncher(language, language.equals("pl") ? "Kalendarz" : "Calendar");
        }
    }

    @Test public void persistedChoiceRestoresWithANewPackageContext() throws Exception {
        LauncherLanguage.saveChoice(context, "pl");
        Context restarted = context.createPackageContext(context.getPackageName(), 0);
        assertEquals("pl", LauncherLanguage.desired(restarted));
        LauncherLanguage.applyPending(restarted);
        assertLauncher("pl", "Kalendarz");
    }

    @Test public void unsupportedLanguageDoesNotLoseLastChoiceOrLauncher() throws Exception {
        LauncherLanguage.saveChoice(context, "de");
        assertThrows(IllegalArgumentException.class, () -> LauncherLanguage.saveChoice(context, "xx"));
        assertEquals("de", LauncherLanguage.desired(context));
        LauncherLanguage.applyPending(context);
        assertLauncher("de", "Kalender");
    }

    @Test public void nativeTitleAndSupportedApplicationLocalesFollowTheSelection() {
        try (var controller = Robolectric.buildActivity(Activity.class).setup()) {
            Activity activity = controller.get();
            for (String language : new String[]{"pl", "en", "pl"}) {
                LauncherLanguage.updateActivity(activity, language);
                assertEquals(language.equals("pl") ? "Kalendarz" : "Calendar", activity.getTitle());
                if (Build.VERSION.SDK_INT >= 33) assertEquals(language,
                    activity.getSystemService(LocaleManager.class).getApplicationLocales().get(0).getLanguage());
            }
        }
    }
}

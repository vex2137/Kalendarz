package com.kalendarz.offline;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Exercises the actual release WebView and its IndexedDB, without a test server. */
@RunWith(AndroidJUnit4.class)
public class CalendarSmokeTest {
    private WebView findWebView(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView found = findWebView(group.getChildAt(i));
                if (found != null) return found;
            }
        }
        return null;
    }

    private WebView webView(MainActivity activity) {
        WebView view = findWebView(activity.getWindow().getDecorView());
        if (view == null) throw new AssertionError("The release activity has no WebView");
        return view;
    }

    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch callback = new CountDownLatch(1);
        scenario.onActivity(activity -> webView(activity).evaluateJavascript(script, value -> {
            result.set(value);
            callback.countDown();
        }));
        if (!callback.await(10, TimeUnit.SECONDS)) fail("WebView JavaScript timed out");
        return result.get();
    }

    private void until(ActivityScenario<MainActivity> scenario, String predicate) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(40);
        while (System.nanoTime() < deadline) {
            if ("true".equals(evaluate(scenario, "Boolean(" + predicate + ")"))) return;
            Thread.sleep(200);
        }
        fail("Release WebView did not satisfy: " + predicate + "; state=" + evaluate(scenario,
            "JSON.stringify({url:location.href,ready:document.readyState,title:document.title,dialog:document.querySelector('[role=dialog]')?.textContent?.slice(0,1200)})"));
    }

    @Test
    public void createsPersistsAndDisplaysVersion() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            String title = "Android smoke " + System.nanoTime();
            until(scenario, "document.querySelector('#btn-create-event-top')");
            evaluate(scenario, "document.querySelector('#btn-create-event-top').click()");
            until(scenario, "document.querySelector('#input-event-title')");
            evaluate(scenario,
                "(()=>{const input=document.querySelector('#input-event-title');" +
                "Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'" + title + "');" +
                "input.dispatchEvent(new Event('input',{bubbles:true}));return true})()");
            until(scenario, "document.querySelector('#input-event-title').value === '" + title + "'");
            evaluate(scenario, "document.querySelector('#btn-save-event-form').click()");
            until(scenario, "!document.querySelector('#input-event-title') && document.body.textContent.includes('" + title + "')");
            evaluate(scenario, "window.__calendarSmokeBeforeReload = true");
            scenario.onActivity(activity -> webView(activity).reload());
            until(scenario, "!window.__calendarSmokeBeforeReload && document.querySelector('#btn-create-event-top') && document.body.textContent.includes('" + title + "')");
            evaluate(scenario, "document.querySelector('#btn-open-download').click()");
            AtomicReference<String> version = new AtomicReference<>();
            scenario.onActivity(activity -> {
                try {
                    version.set(activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionName);
                } catch (Exception error) {
                    throw new AssertionError(error);
                }
            });
            until(scenario, "document.querySelector('[role=dialog]') && document.querySelector('[role=dialog]').textContent.includes('" + version.get() + "')");
            assertEquals("\"" + version.get() + "\"", evaluate(scenario,
                "document.querySelector('[role=dialog]').textContent.match(/\\d+\\.\\d+\\.\\d+/)[0]"));
        }
    }
    @Test
    public void languageSelectionUpdatesExactlyOneLauncher() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            until(scenario, "document.querySelector('#btn-open-settings')");
            evaluate(scenario, "document.querySelector('#btn-open-settings').click()");
            String[][] languages = {
                {"pl", "Polski", "Kalendarz"}, {"ru", "Русский", "Календарь"},
                {"de", "Deutsch", "Kalender"}, {"en", "English", "Calendar"}
            };
            for (String[] language : languages) {
                until(scenario, "document.querySelector('#modal-settings button[aria-label=\"" + language[1] + "\"]')");
                evaluate(scenario, "document.querySelector('#modal-settings button[aria-label=\"" + language[1] + "\"]').click()");
                until(scenario, "document.title === '" + language[2] + "'");
                AtomicReference<String> launcherLabel = new AtomicReference<>("");
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
                do {
                    scenario.onActivity(activity -> {
                        android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_MAIN)
                            .addCategory(android.content.Intent.CATEGORY_LAUNCHER).setPackage(activity.getPackageName());
                        java.util.List<android.content.pm.ResolveInfo> entries = activity.getPackageManager().queryIntentActivities(intent, 0);
                        if (entries.size() == 1) launcherLabel.set(entries.get(0).loadLabel(activity.getPackageManager()).toString());
                    });
                    if (language[2].equals(launcherLabel.get())) break;
                    Thread.sleep(100);
                } while (System.nanoTime() < deadline);
                assertEquals(language[2], launcherLabel.get());
            }
        }
    }

    @Test
    public void nativeNotificationStatusReturnsCurrentSystemPermission() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            until(scenario, "document.querySelector('#btn-open-settings')");
            evaluate(scenario, "window.__calendarNativeStatus = null; window.Capacitor.nativePromise('CalendarDevice', 'notificationStatus', {})"
                + ".then(status => window.__calendarNativeStatus = status)");
            until(scenario, "window.__calendarNativeStatus && typeof window.__calendarNativeStatus.enabled === 'boolean'"
                + " && ['ready', 'silent', 'blocked'].includes(window.__calendarNativeStatus.channel)");
            AtomicReference<Boolean> enabled = new AtomicReference<>();
            // Query the framework independently: R8 may inline AndroidX helpers in
            // the release APK, so the separate instrumentation APK must not call them.
            scenario.onActivity(activity -> enabled.set(activity.getSystemService(android.app.NotificationManager.class).areNotificationsEnabled()));
            assertEquals(enabled.get().toString(), evaluate(scenario, "window.__calendarNativeStatus.enabled"));
        }
    }

}

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
        until(scenario, predicate, 40);
    }

    private void until(ActivityScenario<MainActivity> scenario, String predicate, int seconds) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
        while (System.nanoTime() < deadline) {
            if ("true".equals(evaluate(scenario, "Boolean(" + predicate + ")"))) return;
            Thread.sleep(200);
        }
        fail("Release WebView did not satisfy: " + predicate + "; state=" + evaluate(scenario,
            "JSON.stringify({url:location.href,ready:document.readyState,title:document.title,dialog:document.querySelector('[role=dialog]')?.textContent?.slice(0,1200),touchTrace:window.__calendarTouchTrace})"));
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
    private String launcherLabel(ActivityScenario<MainActivity> scenario) {
        AtomicReference<String> label = new AtomicReference<>("");
        scenario.onActivity(activity -> {
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_MAIN)
                .addCategory(android.content.Intent.CATEGORY_LAUNCHER).setPackage(activity.getPackageName());
            java.util.List<android.content.pm.ResolveInfo> entries = activity.getPackageManager().queryIntentActivities(intent, 0);
            assertEquals(1, entries.size());
            label.set(entries.get(0).loadLabel(activity.getPackageManager()).toString());
        });
        return label.get();
    }

    @Test
    public void languageSelectionUpdatesExactlyOneLauncher() throws Exception {
        android.content.Context context = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().getTargetContext();
        // Launch through the real enabled alias, as a phone launcher does.
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(context.getPackageManager().getLaunchIntentForPackage(context.getPackageName()))) {
            until(scenario, "document.querySelector('#btn-open-settings')");
            evaluate(scenario, "window.__languageSurvival = 'same-webview'; document.querySelector('#btn-open-settings').click()");
            String[][] languages = {
                {"pl", "Polski", "Kalendarz"}, {"ru", "Русский", "Календарь"},
                {"de", "Deutsch", "Kalender"}, {"en", "English", "Calendar"}
            };
            for (String[] language : languages) {
                String previous = launcherLabel(scenario);
                until(scenario, "document.querySelector('#modal-settings button[aria-label=\"" + language[1] + "\"]')");
                evaluate(scenario, "document.querySelector('#modal-settings button[aria-label=\"" + language[1] + "\"]').click()");
                until(scenario, "document.title === '" + language[2] + "'");
                assertEquals(previous, launcherLabel(scenario));
                assertEquals("\"same-webview\"", evaluate(scenario, "window.__languageSurvival"));
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);
                assertEquals(language[2], launcherLabel(scenario));
                assertEquals("\"same-webview\"", evaluate(scenario, "window.__languageSurvival"));
                until(scenario, "document.title === '" + language[2] + "'");
            }
        }
    }

    @Test
    public void bundledModelUnderstandsPolishAndEnglishOffline() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            until(scenario, "document.querySelector('#btn-open-settings')");
            // Block all external main-thread fetches. Weights and both WASM builds must be local.
            evaluate(scenario, "window.__externalModelRequests=[]; const originalFetch=window.fetch; window.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input.url,document.baseURI);if(/^https?:$/.test(url.protocol)&&url.hostname!=='localhost'){window.__externalModelRequests.push(url.href);throw new Error('External request blocked by offline model test')}return originalFetch(input,options)}");
            String[][] cases = {
                {"Polski", "Dodaj wydarzenie Kontrola 2026-11-15 o 15:00 do 16:00", "Kontrola"},
                {"English", "Add event Checkup on 2026-11-15 at 15:00 until 16:00", "Checkup"}
            };
            for (String[] example : cases) {
                evaluate(scenario, "document.querySelector('#btn-open-settings').click()");
                until(scenario, "document.querySelector('#modal-settings button[aria-label=\"" + example[0] + "\"]')");
                evaluate(scenario, "document.querySelector('#modal-settings button[aria-label=\"" + example[0] + "\"]').click()");
                evaluate(scenario, "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
                until(scenario, "!document.querySelector('#modal-settings')");
                evaluate(scenario, "document.querySelector('#btn-open-ai-assistant').click()");
                until(scenario, "document.querySelector('#drawer-ai-assistant input[type=text]') && !document.querySelector('#drawer-ai-assistant input[type=text]').disabled");
                evaluate(scenario, "(()=>{const input=document.querySelector('#drawer-ai-assistant input[type=text]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'" + example[1] + "');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
                until(scenario, "!document.querySelector('#btn-send-ai-message').disabled");
                evaluate(scenario, "document.querySelector('#btn-send-ai-message').click()");
                until(scenario, "document.querySelector('[id^=btn-confirm-ai-event-]') && !document.querySelector('#drawer-ai-assistant input[type=text]').disabled", 180);
                String proposal = evaluate(scenario, "document.querySelector('#drawer-ai-assistant').innerText");
                org.junit.Assert.assertTrue(proposal, proposal.contains(example[2]) && proposal.contains("2026-11-15 15:00") && proposal.contains("16:00"));
                assertEquals("0", evaluate(scenario, "window.__externalModelRequests.length"));
                evaluate(scenario, "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
                until(scenario, "!document.querySelector('#drawer-ai-assistant')");
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

    private void clickText(ActivityScenario<MainActivity> scenario, String text) throws Exception {
        String expression = "[...document.querySelectorAll('button')].find(button => button.textContent.trim() === " + org.json.JSONObject.quote(text) + ")";
        until(scenario, expression);
        evaluate(scenario, expression + ".click()");
    }

    private void fill(ActivityScenario<MainActivity> scenario, String selector, String value) throws Exception {
        String input = "document.querySelector(" + org.json.JSONObject.quote(selector) + ")";
        until(scenario, input);
        evaluate(scenario, "(()=>{const input=" + input + ";const prototype=input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;"
            + "Object.getOwnPropertyDescriptor(prototype,'value').set.call(input," + org.json.JSONObject.quote(value) + ");"
            + "input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
    }

    @Test
    public void encryptedQrAndCustomThemeWorkOfflineInReleaseWebView() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            until(scenario, "document.querySelector('#btn-open-settings')");
            evaluate(scenario, "document.querySelector('#btn-open-settings').click()");
            until(scenario, "document.querySelector('button[aria-label=\"English\"]')");
            evaluate(scenario, "document.querySelector('button[aria-label=\"English\"]').click()");
            clickText(scenario, "Create theme");
            fill(scenario, "input[maxlength='50']", "Android custom palette");
            fill(scenario, "input[type='color']", "#112233");
            clickText(scenario, "Save theme");
            until(scenario, "document.documentElement.style.getPropertyValue('--bg-main') === '#112233'");
            evaluate(scenario, "window.__calendarSmokeBeforeReload = true");
            scenario.onActivity(activity -> webView(activity).reload());
            until(scenario, "!window.__calendarSmokeBeforeReload && document.querySelector('#btn-open-settings') && document.documentElement.style.getPropertyValue('--bg-main') === '#112233'");
            evaluate(scenario, "document.querySelector('#btn-open-settings').click()");
            until(scenario, "document.querySelector('button[aria-label=\"Delete theme: Android custom palette\"]')");
            evaluate(scenario, "document.querySelector('button[aria-label=\"Delete theme: Android custom palette\"]').click()");
            clickText(scenario, "Delete");
            until(scenario, "document.documentElement.dataset.theme === 'dark'");
            evaluate(scenario, "document.querySelector('#btn-close-settings-modal').click()");
            evaluate(scenario, "document.querySelector('#btn-open-sync').click()");
            fill(scenario, "input[type='password']", "Android encrypted sync password");
            clickText(scenario, "Generate encrypted code");
            until(scenario, "document.querySelector('img[alt=\"Sync QR\"]') && document.querySelector('input[type=password]').value === ''");
            clickText(scenario, "Text code");
            evaluate(scenario, "Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__androidEncryptedPacket=text}}})");
            clickText(scenario, "Copy my code");
            until(scenario, "window.__androidEncryptedPacket && window.__androidEncryptedPacket.startsWith('KAL3:')");
            String packetJson = evaluate(scenario, "window.__androidEncryptedPacket");
            fill(scenario, "textarea", new org.json.JSONTokener(packetJson).nextValue().toString());
            clickText(scenario, "Merge data");
            fill(scenario, "[data-testid='incoming-sync'] input[type=password]", "Android encrypted sync password");
            clickText(scenario, "Decrypt and merge");
            until(scenario, "document.querySelector('[role=dialog]').textContent.includes('Data saved and merged.')");
            assertEquals("false", evaluate(scenario, "JSON.stringify({...localStorage}).includes('Android encrypted sync password')"));
        }
    }

    @Test
    public void realFingerSwipeNavigatesWithoutOpeningAnEvent() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            until(scenario, "document.querySelector('[data-testid=calendar-navigation]')");
            String before = evaluate(scenario, "document.querySelector('[data-testid=calendar-navigation]').dataset.dateKey.slice(0,7)");
            evaluate(scenario, "window.__calendarTouchTrace=[]; for(const type of ['pointerdown','pointermove','pointerup','pointercancel']) document.addEventListener(type,e=>{if(window.__calendarTouchTrace.length<20)window.__calendarTouchTrace.push({type,kind:e.pointerType,primary:e.isPrimary,x:e.clientX,y:e.clientY,inside:!!e.target.closest('[data-testid=calendar-navigation]'),at:performance.now()})},true)");
            AtomicReference<int[]> bounds = new AtomicReference<>();
            scenario.onActivity(activity -> {
                WebView view = webView(activity);
                int[] location = new int[2]; view.getLocationOnScreen(location);
                bounds.set(new int[] { location[0], location[1], view.getWidth(), view.getHeight() });
            });
            int[] area = bounds.get();
            float start = area[0] + area[2] * 0.8f, finish = area[0] + area[2] * 0.2f;
            float y = area[1] + area[3] * 0.5f;
            long down = android.os.SystemClock.uptimeMillis();
            android.app.Instrumentation instrumentation = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation();
            for (int i = 0; i <= 8; i++) {
                int action = i == 0 ? android.view.MotionEvent.ACTION_DOWN : i == 8 ? android.view.MotionEvent.ACTION_UP : android.view.MotionEvent.ACTION_MOVE;
                android.view.MotionEvent.PointerProperties finger = new android.view.MotionEvent.PointerProperties();
                finger.id = 0; finger.toolType = android.view.MotionEvent.TOOL_TYPE_FINGER;
                android.view.MotionEvent.PointerCoords point = new android.view.MotionEvent.PointerCoords();
                point.x = start + (finish-start)*i/8; point.y = y; point.pressure = i == 8 ? 0 : 1; point.size = 1;
                android.view.MotionEvent motion = android.view.MotionEvent.obtain(down, android.os.SystemClock.uptimeMillis(), action,
                    1, new android.view.MotionEvent.PointerProperties[] { finger }, new android.view.MotionEvent.PointerCoords[] { point },
                    0, 0, 1, 1, 0, 0, android.view.InputDevice.SOURCE_TOUCHSCREEN, 0);
                instrumentation.sendPointerSync(motion); motion.recycle(); Thread.sleep(20);
            }
            until(scenario, "document.querySelector('[data-testid=calendar-navigation]').dataset.dateKey.slice(0,7) !== " + before);
            assertEquals("false", evaluate(scenario, "Boolean(document.querySelector('[role=dialog]'))"));
        }
    }

}

package com.kalendarz.offline;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.ComponentCallbacks2;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    @Override
    public void onResume() {
        super.onResume();
        if (bridge != null) bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('calendar-app-resume'))", null));
    }
    @Override
    protected void load() {
        super.load();
        if (bridge.getConfig().isResolveServiceWorkerRequests()) {
            // Capacitor initializes its SW client inside loadWebView(). Keep the
            // same local routing plus headers for precached offline reloads.
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    WebResourceResponse response = CalendarModelImportPlugin.intercept(MainActivity.this, request.getUrl());
                    if (response == null) response = CalendarNativeAIPlugin.intercept(MainActivity.this, request.getUrl());
                    if (response == null) response = bridge.getLocalServer().shouldInterceptRequest(request);
                    return CalendarWebViewClient.isolate(response, request.getUrl());
                }
            });
        }
    }
    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW || level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL || level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) {
            if (bridge != null) bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('calendar-memory-pressure'))", null));
        }
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        if (bridge != null) bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('calendar-memory-pressure'))", null));
    }
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CalendarDevicePlugin.class);
        registerPlugin(CalendarModelImportPlugin.class);
        registerPlugin(CalendarNativeAIPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('calendar-back', {cancelable:true}))", result -> {
                    if (!"false".equals(result)) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    }
                });
            }
        });
    }
}

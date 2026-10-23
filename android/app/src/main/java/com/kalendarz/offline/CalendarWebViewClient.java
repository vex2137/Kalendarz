package com.kalendarz.offline;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.HashMap;
import java.util.Map;

/** Preserve Capacitor interception/navigation; isolate only packaged local resources. */
public class CalendarWebViewClient extends BridgeWebViewClient {
    public CalendarWebViewClient(Bridge bridge) { super(bridge); }
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        WebResourceResponse response = super.shouldInterceptRequest(view, request);
        return isolate(response, request.getUrl());
    }

    static WebResourceResponse isolate(WebResourceResponse response, Uri url) {
        if (response != null && "https".equals(url.getScheme()) && "localhost".equals(url.getHost()) && url.getPort() == -1) {
            Map<String, String> headers = new HashMap<>();
            if (response.getResponseHeaders() != null) headers.putAll(response.getResponseHeaders());
            headers.put("Cross-Origin-Opener-Policy", "same-origin");
            headers.put("Cross-Origin-Embedder-Policy", "require-corp");
            headers.put("Cross-Origin-Resource-Policy", "same-origin");
            response.setResponseHeaders(headers);
        }
        return response;
    }
}

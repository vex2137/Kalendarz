package com.kalendarz.offline;

import org.json.JSONObject;

/** Text deltas only; role, reasoning and finish frames are not answer tokens. */
final class NativeCompletionText {
    private final StringBuilder text = new StringBuilder();

    boolean append(JSONObject delta) {
        // Android optString coerces JSON null to "null"; accept text, not coercions.
        Object content = delta == null ? null : delta.opt("content");
        if (!(content instanceof String) || ((String) content).isEmpty()) return false;
        text.append((String) content);
        return true;
    }

    int length() { return text.length(); }

    @Override public String toString() { return text.toString(); }
}

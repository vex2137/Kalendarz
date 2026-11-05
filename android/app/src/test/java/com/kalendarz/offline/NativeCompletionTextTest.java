package com.kalendarz.offline;

import static org.junit.Assert.*;
import org.json.JSONObject;
import org.junit.Test;

public class NativeCompletionTextTest {
    @Test public void androidJsonNullIsNotTheOptStringFallback() throws Exception {
        // Android coerces JSONObject.NULL to the literal string "null".
        // A desktop org.json implementation can hide this platform-specific bug.
        assertEquals("null", new JSONObject("{\"content\":null}").optString("content", ""));
    }

    @Test public void firstRoleFrameDoesNotCountAsAnAnswerToken() throws Exception {
        NativeCompletionText text = new NativeCompletionText();
        assertFalse(text.append(new JSONObject("{\"role\":\"assistant\",\"content\":null}")));
        assertFalse(text.append(new JSONObject("{\"content\":\"\"}")));
        assertEquals(0, text.length());
        assertTrue(text.append(new JSONObject("{\"content\":\"Cześć\"}")));
        assertEquals("Cześć", text.toString());
    }

    @Test public void joinsTokensAndPreservesPolishAndWhitespace() throws Exception {
        NativeCompletionText text = new NativeCompletionText();
        for (String delta : new String[] {
            "{\"role\":\"assistant\",\"content\":null}",
            "{\"content\":\"Cześć\"}", "{\"content\":\"! Jak\"}",
            "{\"content\":null}", "{}", "{\"content\":\" mogę Ci pomóc?\"}"
        }) text.append(new JSONObject(delta));
        assertEquals("Cześć! Jak mogę Ci pomóc?", text.toString());
    }

    @Test public void emptyAndReasoningOnlyResponsesRemainEmpty() throws Exception {
        NativeCompletionText text = new NativeCompletionText();
        assertFalse(text.append(null));
        for (String delta : new String[] {
            "{}", "{\"content\":null}", "{\"content\":\"\"}",
            "{\"reasoning_content\":\"private reasoning\",\"content\":null}"
        }) assertFalse(text.append(new JSONObject(delta)));
        // The plugin's existing length()==0 check must still reject this response.
        assertEquals(0, text.length());
        assertEquals("", text.toString());
    }

    @Test public void literalNullAndNullAtTheStartOfAnAnswerArePreserved() throws Exception {
        for (String answer : new String[] {"null", "null jest poprawną wartością.", "nullable", "value: null"}) {
            NativeCompletionText text = new NativeCompletionText();
            text.append(new JSONObject("{\"content\":null}"));
            for (int i = 0; i < answer.length(); i++)
                assertTrue(text.append(new JSONObject().put("content", answer.substring(i, i + 1))));
            assertEquals(answer, text.toString());
        }
    }

    @Test public void nonStringProtocolValuesAreNotCoercedToAnswerText() throws Exception {
        NativeCompletionText text = new NativeCompletionText();
        for (String delta : new String[] {
            "{\"content\":false}", "{\"content\":42}", "{\"content\":{}}", "{\"content\":[]}"
        }) assertFalse(text.append(new JSONObject(delta)));
        assertEquals(0, text.length());
    }

    @Test public void structuredCalendarResponseRetainsItsJsonNullValue() throws Exception {
        NativeCompletionText text = new NativeCompletionText();
        text.append(new JSONObject("{\"role\":\"assistant\",\"content\":null}"));
        text.append(new JSONObject().put("content", "{\"action\":\"create\",\"title\":\"Yoga\","));
        text.append(new JSONObject().put("content", "\"date\":null}"));
        assertEquals("{\"action\":\"create\",\"title\":\"Yoga\",\"date\":null}", text.toString());
        JSONObject command = new JSONObject(text.toString());
        assertEquals("create", command.getString("action"));
        assertTrue(command.isNull("date"));
    }
}

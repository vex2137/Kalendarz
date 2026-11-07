package com.kalendarz.offline;

import static org.junit.Assert.*;
import org.junit.Test;

public class BiometricSessionStateTest {
    @Test public void requiresResumedActivity() {
        BiometricSessionState state = new BiometricSessionState();
        assertFalse(state.ready());
        try { state.begin(); fail("background prompt"); }
        catch (IllegalStateException error) { assertEquals("biometric-not-ready", error.getMessage()); }
        state.resume(); assertTrue(state.ready()); assertTrue(state.begin() > 0);
    }
    @Test public void excludesConcurrentPromptsAndAllowsDeliberateRetry() {
        BiometricSessionState state = new BiometricSessionState(); state.resume();
        long first = state.begin();
        try { state.begin(); fail("duplicate prompt"); }
        catch (IllegalStateException error) { assertEquals("biometric-busy", error.getMessage()); }
        assertTrue(state.finish(first)); assertFalse(state.finish(first));
        long retry = state.begin(); assertTrue(retry > first); assertTrue(state.finish(retry));
    }
    @Test public void pauseCancelsRequestAndRejectsStaleSuccessAfterResume() {
        BiometricSessionState state = new BiometricSessionState(); state.resume();
        long first = state.begin(); assertEquals(first, state.pause()); assertFalse(state.ready());
        state.resume(); long next = state.begin();
        assertFalse(state.finish(first)); assertTrue(state.finish(next));
        assertEquals(0, state.pause());
    }
}

package com.kalendarz.offline;

/** Activity lifecycle and one outstanding system prompt; contains no credentials. */
final class BiometricSessionState {
    private boolean resumed;
    private long sequence;
    private long pending;

    synchronized void resume() { resumed = true; }
    synchronized boolean ready() { return resumed; }
    synchronized long begin() {
        if (!resumed) throw new IllegalStateException("biometric-not-ready");
        if (pending != 0) throw new IllegalStateException("biometric-busy");
        pending = ++sequence;
        return pending;
    }
    synchronized boolean finish(long request) {
        if (pending != request || request == 0) return false;
        pending = 0;
        return true;
    }
    synchronized long pause() {
        resumed = false;
        long cancelled = pending;
        pending = 0;
        return cancelled;
    }
}

package com.kalendarz.offline;

import java.io.IOException;
import java.io.InputStream;
import java.io.PushbackInputStream;
import java.util.Arrays;

/** One bounded SAF reader. The stream is owned until EOF, cancellation or release. */
final class SafImportSession implements AutoCloseable {
    static final int CHUNK_BYTES = 256 * 1024;
    static final long MAX_BYTES = 16L * 1024 * 1024 * 1024;
    private final PushbackInputStream source;
    private final long expectedBytes;
    private long received;
    private volatile boolean closed;

    SafImportSession(InputStream input, long expectedBytes) throws IOException {
        if (input == null) throw new IOException("model-import-unavailable");
        this.source = new PushbackInputStream(input, 8);
        this.expectedBytes = expectedBytes;
        try {
            byte[] header = new byte[8];
            int offset = 0;
            while (offset < header.length) {
                int count = source.read(header, offset, header.length - offset);
                if (count < 0) throw new IOException("model-gguf-invalid");
                if (count == 0) continue;
                offset += count;
            }
            if (header[0] != 'G' || header[1] != 'G' || header[2] != 'U' || header[3] != 'F' ||
                (header[4] != 2 && header[4] != 3) || header[5] != 0 || header[6] != 0 || header[7] != 0) {
                throw new IOException("model-gguf-invalid");
            }
            source.unread(header);
        } catch (IOException | RuntimeException error) {
            try { source.close(); } catch (IOException ignored) {}
            throw error;
        }
    }

    byte[] read() throws IOException {
        if (closed) throw new IOException("model-import-expired");
        byte[] buffer = new byte[CHUNK_BYTES];
        int count;
        do { count = source.read(buffer); } while (count == 0 && !closed);
        if (count < 0) {
            close();
            if (expectedBytes > 0 && received != expectedBytes) throw new IOException("model-import-incomplete");
            return new byte[0];
        }
        received += count;
        if (received > MAX_BYTES || expectedBytes > 0 && received > expectedBytes) {
            close(); throw new IOException("model-size");
        }
        return count == buffer.length ? buffer : Arrays.copyOf(buffer, count);
    }

    long receivedBytes() { return received; }
    @Override public void close() throws IOException { closed = true; source.close(); }
}

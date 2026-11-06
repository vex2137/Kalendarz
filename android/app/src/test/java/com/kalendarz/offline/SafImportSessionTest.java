package com.kalendarz.offline;

import static org.junit.Assert.*;
import java.io.*;
import java.security.MessageDigest;
import org.junit.Test;

public class SafImportSessionTest {
    private byte[] fixture(int size) {
        byte[] bytes = new byte[size];
        for (int i = 8; i < size; i++) bytes[i] = (byte)(i % 251);
        bytes[0]='G'; bytes[1]='G'; bytes[2]='U'; bytes[3]='F'; bytes[4]=3;
        return bytes;
    }
    @Test public void streamsLargeUnknownSizeWithBoundedReadsAndIdenticalChecksum() throws Exception {
        // Generate 128 MiB lazily: allocating the full model in the reader would fail this bound.
        final long length=128L*1024*1024+31;
        final MessageDigest sourceHash=MessageDigest.getInstance("SHA-256");
        InputStream source=new InputStream() {
            long offset;
            @Override public int read() { throw new AssertionError("Use bounded bulk reads"); }
            @Override public int read(byte[] bytes,int start,int count) {
                assertTrue(count<=SafImportSession.CHUNK_BYTES);
                if(offset==length)return -1;
                int n=(int)Math.min(count,length-offset);
                for(int i=0;i<n;i++) {long at=offset+i;bytes[start+i]=at<8?new byte[]{'G','G','U','F',3,0,0,0}[(int)at]:(byte)(at%251);}
                sourceHash.update(bytes,start,n);offset+=n;return n;
            }
        };
        MessageDigest target=MessageDigest.getInstance("SHA-256");long received=0;
        try(SafImportSession session=new SafImportSession(source,-1)) {
            byte[] bytes;
            while((bytes=session.read()).length>0){assertTrue(bytes.length<=SafImportSession.CHUNK_BYTES);target.update(bytes);received+=bytes.length;}
            assertEquals(length,session.receivedBytes());
        }
        assertEquals(length,received);assertArrayEquals(sourceHash.digest(),target.digest());
    }
    @Test public void acceptsShortReadsAndPreservesHeader()throws Exception {
        byte[] expected=fixture(65537);ByteArrayInputStream input=new ByteArrayInputStream(expected){
            @Override public synchronized int read(byte[] b,int off,int len){return super.read(b,off,Math.min(3,len));}
        };
        ByteArrayOutputStream copied=new ByteArrayOutputStream();
        try(SafImportSession session=new SafImportSession(input,expected.length)) {byte[] bytes;while((bytes=session.read()).length>0)copied.write(bytes);}
        assertArrayEquals(expected,copied.toByteArray());
    }
    @Test public void rejectsWrongMagicUnsupportedVersionAndTruncatedHeaderAndCloses()throws Exception {
        for(byte[] bytes:new byte[][]{new byte[12],new byte[]{'G','G','U','F',1,0,0,0},new byte[]{'G','G','U','F',3}}) {
            final boolean[] closed={false};
            try {new SafImportSession(new ByteArrayInputStream(bytes){@Override public void close(){closed[0]=true;}},-1);fail();}
            catch(IOException error){assertEquals("model-gguf-invalid",error.getMessage());assertTrue(closed[0]);}
        }
    }
    @Test public void rejectsNullProviderAndIncompleteDeclaredSize()throws Exception {
        try {new SafImportSession(null,-1);fail();}catch(IOException error){assertEquals("model-import-unavailable",error.getMessage());}
        try(SafImportSession session=new SafImportSession(new ByteArrayInputStream(fixture(100)),101)) {
            session.read();
            try{session.read();fail();}catch(IOException error){assertEquals("model-import-incomplete",error.getMessage());}
        }
    }
    @Test public void closesOnCancellationAndPreservesReadFailure()throws Exception {
        SafImportSession session=new SafImportSession(new ByteArrayInputStream(fixture(100)),100);session.close();
        try{session.read();fail();}catch(IOException error){assertEquals("model-import-expired",error.getMessage());}
        InputStream failing=new ByteArrayInputStream(fixture(100)){
            @Override public synchronized int read(byte[] b,int start,int count){if(pos>=8)throw new IllegalStateException("provider read failed");return super.read(b,start,count);}
        };
        try(SafImportSession broken=new SafImportSession(failing,100)) {
            try{broken.read();fail();}catch(IllegalStateException error){assertEquals("provider read failed",error.getMessage());}
        }
    }
}

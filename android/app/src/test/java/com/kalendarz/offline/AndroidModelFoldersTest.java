package com.kalendarz.offline;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;

public class AndroidModelFoldersTest {
    private static void number(ByteArrayOutputStream out,long n,int size)throws Exception{ByteBuffer b=ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN);if(size==8)b.putLong(n);else b.putInt((int)n);out.write(b.array());}
    private static void text(ByteArrayOutputStream out,String s)throws Exception{byte[] bytes=s.getBytes(StandardCharsets.UTF_8);number(out,bytes.length,8);out.write(bytes);}
    @Test public void readsBoundedUnicodeMetadataWithoutModelBytes()throws Exception{
        ByteArrayOutputStream out=new ByteArrayOutputStream();out.write("GGUF".getBytes(StandardCharsets.US_ASCII));number(out,3,4);number(out,1,8);number(out,3,8);
        text(out,"general.architecture");number(out,8,4);text(out,"qwen35");text(out,"general.name");number(out,8,4);text(out,"Zażółć gęślą");text(out,"qwen35.context_length");number(out,4,4);number(out,32768,4);
        org.json.JSONObject m=AndroidModelFolders.metadata(new ByteArrayInputStream(out.toByteArray()));assertEquals("qwen35",m.getString("architecture"));assertEquals("Zażółć gęślą",m.getString("name"));assertEquals(32768,m.getInt("context"));
    }
    @Test public void rejectsNonGgufHeader()throws Exception{try{AndroidModelFolders.metadata(new ByteArrayInputStream(new byte[24]));fail("Invalid header accepted");}catch(IOException expected){}}
    @Test public void giganticMetadataStringDoesNotAllocateItsDeclaredSize()throws Exception{
        ByteArrayOutputStream out=new ByteArrayOutputStream();out.write("GGUF".getBytes(StandardCharsets.US_ASCII));number(out,3,4);number(out,1,8);number(out,1,8);number(out,Long.MAX_VALUE,8);
        assertEquals(0,AndroidModelFolders.metadata(new ByteArrayInputStream(out.toByteArray())).length());
    }
}

package com.kalendarz.offline;

import static org.junit.Assert.*;
import org.junit.Test;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.*;

public class ModelTransferCoreTest {
    private static byte[] weights(int size){byte[] data=new byte[size];new Random(42).nextBytes(data);data[0]='G';data[1]='G';data[2]='U';data[3]='F';return data;}
    private static ModelTransferCore.Model model(byte[] data)throws Exception{return model(data,"https://models.example/model.gguf");}
    private static ModelTransferCore.Model model(byte[] data,String url)throws Exception{return new ModelTransferCore.Model(new JSONObject().put("id","catalogue-model.v2").put("name","Model").put("url",url).put("bytes",data.length).put("sha256",ModelTransferCore.hex(MessageDigest.getInstance("SHA-256").digest(data))));}
    private static File root()throws Exception{return Files.createTempDirectory("calendar-transfer-").toFile();}
    private static class Response extends HttpURLConnection {
        final int status;final byte[] body;final Map<String,String> headers=new HashMap<>();int maxRead;
        Response(URL url,int status,byte[] body){super(url);this.status=status;this.body=body;headers.put("Content-Length",Integer.toString(body.length));headers.put("ETag","\"v1\"");}
        Response header(String key,String value){headers.put(key,value);return this;}
        @Override public int getResponseCode(){return status;}
        @Override public String getHeaderField(String key){return headers.get(key);}
        @Override public InputStream getInputStream(){return new ByteArrayInputStream(body){@Override public synchronized int read(byte[] b,int offset,int length){maxRead=Math.max(maxRead,length);return super.read(b,offset,length);}};}
        @Override public void disconnect(){}@Override public boolean usingProxy(){return false;}@Override public void connect(){}
    }
    @Test public void streamsBoundedBuffersAndAtomicallyInstallsVerifiedBytes()throws Exception{
        byte[] data=weights(9*1024*1024);File root=root();ModelTransferCore.Model model=model(data);Response response=new Response(new URL(model.url),200,data);
        List<String> phases=new ArrayList<>();ModelTransferCore core=new ModelTransferCore(root,model,state->phases.add(state.optString("phase")),url->response);
        assertEquals("installed",core.run().getString("phase"));assertArrayEquals(data,Files.readAllBytes(core.destination().toPath()));assertTrue(response.maxRead<=256*1024);assertTrue(phases.contains("verifying"));assertTrue(core.hasVerifiedInstall());assertFalse(core.partial().exists());
        assertEquals("installed",new ModelTransferCore(root,model,state->{}).storedState().getString("phase"));
    }
    @Test public void cancellationSurvivesNewEngineAndResumesWithRangeAndStrongETag()throws Exception{
        byte[] data=weights(2*1024*1024);File root=root();ModelTransferCore.Model model=model(data);ModelTransferCore[] first=new ModelTransferCore[1];
        first[0]=new ModelTransferCore(root,model,state->{if(state.optLong("receivedBytes")>=256*1024)first[0].pause();},url->new Response(url,200,data));
        assertEquals("paused",first[0].run().getString("phase"));long offset=first[0].partial().length();assertTrue(offset>0&&offset<data.length);
        assertEquals(offset,new ModelTransferCore(root,model,state->{}).storedState().getLong("receivedBytes"));
        Response resumed=new Response(new URL(model.url),206,Arrays.copyOfRange(data,(int)offset,data.length)).header("Content-Range","bytes "+offset+"-"+(data.length-1)+"/"+data.length);
        ModelTransferCore next=new ModelTransferCore(root,model,state->{},url->resumed);assertEquals("installed",next.run().getString("phase"));assertEquals("bytes="+offset+"-",resumed.getRequestProperty("Range"));assertEquals("\"v1\"",resumed.getRequestProperty("If-Range"));assertArrayEquals(data,Files.readAllBytes(next.destination().toPath()));
    }
    private static void seed(ModelTransferCore core,byte[] data,int bytes,String etag)throws Exception{File file=new File(core.partial().getParentFile(),"test.seed");try(FileOutputStream out=new FileOutputStream(file)){out.write(data,0,bytes);out.getFD().sync();}core.commitSeed(file,bytes,etag);}
    @Test public void safelyRestartsWhenRangeIgnoredOrValidatorChanges()throws Exception{
        byte[] data=weights(1024*1024);ModelTransferCore.Model model=model(data);
        for(boolean ignoreRange:Arrays.asList(false,true)){
            File root=root();AtomicInteger count=new AtomicInteger();List<Response> responses=new ArrayList<>();
            ModelTransferCore core=new ModelTransferCore(root,model,state->{},url->{int n=count.incrementAndGet();Response response;
                if(n==1&&!ignoreRange)response=new Response(url,206,Arrays.copyOfRange(data,100,data.length)).header("Content-Range","bytes 100-"+(data.length-1)+"/"+data.length).header("ETag","\"changed\"");
                else response=new Response(url,200,data);responses.add(response);return response;});
            seed(core,data,100,"\"v1\"");assertEquals("installed",core.run().getString("phase"));assertArrayEquals(data,Files.readAllBytes(core.destination().toPath()));assertEquals(ignoreRange?1:2,count.get());if(!ignoreRange)assertNull(responses.get(1).getRequestProperty("Range"));
        }
    }
    @Test public void rejectsMalformedRangeAfterOnlyOneSafeRetry()throws Exception{
        byte[] data=weights(1000);ModelTransferCore.Model model=model(data);AtomicInteger requests=new AtomicInteger();ModelTransferCore core=new ModelTransferCore(root(),model,state->{},url->{requests.incrementAndGet();return new Response(url,206,data).header("Content-Range","bytes 9-999/1000");});
        seed(core,data,100,"\"v1\"");assertEquals("model-download-range",core.run().getString("error"));assertEquals(2,requests.get());assertFalse(core.destination().exists());
    }
    @Test public void range416SafelyRetriesFromZero()throws Exception{
        byte[] data=weights(1000);ModelTransferCore.Model model=model(data);AtomicInteger requests=new AtomicInteger();ModelTransferCore core=new ModelTransferCore(root(),model,state->{},url->requests.incrementAndGet()==1?new Response(url,416,new byte[0]):new Response(url,200,data));
        seed(core,data,100,"\"v1\"");assertEquals("installed",core.run().getString("phase"));assertEquals(2,requests.get());
    }
    @Test public void checksumFailureDoesNotReplacePreviousInstalledModel()throws Exception{
        byte[] data=weights(1024*1024),bad=data.clone(),previous=weights(4096);bad[600]^=1;File root=root();ModelTransferCore.Model model=model(data);ModelTransferCore core=new ModelTransferCore(root,model,state->{},url->new Response(url,200,bad));
        Files.write(core.destination().toPath(),previous);assertEquals("model-checksum",core.run().getString("error"));assertArrayEquals(previous,Files.readAllBytes(core.destination().toPath()));assertFalse(core.hasVerifiedInstall());assertFalse(core.partial().exists());
    }
    @Test public void rejectsNonGgufEvenWhenChecksumMatches()throws Exception{
        byte[] data=weights(1000);data[0]='X';ModelTransferCore.Model model=model(data);ModelTransferCore core=new ModelTransferCore(root(),model,state->{},url->new Response(url,200,data));assertEquals("model-gguf-invalid",core.run().getString("error"));assertFalse(core.destination().exists());
    }
    @Test public void receiptNeverTrustsOnlyLengthAndUnknownFile()throws Exception{
        byte[] data=weights(1000);ModelTransferCore.Model model=model(data);ModelTransferCore core=new ModelTransferCore(root(),model,state->{},url->new Response(url,200,data));Files.write(core.destination().toPath(),data);assertFalse(core.hasVerifiedInstall());assertFalse(core.storedState().getBoolean("installed"));
        assertEquals("installed",core.run().getString("phase"));core.destination().setLastModified(core.destination().lastModified()+10000);assertFalse(core.hasVerifiedInstall());
    }
    @Test public void receiptOrDetachedNotificationFailureCannotRevokeVerifiedInstall()throws Exception{
        byte[] data=weights(1000);ModelTransferCore.Model model=model(data);ModelTransferCore core=new ModelTransferCore(root(),model,state->{throw new IllegalStateException("detached UI");},url->new Response(url,200,data));
        assertTrue(new File(core.destination().getParentFile(),model.id+".verified.json").mkdir());
        assertEquals("installed",core.run().getString("phase"));assertArrayEquals(data,Files.readAllBytes(core.destination().toPath()));
        // The receipt could not be saved, so a new process must use full native verification.
        assertFalse(new ModelTransferCore(core.destination().getParentFile().getParentFile(),model,state->{}).hasVerifiedInstall());
    }
    @Test public void weakOrMissingValidatorCannotAuthorizePartialResume()throws Exception{
        byte[] data=weights(1000);ModelTransferCore.Model model=model(data);Response response=new Response(new URL(model.url),200,data);ModelTransferCore core=new ModelTransferCore(root(),model,state->{},url->response);
        Files.write(core.partial().toPath(),Arrays.copyOf(data,100));assertEquals("installed",core.run().getString("phase"));assertNull(response.getRequestProperty("Range"));assertNull(ModelTransferCore.strongETag("W/\"weak\""));
    }
    @Test public void realHttpDisconnectRetainsBytesAndNewInstanceResumes()throws Exception{
        byte[] data=weights(1024*1024);File root=root();AtomicReference<Throwable> failure=new AtomicReference<>();List<String> requests=Collections.synchronizedList(new ArrayList<>());
        try(ServerSocket server=new ServerSocket(0,2,InetAddress.getByName("127.0.0.1"))){server.setSoTimeout(10000);
            Thread responder=new Thread(()->{try{for(int request=0;request<2;request++){try(Socket socket=server.accept()){
                socket.setSoTimeout(10000);BufferedReader reader=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.US_ASCII));StringBuilder head=new StringBuilder();String line;while((line=reader.readLine())!=null&&!line.isEmpty())head.append(line).append('\n');requests.add(head.toString());
                int offset=request==0?0:256*1024;OutputStream output=socket.getOutputStream();String header="HTTP/1.1 "+(request==0?"200 OK":"206 Partial Content")+"\r\nContent-Length: "+(data.length-offset)+"\r\nETag: \"v1\"\r\nConnection: close\r\n"+(request==0?"":"Content-Range: bytes "+offset+"-"+(data.length-1)+"/"+data.length+"\r\n")+"\r\n";
                output.write(header.getBytes(StandardCharsets.US_ASCII));output.write(data,offset,request==0?256*1024:data.length-offset);output.flush();
            }}}catch(Throwable error){failure.set(error);}});responder.start();
            ModelTransferCore.Model model=model(data,"http://127.0.0.1:"+server.getLocalPort()+"/weights.gguf");ModelTransferCore first=new ModelTransferCore(root,model,state->{});JSONObject interrupted=first.run();assertEquals("error",interrupted.getString("phase"));assertEquals(256*1024,first.partial().length());
            ModelTransferCore next=new ModelTransferCore(root,model,state->{});assertEquals("installed",next.run().getString("phase"));responder.join(10000);assertFalse(responder.isAlive());if(failure.get()!=null)throw new AssertionError(failure.get());assertTrue(requests.get(1).contains("Range: bytes=262144-"));assertTrue(requests.get(1).contains("If-Range: \"v1\""));assertArrayEquals(data,Files.readAllBytes(next.destination().toPath()));
        }
    }
}

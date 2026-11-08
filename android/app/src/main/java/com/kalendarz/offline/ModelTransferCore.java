package com.kalendarz.offline;

import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.*;

/** Disk-backed transfer engine shared by the Android service and JVM regressions.
 * A strong validator authorizes a Range; only a verified atomic rename installs bytes.
 */
final class ModelTransferCore {
    static final int BUFFER = 256 * 1024;
    static final long CHECKPOINT = 4L * 1024 * 1024;
    static final class Model {
        final String id, name, url, sha256, key;
        final long bytes;
        Model(JSONObject input) throws Exception {
            if(input==null)throw new Exception("model-input");
            id=input.getString("id");name=input.optString("name",id);url=input.optString("url","");sha256=input.getString("sha256");bytes=input.getLong("bytes");
            if(!ModelIdentity.valid(id)||name.length()>240||!sha256.matches("[a-f0-9]{64}")||bytes<=24||bytes>16L*1024*1024*1024)throw new Exception("model-input");
            if(!url.isEmpty())validUrl(new URL(url));
            key=hex(MessageDigest.getInstance("SHA-256").digest((id+"\n"+url+"\n"+bytes+"\n"+sha256).getBytes(StandardCharsets.UTF_8)));
        }
        JSONObject json() throws Exception{return new JSONObject().put("id",id).put("name",name).put("url",url).put("sha256",sha256).put("bytes",bytes);}
    }
    interface Observer { void changed(JSONObject state); }
    interface Connections { HttpURLConnection open(URL url) throws IOException; }
    private final File transfers, installed;
    private final Model model;
    private final Observer observer;
    private final Connections connections;
    private final AtomicBoolean cancelled=new AtomicBoolean();
    private volatile HttpURLConnection connection;
    private volatile long loaded, resumed;
    private long started, measuredAt, measuredBytes;
    private double speed;
    private String phase="downloading", error;

    ModelTransferCore(File root,Model model,Observer observer){this(root,model,observer,url->(HttpURLConnection)url.openConnection());}
    ModelTransferCore(File root,Model model,Observer observer,Connections connections){
        transfers=new File(root,"calendar-model-transfers");installed=new File(root,"calendar-native-models");transfers.mkdirs();installed.mkdirs();this.model=model;this.observer=observer;this.connections=connections;
    }
    File partial(){return new File(transfers,model.key+".partial");}
    File journal(){return new File(transfers,model.key+".json");}
    File destination(){return new File(installed,model.id+".gguf");}
    private File receipt(){return new File(installed,model.id+".verified.json");}
    private File stateFile(){return new File(transfers,model.key+".state.json");}
    static String strongETag(String value){return value!=null&&value.matches("\"[^\r\n]*\"")?value:null;}
    static void validUrl(URL url)throws Exception{
        // Loopback HTTP supports the existing local transfer diagnostics; no public cleartext.
        if(!("https".equals(url.getProtocol())||"http".equals(url.getProtocol())&&"127.0.0.1".equals(url.getHost()))||url.getUserInfo()!=null||url.getHost().isEmpty())throw new Exception("model-input");
    }
    static String hex(byte[] bytes){StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
    private static JSONObject read(File file)throws Exception{
        if(!file.isFile()||file.length()>16384)throw new IOException();
        byte[] data=new byte[(int)file.length()];try(DataInputStream in=new DataInputStream(new FileInputStream(file))){in.readFully(data);}return new JSONObject(new String(data,StandardCharsets.UTF_8));
    }
    static void atomicJson(File file,JSONObject value)throws Exception{
        File temp=new File(file.getParentFile(),file.getName()+".tmp");
        try(FileOutputStream out=new FileOutputStream(temp)){out.write(value.toString().getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
        Files.move(temp.toPath(),file.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
    }
    private String validator(){try{JSONObject saved=read(journal());return model.key.equals(saved.getString("key"))?strongETag(saved.optString("etag",null)):null;}catch(Exception ignored){return null;}}
    private void saveJournal(String etag)throws Exception{JSONObject value=new JSONObject().put("key",model.key).put("model",model.json());if(etag!=null)value.put("etag",etag);atomicJson(journal(),value);}
    synchronized JSONObject snapshot(){
        JSONObject value=new JSONObject();try{
            value.put("modelId",model.id).put("phase",phase).put("receivedBytes",loaded).put("totalBytes",model.bytes).put("resumeBytes",resumed).put("bytesPerSecond",speed).put("installed","installed".equals(phase)).put("verified","installed".equals(phase));
            if(speed>0&&loaded<model.bytes)value.put("etaSeconds",(model.bytes-loaded)/speed);
            if(error!=null)value.put("error",error);
        }catch(Exception impossible){throw new IllegalStateException(impossible);}return value;
    }
    private void emit(boolean persist)throws Exception{
        long now=System.nanoTime();
        if(started==0){started=measuredAt=now;measuredBytes=loaded;}
        if(now-measuredAt>=250_000_000L){double instant=(loaded-measuredBytes)*1e9/(now-measuredAt);speed=speed>0?speed*.7+instant*.3:instant;measuredAt=now;measuredBytes=loaded;}
        JSONObject value=snapshot();if(persist)atomicJson(stateFile(),value);try{observer.changed(value);}catch(RuntimeException ignored){/* A detached UI/notification cannot stop durable I/O. */}
    }
    private void check()throws Exception{if(cancelled.get())throw new Exception("model-cancelled");}
    void pause(){cancelled.set(true);HttpURLConnection current=connection;if(current!=null)current.disconnect();}
    private void reset()throws Exception{try(FileOutputStream out=new FileOutputStream(partial())){out.getFD().sync();}loaded=resumed=0;}
    private void verify(File file)throws Exception{
        if(!file.isFile()||file.length()!=model.bytes)throw new Exception("model-size");
        MessageDigest hash=MessageDigest.getInstance("SHA-256");
        try(InputStream in=new FileInputStream(file)){
            byte[] buffer=new byte[BUFFER];int count;long n=0;while((count=in.read(buffer))!=-1){check();
                if(n==0&&(count<4||buffer[0]!='G'||buffer[1]!='G'||buffer[2]!='U'||buffer[3]!='F'))throw new Exception("model-gguf-invalid");
                hash.update(buffer,0,count);n+=count;
            }
        }
        if(!hex(hash.digest()).equals(model.sha256))throw new Exception("model-checksum");
    }
    private void writeReceipt()throws Exception{File file=destination();atomicJson(receipt(),new JSONObject().put("sha256",model.sha256).put("bytes",file.length()).put("modified",file.lastModified()));}
    boolean hasVerifiedInstall(){try{File file=destination();JSONObject value=read(receipt());return file.isFile()&&file.length()==model.bytes&&value.getLong("bytes")==model.bytes&&value.getLong("modified")==file.lastModified()&&model.sha256.equals(value.getString("sha256"));}catch(Exception ignored){return false;}}
    JSONObject storedState(){
        loaded=partial().isFile()?Math.min(partial().length(),model.bytes):0;resumed=loaded;speed=0;phase=loaded>0?"paused":"missing";
        if(hasVerifiedInstall()){loaded=model.bytes;phase="installed";return snapshot();}
        try{JSONObject saved=read(stateFile());if(model.id.equals(saved.optString("modelId"))){error=saved.optString("error",null);if("error".equals(saved.optString("phase")))phase="error";else phase=loaded>0?"paused":"missing";}}catch(Exception ignored){phase=loaded>0?"paused":"missing";}
        return snapshot();
    }
    JSONObject run(){
        FileOutputStream output=null;InputStream input=null;boolean committed=false;
        try{
            check();if(destination().isFile()){
                try{verify(destination());committed=true;writeReceipt();loaded=model.bytes;phase="installed";emit(true);return snapshot();}
                catch(Exception existing){check();if(!isInvalid(existing))throw existing;}
            }
            loaded=partial().isFile()?partial().length():0;String etag=validator();
            if(loaded>model.bytes||loaded>0&&etag==null&&loaded!=model.bytes)reset();
            resumed=loaded;phase="downloading";emit(true);
            if(loaded<model.bytes){
                if(transfers.getUsableSpace()<model.bytes-loaded+64L*1024*1024)throw new Exception("model-storage-space");
                HttpURLConnection response=null;
                for(int attempt=0;attempt<2;attempt++){
                    check();response=open(loaded,etag);int status=response.getResponseCode();
                    if(status==200){if(loaded>0){reset();etag=null;}break;}
                    if(status==206&&validRange(response,loaded,etag))break;
                    response.disconnect();connection=null;response=null;
                    if(status!=206&&status!=416)throw new Exception("model-http-"+status);
                    if(attempt==1)throw new Exception("model-download-range");reset();etag=null;
                }
                if(response==null)throw new Exception("model-download");
                String encoding=response.getHeaderField("Content-Encoding"),length=response.getHeaderField("Content-Length");
                if(encoding!=null&&!"identity".equalsIgnoreCase(encoding))throw new Exception("model-download-range");
                if(length!=null&&(!length.matches("[0-9]+")||Long.parseLong(length)!=model.bytes-loaded))throw new Exception("model-download-range");
                etag=strongETag(response.getHeaderField("ETag"));saveJournal(etag);
                output=new FileOutputStream(partial(),loaded>0);input=response.getInputStream();long checkpoint=loaded,lastEvent=0;byte[] buffer=new byte[BUFFER];int count;
                while((count=input.read(buffer))!=-1){check();if(loaded+count>model.bytes)throw new Exception("model-size");output.write(buffer,0,count);loaded+=count;
                    long now=System.nanoTime();if(loaded-checkpoint>=CHECKPOINT){output.getFD().sync();checkpoint=loaded;emit(true);lastEvent=now;}else if(now-lastEvent>=250_000_000L){emit(false);lastEvent=now;}
                }
                output.getFD().sync();output.close();output=null;input.close();input=null;response.disconnect();connection=null;
                check();if(loaded!=model.bytes)throw new Exception("model-download-incomplete");
            }
            phase="verifying";speed=0;emit(true);verify(partial());check();
            Files.move(partial().toPath(),destination().toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
            committed=true;
            writeReceipt();journal().delete();phase="installed";resumed=0;emit(true);
        }catch(Exception failure){
            try{if(output!=null){output.getFD().sync();output.close();output=null;}}catch(Exception ignored){}
            if(committed){phase="installed";error=null;loaded=model.bytes;resumed=0;try{emit(false);}catch(Exception ignored){}return snapshot();}
            if(cancelled.get()){phase="paused";error=null;}else{
                phase="error";String code=failure.getMessage();error=code!=null&&code.startsWith("model-")?code:failure instanceof SocketTimeoutException?"model-download-timeout":"model-download";
                if(isInvalid(failure)){partial().delete();journal().delete();loaded=0;}
            }
            resumed=partial().isFile()?partial().length():0;
            try{emit(true);}catch(Exception ignored){try{observer.changed(snapshot());}catch(RuntimeException detached){}}
        }finally{
            try{if(input!=null)input.close();}catch(IOException ignored){}try{if(output!=null)output.close();}catch(IOException ignored){}
            HttpURLConnection current=connection;if(current!=null)current.disconnect();connection=null;
        }
        return snapshot();
    }
    private static boolean isInvalid(Exception error){String code=error.getMessage();return "model-size".equals(code)||"model-checksum".equals(code)||"model-gguf-invalid".equals(code);}
    private boolean validRange(HttpURLConnection response,long offset,String etag){
        Matcher match=Pattern.compile("bytes ([0-9]+)-([0-9]+)/([0-9]+)").matcher(String.valueOf(response.getHeaderField("Content-Range")));
        try{return match.matches()&&Long.parseLong(match.group(1))==offset&&Long.parseLong(match.group(2))==model.bytes-1&&Long.parseLong(match.group(3))==model.bytes&&(offset==0||etag!=null&&etag.equals(strongETag(response.getHeaderField("ETag"))));}catch(NumberFormatException error){return false;}
    }
    private HttpURLConnection open(long offset,String etag)throws Exception{
        URL next=new URL(model.url);
        for(int redirect=0;redirect<8;redirect++){
            validUrl(next);HttpURLConnection current=connections.open(next);connection=current;check();current.setInstanceFollowRedirects(false);current.setConnectTimeout(15000);current.setReadTimeout(45000);current.setRequestProperty("Accept-Encoding","identity");
            if(offset>0){current.setRequestProperty("Range","bytes="+offset+"-");current.setRequestProperty("If-Range",etag);}
            int status=current.getResponseCode();
            if(status!=301&&status!=302&&status!=303&&status!=307&&status!=308)return current;
            String location=current.getHeaderField("Location");current.disconnect();connection=null;if(location==null)throw new Exception("model-download");URL redirected=new URL(next,location);
            if("https".equals(next.getProtocol())&&!"https".equals(redirected.getProtocol()))throw new Exception("model-download");next=redirected;
        }
        throw new Exception("model-download");
    }
    boolean hasSeed(long bytes,String etag){return partial().isFile()&&partial().length()>=bytes&&etag.equals(validator());}
    void commitSeed(File seed,long bytes,String etag)throws Exception{
        if(seed.length()!=bytes||bytes<=0||bytes>model.bytes||strongETag(etag)==null)throw new Exception("model-input");
        Files.move(seed.toPath(),partial().toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);saveJournal(etag);loaded=resumed=bytes;phase="paused";emit(true);
    }
}

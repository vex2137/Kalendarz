package com.kalendarz.offline;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.system.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/** SAF identities stay native. Missing entries are retained; no provider file is deleted. */
final class AndroidModelFolders {
    private final Context context;
    private final android.content.SharedPreferences prefs;
    private JSONArray folders,models,warnings=new JSONArray();
    AndroidModelFolders(Context context){this.context=context.getApplicationContext();prefs=this.context.getSharedPreferences("calendar-model-folders",0);try{folders=new JSONArray(prefs.getString("folders","[]"));models=new JSONArray(prefs.getString("models","[]"));}catch(JSONException e){throw new IllegalStateException("model-folder-config",e);}}
    private void save(){prefs.edit().putString("folders",folders.toString()).putString("models",models.toString()).apply();}
    private static String id(String value)throws Exception {byte[] hash=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(int i=0;i<16;i++)out.append(String.format(Locale.ROOT,"%02x",hash[i]&255));return out.toString();}
    synchronized JSONObject descriptor(String id)throws Exception{for(int i=0;i<models.length();i++){JSONObject m=models.getJSONObject(i);if(m.getString("id").equals(id))return new JSONObject(m.toString());}throw new Exception("model-unknown");}
    synchronized JSONObject add(Uri uri)throws Exception{
        if(!"content".equals(uri.getScheme())||!DocumentsContract.isTreeUri(uri))throw new Exception("model-folder-uri");
        String folderId=id(uri.toString());boolean found=false;for(int i=0;i<folders.length();i++)if(folders.getJSONObject(i).getString("id").equals(folderId))found=true;
        if(!found&&folders.length()>=32)throw new Exception("model-folder-limit");
        if(!found)folders.put(new JSONObject().put("id",folderId).put("uri",uri.toString()).put("path",name(DocumentsContract.buildDocumentUriUsingTree(uri,DocumentsContract.getTreeDocumentId(uri)))));
        save();return refresh();
    }
    private String name(Uri uri){try(Cursor c=context.getContentResolver().query(uri,new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME},null,null,null)){if(c!=null&&c.moveToFirst())return c.getString(0);}catch(Exception ignored){}return "GGUF folder";}
    synchronized JSONObject remove(String id)throws Exception{
        JSONArray next=new JSONArray();for(int i=0;i<folders.length();i++){JSONObject f=folders.getJSONObject(i);if(!f.getString("id").equals(id))next.put(f);}folders=next;save();return refresh();
    }
    synchronized JSONObject forget(String id)throws Exception{JSONArray next=new JSONArray();for(int i=0;i<models.length();i++)if(!models.getJSONObject(i).getString("id").equals(id))next.put(models.getJSONObject(i));models=next;save();return snapshot();}
    synchronized JSONObject relink(String id,Uri uri)throws Exception{
        if(!"content".equals(uri.getScheme()))throw new Exception("model-folder-uri");JSONObject m=descriptor(id);
        try(ParcelFileDescriptor fd=context.getContentResolver().openFileDescriptor(uri,"r")){
            if(fd==null)throw new Exception("model-folder-read");Os.lseek(fd.getFileDescriptor(),0,OsConstants.SEEK_SET);long bytes=fd.getStatSize();if(bytes<24||bytes>16L*1024*1024*1024)throw new Exception("model-size");
            JSONObject meta;try(InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(ParcelFileDescriptor.dup(fd.getFileDescriptor()))){meta=metadata(in);}
            m.put("uri",uri.toString()).put("file",name(uri)).put("bytes",bytes).put("modified",0).put("architecture",meta.optString("architecture",m.getString("architecture"))).put("standalone",true).put("available",true);
            for(int i=0;i<models.length();i++)if(models.getJSONObject(i).getString("id").equals(id)){models.put(i,m);break;}save();return snapshot();
        }
    }
    synchronized JSONObject refresh()throws Exception{
        Map<String,JSONObject> retained=new LinkedHashMap<>();for(int i=0;i<models.length();i++){JSONObject m=models.getJSONObject(i);m.put("available",false);retained.put(m.getString("id"),m);}
        warnings=new JSONArray();int[] count={0};
        for(int i=0;i<folders.length();i++){JSONObject folder=folders.getJSONObject(i);Uri tree=Uri.parse(folder.getString("uri"));try{scan(tree,DocumentsContract.getTreeDocumentId(tree),folder.getString("id"),retained,count,0);}catch(Exception error){if(warnings.length()<100)warnings.put(new JSONObject().put("folderId",folder.getString("id")).put("code","model-folder-permission"));}}
        for(JSONObject m:retained.values())if(m.optBoolean("standalone")){m.put("available",true);try(ParcelFileDescriptor fd=open(m.getString("id"))){}catch(Exception error){m.put("available",false);}}
        models=new JSONArray();for(JSONObject m:retained.values())models.put(m);save();return snapshot();
    }
    private void scan(Uri tree,String parent,String folderId,Map<String,JSONObject> retained,int[] count,int depth)throws Exception{
        if(depth>8||count[0]>=4096)return;
        String[] projection={DocumentsContract.Document.COLUMN_DOCUMENT_ID,DocumentsContract.Document.COLUMN_DISPLAY_NAME,DocumentsContract.Document.COLUMN_MIME_TYPE,DocumentsContract.Document.COLUMN_SIZE,DocumentsContract.Document.COLUMN_LAST_MODIFIED};
        try(Cursor c=context.getContentResolver().query(DocumentsContract.buildChildDocumentsUriUsingTree(tree,parent),projection,null,null,null)){
            while(c!=null&&c.moveToNext()&&count[0]++<4096){String document=c.getString(0),name=c.getString(1);if(DocumentsContract.Document.MIME_TYPE_DIR.equals(c.getString(2))){scan(tree,document,folderId,retained,count,depth+1);continue;}
                if(name==null||!name.toLowerCase(Locale.ROOT).endsWith(".gguf")||retained.size()>=128&&!retained.containsKey("external-"+id(tree.getAuthority()+":"+document)))continue;
                Uri uri=DocumentsContract.buildDocumentUriUsingTree(tree,document);String modelId="external-"+id(uri.getAuthority()+":"+DocumentsContract.getDocumentId(uri));
                try(ParcelFileDescriptor fd=context.getContentResolver().openFileDescriptor(uri,"r")){
                    if(fd==null)continue;Os.lseek(fd.getFileDescriptor(),0,OsConstants.SEEK_SET);long bytes=fd.getStatSize();if(bytes<24||bytes>16L*1024*1024*1024)continue;
                    JSONObject meta;try(InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(ParcelFileDescriptor.dup(fd.getFileDescriptor()))){meta=metadata(in);}
                    JSONObject m=new JSONObject().put("id",modelId).put("name",meta.optString("name",name).substring(0,Math.min(200,meta.optString("name",name).length()))).put("file",name).put("bytes",bytes).put("uri",uri.toString()).put("modified",c.isNull(4)?0:c.getLong(4)).put("architecture",meta.optString("architecture","unknown")).put("maxContext",Math.max(32,Math.min(2048,meta.optInt("context",2048)))).put("quantization","GGUF").put("folderIds",new JSONArray().put(folderId)).put("external",true).put("available",true).put("sha256","").put("revision","local").put("url","").put("license","").put("licenseName","Local GGUF").put("estimatedRamMB",(int)(bytes/1048576*1.5)+512);
                    retained.put(modelId,m);
                }catch(Exception error){if(warnings.length()<100)warnings.put(new JSONObject().put("folderId",folderId).put("file",name).put("code",error instanceof ErrnoException?"model-folder-seek-required":"model-folder-read"));}
            }
        }
    }
    synchronized ParcelFileDescriptor open(String id)throws Exception{
        JSONObject m=descriptor(id);if(!m.optBoolean("available",false))throw new Exception("model-folder-unavailable");ParcelFileDescriptor fd=context.getContentResolver().openFileDescriptor(Uri.parse(m.getString("uri")),"r");
        if(fd==null)throw new Exception("model-folder-read");try{Os.lseek(fd.getFileDescriptor(),0,OsConstants.SEEK_SET);try(Cursor stat=context.getContentResolver().query(Uri.parse(m.getString("uri")),new String[]{DocumentsContract.Document.COLUMN_LAST_MODIFIED},null,null,null)){if(stat!=null&&stat.moveToFirst()&&!stat.isNull(0)&&m.optLong("modified")>0&&stat.getLong(0)!=m.getLong("modified"))throw new Exception("model-folder-changed");}if(fd.getStatSize()!=m.getLong("bytes"))throw new Exception("model-folder-changed");return fd;}catch(Exception e){fd.close();throw new Exception(e instanceof ErrnoException?"model-folder-seek-required":"model-folder-changed",e);}
    }
    synchronized JSONObject info(String id)throws Exception{try(ParcelFileDescriptor fd=open(id)){return new JSONObject().put("installed",true).put("verified",true).put("bytes",fd.getStatSize());}catch(Exception e){return new JSONObject().put("installed",false).put("verified",false);}}
    synchronized JSONObject snapshot()throws Exception{
        JSONArray safeFolders=new JSONArray(),safeModels=new JSONArray();for(int i=0;i<folders.length();i++){JSONObject f=folders.getJSONObject(i);safeFolders.put(new JSONObject().put("id",f.getString("id")).put("path",f.getString("path")));}
        for(int i=0;i<models.length();i++){JSONObject m=new JSONObject(models.getJSONObject(i).toString());m.remove("uri");m.remove("modified");safeModels.put(m);}
        return new JSONObject().put("folders",safeFolders).put("models",safeModels).put("warnings",warnings);
    }
    // Read at most 1 MiB of metadata. Tokenizer arrays may exceed this budget;
    // model/architecture keys already found remain useful without allocating arrays.
    static JSONObject metadata(InputStream input)throws Exception{
        DataInputStream in=new DataInputStream(new BufferedInputStream(new LimitedInput(input,1024*1024)));JSONObject out=new JSONObject();
        if(in.readInt()!=0x47475546)throw new IOException("GGUF");int version=Integer.reverseBytes(in.readInt());if(version!=2&&version!=3)throw new IOException("GGUF version");
        long tensors=Long.reverseBytes(in.readLong()),count=Long.reverseBytes(in.readLong());if(tensors<1||count<1||count>100000)throw new IOException("GGUF header");
        try{for(long i=0;i<count;i++){String key=string(in);int type=Integer.reverseBytes(in.readInt());Object value=value(in,type,0);if(key.equals("general.name")&&value instanceof String)out.put("name",value);if(key.equals("general.architecture")&&value instanceof String&&((String)value).matches("[a-z0-9_]{1,64}"))out.put("architecture",value);if(key.endsWith(".context_length")&&value instanceof Number)out.put("context",value);}}catch(EOFException budget){/* Bounded scan; engine validates the complete GGUF on load. */}return out;
    }
    private static String string(DataInputStream in)throws Exception{long n=Long.reverseBytes(in.readLong());if(n<0||n>65536)throw new EOFException();byte[] bytes=new byte[(int)n];in.readFully(bytes);return new String(bytes,StandardCharsets.UTF_8);}
    private static Object value(DataInputStream in,int type,int depth)throws Exception{
        switch(type){case 0:case 1:case 7:return in.readByte();case 2:case 3:return Short.reverseBytes(in.readShort());case 4:return Integer.toUnsignedLong(Integer.reverseBytes(in.readInt()));case 5:case 6:return Integer.reverseBytes(in.readInt());case 10:case 11:case 12:return Long.reverseBytes(in.readLong());case 8:return string(in);case 9:int subtype=Integer.reverseBytes(in.readInt());long n=Long.reverseBytes(in.readLong());if(depth>0||n<0||n>1000000)throw new EOFException();for(long i=0;i<n;i++)value(in,subtype,depth+1);return null;default:throw new EOFException();}
    }
    private static final class LimitedInput extends FilterInputStream{int remaining;LimitedInput(InputStream in,int limit){super(in);remaining=limit;}@Override public int read()throws IOException{if(remaining<=0)return -1;int v=super.read();if(v>=0)remaining--;return v;}@Override public int read(byte[] b,int off,int len)throws IOException{if(remaining<=0)return -1;int n=super.read(b,off,Math.min(len,remaining));if(n>0)remaining-=n;return n;}}
}

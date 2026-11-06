package com.kalendarz.offline;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import java.io.*;

/** Models a provider accepting raw file opens but rejecting typed asset opens. */
public class RawSafFixtureProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    @Override public AssetFileDescriptor openTypedAssetFile(Uri uri, String mime, Bundle options) {
        throw new SecurityException("Synthetic typed-open rejection");
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode) || "denied".equals(uri.getLastPathSegment())) throw new SecurityException("Synthetic provider denial");
        File file=new File(getContext().getCacheDir(),"raw-saf-fixture.gguf");
        try(FileOutputStream out=new FileOutputStream(file)) {
            byte[] chunk=new byte[65536];chunk[0]='G';chunk[1]='G';chunk[2]='U';chunk[3]='F';chunk[4]=3;
            for(int i=0;i<128;i++)out.write(chunk);
        } catch(IOException error) {throw new FileNotFoundException("fixture-write");}
        return ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public String getType(Uri uri) {return "application/octet-stream";}
    @Override public Cursor query(Uri uri,String[] p,String s,String[] a,String o) {return null;}
    @Override public Uri insert(Uri uri,ContentValues values) {throw new UnsupportedOperationException();}
    @Override public int delete(Uri uri,String s,String[] a) {return 0;}
    @Override public int update(Uri uri,ContentValues v,String s,String[] a) {return 0;}
}

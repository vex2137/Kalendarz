package com.kalendarz.offline;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Inference settings only; never infer applied capacity from a requested flag. */
final class NativeContextConfig {
    // Platform safety ceiling, not a claim about model metadata or actual RAM use.
    static final int MAX_CONTEXT=32768;
    static void requireMemory(long available,boolean lowMemory){
        if(lowMemory||available<256L*1024*1024)throw new IllegalArgumentException("model-memory");
    }
    static int validateOutputTokens(double value) {
        if (!Double.isFinite(value) || value != Math.floor(value) || value < 1 || value > 4096)
            throw new IllegalArgumentException("model-output-range");
        return (int)value;
    }
    static int validate(double value) {
        if (!Double.isFinite(value) || value != Math.floor(value) || value < 32 || value > MAX_CONTEXT)
            throw new IllegalArgumentException("model-context-range");
        return (int)value;
    }
    static Integer fromLog(String log) {
        for (String field : new String[]{"n_ctx_per_seq", "n_ctx"}) {
            Matcher matcher=Pattern.compile("\\b"+field+"\\s*=\\s*(\\d+)").matcher(log);
            Integer result=null;
            while(matcher.find())try{long n=Long.parseLong(matcher.group(1));if(n>0&&n<=Integer.MAX_VALUE)result=(int)n;}catch(NumberFormatException ignored){}
            if(result!=null)return result;
        }
        return null;
    }
}

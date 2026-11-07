package com.kalendarz.offline;
import org.junit.Test;
import static org.junit.Assert.*;
public class NativeContextConfigTest {
    @org.junit.Test public void outputBudgetIsBoundedAndDoesNotTruncateFractions() {
        org.junit.Assert.assertEquals(1500,NativeContextConfig.validateOutputTokens(1500));
        org.junit.Assert.assertEquals(4096,NativeContextConfig.validateOutputTokens(4096));
        for(double value:new double[]{0,-1,4097,1.5,Double.NaN,Double.POSITIVE_INFINITY}) {
            try { NativeContextConfig.validateOutputTokens(value);org.junit.Assert.fail("Invalid budget accepted"); }
            catch(IllegalArgumentException expected) { org.junit.Assert.assertEquals("model-output-range",expected.getMessage()); }
        }
    }
    @Test public void preservesExactContextAndRejectsInvalidValues(){
        assertEquals(8193,NativeContextConfig.validate(8193));
        for(double value:new double[]{0,31,1.5,Double.NaN,Double.POSITIVE_INFINITY,2147483648d}){
            try{NativeContextConfig.validate(value);fail("invalid context accepted");}catch(IllegalArgumentException expected){}
        }
    }
    @Test public void reportsAppliedContextOnlyWhenNativeLogsConfirmIt(){
        assertEquals(Integer.valueOf(8192),NativeContextConfig.fromLog("n_ctx = 16384\nn_ctx_per_seq = 8192"));
        assertEquals(Integer.valueOf(8448),NativeContextConfig.fromLog("n_ctx = 8448"));
        assertNull(NativeContextConfig.fromLog("requested --ctx-size 8192"));
        assertNull(NativeContextConfig.fromLog("n_ctx = 0"));
    }
}

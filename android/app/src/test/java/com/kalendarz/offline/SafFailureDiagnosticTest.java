package com.kalendarz.offline;
import static org.junit.Assert.*;
import org.junit.Test;
import com.getcapacitor.JSObject;
public class SafFailureDiagnosticTest {
    @Test public void securityExceptionRetainsOperationAndTypeWithoutProviderMessage() throws Exception {
        SecurityException failure=new SecurityException("content://private/Download/secret.gguf");
        failure.setStackTrace(new StackTraceElement[]{new StackTraceElement("android.content.ContentResolver","openInputStream","ContentResolver.java",123)});
        JSObject detail=CalendarModelImportPlugin.failureDetail("resolver-open",failure);
        assertEquals("resolver-open",detail.getString("stage"));
        assertEquals("java.lang.SecurityException",detail.getString("exceptionType"));
        assertFalse(detail.toString().contains("secret")); assertFalse(detail.toString().contains("content://"));
        assertTrue(detail.toString().contains("android.content.ContentResolver.openInputStream"));
    }
    @Test public void headerFailureIsNotReportedAsResolverFailure() throws Exception {
        JSObject detail=CalendarModelImportPlugin.failureDetail("header-read",new SecurityException("private"));
        assertEquals("header-read",detail.getString("stage")); assertFalse(detail.toString().contains("private"));
    }
}

package com.kalendarz.offline;
import org.junit.Test;
import org.json.*;
import static org.junit.Assert.*;

public class NativeRequestSamplingTest {
    @Test public void nativeSamplingMatchesDesktopAndCannotBeOverriddenByUnvalidatedOptions()throws Exception{
        JSONObject input=new JSONObject().put("messages",new JSONArray().put(new JSONObject().put("role","user").put("content","Zażółć gęślą"))).put("max_tokens",64).put("temperature",9).put("repeat_penalty",100).put("top_k",999).put("unsafe_server_option",true);
        JSONObject request=NativeInferenceEngine.validateRequest(input);
        assertEquals(0,request.getInt("temperature"));assertEquals(50,request.getInt("top_k"));assertEquals(1.05,request.getDouble("repeat_penalty"),0);assertFalse(request.has("unsafe_server_option"));assertFalse(request.getJSONObject("chat_template_kwargs").getBoolean("enable_thinking"));assertTrue(request.getJSONObject("stream_options").getBoolean("include_usage"));assertEquals("Zażółć gęślą",request.getJSONArray("messages").getJSONObject(0).getString("content"));
    }
}

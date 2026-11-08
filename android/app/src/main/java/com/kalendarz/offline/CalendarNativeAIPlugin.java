package com.kalendarz.offline;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
/** Activity bridge only. The application-owned engine survives Activity recreation. */
@CapacitorPlugin(name="CalendarNativeAI")
public final class CalendarNativeAIPlugin extends Plugin {
    private static NativeInferenceEngine engine;
    private static volatile WeakReference<CalendarNativeAIPlugin> target=new WeakReference<>(null);
    static synchronized NativeInferenceEngine engineFor(android.content.Context context){
        if(engine==null)engine=new NativeInferenceEngine(context,(name,data)->{CalendarNativeAIPlugin plugin=target.get();if(plugin!=null)plugin.notifyListeners(name,data);},()->target.get()!=null);
        return engine;
    }
    private NativeInferenceEngine engine(){target=new WeakReference<>(this);return engineFor(getContext());}
    @PluginMethod public void status(PluginCall call){engine().status(call);}
    @PluginMethod public void info(PluginCall call){engine().info(call);}
    @PluginMethod public void begin(PluginCall call){engine().begin(call);}
    @PluginMethod public void write(PluginCall call){engine().write(call);}
    @PluginMethod public void finish(PluginCall call){engine().finish(call);}
    @PluginMethod public void abortUpload(PluginCall call){engine().abortUpload(call);}
    @PluginMethod public void remove(PluginCall call){engine().remove(call);}
    @PluginMethod public void cancelGeneration(PluginCall call){engine().cancelGeneration(call);}
    @PluginMethod public void stop(PluginCall call){engine().stop(call);}
    @PluginMethod public void setMode(PluginCall call){engine().setMode(call);}
    @PluginMethod public void prepare(PluginCall call){engine().prepare(call);}
    @PluginMethod public void configureResidency(PluginCall call){engine().configureResidency(call);}
    @PluginMethod public void complete(PluginCall call){engine().complete(call);}
    @PluginMethod public void generation(PluginCall call){engine().generation(call);}
    @Override protected void handleOnDestroy(){if(target.get()!=this)return;target=new WeakReference<>(null);if(engine!=null&&(getActivity()==null||!getActivity().isChangingConfigurations()))engine.bridgeDestroyed();}
    static ProcessBuilder nativeProcessBuilder(java.io.File binary,java.util.List<String> args){return NativeInferenceEngine.nativeProcessBuilder(binary,args);}
    static android.webkit.WebResourceResponse intercept(android.content.Context context,android.net.Uri uri){return NativeInferenceEngine.intercept(context,uri);}
}

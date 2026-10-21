package com.kalendarz.offline;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CalendarDevicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}

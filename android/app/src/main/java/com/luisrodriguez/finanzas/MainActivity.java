package com.luisrodriguez.finanzas;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NotificationBillsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

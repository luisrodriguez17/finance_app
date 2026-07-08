package com.luisrodriguez.finanzas;

import android.content.Intent;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

@CapacitorPlugin(name = "NotificationBills")
public class NotificationBillsPlugin extends Plugin {

    @PluginMethod
    public void isAccessEnabled(PluginCall call) {
        String enabled = Settings.Secure.getString(
                getContext().getContentResolver(), "enabled_notification_listeners");
        boolean ok = enabled != null && enabled.contains(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("enabled", ok);
        call.resolve(ret);
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void drainCaptured(PluginCall call) {
        try {
            JSONArray arr = new JSONArray(BillNotificationListenerService.drain(getContext()));
            JSObject ret = new JSObject();
            ret.put("notifications", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to read captured notifications", e);
        }
    }
}

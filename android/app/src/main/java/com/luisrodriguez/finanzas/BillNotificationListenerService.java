package com.luisrodriguez.finanzas;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.regex.Pattern;

/**
 * Listens to notifications posted by other apps (requires the user to grant
 * "notification access" in system settings) and queues the ones that look like
 * bank/wallet transaction alerts. The JS side drains the queue and parses the
 * amount/merchant into a pending bill for the user to review.
 *
 * Only notifications matching BOTH a currency amount and a transaction keyword
 * are stored; everything else is ignored and never persisted.
 */
public class BillNotificationListenerService extends NotificationListenerService {

    private static final String PREFS = "notification_bills";
    private static final String KEY_PENDING = "pending";
    private static final int MAX_QUEUE = 100;

    private static final Pattern AMOUNT =
            Pattern.compile("(₡|¢|\\$|CRC|USD|colones)\\s?\\d", Pattern.CASE_INSENSITIVE);
    private static final Pattern KEYWORD = Pattern.compile(
            "(compra|purchase|spent|gast|transac|pago|payment|débito|debito|retiro|withdrawal)",
            Pattern.CASE_INSENSITIVE);

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn.getPackageName().equals(getPackageName())) return;
        Notification n = sbn.getNotification();
        if (n == null || n.extras == null) return;

        Bundle extras = n.extras;
        String title = str(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = str(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (text.isEmpty()) text = str(extras.getCharSequence(Notification.EXTRA_TEXT));

        String combined = title + "\n" + text;
        if (!AMOUNT.matcher(combined).find() || !KEYWORD.matcher(combined).find()) return;

        append(this, sbn.getPackageName(), title, text, sbn.getPostTime());
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString();
    }

    static synchronized void append(Context ctx, String pkg, String title, String text, long postedAt) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray arr = new JSONArray(prefs.getString(KEY_PENDING, "[]"));
            JSONObject o = new JSONObject();
            o.put("package", pkg);
            o.put("title", title);
            o.put("text", text);
            o.put("postedAt", postedAt);
            arr.put(o);
            while (arr.length() > MAX_QUEUE) arr.remove(0);
            prefs.edit().putString(KEY_PENDING, arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** Return the queued notifications as a JSON array string and clear the queue. */
    static synchronized String drain(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String out = prefs.getString(KEY_PENDING, "[]");
        prefs.edit().putString(KEY_PENDING, "[]").apply();
        return out;
    }
}

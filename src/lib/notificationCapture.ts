/**
 * JS bridge to the native Android NotificationBills Capacitor plugin
 * (android/app/src/main/java/.../NotificationBillsPlugin.java).
 *
 * On web/iOS every call degrades to a safe no-op so the PWA keeps working.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PendingBill } from '../types';
import { toPendingBill } from './billParser';

export interface CapturedNotification {
  package: string;
  title: string;
  text: string;
  postedAt: number;
}

interface NotificationBillsPlugin {
  /** Whether the user has granted notification access to the app. */
  isAccessEnabled(): Promise<{ enabled: boolean }>;
  /** Open Android's notification-access system settings screen. */
  openAccessSettings(): Promise<void>;
  /** Return and clear notifications captured while the app was closed. */
  drainCaptured(): Promise<{ notifications: CapturedNotification[] }>;
}

const plugin = registerPlugin<NotificationBillsPlugin>('NotificationBills');

export const isNativeAndroid = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function isNotificationAccessEnabled(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    return (await plugin.isAccessEnabled()).enabled;
  } catch {
    return false;
  }
}

export async function openNotificationAccessSettings(): Promise<void> {
  if (!isNativeAndroid()) return;
  await plugin.openAccessSettings();
}

/** Pull captured bank/wallet notifications and parse them into pending bills. */
export async function drainCapturedBills(): Promise<PendingBill[]> {
  if (!isNativeAndroid()) return [];
  try {
    const { notifications } = await plugin.drainCaptured();
    const bills: PendingBill[] = [];
    for (const n of notifications) {
      const parsed = toPendingBill([n.title, n.text].filter(Boolean).join('\n'), 'notification', n.postedAt);
      if (parsed) bills.push(parsed);
    }
    return bills;
  } catch {
    return [];
  }
}

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export async function hapticSelection(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // Graceful no-op on unsupported environments
  }
}

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const impactStyle =
        style === 'heavy'
          ? ImpactStyle.Heavy
          : style === 'medium'
            ? ImpactStyle.Medium
            : ImpactStyle.Light;
      await Haptics.impact({ style: impactStyle });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const ms = style === 'heavy' ? 40 : style === 'medium' ? 25 : 15;
      navigator.vibrate(ms);
    }
  } catch {
    // Graceful no-op
  }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const notifType =
        type === 'error'
          ? NotificationType.Error
          : type === 'warning'
            ? NotificationType.Warning
            : NotificationType.Success;
      await Haptics.notification({ type: notifType });
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const pattern = type === 'error' ? [50, 50, 50] : [20, 40, 20];
      navigator.vibrate(pattern);
    }
  } catch {
    // Graceful no-op
  }
}

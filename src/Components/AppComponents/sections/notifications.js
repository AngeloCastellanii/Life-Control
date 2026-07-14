export function notificationsSupported() {
   return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission() {
   return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
   if (!notificationsSupported()) {
      return 'unsupported';
   }
   if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Notification.permission;
   }
   try {
      return await Notification.requestPermission();
   } catch {
      return Notification.permission;
   }
}

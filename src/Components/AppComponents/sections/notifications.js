const INBOX_KEY = 'lc_notification_inbox';
const MAX_INBOX = 40;

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

export function readNotificationInbox() {
   try {
      const parsed = JSON.parse(localStorage.getItem(INBOX_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
   } catch {
      return [];
   }
}

export function writeNotificationInbox(items) {
   try {
      localStorage.setItem(INBOX_KEY, JSON.stringify((items ?? []).slice(0, MAX_INBOX)));
   } catch {
      /* ignore */
   }
}

export function unreadNotificationCount() {
   return readNotificationInbox().filter((item) => !item.read).length;
}

export function addNotificationToInbox(entry) {
   const items = readNotificationInbox();
   const id = entry.id || `lc-${Date.now()}`;
   const next = [
      {
         id,
         title: entry.title || 'Recordatorio',
         body: entry.body || '',
         route: entry.route || '/',
         createdAt: entry.createdAt ?? Date.now(),
         read: false
      },
      ...items.filter((item) => item.id !== id)
   ];
   writeNotificationInbox(next);
   slice.events?.emit?.('reminder:inbox-changed', { items: next });
   return next;
}

export function markInboxRead(id) {
   const next = readNotificationInbox().map((item) => (item.id === id ? { ...item, read: true } : item));
   writeNotificationInbox(next);
   slice.events?.emit?.('reminder:inbox-changed', { items: next });
   return next;
}

export function dismissInboxItem(id) {
   const next = readNotificationInbox().filter((item) => item.id !== id);
   writeNotificationInbox(next);
   slice.events?.emit?.('reminder:inbox-changed', { items: next });
   return next;
}

export async function getServiceWorkerRegistration() {
   if (!('serviceWorker' in navigator)) {
      return null;
   }
   try {
      return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
   } catch {
      return null;
   }
}

export async function showOsNotification({ title, body, tag, route }) {
   const permission = notificationPermission();
   if (permission !== 'granted') {
      return false;
   }

   const options = {
      body,
      tag: tag || 'lc-pending-digest',
      renotify: true,
      requireInteraction: true,
      icon: '/images/icon-192.png',
      badge: '/images/icon-192.png',
      data: { route: route || '/' }
   };

   const registration = await getServiceWorkerRegistration();
   if (registration?.showNotification) {
      try {
         await registration.showNotification(title || 'Life Control', options);
         return true;
      } catch {
         /* fallback */
      }
   }

   try {
      const notification = new Notification(title || 'Life Control', options);
      notification.onclick = () => {
         window.focus();
         slice.router?.navigate?.(route);
         notification.close();
      };
      return true;
   } catch {
      return false;
   }
}

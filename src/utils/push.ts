import api from '../services/api';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests notification permission (if needed) and subscribes the current
 * browser to push notifications, saving the subscription server-side under
 * the logged-in user. Returns true on success.
 */
export async function enablePushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const { data } = await api.get('/push/vapid-key');
  if (!data?.publicKey) return false; // push not configured on the server yet

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }

  const sub = subscription.toJSON();
  await api.post('/push/subscribe', {
    endpoint: sub.endpoint,
    keys: sub.keys,
  });

  return true;
}

/** Unsubscribes the current browser from push notifications entirely. */
export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const sub = subscription.toJSON();
  await subscription.unsubscribe();
  if (sub.endpoint) {
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  }
}

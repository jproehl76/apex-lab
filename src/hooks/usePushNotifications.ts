import { useState, useEffect } from 'react';
import { config } from '@/config';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const STORAGE_KEY = 'push-subscription';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const isSupported = typeof window !== 'undefined'
    && 'PushManager' in window
    && 'Notification' in window
    && !!VAPID_PUBLIC_KEY
    && !!config.whoopWorkerUrl;

  const [isSubscribed, setIsSubscribed] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEY);
  });
  const [isLoading, setIsLoading] = useState(false);

  // Verify subscription is still valid on mount
  useEffect(() => {
    if (!isSupported || !isSubscribed) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        if (!sub) {
          localStorage.removeItem(STORAGE_KEY);
          setIsSubscribed(false);
        }
      });
    });
  }, []); // eslint-disable-line

  async function subscribe() {
    if (!isSupported || isLoading) return;
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;
      const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY!);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray.buffer as ArrayBuffer,
      });

      const subJson = sub.toJSON();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subJson));

      await fetch(`${config.whoopWorkerUrl}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subJson),
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error('Push subscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    if (!isSupported || isLoading) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const subJson = sub.toJSON();
        await fetch(`${config.whoopWorkerUrl}/push/subscribe`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subJson),
        }).catch(() => {});
      }
      localStorage.removeItem(STORAGE_KEY);
      setIsSubscribed(false);
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}

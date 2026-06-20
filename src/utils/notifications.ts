import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registrado com sucesso:', registration.scope);
    return registration;
  } catch (err) {
    console.error('Falha ao registrar o Service Worker:', err);
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) return false;
  if (!('PushManager' in window)) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  try {
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
      });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const sub = subscription.toJSON();
    const keys = sub.keys as { p256dh: string; auth: string };

    await supabase.from('push_subscriptions').upsert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    );

    return true;
  } catch (err) {
    console.error('[subscribeToPush]', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch (err) {
    console.error('[unsubscribeFromPush]', err);
  }
}

export async function sendTaskNotification(title: string, body: string, routineId: string, dateStr: string) {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      data: { routineId, dateStr },
      actions: [
        { action: 'completed', title: 'Concluir' },
        { action: 'in_progress', title: 'Em Andamento' },
        { action: 'late', title: 'Atrasado' },
        { action: 'canceled', title: 'Cancelar' },
      ]
    } as any);
  }
}

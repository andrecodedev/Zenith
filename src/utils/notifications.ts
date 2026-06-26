import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
let _subscribing = false;

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
  if (_subscribing) return false;
  if (!VAPID_PUBLIC_KEY) { console.warn('[push] VAPID_PUBLIC_KEY ausente'); return false; }
  if (!('PushManager' in window)) { console.warn('[push] PushManager não disponível'); return false; }

  const granted = await requestNotificationPermission();
  if (!granted) { console.warn('[push] permissão negada'); return false; }

  _subscribing = true;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { console.warn('[push] sem usuário autenticado'); return false; }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Verificar se este endpoint já está salvo para o user atual
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();

      if (existing) {
        console.log('[push] subscription já existe para user:', user.id);
        return true;
      }

      // Endpoint pertence a outro user ou sumiu do banco — forçar unsubscribe
      // para gerar endpoint novo (sem isso, o upsert bateria na RLS do outro user)
      await subscription.unsubscribe();
      console.log('[push] subscription antiga removida, gerando nova para user:', user.id);
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });

    const sub = subscription.toJSON();
    const keys = sub.keys as { p256dh: string; auth: string };

    // Insere o novo endpoint (sem deletar os outros dispositivos do usuário)
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'endpoint' });

    if (error) { console.error('[push] falha ao salvar no banco:', error); return false; }

    console.log('[push] subscription salva para user:', user.id);
    return true;
  } catch (err) {
    console.error('[subscribeToPush]', err);
    return false;
  } finally {
    _subscribing = false;
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

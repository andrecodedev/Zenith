export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações de desktop');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado com sucesso:', registration.scope);
      return registration;
    } catch (err) {
      console.error('Falha ao registrar o Service Worker:', err);
    }
  }
  return null;
}

export async function sendTaskNotification(title: string, body: string, routineId: string, dateStr: string) {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      body,
      icon: '/logo.png', // Caminho do ícone do seu app
      badge: '/logo.png',
      data: {
        routineId,
        dateStr
      },
      actions: [
        { action: 'completed', title: '✅ Concluir' },
        { action: 'late', title: '⏰ Adiar' }
      ]
    } as any);
  }
}

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  self.skipWaiting();
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Zenith', body: 'Você tem uma tarefa agora!' };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const appVisible = clients.some(c => c.visibilityState === 'visible');
      if (appVisible) return; // app aberto: notificação local já cuida
      return self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/logo.png',
        badge: '/logo.png',
        data: data.payload ?? {},
        actions: [
          { action: 'completed', title: 'Concluído' },
          { action: 'in_progress', title: 'Em andamento' },
        ]
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  // Enviar a ação para todas as abas abertas do app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Se não houver aba aberta, talvez quiséssemos abrir uma (clients.openWindow('/'))
      for (const client of clientList) {
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: action,
          payload: data
        });
      }
    })
  );
});

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  self.skipWaiting();
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

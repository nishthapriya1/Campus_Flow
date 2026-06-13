// Service Worker for Campus Flow Web Push Notifications
// Served from root path to cover the entire app scope

self.addEventListener('push', (event) => {
  console.log('SW: Push event received.');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.warn('SW: Push data is not JSON:', event.data.text());
      data = { title: 'Campus Flow Update', body: event.data.text() };
    }
  }

  const title = data.title || 'Campus Flow Notification';
  const body = data.body || data.shortMessage || 'You have a new institutional alert.';
  
  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: data.data?.url || '/notifications',
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('SW: Notification clicked.');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Find if client window is already open
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if not found
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('SW: Notification closed by user:', event.notification.title);
});

import { useState, useEffect } from 'react';
import client from '../api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushPermission = () => {
  const [permission, setPermission] = useState('default');
  const [deniedByApp, setDeniedByApp] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check state on mount
  useEffect(() => {
    const checkPermissionState = async () => {
      setLoading(true);
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        console.warn('Push notifications not supported in this browser.');
        setLoading(false);
        return;
      }

      setPermission(Notification.permission);
      setDeniedByApp(localStorage.getItem('cf_push_denied') === 'true');

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setSubscriptionActive(!!subscription);
      } catch (err) {
        console.error('Error checking push subscription status:', err);
      }
      setLoading(false);
    };

    checkPermissionState();
  }, []);

  const subscribeUser = async () => {
    setLoading(true);
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        throw new Error('Push notifications not supported in this browser.');
      }

      // 1. Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'denied') {
        localStorage.setItem('cf_push_denied', 'true');
        setDeniedByApp(true);
        throw new Error('Permission denied for notifications.');
      }

      if (result === 'granted') {
        // Remove app-level denial if they explicitly allowed it
        localStorage.removeItem('cf_push_denied');
        setDeniedByApp(false);

        // 2. Fetch VAPID public key
        const keyRes = await client.get('/push/vapid-public-key');
        const vapidPublicKey = keyRes.data.publicKey;

        if (!vapidPublicKey) {
          throw new Error('VAPID public key was not found.');
        }

        // 3. Register service worker and subscribe
        const registration = await navigator.serviceWorker.ready;
        const subscribeOptions = {
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        };

        const subscription = await registration.pushManager.subscribe(subscribeOptions);
        
        // 4. POST the subscription to our backend
        await client.post('/push/subscribe', {
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        });

        setSubscriptionActive(true);
        console.log('Push subscription successfully registered on backend.');
      }
    } catch (err) {
      console.error('Failed to subscribe user to push notifications:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 1. Call unsubscribe on browser API
        await subscription.unsubscribe();

        // 2. Notify backend to delete from DB
        await client.post('/push/unsubscribe', {
          endpoint: subscription.endpoint,
        });
      }

      setSubscriptionActive(false);
      console.log('Push subscription successfully removed.');
    } catch (err) {
      console.error('Failed to unsubscribe from push notifications:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const dismissPrompt = () => {
    localStorage.setItem('cf_push_denied', 'true');
    setDeniedByApp(true);
  };

  const resetPermissionCheck = () => {
    localStorage.removeItem('cf_push_denied');
    setDeniedByApp(false);
  };

  const showPrompt = permission === 'default' && !deniedByApp;

  return {
    permission,
    deniedByApp,
    subscriptionActive,
    showPrompt,
    loading,
    subscribeUser,
    unsubscribeUser,
    dismissPrompt,
    resetPermissionCheck,
  };
};

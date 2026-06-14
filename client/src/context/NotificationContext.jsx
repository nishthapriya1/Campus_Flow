import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import client from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchUnreadCount = async () => {
    if (user && user.role === 'student') {
      try {
        const res = await client.get('/notifications/unread-count');
        setUnreadCount(res.data?.count ?? 0);
      } catch (err) {
        console.error('Failed to fetch unread count:', err);
      }
    }
  };

  useEffect(() => {
    // Reset state and clear interval if user is not student
    if (!user || user.role !== 'student') {
      setUnreadCount(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchUnreadCount();

    // Start 15s poll
    intervalRef.current = setInterval(fetchUnreadCount, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user?.userId, user?.role]);

  return (
    <NotificationContext.Provider value={{ unreadCount, fetchUnreadCount, setUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

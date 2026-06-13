import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export const NotificationBanner = () => {
  const [reminders, setReminders] = useState([]);
  const { token, user } = useAuth();

  const fetchReminders = async () => {
    try {
      const response = await client.get('/reminders/pending');
      setReminders(response.data || []);
    } catch (error) {
      console.error('Error fetching reminders:', error.message);
    }
  };

  useEffect(() => {
    if (!token || !user || user.role !== 'student') return;

    // Fetch immediately on mount
    fetchReminders();

    // Poll every 30 seconds
    const intervalId = setInterval(fetchReminders, 30000);

    return () => clearInterval(intervalId);
  }, [token, user]);

  const handleDismiss = async (reminderId) => {
    // Optimistic UI update: remove from local state immediately
    setReminders((prev) => prev.filter((r) => r._id !== reminderId));

    try {
      await client.patch(`/reminders/${reminderId}/dismiss`);
    } catch (error) {
      console.error('Error dismissing reminder:', error.message);
      // Rollback or re-fetch on failure
      fetchReminders();
    }
  };

  const getTimeRemaining = (eventTime) => {
    const diff = new Date(eventTime) - new Date();
    if (diff <= 0) return 'starting now';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `in ${hours}h ${minutes}m`;
    }
    return `in ${minutes}m`;
  };

  if (!user || user.role !== 'student' || reminders.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-2 p-4 pb-0 bg-slate-950/20 max-h-48 overflow-y-auto z-40 border-b border-slate-900">
      {reminders.map((reminder) => (
        <div
          key={reminder._id}
          className="flex items-center justify-between px-4 py-3 bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl shadow-lg backdrop-blur-md transition-all duration-300 animate-fadeIn"
        >
          <div className="flex items-center gap-3">
            {/* Warning Alarm Icon */}
            <span className="flex-shrink-0 p-1.5 bg-amber-500/20 rounded-lg text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div className="text-sm">
              <span className="font-bold text-white uppercase text-xs mr-2 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                {reminder.eventId?.type || 'event'}
              </span>
              <span className="font-semibold text-amber-100">{reminder.eventId?.title}</span> is approaching{' '}
              <span className="font-bold text-white bg-slate-950/40 px-2 py-0.5 rounded-md">
                {getTimeRemaining(reminder.eventId?.startTime)}
              </span>.
            </div>
          </div>
          
          <button
            onClick={() => handleDismiss(reminder._id)}
            className="p-1 hover:bg-amber-500/20 rounded-lg text-amber-400 hover:text-white transition-all duration-150 ml-4"
            aria-label="Dismiss Notification"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationBanner;

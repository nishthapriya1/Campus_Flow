import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';

export const NotificationsPage = () => {
  const { addToast } = useToast();
  const { unreadCount, setUnreadCount, fetchUnreadCount } = useNotification();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchNotifications = async (currentPage) => {
    setLoading(true);
    try {
      const response = await client.get(`/notifications?page=${currentPage}&limit=${limit}`);
      setNotifications(response.data?.notifications || []);
      setTotal(response.data?.total || 0);
      setUnreadCount(response.data?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err.message);
      addToast('Error fetching notifications.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(page);
  }, [page]);

  const handleMarkAsRead = async (id) => {
    try {
      const notification = notifications.find((n) => n._id === id);
      if (notification?.read) return;

      const res = await client.patch(`/notifications/${id}/read`);
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true, readAt: res.data.readAt } : n))
      );
      await fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark notification as read:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      if (unreadCount === 0) return;

      await client.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      await fetchUnreadCount();
      addToast('All notifications marked as read.', 'success');
    } catch (err) {
      console.error('Failed to mark all as read:', err.message);
      addToast('Error marking all notifications as read.', 'error');
    }
  };

  const getSeverityBadgeClass = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const formatRelativeTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Notification Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review past deadline warnings, risk alerts, and academic notifications.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="glass-btn-primary py-2 px-4 text-xs font-semibold self-start sm:self-auto"
          >
            Mark All as Read
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-slate-800 rounded-2xl"></div>
          <div className="h-24 bg-slate-800 rounded-2xl"></div>
          <div className="h-24 bg-slate-800 rounded-2xl"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 text-sm">
          No notifications have been received.
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif) => (
            <div
              key={notif._id}
              onClick={() => handleMarkAsRead(notif._id)}
              className={`glass-panel p-5 transition-all duration-200 cursor-pointer ${
                notif.read ? 'opacity-70 hover:opacity-90' : 'border-l-4 border-l-indigo-500 shadow-md shadow-indigo-500/5 bg-slate-900/50'
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Read indicator dot */}
                    {!notif.read && (
                      <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse flex-shrink-0"></span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getSeverityBadgeClass(
                        notif.severity
                      )}`}
                    >
                      {notif.severity}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {notif.alertType.replace('_', ' ')}
                    </span>
                    <h2 className="font-bold text-white text-sm sm:text-base ml-1">{notif.title}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{formatRelativeTime(notif.createdAt)}</span>
                    {!notif.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notif._id);
                        }}
                        className="px-2.5 py-1 bg-indigo-600/90 hover:bg-indigo-600 text-[10px] font-bold text-white rounded-lg transition-all duration-150 shadow-md shadow-indigo-600/10 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Mark as Read
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-slate-300 text-xs sm:text-sm mt-1">{notif.shortMessage}</p>

                {/* Details collapsible area / view detail */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3.5 mt-2 space-y-2 text-xs">
                  <div className="text-slate-400">
                    <span className="font-semibold text-slate-500 uppercase tracking-wide block mb-0.5">
                      Reasoning
                    </span>
                    {notif.detailedReason}
                  </div>
                  <div className="text-indigo-300">
                    <span className="font-semibold text-slate-500 uppercase tracking-wide block mb-0.5">
                      Recommended Action
                    </span>
                    {notif.recommendedAction}
                  </div>
                  {notif.deadline && (
                    <div className="text-rose-400 font-semibold mt-1">
                      Deadline: {new Date(notif.deadline).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-6">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1 || loading}
            className="glass-btn-secondary py-2 px-3 text-xs"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages || loading}
            className="glass-btn-secondary py-2 px-3 text-xs"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;

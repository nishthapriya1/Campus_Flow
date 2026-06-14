import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const getUrgencyBadgeClass = (urgency) => {
  switch (urgency) {
    case 'critical':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'high':
      return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
    case 'medium':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'low':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
};

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'summarized':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'summary_failed':
      return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
    case 'uploaded':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
};

const PAGE_SIZE = 10;

export const PreviousNoticesPage = () => {
  const { addToast } = useToast();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNotices = async (sort) => {
    setLoading(true);
    setError(null);
    try {
      const response = await client.get(`/notices/admin/history?sort=${sort}`);
      setNotices(response.data?.notices || []);
    } catch (err) {
      console.error('Failed to fetch admin notice history:', err.message);
      setError('Failed to load notices. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices(sortOrder);
  }, [sortOrder]);

  const handleSortChange = (newSort) => {
    if (newSort !== sortOrder) {
      setSortOrder(newSort);
      setPage(1);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await client.delete(`/notices/${deleteTarget._id}`);
      setNotices((prev) => prev.filter((n) => n._id !== deleteTarget._id));
      addToast('Notice deleted successfully.', 'success');
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete notice:', err.message);
      addToast('Failed to delete notice. Please try again.', 'error');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Pagination
  const totalPages = Math.ceil(notices.length / PAGE_SIZE);
  const paginatedNotices = notices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Ensure page doesn't exceed available pages after deletion
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [notices.length]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Previous Notices</h1>
        <p className="text-sm text-slate-400 mt-1">
          View and manage all notices you have previously uploaded.
        </p>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Sort by:</span>
        <button
          onClick={() => handleSortChange('newest')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            sortOrder === 'newest'
              ? 'bg-indigo-600/90 text-white shadow-md shadow-indigo-600/10'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Newest First
        </button>
        <button
          onClick={() => handleSortChange('oldest')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            sortOrder === 'oldest'
              ? 'bg-indigo-600/90 text-white shadow-md shadow-indigo-600/10'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Oldest First
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : error ? (
        <div className="glass-panel p-12 text-center">
          <p className="text-rose-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchNotices(sortOrder)}
            className="glass-btn-primary py-2 px-4 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : notices.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 text-sm">
          No notices have been uploaded yet.
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Title</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">File Name</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Uploaded</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Category</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Urgency</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {paginatedNotices.map((notice) => (
                    <tr key={notice._id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate" title={notice.title || notice.fileName}>
                        {notice.title || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[180px] truncate" title={notice.fileName}>
                        {notice.fileName}
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                        {formatDate(notice.uploadedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {notice.category && notice.category !== 'unknown' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {notice.category}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {notice.urgency ? (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getUrgencyBadgeClass(notice.urgency)}`}>
                            {notice.urgency}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getStatusBadgeClass(notice.status)}`}>
                          {notice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteTarget(notice)}
                          className="px-2.5 py-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 hover:text-rose-300 text-[10px] font-bold rounded-lg border border-rose-500/20 transition-all"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="glass-btn-secondary py-2 px-3 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="glass-btn-secondary py-2 px-3 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Notice</h3>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to permanently delete this notice?
            </p>
            <p className="text-xs text-slate-500 mb-6 truncate">
              <span className="font-semibold text-slate-400">File:</span> {deleteTarget.fileName}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {deleting && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviousNoticesPage;

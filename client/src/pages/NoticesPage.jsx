import React, { useEffect, useState } from 'react';
import client from '../api/client';
import EventModal from '../components/EventModal';
import { useToast } from '../context/ToastContext';

const getUrgencyBadgeClass = (urgency) => {
  switch (urgency) {
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

export const NoticesPage = () => {
  const { addToast } = useToast();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Calendar EventModal integration (Task 44)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [defaultSlotData, setDefaultSlotData] = useState(null);

  const fetchNotices = async (currentPage) => {
    setLoading(true);
    try {
      const response = await client.get(`/notices?page=${currentPage}&limit=${limit}`);
      setNotices(response.data?.notices || []);
      setTotal(response.data?.total || 0);
    } catch (err) {
      console.error('Failed to fetch notices:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices(page);
  }, [page]);

  const handleViewFullNotice = async (noticeId) => {
    try {
      const response = await client.get(`/notices/${noticeId}`);
      if (response.data?.fileUrl) {
        window.open(response.data.fileUrl, '_blank');
      } else {
        addToast('File URL is not available.', 'error');
      }
    } catch (err) {
      console.error('Failed to get notice file URL:', err.message);
      addToast('Error fetching file attachment.', 'error');
    }
  };

  const handleAddToCalendar = (notice) => {
    if (!notice.extractedDate) return;

    // Clean extension off file name (Task 44)
    const cleanTitle = notice.fileName.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(notice.extractedDate).toISOString().split('T')[0];
    const start = new Date(`${dateStr}T09:00:00`);
    const end = new Date(`${dateStr}T10:00:00`);

    setDefaultSlotData({
      start,
      end,
      title: cleanTitle,
      sourceNoticeId: notice._id,
    });
    setIsModalOpen(true);
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Institutional Notices</h1>
        <p className="text-sm text-slate-400 mt-1">
          Stay informed about official announcements and campus notices.
        </p>
      </div>

      {loading && notices.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="h-48 bg-slate-800 rounded-2xl"></div>
          <div className="h-48 bg-slate-800 rounded-2xl"></div>
        </div>
      ) : notices.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-400 text-sm">
          No notices have been uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {notices.map((notice) => (
            <div key={notice._id} className="glass-panel p-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-white text-base truncate max-w-[70%]" title={notice.fileName}>
                      {notice.fileName}
                    </h2>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      {notice.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {notice.urgency && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${getUrgencyBadgeClass(notice.urgency)}`}>
                        {notice.urgency} urgency
                      </span>
                    )}
                    {notice.category && notice.category !== 'unknown' && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {notice.category}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-500">{formatDate(notice.uploadedAt)}</p>

                {/* AI Notice Summary Box */}
                <div className="bg-slate-950/45 border border-slate-800/80 rounded-xl p-4 text-xs leading-relaxed text-slate-300">
                  <span className="font-semibold text-slate-400 block mb-1">AI Summary</span>
                  {notice.status === 'summarized' && notice.summary ? (
                    notice.summary
                  ) : notice.status === 'summary_failed' ? (
                    <span className="text-rose-400 italic">Summary unavailable</span>
                  ) : (
                    <span className="text-slate-500 italic">Generating summary...</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between pt-3 border-t border-slate-800/50 gap-2">
                <button
                  onClick={() => handleViewFullNotice(notice._id)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Full Notice
                </button>

                {notice.extractedDate && (
                  <button
                    onClick={() => handleAddToCalendar(notice)}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 px-3 py-1.5 rounded-xl transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Add to Calendar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
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

      {/* Modal triggered via Add to Calendar */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedEvent={null}
        defaultSlotData={defaultSlotData}
        onSaveSuccess={() => addToast('Notice event added to your calendar successfully.', 'success')}
      />
    </div>
  );
};

export default NoticesPage;

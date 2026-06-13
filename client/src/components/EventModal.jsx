import React, { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export const EventModal = ({ isOpen, onClose, selectedEvent, defaultSlotData, onSaveSuccess }) => {
  const { addToast } = useToast();
  const dialogRef = useRef(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState('class');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isBlocked, setIsBlocked] = useState(false);
  const [sourceNoticeId, setSourceNoticeId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Synchronize dialog open state using HTML5 showModal() / close()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Set initial form states based on mode (Edit or Create)
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (selectedEvent) {
      // Edit Mode
      setTitle(selectedEvent.title || '');
      setType(selectedEvent.type || 'class');
      setIsBlocked(selectedEvent.isBlocked || false);
      setSourceNoticeId(selectedEvent.sourceNoticeId || null);

      const start = new Date(selectedEvent.startTime);
      const end = new Date(selectedEvent.endTime);
      setDate(start.toISOString().split('T')[0]);
      
      const pad = (n) => (n < 10 ? '0' + n : n);
      setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
      setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
    } else if (defaultSlotData) {
      // Create Mode (pre-fill based on calendar click)
      setTitle('');
      setType('class');
      setIsBlocked(false);
      setSourceNoticeId(defaultSlotData.sourceNoticeId || null);

      if (defaultSlotData.title) {
        setTitle(defaultSlotData.title);
      }

      const start = new Date(defaultSlotData.start);
      const end = new Date(defaultSlotData.end);
      setDate(start.toISOString().split('T')[0]);

      const pad = (n) => (n < 10 ? '0' + n : n);
      setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
      setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
    } else {
      // Blank Create Mode
      setTitle('');
      setType('class');
      setDate(new Date().toISOString().split('T')[0]);
      setStartTime('09:00');
      setEndTime('10:00');
      setIsBlocked(false);
      setSourceNoticeId(null);
    }
  }, [isOpen, selectedEvent, defaultSlotData]);

  // Fallback for light-dismiss (clicking outside the content box to close)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event) => {
      if (event.target !== dialog) return;

      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );

      if (!isDialogContent) {
        onClose();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => dialog.removeEventListener('click', handleBackdropClick);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (endDateTime <= startDateTime) {
      const errMsg = 'End time must be after start time.';
      setError(errMsg);
      addToast(errMsg, 'error');
      setLoading(false);
      return;
    }

    const payload = {
      title,
      type,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      isBlocked,
      sourceNoticeId,
    };

    try {
      if (selectedEvent) {
        // Edit Mode
        await client.put(`/events/${selectedEvent._id}`, payload);
        addToast('Event updated successfully!', 'success');
      } else {
        // Create Mode
        await client.post('/events', payload);
        addToast('Event created successfully!', 'success');
      }
      onSaveSuccess();
      onClose();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to save event. Please check inputs.';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    const confirmDelete = window.confirm('Are you sure you want to delete this event?');
    if (!confirmDelete) return;

    setError(null);
    setLoading(true);

    try {
      await client.delete(`/events/${selectedEvent._id}`);
      addToast('Event deleted successfully!', 'success');
      onSaveSuccess();
      onClose();
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to delete event.';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="glass-card max-w-lg w-full p-6 sm:p-8 text-slate-100 overflow-hidden outline-none bg-slate-900 border border-slate-800"
      aria-labelledby="modal-title"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 id="modal-title" className="text-xl font-bold text-white">
            {selectedEvent ? 'Edit Event' : 'Create Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-rose-950/30 border border-rose-800/80 text-rose-200 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Event Title
            </label>
            <input
              type="text"
              required
              maxLength={100}
              className="w-full glass-input"
              placeholder="e.g. CS 101 Midterm Exam"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Event Type
              </label>
              <select
                className="w-full glass-input bg-slate-950"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="class">Class Session</option>
                <option value="exam">Exam</option>
                <option value="assignment">Assignment Due</option>
                <option value="extracurricular">Extracurricular</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                className="w-full glass-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Start Time
              </label>
              <input
                type="time"
                required
                className="w-full glass-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                End Time
              </label>
              <input
                type="time"
                required
                className="w-full glass-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Block study plan checkbox */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="is-blocked"
              type="checkbox"
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 focus:ring-2 accent-indigo-600"
              checked={isBlocked}
              onChange={(e) => setIsBlocked(e.target.checked)}
            />
            <label htmlFor="is-blocked" className="text-sm font-medium text-slate-300">
              Block this time from study plan scheduling
            </label>
          </div>

          {sourceNoticeId && (
            <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              This event was generated from institutional notice attachment.
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-4">
            {selectedEvent ? (
              <button
                type="button"
                onClick={handleDelete}
                className="glass-btn-danger px-4 py-2.5"
                disabled={loading}
              >
                Delete
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="glass-btn-secondary px-4 py-2.5"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="glass-btn-primary px-6 py-2.5"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </dialog>
  );
};

export default EventModal;

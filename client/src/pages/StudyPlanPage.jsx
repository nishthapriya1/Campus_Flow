import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export const StudyPlanPage = () => {
  const { addToast } = useToast();
  const [activePlan, setActivePlan] = useState(null);
  const [historyPlans, setHistoryPlans] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingActive, setFetchingActive] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState([{ subject: '', examDate: '' }]);
  const [dailyHours, setDailyHours] = useState(4);

  const fetchActivePlan = async () => {
    setFetchingActive(true);
    setError(null);
    try {
      const response = await client.get('/studyplans/active');
      setActivePlan(response.data);
      setShowForm(false);
    } catch (err) {
      if (err.response?.status === 404) {
        setActivePlan(null);
        setShowForm(true);
      } else {
        setError('Failed to fetch active study plan.');
      }
    } finally {
      setFetchingActive(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await client.get('/studyplans/history');
      setHistoryPlans(response.data || []);
    } catch (err) {
      console.error('Failed to load study plan history:', err.message);
    }
  };

  useEffect(() => {
    fetchActivePlan();
    fetchHistory();
  }, []);

  const handleAddRow = () => {
    if (rows.length >= 10) return;
    setRows([...rows, { subject: '', examDate: '' }]);
  };

  const handleRemoveRow = (index) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const subjects = rows.map((r) => r.subject.trim());
    const examDates = rows.map((r) => r.examDate);

    // Basic client validation
    const hasEmptyFields = rows.some((r) => !r.subject.trim() || !r.examDate);
    if (hasEmptyFields) {
      const errMsg = 'Please fill in all subject and exam date fields.';
      setError(errMsg);
      addToast(errMsg, 'error');
      setLoading(false);
      return;
    }

    try {
      const response = await client.post('/studyplans/generate', {
        subjects,
        examDates,
        dailyHours: parseFloat(dailyHours),
      });

      setActivePlan(response.data?.studyPlan || response.data);
      setShowForm(false);
      addToast('Study plan generated successfully!', 'success');
      fetchHistory(); // refresh archived list
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to generate study plan. Please verify inputs.';
      setError(errMsg);
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Deterministic color styling per subject (Task 41)
  const getSubjectColor = (subject) => {
    const colors = [
      'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'bg-violet-500/10 text-violet-400 border-violet-500/20',
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'bg-rose-500/10 text-rose-400 border-rose-500/20',
      'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      'bg-pink-500/10 text-pink-400 border-pink-500/20',
      'bg-sky-500/10 text-sky-400 border-sky-500/20',
    ];

    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
      hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const groupSessionsByDate = (sessions) => {
    if (!sessions) return {};
    const groups = {};
    sessions.forEach((session) => {
      const dateStr = new Date(session.date).toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(session);
    });
    return groups;
  };

  const activePlanGrouped = activePlan ? groupSessionsByDate(activePlan.sessions) : {};

  if (fetchingActive) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <svg className="animate-spin h-10 w-10 text-violet-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AI Study Planner</h1>
          <p className="text-sm text-slate-400 mt-1">
            Build personalized study plans proportional to your exam dates and calendar events.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activePlan && (
            <button
              onClick={() => {
                setShowForm(!showForm);
                if (!showForm) {
                  // populate form with active plans subjects
                  setRows(
                    activePlan.preferences.subjects.map((sub, idx) => ({
                      subject: sub,
                      examDate: activePlan.preferences.examDates[idx]
                        ? new Date(activePlan.preferences.examDates[idx])
                            .toISOString()
                            .split('T')[0]
                        : '',
                    }))
                  );
                  setDailyHours(activePlan.preferences.dailyHours);
                }
              }}
              className="glass-btn-secondary py-2.5"
            >
              {showForm ? 'Cancel Generation' : 'Re-generate Plan'}
            </button>
          )}

          {historyPlans.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="glass-btn-secondary py-2.5 text-violet-400 border-violet-500/20"
            >
              {showHistory ? 'Show Timeline' : 'View History'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/30 border border-rose-800/80 text-rose-200 px-4 py-3 rounded-xl text-sm" role="alert">
          {error}
        </div>
      )}

      {/* 1. View History Panel */}
      {showHistory ? (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-2">Archived Study Plans (Last 7 Days)</h2>
          <div className="space-y-4">
            {historyPlans.map((histPlan) => (
              <div key={histPlan._id} className="glass-panel p-6 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/50 pb-2">
                  <span>Replaced at: {new Date(histPlan.archivedAt).toLocaleString()}</span>
                  <span>Daily allocation: {histPlan.preferences.dailyHours} hours</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {histPlan.preferences.subjects.map((sub, idx) => (
                    <div key={idx} className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                      <div className="font-bold text-white text-sm">{sub}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Exam date: {new Date(histPlan.preferences.examDates[idx]).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
                <details className="text-xs text-slate-400 cursor-pointer">
                  <summary className="font-semibold text-indigo-400 hover:underline">Show timeline sessions ({histPlan.sessions.length})</summary>
                  <div className="mt-3 pl-4 space-y-2 border-l border-slate-800">
                    {histPlan.sessions.map((sess, sidx) => (
                      <div key={sidx} className="flex justify-between max-w-lg py-1">
                        <span>{new Date(sess.date).toLocaleDateString()} - {sess.subject}</span>
                        <span>{sess.startTime} - {sess.endTime} ({sess.durationMins}m)</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      ) : showForm ? (
        /* 2. Study Plan Generation Form */
        <div className="glass-card p-6 sm:p-10 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Configure Study Preferences</h2>
            <p className="text-slate-400 text-xs mt-1">
              Add upcoming subject exams and specify your daily free hours. AI will handle calendar integration.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subject Exam Details</div>

              {rows.map((row, index) => (
                <div key={index} className="flex items-center gap-3 bg-slate-950/20 border border-slate-800/50 p-4 rounded-2xl">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Subject name (e.g. Calculus)"
                      className="w-full glass-input"
                      value={row.subject}
                      onChange={(e) => handleRowChange(index, 'subject', e.target.value)}
                    />
                    <input
                      type="date"
                      required
                      className="w-full glass-input"
                      value={row.examDate}
                      onChange={(e) => handleRowChange(index, 'examDate', e.target.value)}
                    />
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(index)}
                      className="p-2 bg-rose-950/30 text-rose-400 hover:text-rose-200 border border-rose-800/40 rounded-xl transition"
                      title="Remove Row"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {rows.length < 10 && (
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center justify-center gap-1.5 w-full py-3.5 border border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-2xl text-xs font-semibold transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Subject Row
                </button>
              )}
            </div>

            <div className="border-t border-slate-800 pt-6">
              <label htmlFor="daily-hours" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Daily Available Study Hours: <span className="text-white text-sm font-bold ml-1">{dailyHours}</span>
              </label>
              <input
                id="daily-hours"
                type="range"
                min="0.5"
                max="16"
                step="0.5"
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                value={dailyHours}
                onChange={(e) => setDailyHours(e.target.value)}
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider pt-1">
                <span>0.5 hours</span>
                <span>8 hours</span>
                <span>16 hours</span>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800 gap-4">
              {activePlan && (
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="glass-btn-secondary px-6"
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="glass-btn-primary px-8 py-3 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating Study Plan...
                  </>
                ) : (
                  'Generate Study Plan'
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* 3. Study Plan Timeline View */
        <div className="space-y-8">
          {/* Active plan details banner */}
          <div className="glass-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-violet-500/10">
            <div>
              <div className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 rounded-full w-fit">
                Active Study Plan
              </div>
              <h2 className="text-lg font-bold text-white mt-2">Personalized Academic Timeline</h2>
              <p className="text-slate-400 text-xs mt-1">
                Generated proportional to your exams. Subject blocks are color-coded.
              </p>
            </div>
            
            <div className="text-xs text-slate-400 text-left sm:text-right border-l-0 md:border-l md:border-slate-800 md:pl-6 space-y-1">
              <div>Daily Hours Target: <span className="font-bold text-white">{activePlan?.preferences?.dailyHours} h</span></div>
              <div>Generated: <span className="font-bold text-white">{new Date(activePlan?.generatedAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          {/* Timeline Display */}
          <div className="space-y-6">
            {Object.keys(activePlanGrouped).map((dateStr) => (
              <div key={dateStr} className="space-y-3">
                <h3 className="font-bold text-white text-sm tracking-wide bg-slate-900/40 border border-slate-800/50 px-4 py-2.5 rounded-xl w-fit">
                  {dateStr}
                </h3>
                
                <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-4 pt-1">
                  {activePlanGrouped[dateStr].map((session, index) => (
                    <div key={index} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[32px] top-4 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 border border-slate-950">
                        <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                      </span>

                      <div className={`glass-panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${getSubjectColor(session.subject)}`}>
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-sm text-white">{session.subject}</h4>
                          <p className="text-[11px] text-slate-400 font-medium">
                            Scheduled session &bull; {session.durationMins} min duration
                          </p>
                        </div>
                        <div className="text-xs font-bold bg-slate-950/40 border border-slate-800/60 px-4 py-2 rounded-xl text-white self-start sm:self-auto">
                          {session.startTime} - {session.endTime}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPlanPage;

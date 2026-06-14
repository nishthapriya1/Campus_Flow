import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import GuardianAIPanel from '../components/GuardianAIPanel';
import { usePushPermission } from '../hooks/usePushPermission';

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    permission,
    deniedByApp,
    subscriptionActive,
    showPrompt,
    subscribeUser,
    unsubscribeUser,
    dismissPrompt,
    resetPermissionCheck,
  } = usePushPermission();

  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState([]);
  const [events, setEvents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [studyPlan, setStudyPlan] = useState(null);
  const [attendance, setAttendance] = useState([]);

  const fetchData = async () => {
    if (!user || user.role !== 'student') {
      setLoading(false);
      return;
    }
    setLoading(true);
    const now = new Date();

    // Fetch the 5 sources in parallel using Promise.allSettled (Task 36)
    const results = await Promise.allSettled([
      client.get('/reminders/pending'),
      client.get(`/events?from=${now.toISOString()}`),
      client.get('/notices?page=1&limit=5'),
      client.get('/studyplans/active'),
      client.get('/attendance'),
    ]);

    // Handle reminders
    if (results[0].status === 'fulfilled') {
      setReminders(results[0].value.data || []);
    } else {
      console.error('Failed to load pending reminders:', results[0].reason);
    }

    // Handle upcoming events (take next 3 events)
    if (results[1].status === 'fulfilled') {
      const allFutureEvents = results[1].value.data || [];
      setEvents(allFutureEvents.slice(0, 3));
    } else {
      console.error('Failed to load upcoming events:', results[1].reason);
    }

    // Handle notices
    if (results[2].status === 'fulfilled') {
      setNotices(results[2].value.data?.notices || []);
    } else {
      console.error('Failed to load notices:', results[2].reason);
    }

    // Handle study plan (today's sessions)
    if (results[3].status === 'fulfilled') {
      setStudyPlan(results[3].value.data || null);
    } else {
      // 404 from active plan is normal, don't crash
      setStudyPlan(null);
    }

    // Handle attendance
    if (results[4].status === 'fulfilled') {
      setAttendance(results[4].value.data || []);
    } else {
      console.error('Failed to load attendance:', results[4].reason);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getTodaySessions = () => {
    if (!studyPlan?.sessions) return [];
    const todayStr = new Date().toISOString().split('T')[0];
    return studyPlan.sessions.filter((session) => {
      const sessDateStr = new Date(session.date).toISOString().split('T')[0];
      return sessDateStr === todayStr;
    });
  };

  const todaySessions = getTodaySessions();

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getEventBadgeClass = (type) => {
    switch (type) {
      case 'exam':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'assignment':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'class':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
  };

  // Render skeleton screens for parallel queries
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 bg-slate-800 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="h-48 bg-slate-800 rounded-2xl"></div>
            <div className="h-64 bg-slate-800 rounded-2xl"></div>
          </div>
          <div className="h-96 bg-slate-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Here is your academic status update for today.
          </p>
        </div>
        {user?.role === 'administrator' && (
          <Link to="/admin" className="glass-btn-primary self-start">
            Notice Upload Portal
          </Link>
        )}
      </div>

      {/* Push Notification Banner/Card (Task 75) */}
      {showPrompt && user?.role === 'student' && (
        <div className="glass-panel p-5 border border-indigo-500/30 bg-indigo-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Enable Browser Push Notifications
            </h3>
            <p className="text-xs text-slate-400">
              Receive critical deadline alerts and Guardian AI academic risks immediately on your device, even when the app is closed.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={subscribeUser}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all duration-200 shadow-md shadow-indigo-600/20"
            >
              Enable
            </button>
            <button
              onClick={dismissPrompt}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              Not Now
            </button>
          </div>
        </div>
      )}

      {/* Subscription Status Panel (surfaced if permission is granted/denied or manually togglable) */}
      {(permission === 'granted' || permission === 'denied' || deniedByApp) && user?.role === 'student' && (
        <div className="glass-panel p-4 bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{
              backgroundColor: permission === 'granted' && subscriptionActive ? '#10b981' : '#ef4444'
            }}></span>
            <span className="text-slate-300 font-semibold">
              Push Notifications: {
                permission === 'granted' && subscriptionActive
                  ? 'Active & Subscribed'
                  : permission === 'denied'
                  ? 'Blocked by Browser'
                  : 'Disabled'
              }
            </span>
          </div>
          <div>
            {permission === 'granted' && subscriptionActive ? (
              <button
                onClick={unsubscribeUser}
                className="text-indigo-400 hover:text-indigo-300 font-bold transition-all"
              >
                Disable Notifications
              </button>
            ) : permission === 'denied' ? (
              <span className="text-slate-500 italic">Please reset browser site permissions to enable.</span>
            ) : (
              <button
                onClick={resetPermissionCheck}
                className="text-indigo-400 hover:text-indigo-300 font-bold transition-all"
              >
                Reset Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Schedule & Study Plan */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Upcoming Events */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Upcoming Deadlines & Schedule
              </h2>
              <Link to="/calendar" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline">
                View Calendar &rarr;
              </Link>
            </div>

            {events.length === 0 ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-slate-400 text-sm">No upcoming exams, classes, or assignments on your schedule.</p>
                <button
                  onClick={() => navigate('/calendar')}
                  className="glass-btn-secondary py-2 text-xs"
                >
                  Create Calendar Event
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {events.map((event) => (
                  <div key={event._id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getEventBadgeClass(event.type)}`}>
                          {event.type}
                        </span>
                        <h3 className="font-semibold text-white text-sm">{event.title}</h3>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(event.startTime)} at {formatTime(event.startTime)} - {formatTime(event.endTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Study Plan (Today's sessions) */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Today's AI Study Plan
              </h2>
              <Link to="/study-plan" className="text-xs font-semibold text-violet-400 hover:text-violet-300 hover:underline">
                Study Planner &rarr;
              </Link>
            </div>

            {!studyPlan ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-slate-400 text-sm">You do not have an active study plan generated yet.</p>
                <button
                  onClick={() => navigate('/study-plan')}
                  className="glass-btn-secondary py-2 text-xs"
                >
                  Generate AI Study Plan
                </button>
              </div>
            ) : todaySessions.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <p className="text-slate-300 font-medium text-sm">No study sessions scheduled for today!</p>
                <p className="text-slate-500 text-xs">Enjoy your day or check the full timeline.</p>
              </div>
            ) : (
              <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6">
                {todaySessions.map((session, index) => (
                  <div key={index} className="relative">
                    {/* Circle timeline connector */}
                    <span className="absolute -left-[30px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 border border-slate-950">
                      <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                    </span>
                    <div className="glass-panel p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm">{session.subject}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Duration: {session.durationMins} minutes
                        </p>
                      </div>
                      <div className="text-xs font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1.5 rounded-xl self-start sm:self-auto">
                        {session.startTime} - {session.endTime}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance Overview Widget */}
          {user?.role === 'student' && (
            <div className="glass-panel p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                  </svg>
                  Attendance Overview
                </h2>
                <Link to="/attendance" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline">
                  View Tracker &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Overall Percentage Progress Circle */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/60 md:col-span-1 text-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Overall</span>
                  <span className={`text-3xl font-extrabold mt-1 tracking-tight ${
                    (() => {
                      const totalConducted = attendance.reduce((sum, s) => sum + s.conducted, 0);
                      const totalAttended = attendance.reduce((sum, s) => sum + s.attended, 0);
                      const pct = totalConducted === 0 ? 100 : (totalAttended / totalConducted) * 100;
                      return pct >= 75 ? 'text-emerald-400' : pct >= 65 ? 'text-amber-400' : 'text-rose-400';
                    })()
                  }`}>
                    {(() => {
                      const totalConducted = attendance.reduce((sum, s) => sum + s.conducted, 0);
                      const totalAttended = attendance.reduce((sum, s) => sum + s.attended, 0);
                      return (totalConducted === 0 ? 100 : (totalAttended / totalConducted) * 100).toFixed(1);
                    })()}%
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1.5 font-medium">
                    {attendance.reduce((sum, s) => sum + s.attended, 0)} / {attendance.reduce((sum, s) => sum + s.conducted, 0)} classes
                  </span>
                </div>

                {/* Risky subjects list */}
                <div className="md:col-span-2 space-y-2.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Top Risky Subjects (&lt; 75%)</span>
                  {(() => {
                    const risky = attendance.filter(s => {
                      const pct = s.conducted === 0 ? 100 : (s.attended / s.conducted) * 100;
                      return pct < 75;
                    });

                    if (risky.length === 0) {
                      return (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          All subjects are safe! Excellent work.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {risky.slice(0, 2).map((sub) => {
                          const pct = sub.conducted === 0 ? 100 : (sub.attended / sub.conducted) * 100;
                          return (
                            <div key={sub._id} className="flex items-center justify-between p-2.5 bg-slate-950/20 border border-slate-800/80 rounded-xl">
                              <div className="truncate max-w-[70%]">
                                <span className="text-xs font-bold text-white block truncate">{sub.subjectName}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{sub.subjectCode}</span>
                              </div>
                              <div className="text-right">
                                <span className={`text-xs font-bold ${pct >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
                                  {pct.toFixed(1)}%
                                </span>
                                <span className="text-[9px] text-slate-400 block font-medium">
                                  {sub.attended}/{sub.conducted} lec
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {risky.length > 2 && (
                          <div className="text-[10px] text-slate-500 italic text-right font-medium">
                            + {risky.length - 2} more risky subjects
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Guardian AI Risk Panel */}
          <GuardianAIPanel />

        </div>

        {/* Right Side: Notices Feed */}
        <div className="glass-panel p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Recent Notices
            </h2>
            <Link to="/notices" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline">
              View All &rarr;
            </Link>
          </div>

          {notices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No recent institutional notices uploaded.
            </div>
          ) : (
            <div className="space-y-4">
              {notices.map((notice) => (
                <div key={notice._id} className="glass-panel-interactive p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white text-xs truncate max-w-[80%]">
                      {notice.fileName}
                    </h3>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {formatDate(notice.uploadedAt)}
                    </span>
                  </div>
                  
                  {/* Summary Preview */}
                  <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed">
                    {notice.status === 'summarized' && notice.summary
                      ? notice.summary
                      : notice.status === 'summary_failed'
                      ? 'AI Summary unavailable. Please read the original notice file.'
                      : 'Summarizing notice content with AI assistant...'}
                  </p>
                  
                  <div className="pt-1">
                    <Link
                      to="/notices"
                      className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider"
                    >
                      Read full &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

// Module-scoped cache to persist scheduling analysis and preferences across mounts
let cachedSchedulingData = null;

export const SchedulingPage = () => {
  const { addToast } = useToast();

  // Helper to format 24h time string to 12h AM/PM format
  const formatTime12Hour = (time) => {
    if (!time) return 'Not Set';
    const [hourStr, minStr] = time.split(':');
    let hour = parseInt(hourStr, 10);
    const min = minStr || '00';
    if (isNaN(hour)) return 'Not Set';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${min} ${ampm}`;
  };

  // Core Agent Report and Preferences state
  const [analysis, setAnalysis] = useState(cachedSchedulingData?.analysis || null);
  const [preferences, setPreferences] = useState(cachedSchedulingData?.preferences || {
    sleepStart: '23:00',
    sleepEnd: '07:00',
    preferredStudyHours: 'evening',
    breakfastTime: '08:00',
    lunchTime: '13:00',
    dinnerTime: '20:00',
    travelTimeMins: 30,
    productivityPreference: 'Balanced workload',
    personalCommitments: []
  });

  const [loading, setLoading] = useState(!cachedSchedulingData);
  const [optimizing, setOptimizing] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Preference edit states
  const [editSleepStart, setEditSleepStart] = useState(cachedSchedulingData?.preferences?.sleepStart || '23:00');
  const [editSleepEnd, setEditSleepEnd] = useState(cachedSchedulingData?.preferences?.sleepEnd || '07:00');
  const [editPreferredStudyHours, setEditPreferredStudyHours] = useState(cachedSchedulingData?.preferences?.preferredStudyHours || 'evening');
  const [editBreakfastTime, setEditBreakfastTime] = useState(cachedSchedulingData?.preferences?.breakfastTime || '08:00');
  const [editLunchTime, setEditLunchTime] = useState(cachedSchedulingData?.preferences?.lunchTime || '13:00');
  const [editDinnerTime, setEditDinnerTime] = useState(cachedSchedulingData?.preferences?.dinnerTime || '20:00');
  const [editTravelTimeMins, setEditTravelTimeMins] = useState(cachedSchedulingData?.preferences?.travelTimeMins || 30);
  const [editProductivityPreference, setEditProductivityPreference] = useState(cachedSchedulingData?.preferences?.productivityPreference || 'Balanced workload');
  const [commitmentInput, setCommitmentInput] = useState('');
  const [commitmentsList, setCommitmentsList] = useState(cachedSchedulingData?.preferences?.personalCommitments || []);

  // Load schedule analysis and preferences
  const fetchAnalysis = async (showToast = false, silent = false) => {
    const shouldShowLoading = !silent && !cachedSchedulingData;
    if (shouldShowLoading) setLoading(true);
    try {
      const response = await client.get('/scheduling/analyze');
      if (response.data) {
        setAnalysis(response.data.analysis);
        cachedSchedulingData = cachedSchedulingData || {};
        cachedSchedulingData.analysis = response.data.analysis;
        if (response.data.preferences) {
          const prefs = response.data.preferences;
          setPreferences(prefs);
          cachedSchedulingData.preferences = prefs;
          setEditSleepStart(prefs.sleepStart || '23:00');
          setEditSleepEnd(prefs.sleepEnd || '07:00');
          setEditPreferredStudyHours(prefs.preferredStudyHours || 'evening');
          setEditBreakfastTime(prefs.breakfastTime || '08:00');
          setEditLunchTime(prefs.lunchTime || '13:00');
          setEditDinnerTime(prefs.dinnerTime || '20:00');
          setEditTravelTimeMins(prefs.travelTimeMins || 30);
          setEditProductivityPreference(prefs.productivityPreference || 'Balanced workload');
          setCommitmentsList(prefs.personalCommitments || []);
        }
        if (showToast) {
          addToast('Schedule analysis generated successfully!', 'success');
        }
      }
    } catch (err) {
      console.error('Failed to load scheduling report:', err.message);
      addToast('Error loading schedule analysis.', 'error');
    } finally {
      if (shouldShowLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis(false, !!cachedSchedulingData);
  }, []);

  // Save updated preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const payload = {
        sleepStart: editSleepStart,
        sleepEnd: editSleepEnd,
        preferredStudyHours: editPreferredStudyHours,
        breakfastTime: editBreakfastTime,
        lunchTime: editLunchTime,
        dinnerTime: editDinnerTime,
        travelTimeMins: parseInt(editTravelTimeMins, 10),
        productivityPreference: editProductivityPreference,
        personalCommitments: commitmentsList
      };

      const response = await client.post('/scheduling/preferences', payload);
      if (response.data) {
        setPreferences(response.data);
        cachedSchedulingData = cachedSchedulingData || {};
        cachedSchedulingData.preferences = response.data;
        addToast('Scheduling preferences updated successfully!', 'success');
        // Refresh analysis to reflect updated preferences (e.g. sleep/meal timers)
        fetchAnalysis();
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save preferences.', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  // Run proactive optimization
  const handleOptimizeSchedule = async () => {
    setOptimizing(true);
    try {
      const response = await client.post('/scheduling/optimize');
      if (response.data) {
        setAnalysis(response.data.analysis);
        cachedSchedulingData = cachedSchedulingData || {};
        cachedSchedulingData.analysis = response.data.analysis;
        addToast('Schedule optimization completed! Clashing events shifted and study blocks booked.', 'success');
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to optimize schedule.', 'error');
    } finally {
      setOptimizing(false);
    }
  };

  // Add tag to commitments list
  const handleAddCommitment = () => {
    const cleanVal = commitmentInput.trim();
    if (cleanVal && !commitmentsList.includes(cleanVal)) {
      setCommitmentsList([...commitmentsList, cleanVal]);
      setCommitmentInput('');
    }
  };

  // Remove tag from commitments list
  const handleRemoveCommitment = (val) => {
    setCommitmentsList(commitmentsList.filter(c => c !== val));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  // Get color for urgency levels
  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  // Get color for risks levels
  const getRiskScoreColor = (score) => {
    if (score >= 70) return 'text-rose-400 bg-rose-500/10 border-rose-500/25';
    if (score >= 40) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  };

  // Helper for today plan categories colors
  const getPlanActivityStyle = (activity) => {
    const lower = activity.toLowerCase();
    if (lower.includes('class') || lower.includes('lecture')) {
      return 'border-indigo-500/20 bg-indigo-950/15 text-indigo-300';
    }
    if (lower.includes('exam') || lower.includes('test') || lower.includes('submission')) {
      return 'border-rose-500/20 bg-rose-950/15 text-rose-300';
    }
    if (lower.includes('study') || lower.includes('focus')) {
      return 'border-violet-500/20 bg-violet-950/15 text-violet-300';
    }
    if (lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('meal')) {
      return 'border-emerald-500/20 bg-emerald-950/15 text-emerald-300';
    }
    if (lower.includes('sleep') || lower.includes('wind down')) {
      return 'border-slate-800/80 bg-slate-900/10 text-slate-400';
    }
    return 'border-slate-800 bg-slate-900/10 text-slate-300';
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 h-full flex flex-col justify-start">
      
      {/* 2-Column Responsive Layout: Left 70% / Right 30% */}
      <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-10 gap-6 items-start flex-1">
        
        {/* LEFT COLUMN: Schedule metrics, warnings, coaches recommendations */}
        <div className="md:col-span-3 lg:col-span-7 space-y-6 flex flex-col">
          
          {/* Header Card: Coach Status Banner */}
          <div className="glass-panel p-6 border border-violet-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 text-8xl pointer-events-none select-none">🤖</div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-indigo-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
                </span>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                  Smart Success Coach Active
                </span>
              </div>
              
              <h2 className="text-2xl font-extrabold text-white tracking-tight">Smart Scheduling Dashboard</h2>
              
              <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 mt-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Coach Arjun Summary</div>
                <p className="text-sm text-slate-200 mt-1 font-medium leading-relaxed">
                  "{analysis?.scheduleSummary}"
                </p>
              </div>

              {analysis?.nextBestAction && (
                <div className="flex items-center gap-3 bg-indigo-950/20 border border-indigo-500/30 p-3.5 rounded-xl mt-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <div className="text-[9px] font-extrabold uppercase text-indigo-400 tracking-wider">Recommended Next Action</div>
                    <div className="text-sm font-bold text-white leading-tight mt-0.5">{analysis?.nextBestAction}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Today's Chronological Schedule */}
          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>📅</span> Today's Plan
              </h3>
              <span className="text-xs text-slate-400 font-semibold">Chronological Time-Blocking</span>
            </div>

            <div className="space-y-2.5">
              {analysis?.todayPlan && analysis.todayPlan.length > 0 ? (
                analysis.todayPlan.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all hover:scale-[1.01] ${getPlanActivityStyle(item.activity)}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-6 rounded-full bg-current opacity-70"></span>
                      <span className="text-sm font-bold tracking-wide">{item.activity}</span>
                    </div>
                    <div className="text-xs font-mono font-bold bg-slate-950/50 border border-slate-800/60 px-3 py-1.5 rounded-lg select-none">
                      {item.time}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">
                  No active events scheduled for today.
                </div>
              )}
            </div>
          </div>

          {/* Grid: Risks Meter & Conflicts Warnings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Weekly Workload Indicators (Meters) */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/40 pb-2 flex items-center gap-2">
                <span>📊</span> Weekly Workload Insights
              </h3>
              
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 mb-2">
                <div className="bg-slate-950/50 border border-slate-900 p-2.5 rounded-lg">
                  <div>Busiest Day</div>
                  <div className="text-white font-bold mt-1 text-sm">{analysis?.weeklyInsights?.busiestDay || 'N/A'}</div>
                </div>
                <div className="bg-slate-950/50 border border-slate-900 p-2.5 rounded-lg">
                  <div>Study Free Hours</div>
                  <div className="text-white font-bold mt-1 text-sm">{analysis?.weeklyInsights?.availableStudyHours?.toFixed(1) || '0'}h</div>
                </div>
              </div>

              {/* Stress indicators meters */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span>Burnout Risk</span>
                    <span className="font-extrabold">{analysis?.weeklyInsights?.burnoutRiskScore || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900 p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        (analysis?.weeklyInsights?.burnoutRiskScore || 0) >= 70 ? 'bg-rose-500' : (analysis?.weeklyInsights?.burnoutRiskScore || 0) >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${analysis?.weeklyInsights?.burnoutRiskScore || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span>Deadline Overload</span>
                    <span className="font-extrabold">{analysis?.weeklyInsights?.deadlineRiskScore || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900 p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        (analysis?.weeklyInsights?.deadlineRiskScore || 0) >= 70 ? 'bg-rose-500' : (analysis?.weeklyInsights?.deadlineRiskScore || 0) >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${analysis?.weeklyInsights?.deadlineRiskScore || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                    <span>Attendance Warning Level</span>
                    <span className="font-extrabold">{analysis?.weeklyInsights?.attendanceRiskScore || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900 p-0.5">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        (analysis?.weeklyInsights?.attendanceRiskScore || 0) >= 70 ? 'bg-rose-500' : (analysis?.weeklyInsights?.attendanceRiskScore || 0) >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${analysis?.weeklyInsights?.attendanceRiskScore || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Conflicts and Congestion detected */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/40 pb-2 flex items-center gap-2">
                <span>⚠️</span> Conflicts & Congestions
              </h3>

              <div className="space-y-3 overflow-y-auto max-h-[200px] pr-1">
                {analysis?.conflictsDetected && analysis.conflictsDetected.length > 0 ? (
                  analysis.conflictsDetected.map((conf, idx) => (
                    <div key={idx} className="bg-slate-950/40 border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1">
                      <div className="text-xs font-bold text-rose-400">{conf.issue}</div>
                      <div className="text-[11px] text-slate-300 leading-normal">{conf.impact}</div>
                      <div className="text-[10px] font-medium text-indigo-400 mt-1 italic">
                        💡 Resolution: {conf.resolution}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No timeline schedule clashes detected.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Academic & Personal Risks Log */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800/40 pb-2 flex items-center gap-2">
              <span>🚨</span> Predictive Risk Warnings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis?.risksIdentified && analysis.risksIdentified.length > 0 ? (
                analysis.risksIdentified.map((risk, idx) => (
                  <div key={idx} className="bg-slate-950/50 border border-slate-800/70 p-4 rounded-xl flex flex-col gap-1.5 hover:border-slate-700 transition">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {risk.type === 'burnout' ? '🔥' : risk.type === 'attendance' ? '📚' : risk.type === 'exam' ? '📝' : '⚠️'}
                      </span>
                      <div className="text-xs font-bold text-white truncate">{risk.title}</div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">{risk.reason}</p>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-6 text-slate-500 text-xs">
                  All predictive checks verified.
                </div>
              )}
            </div>
          </div>

          {/* Attendance Safety Recovery */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800/40 pb-2 flex items-center gap-2">
              <span>📚</span> Attendance Optimization Status
            </h3>

            <div className="space-y-3">
              {analysis?.attendanceStatus && analysis.attendanceStatus.length > 0 ? (
                analysis.attendanceStatus.map((subj, idx) => (
                  <div key={idx} className="bg-slate-950/30 border border-slate-900 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-white">{subj.subject} <span className="text-xs font-mono text-slate-400">({subj.code})</span></div>
                      <div className="text-xs text-slate-500 mt-1">Required: {subj.requiredPct}% &bull; Threshold: 75.0%</div>
                    </div>

                    <div className="flex items-center gap-4">
                      {subj.status !== 'safe' && (
                        <div className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                          {subj.needed} classes needed
                        </div>
                      )}
                      <div className="text-right">
                        <div className={`text-base font-extrabold ${subj.status === 'critical' ? 'text-rose-400' : subj.status === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {subj.currentPct}%
                        </div>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">{subj.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No courses registered in attendance logs.
                </div>
              )}
            </div>
          </div>

          {/* Coaching Recommendations */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800/40 pb-2 flex items-center gap-2">
              <span>💡</span> Proactive Recommendations
            </h3>

            <ul className="space-y-3">
              {analysis?.recommendations && analysis.recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-3 items-start text-xs text-slate-300">
                  <span className="text-indigo-400 text-sm mt-0.5">✔</span>
                  <span className="leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Schedule Changes Log */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800/40 pb-2 flex items-center gap-2">
              <span>🔄</span> Schedule Optimization Log
            </h3>

            <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-4 space-y-2 max-h-[150px] overflow-y-auto">
              {analysis?.scheduleChangesMade && analysis.scheduleChangesMade.map((change, idx) => (
                <div key={idx} className="text-xs text-slate-400 flex items-start gap-2 py-1 border-b border-slate-900 last:border-0">
                  <span className="text-emerald-400 font-bold">▶</span>
                  <span className="leading-relaxed">{change}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Optimization Control, Constraints Preferences */}
        <div className="md:col-span-2 lg:col-span-3 space-y-6">
          
          {/* Quick Optimizer Control Card */}
          <div className="glass-panel p-5 space-y-4 bg-gradient-to-br from-indigo-950/30 to-slate-950/40 border-indigo-500/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>⚡</span> Proactive Adaptations
            </h3>
            <p className="text-xs text-slate-400 leading-normal">
              Click below to let the agent resolve active timeline overlaps, schedule exam study blocks, and set recovery targets in Mongoose.
            </p>

            <button
              onClick={handleOptimizeSchedule}
              disabled={optimizing}
              className="w-full glass-btn-primary py-3 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(99,102,241,0.15)] active:scale-[0.98]"
            >
              {optimizing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Adapting Calendar...
                </>
              ) : (
                'Optimize & Adapt Calendar'
              )}
            </button>
          </div>

          {/* Preferences Configuration Panel */}
          <div className="glass-panel p-5 space-y-4">
            <div className="border-b border-slate-800/40 pb-2">
              <h3 className="text-sm font-bold text-white">Personal Scheduling Preferences</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Configures sleep limits and meal buffers</p>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Sleep Bedtime</label>
                  <input 
                    type="time" 
                    className="w-full glass-input text-sm py-2 text-white [&::-webkit-datetime-edit]:text-white [&::-webkit-datetime-edit-fields-wrapper]:text-white [&::-webkit-datetime-edit-ampm-field]:text-white"
                    value={editSleepStart}
                    onChange={(e) => setEditSleepStart(e.target.value)}
                  />
                  <span className="block text-[10px] text-indigo-400 font-semibold mt-1">{formatTime12Hour(editSleepStart)}</span>
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Sleep Wakeup</label>
                  <input 
                    type="time" 
                    className="w-full glass-input text-sm py-2 text-white [&::-webkit-datetime-edit]:text-white [&::-webkit-datetime-edit-fields-wrapper]:text-white [&::-webkit-datetime-edit-ampm-field]:text-white"
                    value={editSleepEnd}
                    onChange={(e) => setEditSleepEnd(e.target.value)}
                  />
                  <span className="block text-[10px] text-indigo-400 font-semibold mt-1">{formatTime12Hour(editSleepEnd)}</span>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Preferred Study Slot</label>
                <select 
                  className="w-full glass-input text-xs py-1.5 bg-slate-950"
                  value={editPreferredStudyHours}
                  onChange={(e) => setEditPreferredStudyHours(e.target.value)}
                >
                  <option value="morning">Morning (8 AM - 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                  <option value="evening">Evening (4 PM - 8 PM)</option>
                  <option value="night">Night (8 PM - 12 AM)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Breakfast</label>
                  <input 
                    type="time" 
                    className="w-full glass-input text-sm py-2 px-2 text-white [&::-webkit-datetime-edit]:text-white [&::-webkit-datetime-edit-fields-wrapper]:text-white [&::-webkit-datetime-edit-ampm-field]:text-white"
                    value={editBreakfastTime}
                    onChange={(e) => setEditBreakfastTime(e.target.value)}
                  />
                  <span className="block text-[10px] text-emerald-400 font-semibold mt-1">{formatTime12Hour(editBreakfastTime)}</span>
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Lunch</label>
                  <input 
                    type="time" 
                    className="w-full glass-input text-sm py-2 px-2 text-white [&::-webkit-datetime-edit]:text-white [&::-webkit-datetime-edit-fields-wrapper]:text-white [&::-webkit-datetime-edit-ampm-field]:text-white"
                    value={editLunchTime}
                    onChange={(e) => setEditLunchTime(e.target.value)}
                  />
                  <span className="block text-[10px] text-emerald-400 font-semibold mt-1">{formatTime12Hour(editLunchTime)}</span>
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Dinner</label>
                  <input 
                    type="time" 
                    className="w-full glass-input text-sm py-2 px-2 text-white [&::-webkit-datetime-edit]:text-white [&::-webkit-datetime-edit-fields-wrapper]:text-white [&::-webkit-datetime-edit-ampm-field]:text-white"
                    value={editDinnerTime}
                    onChange={(e) => setEditDinnerTime(e.target.value)}
                  />
                  <span className="block text-[10px] text-emerald-400 font-semibold mt-1">{formatTime12Hour(editDinnerTime)}</span>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-[9px] font-extrabold uppercase text-slate-400 mb-1">
                  <span>Travel Buffer</span>
                  <span className="text-white font-bold">{editTravelTimeMins} mins</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="120" 
                  step="5"
                  className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  value={editTravelTimeMins}
                  onChange={(e) => setEditTravelTimeMins(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Productivity Preference</label>
                <input 
                  type="text" 
                  placeholder="e.g. Balanced workload, frequent breaks"
                  className="w-full glass-input text-xs py-1.5"
                  value={editProductivityPreference}
                  onChange={(e) => setEditProductivityPreference(e.target.value)}
                />
              </div>

              {/* Personal Commitments tags creator */}
              <div>
                <label className="block text-[9px] font-extrabold uppercase text-slate-400 mb-1">Personal Commitments</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g. Gym, Yoga"
                    className="w-full glass-input text-xs py-1.5 flex-1"
                    value={commitmentInput}
                    onChange={(e) => setCommitmentInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCommitment(); } }}
                  />
                  <button 
                    type="button"
                    onClick={handleAddCommitment}
                    className="glass-btn-secondary px-3 py-1.5 text-xs font-bold"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {commitmentsList.map((comm, cidx) => (
                    <span 
                      key={cidx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 border border-slate-800 text-slate-300"
                    >
                      {comm}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveCommitment(comm)}
                        className="text-slate-500 hover:text-white leading-none font-bold"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/40">
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="w-full glass-btn-secondary py-2.5 font-bold text-xs uppercase tracking-wide border-violet-500/20 text-violet-400 hover:border-violet-500/40 hover:bg-violet-950/15"
                >
                  {savingPrefs ? 'Saving Settings...' : 'Save Configuration'}
                </button>
              </div>

            </form>
          </div>

        </div>

      </div>

    </div>
  );
};

export default SchedulingPage;

import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export const RoutinePage = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [feedbackList, setFeedbackList] = useState([]);
  const [votingId, setVotingId] = useState(null);

  const fetchRoutineData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await client.get('/routine/analyze');
      if (response.data) {
        setAnalysis(response.data.analysis);
        setFeedbackList(response.data.feedback || []);
      }
    } catch (err) {
      console.error('Failed to fetch routine analysis:', err);
      addToast('Error loading routine analysis. Please try again.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutineData();
  }, []);

  const handleFeedback = async (insightId, isHelpful) => {
    setVotingId(`${insightId}_${isHelpful ? 'up' : 'down'}`);
    try {
      const response = await client.post('/routine/feedback', {
        insightId,
        isHelpful,
        comments: isHelpful ? 'Voted helpful via dashboard' : 'Voted unhelpful via dashboard'
      });
      if (response.data) {
        addToast(
          isHelpful 
            ? 'Thank you! Your feedback helps train the Routine Brain.' 
            : 'Feedback recorded. Recommendations will adjust.', 
          'success'
        );
        // Refresh analysis silently to update confidence/routine metrics
        await fetchRoutineData(true);
      }
    } catch (err) {
      console.error('Failed to submit recommendation feedback:', err);
      addToast('Failed to save feedback rating.', 'error');
    } finally {
      setVotingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <svg className="animate-spin h-12 w-12 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm font-semibold tracking-wider text-indigo-400 uppercase animate-pulse">Running Neural Pattern Extraction...</span>
      </div>
    );
  }

  // Circular progress specs
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const routineScore = analysis?.routineScore || 70;
  const strokeDashoffset = circumference - (routineScore / 100) * circumference;

  // Retrieve existing voting status for an item
  const getVoteStatus = (insightId) => {
    const existing = feedbackList.find(f => f.insightId === insightId);
    if (!existing) return null;
    return existing.isHelpful ? 'helpful' : 'unhelpful';
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6 h-full flex flex-col justify-start">
      
      {/* 2-Column Responsive Layout: Left 70% / Right 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start flex-grow">
        
        {/* LEFT COLUMN: Routine Score, Profile Grid, Attendance, Habits, Predictions */}
        <div className="lg:col-span-7 space-y-6 flex flex-col">
          
          {/* Main Hero Card: Routine Score & General Summary */}
          <div className="glass-panel p-6 border border-purple-500/10 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-9xl pointer-events-none select-none">🧠</div>
            
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Circular Routine Score progress bar */}
              <div className="relative flex items-center justify-center select-none flex-shrink-0">
                <svg className="w-32 h-32 transform -rotate-90">
                  {/* Background track circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    className="stroke-slate-800"
                    strokeWidth="8"
                    fill="transparent"
                  />
                  {/* Glowing dynamic track */}
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    className="stroke-purple-500 transition-all duration-1000 ease-out"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-white tracking-tight leading-none">{routineScore}</span>
                  <span className="text-[10px] text-purple-400 font-extrabold uppercase mt-1 tracking-wider">Score</span>
                </div>
                {/* Glow ring filter effect */}
                <div className="absolute w-28 h-28 rounded-full border border-purple-500/20 blur-sm pointer-events-none"></div>
              </div>

              {/* Text Summary Info */}
              <div className="space-y-3 flex-grow text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <span className="flex h-3 w-3 items-center justify-center rounded-full bg-purple-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
                  </span>
                  <span className="text-[10px] font-extrabold text-purple-300 uppercase tracking-widest bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-full">
                    Routine Intelligence Agent
                  </span>
                  <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                    Confidence: {analysis?.confidenceScore || 80}%
                  </span>
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight leading-none">Routine Brain Analysis</h2>
                
                <p className="text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
                  Analyzing patterns from sleep schedules, attendance records, deep study sessions, and deadline behaviors to evaluate routine stability.
                </p>
              </div>
            </div>
          </div>

          {/* Grids: Productivity Profile & Study Profile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Productivity Profile Card */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
                <span className="text-purple-400">🕒</span> Productivity Profile
              </h3>
              
              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                  <span className="text-slate-400 font-medium">Peak Focus Hours</span>
                  <span className="text-white font-bold font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    {analysis?.productivityProfile?.peakFocusHours || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                  <span className="text-slate-400 font-medium">Low Energy Period</span>
                  <span className="text-slate-300 font-mono bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                    {analysis?.productivityProfile?.lowEnergyPeriods || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                  <span className="text-slate-400 font-medium">Deep Work Window</span>
                  <span className="text-indigo-300 font-bold font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {analysis?.productivityProfile?.deepWorkWindows || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                  <span className="text-slate-400 font-medium">Preferred Slot</span>
                  <span className="text-white font-bold uppercase tracking-wider text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-850">
                    {analysis?.productivityProfile?.preferredStudyTimes || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Study Habits Profile */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
                <span className="text-indigo-400">📚</span> Academic Study Profile
              </h3>
              
              <div className="space-y-3.5 text-xs">
                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Study Style</div>
                  <div className="text-white font-medium">{analysis?.studyProfile?.studyStyle || 'N/A'}</div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Exam Prep Mode</div>
                  <div className="text-white font-medium">{analysis?.studyProfile?.examPreparation || 'N/A'}</div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Assignment Response</div>
                  <div className="text-white font-medium">{analysis?.studyProfile?.assignmentCompletion || 'N/A'}</div>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                  <span className="text-slate-400 font-medium">Procrastination Score</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[9px] tracking-wider border ${
                    analysis?.studyProfile?.procrastinationTendency === 'high' 
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' 
                      : analysis?.studyProfile?.procrastinationTendency === 'medium'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                  }`}>
                    {analysis?.studyProfile?.procrastinationTendency || 'Low'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Grids: Attendance & Detected Routines Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Attendance Profile */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
                <span className="text-emerald-400">📈</span> Attendance Profile
              </h3>
              
              <div className="space-y-3 text-xs">
                <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 space-y-1">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Identified Trends</div>
                  <p className="text-slate-300 leading-relaxed font-medium">
                    {analysis?.attendanceProfile?.attendanceTrends || 'Stable attendance status.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Attendance Deficit Risk Areas</div>
                  {analysis?.attendanceProfile?.riskSubjects && analysis.attendanceProfile.riskSubjects.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analysis.attendanceProfile.riskSubjects.map((subject, index) => (
                        <span key={index} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          ⚠️ {subject}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 bg-slate-950/20 border border-slate-900/60 p-2.5 rounded-xl italic">
                      No subject warning thresholds triggered. Excellent work!
                    </div>
                  )}
                </div>

                {analysis?.attendanceProfile?.frequentlyMissedClasses && analysis.attendanceProfile.frequentlyMissedClasses.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Frequently Missed Classes</div>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.attendanceProfile.frequentlyMissedClasses.map((code, index) => (
                        <span key={index} className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-900 border border-slate-850 text-slate-400">
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detected Routines Habits */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
                <span className="text-teal-400">🔄</span> Weekly Habit Flows
              </h3>

              <div className="space-y-2.5 overflow-y-auto max-h-[260px] pr-1">
                {analysis?.detectedRoutines && analysis.detectedRoutines.length > 0 ? (
                  analysis.detectedRoutines.map((routine, idx) => (
                    <div key={idx} className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-xl flex flex-col gap-1 hover:border-slate-800 transition">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-white">{routine.habit}</span>
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/25">
                          {routine.frequency}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-450 leading-relaxed font-medium mt-1">
                        {routine.description}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No recurring habits identified yet. Try logged activities.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Predictions & Active Risks Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Predicted Activities */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
                <span className="text-blue-400">🎯</span> Next Likely Activities
              </h3>
              
              <div className="space-y-3.5">
                {analysis?.predictions && analysis.predictions.length > 0 ? (
                  analysis.predictions.map((pred, idx) => (
                    <div key={idx} className="bg-slate-950/40 border border-slate-900 p-3.5 rounded-xl flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-white">{pred.activity}</div>
                        <div className="text-[10px] text-slate-500 font-medium">Expected Time Slot: <span className="text-slate-350 font-bold">{pred.timing}</span></div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-extrabold text-blue-400 font-mono">
                          {pred.confidence}%
                        </div>
                        <div className="text-[9px] uppercase tracking-wider text-slate-600 font-bold">Confidence</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    Insufficient data for sequence prediction.
                  </div>
                )}
              </div>
            </div>

            {/* AI Risk Detection Log */}
            <div className="glass-panel p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
                <span className="text-rose-400">🚨</span> Anomalies & Risk Predictors
              </h3>
              
              <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
                {analysis?.risks && analysis.risks.length > 0 ? (
                  analysis.risks.map((risk, idx) => (
                    <div key={idx} className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl flex flex-col gap-1 hover:border-slate-800 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{risk.title}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                          risk.severity === 'critical' || risk.severity === 'high'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {risk.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {risk.detail}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500">
                    <span className="text-2xl mb-1">✔</span>
                    <span className="text-xs">All routine checkpoints are stable. No risks found.</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Key Insights Panel, Recommendations & Helpfulness Feedback */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Key Insights Panel */}
          <div className="glass-panel p-5 space-y-4 bg-gradient-to-br from-indigo-950/10 to-slate-950/40 border-indigo-500/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">💡</span> Life Pattern Insights
            </h3>
            
            <div className="space-y-3">
              {analysis?.keyInsights && analysis.keyInsights.length > 0 ? (
                analysis.keyInsights.map((insight, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start text-xs text-slate-350 leading-relaxed py-1.5 border-b border-slate-900/60 last:border-0">
                    <span className="text-indigo-500 font-bold select-none">•</span>
                    <span>{insight}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs italic">
                  Compiling habits...
                </div>
              )}
            </div>
          </div>

          {/* Recommendations and Feedback Checklists */}
          <div className="glass-panel p-5 space-y-4">
            <div className="border-b border-slate-800/40 pb-2">
              <h3 className="text-sm font-bold text-white">Interactive Recommendations</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Vote feedback to adapt the routine brain</p>
            </div>

            <div className="space-y-3.5">
              {analysis?.personalizedRecommendations && analysis.personalizedRecommendations.length > 0 ? (
                analysis.personalizedRecommendations.map((rec) => {
                  const vote = getVoteStatus(rec.id);
                  return (
                    <div 
                      key={rec.id} 
                      className="bg-slate-950/50 border border-slate-900 p-4 rounded-2xl flex flex-col gap-3 transition-all hover:border-slate-800"
                    >
                      <p className="text-xs text-slate-250 leading-relaxed font-medium">
                        {rec.text}
                      </p>

                      <div className="flex items-center justify-between border-t border-slate-900 pt-2.5">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-650">Helpful rating?</span>
                        
                        <div className="flex items-center gap-1.5">
                          {/* Helpful button */}
                          <button
                            onClick={() => handleFeedback(rec.id, true)}
                            disabled={votingId !== null}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all select-none ${
                              vote === 'helpful'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-slate-850'
                            }`}
                          >
                            {votingId === `${rec.id}_up` ? (
                              <span className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <span>👍</span>
                            )}
                            Yes
                          </button>

                          {/* Unhelpful button */}
                          <button
                            onClick={() => handleFeedback(rec.id, false)}
                            disabled={votingId !== null}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all select-none ${
                              vote === 'unhelpful'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-900 text-slate-500 hover:text-slate-300 hover:bg-slate-850 border border-slate-850'
                            }`}
                          >
                            {votingId === `${rec.id}_down` ? (
                              <span className="w-2.5 h-2.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <span>👎</span>
                            )}
                            No
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs italic">
                  No pending active advice.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default RoutinePage;

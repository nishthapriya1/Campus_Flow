import React from 'react';

export const OverviewTab = ({ routineBrain = {} }) => {
  const {
    routineScore = 80,
    workloadForecast = 'Light Workload',
    scheduleInsights = [],
    productivityProfile = {},
    risks = []
  } = routineBrain;

  return (
    <div className="space-y-6">
      
      {/* Overview Intro Card */}
      <div className="glass-panel p-6 border border-purple-500/10 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/20">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-9xl pointer-events-none select-none">🧠</div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 items-center justify-center rounded-full bg-purple-500">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></span>
            </span>
            <span className="text-[10px] font-extrabold text-purple-300 uppercase tracking-widest bg-purple-500/15 border border-purple-500/30 px-3 py-1 rounded-full">
              Routine Brain Integrated Engine
            </span>
            <span className="text-[10px] font-extrabold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
              Forecast: {workloadForecast}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-none">Routine Analysis Overview</h2>
          <p className="text-xs text-slate-350 leading-relaxed max-w-2xl">
            Analyzing student timetable commitments, daily focus session intervals, historical class attendance, and notifications responses to evaluate overall schedule consistency.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Productivity Profile */}
        <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
            <span>🕒</span> Productivity Profile
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
              <span className="text-slate-400 font-medium">Peak Focus Hours</span>
              <span className="text-white font-bold font-mono bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {productivityProfile.peakFocusHours || '17:00 - 19:00'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
              <span className="text-slate-400 font-medium">Low Energy Period</span>
              <span className="text-slate-350 font-mono bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
                {productivityProfile.lowEnergyPeriods || '13:00 - 15:00'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
              <span className="text-slate-400 font-medium">Deep Work Window</span>
              <span className="text-indigo-300 font-bold font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {productivityProfile.deepWorkWindows || '09:00 - 11:30'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
              <span className="text-slate-400 font-medium">Preferred Slot</span>
              <span className="text-white font-bold uppercase tracking-wider text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-850">
                {productivityProfile.preferredStudyTimes || 'evening'}
              </span>
            </div>
          </div>
        </div>

        {/* Key Routine Insights */}
        <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
          <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
            <span>💡</span> Schedule Insights
          </h3>
          <div className="space-y-3.5 max-h-[220px] overflow-y-auto sidebar-scrollbar pr-1">
            {scheduleInsights && scheduleInsights.length > 0 ? (
              scheduleInsights.map((insight, idx) => (
                <div key={idx} className="flex gap-2.5 items-start text-xs text-slate-300 leading-relaxed">
                  <span className="text-purple-500 font-bold select-none">•</span>
                  <span>{insight}</span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs italic">
                Compiling study and calendar patterns...
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Routine Risks Alerts */}
      <div className="glass-panel p-5 space-y-4 bg-slate-900/40">
        <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2.5 flex items-center gap-2">
          <span>🚨</span> Anomalies & Schedule Risks
        </h3>
        <div className="space-y-3 max-h-[260px] overflow-y-auto sidebar-scrollbar pr-1">
          {risks && risks.length > 0 ? (
            risks.map((risk, idx) => (
              <div key={idx} className="bg-slate-950/50 border border-slate-900 p-3.5 rounded-xl flex flex-col gap-1.5 hover:border-slate-800 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{risk.title}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                    risk.severity === 'critical' || risk.severity === 'high'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {risk.severity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-350 leading-relaxed font-medium">
                  {risk.detail}
                </p>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-8 text-slate-500">
              <span className="text-xl mb-1">✔</span>
              <span className="text-xs">All routine checkpoints are stable. No active risks found.</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default OverviewTab;

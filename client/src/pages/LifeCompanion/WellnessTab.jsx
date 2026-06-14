import React from 'react';

export const WellnessTab = ({
  lifeCompanion = {},
  wellnessForm = {},
  setWellnessForm,
  handleWellnessSubmit
}) => {
  const {
    lifestyleInsights = [],
    wellnessLogs = [],
    moodTrends = 'Stable',
    stressTrends = 'Low'
  } = lifeCompanion;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* Logging Form */}
      <div className="glass-panel p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2">
          ✍️ Log Daily Well-being
        </h3>
        <form onSubmit={handleWellnessSubmit} className="space-y-4 text-xs font-medium">
          
          <div className="space-y-1">
            <label className="text-slate-400">Mood (1: Exhausted, 5: Excellent)</label>
            <input
              type="range"
              min="1"
              max="5"
              value={wellnessForm.mood}
              onChange={(e) => setWellnessForm({ ...wellnessForm, mood: Number(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 px-1 font-bold mt-1">
              <span>😢</span>
              <span>😐</span>
              <span>😄</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">Sleep Hours</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              required
              value={wellnessForm.sleepHours}
              onChange={(e) => setWellnessForm({ ...wellnessForm, sleepHours: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-white font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">Stress Level (1: Relaxed, 5: Critical)</label>
            <input
              type="range"
              min="1"
              max="5"
              value={wellnessForm.stressLevel}
              onChange={(e) => setWellnessForm({ ...wellnessForm, stressLevel: Number(e.target.value) })}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 px-1 font-bold mt-1">
              <span>😌</span>
              <span>😐</span>
              <span>🚨</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400">Exercise Minutes</label>
            <input
              type="number"
              min="0"
              max="1440"
              required
              value={wellnessForm.exerciseMins}
              onChange={(e) => setWellnessForm({ ...wellnessForm, exerciseMins: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl p-2.5 text-white font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition"
          >
            Log Well-being
          </button>

        </form>
      </div>

      {/* Wellness Trends & History */}
      <div className="glass-panel p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2">
          📈 Wellness Insights & Trends
        </h3>
        
        <div className="space-y-3">
          {lifestyleInsights && lifestyleInsights.length > 0 ? (
            lifestyleInsights.map((ins, i) => (
              <div key={i} className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl text-xs text-slate-300 leading-relaxed font-medium">
                {ins}
              </div>
            ))
          ) : (
            <div className="text-slate-500 text-xs italic bg-slate-950/20 border border-slate-900 p-3 rounded-xl">
              No insights compiled yet. Log your parameters above.
            </div>
          )}
        </div>

        <div className="space-y-2 mt-4">
          <span className="text-[10px] uppercase font-bold text-slate-500">Recent entry history</span>
          <div className="space-y-2 overflow-y-auto max-h-[160px] sidebar-scrollbar pr-1">
            {wellnessLogs && wellnessLogs.length > 0 ? (
              wellnessLogs.map((log, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-slate-950/30 p-2.5 border border-slate-900 rounded-xl">
                  <span className="text-slate-450 font-bold">{new Date(log.createdAt).toLocaleDateString()}</span>
                  <div className="flex gap-3 text-slate-200 font-mono text-[11px]">
                    <span>Mood: <span className="font-bold text-white">{log.mood}</span>/5</span>
                    <span>Sleep: <span className="font-bold text-white">{log.sleepHours}h</span></span>
                    <span>Stress: <span className="font-bold text-white">{log.stressLevel}</span>/5</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-600 text-xs italic py-4 text-center">
                No logs recorded yet.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default WellnessTab;

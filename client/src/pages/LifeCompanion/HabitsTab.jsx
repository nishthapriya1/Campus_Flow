import React from 'react';

export const HabitsTab = ({
  habitTracker = {},
  selectedHabitDate,
  setSelectedHabitDate,
  todayHabits,
  handleHabitToggle
}) => {
  const {
    progressReports = {},
    streakStatistics = {}
  } = habitTracker;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      
      {/* Daily Checklist */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
          <h3 className="text-sm font-bold text-white">
            🔄 Daily Habits Checklist
          </h3>
          <input
            type="date"
            value={selectedHabitDate}
            onChange={(e) => setSelectedHabitDate(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-xs text-white"
          />
        </div>

        <div className="space-y-3.5 text-xs font-semibold select-none">
          
          {/* Sleep Checklist */}
          <label className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-base">🛌</span>
              <div className="flex flex-col">
                <span className="text-white">Sleep Rest habit</span>
                <span className="text-[10px] text-slate-500 font-medium">Target: 7-8 hours restful sleep</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={todayHabits.sleep}
              onChange={() => handleHabitToggle('sleep')}
              className="w-4.5 h-4.5 rounded-lg border-slate-850 text-indigo-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {/* Water Checklist */}
          <label className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-base">💧</span>
              <div className="flex flex-col">
                <span className="text-white">Hydration habit</span>
                <span className="text-[10px] text-slate-500 font-medium">Target: 2.5 - 3.0 Liters</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={todayHabits.waterIntake}
              onChange={() => handleHabitToggle('waterIntake')}
              className="w-4.5 h-4.5 rounded-lg border-slate-850 text-indigo-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {/* Exercise Checklist */}
          <label className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-base">🏃</span>
              <div className="flex flex-col">
                <span className="text-white">Exercise habit</span>
                <span className="text-[10px] text-slate-500 font-medium">Target: 20-30 mins active exercise</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={todayHabits.exercise}
              onChange={() => handleHabitToggle('exercise')}
              className="w-4.5 h-4.5 rounded-lg border-slate-850 text-indigo-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {/* Meditation Checklist */}
          <label className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-base">🧘</span>
              <div className="flex flex-col">
                <span className="text-white">Meditation habit</span>
                <span className="text-[10px] text-slate-500 font-medium">Target: 10 mins mindfulness block</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={todayHabits.meditation}
              onChange={() => handleHabitToggle('meditation')}
              className="w-4.5 h-4.5 rounded-lg border-slate-850 text-indigo-500 focus:ring-0 cursor-pointer"
            />
          </label>

          {/* Study Checklist */}
          <label className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-900 hover:border-slate-800 transition cursor-pointer">
            <div className="flex items-center gap-2">
              <span className="text-base">📚</span>
              <div className="flex flex-col">
                <span className="text-white">Study Blocks habit</span>
                <span className="text-[10px] text-slate-500 font-medium">Target: Complete scheduled focus plan</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={todayHabits.studyHours}
              onChange={() => handleHabitToggle('studyHours')}
              className="w-4.5 h-4.5 rounded-lg border-slate-850 text-indigo-500 focus:ring-0 cursor-pointer"
            />
          </label>

        </div>
      </div>

      {/* Progress & Streaks */}
      <div className="glass-panel p-5 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-slate-800/60 pb-2">
          📈 Habit streaks & progress
        </h3>
        
        <div className="space-y-4 text-xs">
          {Object.entries(progressReports || {}).map(([habit, completion]) => (
            <div key={habit} className="bg-slate-950/30 border border-slate-900 p-3.5 rounded-xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="font-bold text-white uppercase tracking-wider text-[10px]">
                  {habit === 'waterIntake' ? 'Water Intake' : habit === 'studyHours' ? 'Study Hours' : habit}
                </span>
                <div className="text-[10px] text-indigo-400 font-bold">Streak: {streakStatistics?.[habit] || 0} days 🔥</div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-indigo-350 font-mono">{completion}%</span>
                <div className="text-[9px] text-slate-500 font-medium">Completion rate</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default HabitsTab;

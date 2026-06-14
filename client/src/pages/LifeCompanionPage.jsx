import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

// Import subpage tabs
import OverviewTab from './LifeCompanion/OverviewTab';
import WellnessTab from './LifeCompanion/WellnessTab';
import ExpensesTab from './LifeCompanion/ExpensesTab';
import HabitsTab from './LifeCompanion/HabitsTab';
import BurnoutTab from './LifeCompanion/BurnoutTab';
import RecommendationsTab from './LifeCompanion/RecommendationsTab';

// Module-scoped cache to persist dashboard data across mounts
let cachedLifeCompanionData = null;

export const LifeCompanionPage = () => {
  const { addToast } = useToast();
  const { user } = useAuth();
  const userId = user?.userId || user?._id || '';

  // Clear cached data if the user session has changed to prevent data leaks or stale indices
  if (cachedLifeCompanionData && cachedLifeCompanionData.userId !== userId) {
    cachedLifeCompanionData = null;
  }

  const [loading, setLoading] = useState(!cachedLifeCompanionData);
  const [data, setData] = useState(cachedLifeCompanionData || null);
  const { pathname } = useLocation();

  // Debugging route and data logs (Task requirements)
  useEffect(() => {
    console.log(`[LifeCompanion] Active route path changed to: ${pathname}`);
  }, [pathname]);

  useEffect(() => {
    console.log('[LifeCompanion] Telemetry data state updated:', data);
  }, [data]);

  // Form states
  const [wellnessForm, setWellnessForm] = useState({
    mood: 3,
    sleepHours: 7,
    stressLevel: 3,
    exerciseMins: 30
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: 'Food',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [selectedHabitDate, setSelectedHabitDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayHabits, setTodayHabits] = useState({
    sleep: false,
    waterIntake: false,
    exercise: false,
    meditation: false,
    studyHours: false
  });

  const fetchData = async (silent = false) => {
    const shouldShowLoading = !silent && !cachedLifeCompanionData;
    if (shouldShowLoading) setLoading(true);
    try {
      const response = await client.get('/life-companion/dashboard');
      if (response.data) {
        setData(response.data);
        cachedLifeCompanionData = response.data; // Update module-scoped cache
        
        // Find habits for current selected date to populate checkmarks
        const currentHabits = response.data.habitTracker?.habitLogs?.find(
          l => l.date === selectedHabitDate
        );
        if (currentHabits) {
          setTodayHabits({
            sleep: currentHabits.sleep || false,
            waterIntake: currentHabits.waterIntake || false,
            exercise: currentHabits.exercise || false,
            meditation: currentHabits.meditation || false,
            studyHours: currentHabits.studyHours || false
          });
        } else {
          setTodayHabits({
            sleep: false,
            waterIntake: false,
            exercise: false,
            meditation: false,
            studyHours: false
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch life companion data:', err);
      addToast('Error loading Life Companion dashboard.', 'error');
    } finally {
      if (shouldShowLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(!!cachedLifeCompanionData);
  }, []);

  // Handle habit selection date changes
  useEffect(() => {
    if (data?.habitTracker?.habitLogs) {
      const currentHabits = data.habitTracker.habitLogs.find(l => l.date === selectedHabitDate);
      if (currentHabits) {
        setTodayHabits({
          sleep: currentHabits.sleep || false,
          waterIntake: currentHabits.waterIntake || false,
          exercise: currentHabits.exercise || false,
          meditation: currentHabits.meditation || false,
          studyHours: currentHabits.studyHours || false
        });
      } else {
        setTodayHabits({
          sleep: false,
          waterIntake: false,
          exercise: false,
          meditation: false,
          studyHours: false
        });
      }
    }
  }, [selectedHabitDate, data]);

  // Submit Wellness Log
  const handleWellnessSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await client.post('/life-companion/wellness', wellnessForm);
      if (response.status === 201) {
        addToast('Wellness metrics successfully logged! Analysis updated.', 'success');
        await fetchData(true);
      }
    } catch (err) {
      console.error('Failed to log wellness metrics:', err);
      addToast('Failed to save wellness log.', 'error');
    }
  };

  // Submit Expense
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) {
      return addToast('Please enter a valid expense amount.', 'error');
    }
    try {
      const response = await client.post('/life-companion/expense', expenseForm);
      if (response.status === 201) {
        addToast('Expense added. Financial insights compiled.', 'success');
        setExpenseForm({
          amount: '',
          category: 'Food',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        await fetchData(true);
      }
    } catch (err) {
      console.error('Failed to add expense:', err);
      addToast('Failed to add expense.', 'error');
    }
  };

  // Delete Expense
  const handleExpenseDelete = async (id) => {
    try {
      const response = await client.delete(`/life-companion/expense/${id}`);
      if (response.status === 200) {
        addToast('Expense deleted successfully.', 'success');
        await fetchData(true);
      }
    } catch (err) {
      console.error('Failed to delete expense:', err);
      addToast('Failed to delete expense record.', 'error');
    }
  };

  // Toggle Habit Checklist
  const handleHabitToggle = async (habitField) => {
    const nextVal = !todayHabits[habitField];
    const newHabits = { ...todayHabits, [habitField]: nextVal };
    setTodayHabits(newHabits);

    try {
      const response = await client.post('/life-companion/habits', {
        date: selectedHabitDate,
        [habitField]: nextVal
      });
      if (response.status === 200) {
        await fetchData(true);
      }
    } catch (err) {
      console.error('Failed to toggle habit:', err);
      addToast('Failed to save habit status.', 'error');
      // Revert local UI state
      setTodayHabits({ ...todayHabits, [habitField]: !nextVal });
    }
  };



  // Extract variables
  const {
    routineBrain = {},
    lifeCompanion = {},
    expenseIntelligence = {},
    habitTracker = {},
    burnoutGuardian = {},
    recommendations = {}
  } = data || {};

  // Custom visual indicators logic
  const burnoutRisk = burnoutGuardian.burnoutRiskScore || 0;
  const burnoutColor = burnoutRisk > 70 ? 'text-rose-400' : burnoutRisk > 40 ? 'text-amber-400' : 'text-emerald-400';
  const burnoutBg = burnoutRisk > 70 ? 'bg-rose-500' : burnoutRisk > 40 ? 'bg-amber-500' : 'bg-emerald-500';

  const activeBudget = expenseIntelligence.activeBudget || null;
  const getCurrencySymbol = (curr) => {
    switch (curr) {
      case 'INR': return '₹';
      case 'EUR': return '€';
      case 'USD':
      default: return '$';
    }
  };
  const mainSym = getCurrencySymbol(activeBudget ? activeBudget.currency : 'USD');
  const mainBudgetLimit = activeBudget ? activeBudget.budgetAmount : 500;
  const mainTotalSpent = expenseIntelligence.totalSpent !== undefined ? expenseIntelligence.totalSpent : 0;

  return (
    <div className="space-y-6 pb-24 md:pb-6 h-full flex flex-col justify-start">
      
      {/* Master Overview Score Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Score Card 1: Routine Score */}
        <div className="glass-panel p-4 flex flex-col items-center text-center relative overflow-hidden bg-slate-900/60 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Routine score</span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${routineBrain.routineScore}%` }} />
          </div>
          <span className="text-[9px] text-purple-400 font-bold mt-2 uppercase tracking-wide">{routineBrain.workloadForecast}</span>
        </div>

        {/* Score Card 2: Wellness Score */}
        <div className="glass-panel p-4 flex flex-col items-center text-center relative overflow-hidden bg-slate-900/60 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Wellness score</span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-teal-400 h-full rounded-full" style={{ width: `${lifeCompanion.wellnessScore}%` }} />
          </div>
          <span className="text-[9px] text-teal-400 font-bold mt-2 uppercase tracking-wide">Mood: {lifeCompanion.moodTrends}</span>
        </div>

        {/* Score Card 3: Budget Score */}
        <div className="glass-panel p-4 flex flex-col items-center text-center relative overflow-hidden bg-slate-900/60 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Budget score</span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full transition-all duration-550" style={{ width: `${expenseIntelligence.percentageUsed !== undefined ? Math.min(100, expenseIntelligence.percentageUsed) : 0}%` }} />
          </div>
          <span className="text-[9px] text-amber-400 font-bold mt-2 uppercase tracking-wide">Spent: {mainSym}{mainTotalSpent.toFixed(0)} / {mainSym}{mainBudgetLimit}</span>
        </div>

        {/* Score Card 4: Habits Completed */}
        <div className="glass-panel p-4 flex flex-col items-center text-center relative overflow-hidden bg-slate-900/60 border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Habit execution</span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${habitTracker.completionMetrics}%` }} />
          </div>
          <span className="text-[9px] text-indigo-400 font-bold mt-2 uppercase tracking-wide">Last 7 days logged</span>
        </div>

        {/* Score Card 5: Burnout Risk Gauge */}
        <div className="glass-panel p-4 flex flex-col items-center text-center relative overflow-hidden col-span-2 md:col-span-1 bg-slate-900/60 border-slate-850">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Burnout risk</span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className={`${burnoutBg} h-full rounded-full`} style={{ width: `${burnoutRisk}%` }} />
          </div>
          <span className={`text-[9px] font-bold mt-2 uppercase tracking-wide ${burnoutColor}`}>{burnoutGuardian.burnoutLevel} Risk</span>
        </div>

      </div>

      {/* Navigation Tab Menu Links */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-3">
        <NavLink
          to="/life-companion/overview"
          onClick={() => console.log('[LifeCompanion] Clicked tab: Overview & Routine')}
          className={({ isActive }) =>
            `px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isActive
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border-transparent'
            }`
          }
        >
          🧠 Overview & Routine
        </NavLink>
        <NavLink
          to="/life-companion/wellness"
          onClick={() => console.log('[LifeCompanion] Clicked tab: Wellness Logs')}
          className={({ isActive }) =>
            `px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isActive
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border-transparent'
            }`
          }
        >
          ❤️ Wellness Logs
        </NavLink>
        <NavLink
          to="/life-companion/expenses"
          onClick={() => console.log('[LifeCompanion] Clicked tab: Expenses Tracker')}
          className={({ isActive }) =>
            `px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isActive
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border-transparent'
            }`
          }
        >
          💰 Expenses Tracker
        </NavLink>
        <NavLink
          to="/life-companion/habits"
          onClick={() => console.log('[LifeCompanion] Clicked tab: Daily Habits')}
          className={({ isActive }) =>
            `px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isActive
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border-transparent'
            }`
          }
        >
          🔄 Daily Habits
        </NavLink>
        <NavLink
          to="/life-companion/burnout"
          onClick={() => console.log('[LifeCompanion] Clicked tab: Burnout Risk')}
          className={({ isActive }) =>
            `px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isActive
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border-transparent'
            }`
          }
        >
          🩹 Burnout Risk
        </NavLink>
        <NavLink
          to="/life-companion/recommendations"
          onClick={() => console.log('[LifeCompanion] Clicked tab: AI Advice')}
          className={({ isActive }) =>
            `px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              isActive
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow'
                : 'bg-slate-900/60 text-slate-400 hover:text-white border-transparent'
            }`
          }
        >
          🤖 AI Advice
        </NavLink>
      </div>

      {/* Nested Routing Content Area */}
      <div className="flex-grow">
        {!data ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 bg-slate-900/10 border border-slate-900/50 rounded-2xl p-8">
            <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs font-bold tracking-wider text-slate-400 uppercase animate-pulse">
              Synthesizing AI companion telemetry data...
            </span>
          </div>
        ) : (
          <Routes>
            <Route path="" element={<Navigate to="overview" replace />} />
            <Route
              path="overview"
              element={<OverviewTab routineBrain={routineBrain} />}
            />
            <Route
              path="wellness"
              element={
                <WellnessTab
                  lifeCompanion={lifeCompanion}
                  wellnessForm={wellnessForm}
                  setWellnessForm={setWellnessForm}
                  handleWellnessSubmit={handleWellnessSubmit}
                />
              }
            />
            <Route
              path="expenses"
              element={
                <ExpensesTab
                  expenseIntelligence={expenseIntelligence}
                  expenseForm={expenseForm}
                  setExpenseForm={setExpenseForm}
                  handleExpenseSubmit={handleExpenseSubmit}
                  handleExpenseDelete={handleExpenseDelete}
                  fetchData={fetchData}
                />
              }
            />
            <Route
              path="habits"
              element={
                <HabitsTab
                  habitTracker={habitTracker}
                  selectedHabitDate={selectedHabitDate}
                  setSelectedHabitDate={setSelectedHabitDate}
                  todayHabits={todayHabits}
                  handleHabitToggle={handleHabitToggle}
                />
              }
            />
            <Route
              path="burnout"
              element={<BurnoutTab burnoutGuardian={burnoutGuardian} />}
            />
            <Route
              path="recommendations"
              element={<RecommendationsTab recommendations={recommendations} />}
            />
          </Routes>
        )}
      </div>

    </div>
  );
};

export default LifeCompanionPage;

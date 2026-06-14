import React, { useState, useEffect, useRef } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { useNotification } from '../context/NotificationContext';

const PRESET_DURATIONS = [15, 25, 45, 60, 90];
const FRUIT_EMOJIS = {
  Apple: '🍎',
  Orange: '🍊',
  Mango: '🥭',
  Strawberry: '🍓',
  Grapes: '🍇',
  Banana: '🍌'
};

const FRUIT_RARITY = {
  Apple: { name: 'Common', style: 'border-slate-800/80 bg-slate-900/10 text-slate-400 hover:border-slate-700' },
  Banana: { name: 'Common', style: 'border-slate-800/80 bg-slate-900/10 text-slate-400 hover:border-slate-700' },
  Orange: { name: 'Rare', style: 'border-blue-500/20 bg-blue-950/10 text-blue-400 hover:border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]' },
  Grapes: { name: 'Rare', style: 'border-purple-500/20 bg-purple-950/10 text-purple-400 hover:border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)]' },
  Mango: { name: 'Epic', style: 'border-amber-500/35 bg-amber-950/10 text-amber-400 hover:border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
  Strawberry: { name: 'Legendary', style: 'border-rose-500/35 bg-rose-950/10 text-rose-400 hover:border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]' }
};

export const FocusZonePage = () => {
  const { addToast } = useToast();
  const { fetchUnreadCount } = useNotification();

  // Inventory & Streak stats state
  const [inventory, setInventory] = useState({
    fruitCounts: { Apple: 0, Orange: 0, Mango: 0, Strawberry: 0, Grapes: 0, Banana: 0 },
    totalFruits: 0
  });
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    longestStreak: 0,
    weeklyStreak: [
      { day: 'Mon', date: '', fruit: null },
      { day: 'Tue', date: '', fruit: null },
      { day: 'Wed', date: '', fruit: null },
      { day: 'Thu', date: '', fruit: null },
      { day: 'Fri', date: '', fruit: null },
      { day: 'Sat', date: '', fruit: null },
      { day: 'Sun', date: '', fruit: null }
    ]
  });
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalMinutes: 0,
    completionRate: 0,
    longestSession: 0,
    totalFruits: 0,
    currentStreak: 0
  });

  // Session state
  const [selectedDuration, setSelectedDuration] = useState(25); // minutes
  const [customDuration, setCustomDuration] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Timer state (seconds remaining)
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [totalSessionSeconds, setTotalSessionSeconds] = useState(25 * 60);
  
  // Animation state
  const [earnedFruit, setEarnedFruit] = useState(null);
  const [isDropping, setIsDropping] = useState(false);

  const timerRef = useRef(null);
  const isCompletingRef = useRef(false);

  // Fetch initial dashboard data
  const fetchDashboardData = async () => {
    try {
      const [invRes, streakRes, statsRes] = await Promise.all([
        client.get('/focus/inventory'),
        client.get('/focus/streak'),
        client.get('/focus/stats')
      ]);
      if (invRes.data) setInventory(invRes.data);
      if (streakRes.data) setStreakData(streakRes.data);
      if (statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch Focus Zone dashboard details:', err.message);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Timer logic
  useEffect(() => {
    if (isSessionActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSessionActive, isPaused]);

  // Session completion trigger effect (safe from StrictMode multiple state setter calls)
  useEffect(() => {
    if (isSessionActive && secondsRemaining === 0 && activeSessionId && !isPaused) {
      handleSessionComplete();
    }
  }, [secondsRemaining, isSessionActive, activeSessionId, isPaused]);

  // Duration helpers
  const handleDurationSelect = (mins) => {
    setIsCustom(false);
    setSelectedDuration(mins);
    setSecondsRemaining(mins * 60);
    setTotalSessionSeconds(mins * 60);
  };

  const handleCustomDurationChange = (e) => {
    const val = e.target.value;
    setCustomDuration(val);
    const mins = parseInt(val, 10);
    if (!isNaN(mins) && mins > 0) {
      setSelectedDuration(mins);
      setSecondsRemaining(mins * 60);
      setTotalSessionSeconds(mins * 60);
    }
  };

  // Start Session API call
  const handleStartSession = async () => {
    const mins = selectedDuration;
    if (!mins || mins <= 0 || mins > 480) {
      addToast('Please enter a duration between 1 and 480 minutes.', 'error');
      return;
    }

    try {
      const response = await client.post('/focus/start', { duration: mins });
      if (response.data && response.data._id) {
        setActiveSessionId(response.data._id);
        setIsSessionActive(true);
        setIsPaused(false);
        setSecondsRemaining(mins * 60);
        setTotalSessionSeconds(mins * 60);
        addToast(`Focus session of ${mins} minutes started. Stay focused!`, 'success');
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to start focus session.', 'error');
    }
  };

  // Pause Session
  const handlePauseSession = async () => {
    if (!activeSessionId) return;
    try {
      await client.post('/focus/pause', { sessionId: activeSessionId });
      setIsPaused(true);
      addToast('Focus session paused.', 'info');
    } catch (err) {
      addToast('Failed to pause focus session.', 'error');
    }
  };

  // Resume Session
  const handleResumeSession = async () => {
    if (!activeSessionId) return;
    try {
      await client.post('/focus/resume', { sessionId: activeSessionId });
      setIsPaused(false);
      addToast('Focus session resumed.', 'success');
    } catch (err) {
      addToast('Failed to resume focus session.', 'error');
    }
  };

  // End Session early
  const handleEndSessionEarly = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSessionActive(false);
    setIsPaused(false);
    setActiveSessionId(null);
    setSecondsRemaining(selectedDuration * 60);
    isCompletingRef.current = false;
    addToast('Session ended early. No fruit reward was earned.', 'warning');
  };

  // Complete Session
  const handleSessionComplete = async () => {
    if (!activeSessionId) return;
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    const sessionIdToComplete = activeSessionId;

    // Reset active session states immediately to prevent duplicates
    setIsSessionActive(false);
    setIsPaused(false);
    setActiveSessionId(null);

    try {
      const response = await client.post('/focus/complete', { sessionId: sessionIdToComplete });
      if (response.data) {
        const { earnedFruit } = response.data;
        setEarnedFruit(earnedFruit);
        setIsDropping(true);
        addToast(`🎉 Focus session completed! You earned a ${earnedFruit}.`, 'success');
        
        // Refresh dashboards
        fetchDashboardData();
        fetchUnreadCount();

        // Turn off animation after 2.5 seconds
        setTimeout(() => {
          setIsDropping(false);
          setEarnedFruit(null);
        }, 2500);
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to complete focus session.', 'error');
    } finally {
      isCompletingRef.current = false;
    }
  };

  // Developer Helper: complete session quickly for testing
  const handleDevSpeedUp = () => {
    if (!isSessionActive) return;
    setSecondsRemaining(3);
    addToast('Time sped up! Session will finish in 3 seconds.', 'info');
  };

  // Plant stage calculations
  const progressPercent = totalSessionSeconds > 0 
    ? ((totalSessionSeconds - secondsRemaining) / totalSessionSeconds) * 100 
    : 0;

  let stageLabel = 'Seed';
  let stageEmoji = '🌱';

  if (progressPercent < 20) {
    stageLabel = 'Seed';
    stageEmoji = '🌱';
  } else if (progressPercent < 40) {
    stageLabel = 'Sprout';
    stageEmoji = '🌿';
  } else if (progressPercent < 60) {
    stageLabel = 'Sapling';
    stageEmoji = '🌱';
  } else if (progressPercent < 80) {
    stageLabel = 'Tree';
    stageEmoji = '🌳';
  } else {
    stageLabel = 'Fruiting Tree';
    stageEmoji = '🌳';
  }

  // Formatting seconds into MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 h-full flex flex-col justify-start">
      <style>{`
        @keyframes drop-fruit {
          0% { transform: translateY(-160px) scale(0.5); opacity: 0; }
          40% { transform: translateY(160px) scale(1.3); opacity: 1; }
          60% { transform: translateY(240px) scale(0.9); opacity: 1; }
          80% { transform: translateY(280px) scale(1.1); opacity: 1; }
          100% { transform: translateY(320px) scale(1); opacity: 0; }
        }
        .animate-fruit-drop {
          animation: drop-fruit 2.1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.1); }
          50% { box-shadow: 0 0 70px rgba(99, 102, 241, 0.25); }
          100% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.1); }
        }
        @keyframes pulse-glow-active {
          0% { box-shadow: 0 0 45px rgba(16, 185, 129, 0.15); }
          50% { box-shadow: 0 0 85px rgba(16, 185, 129, 0.4); }
          100% { box-shadow: 0 0 45px rgba(16, 185, 129, 0.15); }
        }
        .tree-glow-inactive {
          animation: pulse-glow 3s infinite ease-in-out;
        }
        .tree-glow-active {
          animation: pulse-glow-active 2.2s infinite ease-in-out;
        }
      `}</style>

      {/* Grid wrapper for Left/Right columns: 70/30 split on desktop, 60/40 on tablet, stack on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-10 gap-6 items-stretch flex-1">
        
        {/* LEFT COLUMN (70% Desktop, 60% Tablet, 100% Mobile) */}
        <div className="md:col-span-3 lg:col-span-7 flex flex-col h-full">
          <div className="glass-panel p-8 flex flex-col items-center justify-between flex-1 relative overflow-hidden">
            
            {/* 1. Focus Zone Title */}
            <div className="text-center w-full pb-4 border-b border-slate-800/40">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
                <span>🌱</span> Focus Zone
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Maintain deep work, grow your tree, and harvest fruits.
              </p>
            </div>

            {/* 2. Tree Animation (Visual Centerpiece, size increased significantly and grows dynamically) */}
            <div className="flex flex-col items-center justify-center my-6 relative w-full">
              {/* Animated Fruit Drop Overlay */}
              {isDropping && earnedFruit && (
                <div className="absolute top-2 text-7xl md:text-8xl z-25 animate-fruit-drop select-none">
                  {FRUIT_EMOJIS[earnedFruit] || '🍎'}
                </div>
              )}

              {/* Large Plant Circle Container with Pulsating Glows */}
              <div 
                style={{ width: '340px', height: '340px' }}
                className={`flex items-center justify-center bg-slate-950/60 rounded-full border border-slate-800/70 shadow-inner relative transition-transform duration-300 hover:scale-102 ${isSessionActive && !isPaused ? 'tree-glow-active' : 'tree-glow-inactive'}`}
              >
                {/* Large growth emoji with dynamic scaling for physical growth during focus session */}
                <div 
                  style={{ 
                    fontSize: '150px', 
                    transform: `scale(${0.55 + (progressPercent / 100) * 0.7})`, 
                    transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    lineHeight: 1
                  }}
                  className="select-none text-center flex items-center justify-center"
                >
                  {stageEmoji}
                </div>

                {/* Growth Stage Fruit Details overlay for Fruiting Tree */}
                {stageLabel === 'Fruiting Tree' && (
                  <>
                    <div className="absolute top-12 left-16 text-lg sm:text-xl animate-pulse">🍎</div>
                    <div className="absolute top-16 right-20 text-lg sm:text-xl animate-pulse delay-100">🍊</div>
                    <div className="absolute bottom-20 left-20 text-lg sm:text-xl animate-pulse delay-200">🥭</div>
                  </>
                )}
              </div>
            </div>

            {/* 3. Growth Progress */}
            <div className="w-full max-w-lg space-y-2 mb-6">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Growth Stage: <span className="text-emerald-400 font-extrabold">{stageLabel}</span>
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {Math.round(progressPercent)}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-950/80 rounded-full overflow-hidden border border-slate-900 p-0.5">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 4. Countdown Timer */}
            <div className="text-6xl sm:text-7xl font-extrabold text-white tracking-widest font-mono mb-6 tabular-nums select-none bg-slate-950/40 px-6 py-2 rounded-2xl border border-slate-900 shadow-inner">
              {formatTime(secondsRemaining)}
            </div>

            {/* 5. Controls */}
            <div className="w-full max-w-lg flex flex-col items-center gap-4">
              {!isSessionActive ? (
                <div className="w-full space-y-4">
                  {/* Preset and Custom Durations selectors */}
                  <div className="grid grid-cols-6 gap-2">
                    {PRESET_DURATIONS.map((dur) => (
                      <button
                        key={dur}
                        disabled={isCustom}
                        onClick={() => handleDurationSelect(dur)}
                        className={`py-2 px-1 text-center rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                          selectedDuration === dur && !isCustom
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        {dur}m
                      </button>
                    ))}
                    <button
                      onClick={() => setIsCustom(true)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-semibold tracking-wide transition-all border ${
                        isCustom
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {isCustom && (
                    <div className="flex gap-2 justify-center items-center">
                      <input
                        type="number"
                        placeholder="Minutes (1-480)"
                        min="1"
                        max="480"
                        value={customDuration}
                        onChange={handleCustomDurationChange}
                        className="glass-input text-center w-full max-w-[160px] py-1.5"
                      />
                      <span className="text-xs text-slate-500">Minutes</span>
                    </div>
                  )}

                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleStartSession}
                      className="glass-btn-primary px-12 py-3.5 text-sm font-bold tracking-wider uppercase flex items-center gap-2 shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                    >
                      Start Focus Session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 items-center w-full">
                  <div className="flex gap-3 justify-center w-full">
                    {isPaused ? (
                      <button
                        onClick={handleResumeSession}
                        className="glass-btn-primary bg-emerald-600 hover:bg-emerald-500 text-xs py-2.5 px-8 flex-1 sm:flex-none"
                      >
                        Resume Focus
                      </button>
                    ) : (
                      <button
                        onClick={handlePauseSession}
                        className="glass-btn-secondary text-xs py-2.5 px-8 flex-1 sm:flex-none"
                      >
                        Pause Button
                      </button>
                    )}
                    <button
                      onClick={handleEndSessionEarly}
                      className="glass-btn-danger text-xs py-2.5 px-8 flex-1 sm:flex-none"
                    >
                      End Session
                    </button>
                  </div>

                  <button
                    onClick={handleDevSpeedUp}
                    className="text-[9px] uppercase font-bold tracking-widest text-slate-600 hover:text-indigo-400 transition-colors py-1 px-2"
                  >
                    ⏩ Speed Up (Dev Fast-Forward)
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN (30% Desktop, 40% Tablet, 100% Mobile) */}
        <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-6 justify-start">
          
          {/* 1. Weekly Fruit Streak Card */}
          <div className="glass-panel p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">Weekly Fruit Streak</h2>
              <span className="text-lg">🔥 {streakData.currentStreak} Days</span>
            </div>
            
            {/* Mini days grid */}
            <div className="grid grid-cols-7 gap-1.5 pt-1 text-center">
              {streakData.weeklyStreak.map((dayObj, idx) => (
                <div key={idx} className="flex flex-col gap-1 items-center">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                    {dayObj.day}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-slate-950/60 border border-slate-900 flex items-center justify-center text-sm select-none hover:border-slate-800 transition-colors">
                    {dayObj.fruit ? (
                      FRUIT_EMOJIS[dayObj.fruit]
                    ) : (
                      <span className="text-[10px] text-slate-800">⬜</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Lifetime Stats Card (Moved directly below Streak, redesigned) */}
          <div className="glass-panel p-5 space-y-4">
            <h2 className="text-base font-bold text-white tracking-tight">Lifetime Stats</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-3 flex flex-col gap-0.5 hover:border-slate-800 transition-colors">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">Sessions</div>
                <div className="text-base font-bold text-white tracking-tight">{stats.totalSessions}</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-3 flex flex-col gap-0.5 hover:border-slate-800 transition-colors">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">Time Focused</div>
                <div className="text-base font-bold text-white tracking-tight truncate">{stats.totalMinutes}m</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-3 flex flex-col gap-0.5 hover:border-slate-800 transition-colors">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">Longest Focus</div>
                <div className="text-base font-bold text-white tracking-tight">{stats.longestSession || 0}m</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-3 flex flex-col gap-0.5 hover:border-slate-800 transition-colors">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">Current Streak</div>
                <div className="text-base font-bold text-white tracking-tight">{stats.currentStreak || 0}d</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-3 flex flex-col gap-0.5 hover:border-slate-800 transition-colors">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">Completion Rate</div>
                <div className="text-base font-bold text-emerald-400 tracking-tight">{stats.completionRate}%</div>
              </div>
              <div className="bg-slate-950/40 border border-slate-900/60 rounded-xl p-3 flex flex-col gap-0.5 hover:border-slate-800 transition-colors">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">Total Harvested</div>
                <div className="text-base font-bold text-indigo-400 tracking-tight">{stats.totalFruits || 0}</div>
              </div>
            </div>
          </div>

          {/* 3. My Orchard Card (Moved directly below Stats, redesigned responsive 3-col grid with animations & badges) */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">My Orchard</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-slate-400">
                Fruits: {inventory.totalFruits}
              </span>
            </div>

            {/* Grid of fruits: 3 columns per row on right sidebar, hover transition, rarity style */}
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(FRUIT_EMOJIS).map((fruit) => {
                const count = inventory.fruitCounts[fruit] || 0;
                const rarity = FRUIT_RARITY[fruit] || { name: 'Common', style: 'border-slate-800/80 text-slate-400' };

                return (
                  <div
                    key={fruit}
                    className={`relative p-3 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all duration-300 transform hover:scale-[1.06] hover:-translate-y-[2px] cursor-default select-none ${rarity.style}`}
                    title={`${fruit} (${rarity.name})`}
                  >
                    {/* Quantity Badge */}
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white rounded-full text-[9px] px-1.5 py-0.2 font-extrabold shadow-md leading-none flex items-center justify-center min-w-[16px] min-h-[16px]">
                        {count}
                      </span>
                    )}
                    <span className="text-3xl filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">{FRUIT_EMOJIS[fruit]}</span>
                    <span className="text-[10px] font-semibold text-slate-300 truncate w-full text-center mt-1">{fruit}</span>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold text-center block leading-none">
                      {rarity.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default FocusZonePage;

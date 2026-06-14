import express from 'express';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import WellnessLog from '../models/WellnessLog.js';
import Expense from '../models/Expense.js';
import HabitLog from '../models/HabitLog.js';
import Notification from '../models/Notification.js';
import Event from '../models/Event.js';
import Attendance from '../models/Attendance.js';
import StudyPlan from '../models/StudyPlan.js';
import FocusSession from '../models/FocusSession.js';
import RoutineFeedback from '../models/RoutineFeedback.js';
import SchedulingPreferences from '../models/SchedulingPreferences.js';
import MonthlyBudget from '../models/MonthlyBudget.js';
import { runRoutineIntelligenceAnalysis, runStudentLifeAICompanionAnalysis } from '../services/bedrock.service.js';
import { publishNotification } from '../services/sns.service.js';
import CachedAnalysis from '../models/CachedAnalysis.js';
import { computeHash } from '../utils/hash.js';

const router = express.Router();

router.use(verifyJWT);
router.use(requireRole('student'));

// Helper to check and create a notification with a 24-hour database-level cooldown check per alertType
const checkAndCreateNotification = async (userId, alertType, severity, title, shortMessage, detailedReason, recommendedAction) => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingNotification = await Notification.findOne({
    userId,
    alertType,
    createdAt: { $gte: oneDayAgo }
  });

  if (existingNotification) {
    console.log(`Notification of type ${alertType} suppressed for user ${userId} due to 24-hour cooldown.`);
    return null;
  }

  const notification = await Notification.create({
    userId,
    alertType,
    severity,
    title: title.substring(0, 60),
    shortMessage,
    detailedReason,
    recommendedAction,
    deadline: null
  });

  // Trigger publish (which handles SNS/Lambda push notification simulation)
  await publishNotification({
    userId: userId.toString(),
    alertType,
    severity,
    title: notification.title,
    shortMessage,
    detailedReason,
    recommendedAction,
    deadline: null
  });

  return notification;
};

// GET /api/life-companion/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const now = new Date();

    const past = new Date();
    past.setDate(now.getDate() - 14);
    const future = new Date();
    future.setDate(now.getDate() + 14);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Parallelize Mongoose queries
    const [
      preferences,
      events,
      attendance,
      studyPlan,
      focusSessions,
      notifications,
      routineFeedback,
      wellnessLogs,
      expenses,
      habitLogs,
      allHabitLogs,
      activeBudget,
      allBudgets
    ] = await Promise.all([
      SchedulingPreferences.findOne({ userId }).then(async p => {
        if (!p) {
          const newP = new SchedulingPreferences({ userId });
          await newP.save();
          return newP;
        }
        return p;
      }),
      Event.find({ userId, startTime: { $gte: past, $lte: future } }).sort({ startTime: 1 }),
      Attendance.find({ userId }).sort({ subjectName: 1 }),
      StudyPlan.findOne({ userId, status: 'active' }).sort({ createdAt: -1 }),
      FocusSession.find({ userId }).sort({ createdAt: -1 }),
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(50),
      RoutineFeedback.find({ userId }),
      WellnessLog.find({ userId }).sort({ createdAt: -1 }).limit(30),
      Expense.find({ userId }).sort({ date: -1 }),
      HabitLog.find({ userId, date: { $gte: sevenDaysAgo.toISOString().split('T')[0] } }).sort({ date: 1 }),
      HabitLog.find({ userId }).sort({ date: -1 }).limit(15),
      MonthlyBudget.findOne({ userId, month: currentMonth, year: currentYear }),
      MonthlyBudget.find({ userId }).sort({ year: -1, month: -1 })
    ]);

    // ====================================================
    // MODULE 1: Routine Brain (calculated dynamically)
    // ====================================================
    let routineScore = 75;
    const lowAtt = attendance.filter(a => {
      const pct = a.conducted === 0 ? 100 : (a.attended / a.conducted) * 100;
      return pct < 75;
    });
    routineScore -= lowAtt.length * 4;
    routineScore += Math.min(15, focusSessions.length * 3);
    const unreadWarning = notifications.filter(n => !n.read && n.severity === 'critical');
    routineScore -= unreadWarning.length * 3;
    routineScore = Math.max(35, Math.min(99, routineScore));

    const upcomingEvents = events.filter(e => new Date(e.startTime) >= now && new Date(e.startTime) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    const upcomingAssignments = upcomingEvents.filter(e => e.type === 'assignment' || e.type === 'exam');
    
    let workloadForecast = 'Light Workload';
    if (upcomingAssignments.length > 3) {
      workloadForecast = 'High Workload';
    } else if (upcomingEvents.length > 8) {
      workloadForecast = 'Moderate Workload';
    }

    const peakFocus = preferences.preferredStudyHours === 'morning' ? '08:00 - 12:00' 
                     : preferences.preferredStudyHours === 'afternoon' ? '12:00 - 16:00'
                     : preferences.preferredStudyHours === 'evening' ? '17:00 - 20:00' : '20:00 - 23:00';

    const scheduleInsights = [];
    if (focusSessions.length > 0) {
      const totalMins = focusSessions.reduce((acc, s) => acc + s.duration, 0);
      const avgMins = Math.round(totalMins / focusSessions.length);
      scheduleInsights.push(`Average focus duration is ${avgMins} minutes across ${focusSessions.length} recorded sessions.`);
    } else {
      scheduleInsights.push('No recent focus sessions recorded. Try using the Focus Zone to build focus trends.');
    }

    if (attendance.length > 0) {
      const avgPct = attendance.reduce((acc, a) => {
        const pct = a.conducted === 0 ? 100 : (a.attended / a.conducted) * 100;
        return acc + pct;
      }, 0) / attendance.length;
      scheduleInsights.push(`Academic attendance averages ${avgPct.toFixed(1)}% across all registered classes.`);
    }

    if (preferences.sleepStart) {
      scheduleInsights.push(`Sleep cycles are regular, averaging 8 hours (bedtime around ${preferences.sleepStart}).`);
    }

    const routineBrain = {
      routineScore,
      workloadForecast,
      scheduleInsights,
      productivityProfile: {
        peakFocusHours: peakFocus,
        lowEnergyPeriods: '13:00 - 15:00',
        deepWorkWindows: '09:00 - 11:30',
        preferredStudyTimes: preferences.preferredStudyHours || 'evening'
      },
      risks: []
    };
    if (lowAtt.length > 0) {
      routineBrain.risks.push({
        type: 'attendance',
        title: 'Subject Attendance Shortage',
        severity: 'high',
        detail: `You are currently below the required 75% in ${lowAtt.map(a => a.subjectName).join(', ')}.`
      });
    }
    const upcomingExams = events.filter(e => e.type === 'exam');
    if (upcomingExams.length > 0 && (!studyPlan || studyPlan.sessions?.length === 0)) {
      routineBrain.risks.push({
        type: 'exam',
        title: 'Exam Preparation Risk',
        severity: 'critical',
        detail: `You have ${upcomingExams.length} upcoming exams but no active study sessions planned.`
      });
    }

    // ====================================================
    // MODULE 2: Wellness Engine (calculated dynamically)
    // ====================================================
    const parseTimeToMins = (t) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    const getSleepDurationFromPrefs = (prefs) => {
      const start = parseTimeToMins(prefs?.sleepStart || '23:00');
      const end = parseTimeToMins(prefs?.sleepEnd || '07:00');
      let diff = end - start;
      if (diff < 0) diff += 24 * 60; // wraps around midnight
      return diff / 60;
    };

    let wellnessScore = 0;
    let moodTrends = 'Stable';
    let stressTrends = 'Low';
    let lifestyleInsights = [];
    let avgMood = 0;
    let avgSleep = 0;
    let avgStress = 0;
    let avgExercise = 0;

    if (wellnessLogs.length > 0) {
      avgMood = wellnessLogs.reduce((sum, l) => sum + l.mood, 0) / wellnessLogs.length;
      avgSleep = wellnessLogs.reduce((sum, l) => sum + l.sleepHours, 0) / wellnessLogs.length;
      avgStress = wellnessLogs.reduce((sum, l) => sum + l.stressLevel, 0) / wellnessLogs.length;
      avgExercise = wellnessLogs.reduce((sum, l) => sum + l.exerciseMins, 0) / wellnessLogs.length;

      const moodScore = (avgMood / 5) * 100;
      const sleepScore = Math.max(0, 100 - Math.abs(8 - avgSleep) * 15);
      const stressScore = ((6 - avgStress) / 5) * 100;
      const exerciseScore = Math.min(100, (avgExercise / 30) * 100);

      wellnessScore = Math.round((moodScore * 0.3) + (sleepScore * 0.3) + (stressScore * 0.2) + (exerciseScore * 0.2));

      // Mood Trends
      if (wellnessLogs.length >= 2) {
        const latestMood = wellnessLogs[0].mood;
        const prevAvgMood = wellnessLogs.slice(1).reduce((sum, l) => sum + l.mood, 0) / (wellnessLogs.length - 1);
        if (latestMood < prevAvgMood - 0.5) {
          moodTrends = 'Declining';
        } else if (latestMood > prevAvgMood + 0.5) {
          moodTrends = 'Improving';
        } else {
          moodTrends = 'Stable';
        }
      }

      // Stress Trends
      if (avgStress <= 2) stressTrends = 'Low';
      else if (avgStress <= 3.5) stressTrends = 'Medium';
      else stressTrends = 'High';

      // Lifestyle Insights
      if (avgSleep < 6) {
        lifestyleInsights.push(`You are averaging ${avgSleep.toFixed(1)} hours of sleep. Consider adjusting study blocks.`);
      } else {
        lifestyleInsights.push(`Great job! Your sleep averages ${avgSleep.toFixed(1)} hours, which aids information retention.`);
      }

      if (avgExercise < 15) {
        lifestyleInsights.push('Exercise levels are low. Try inserting a 15-minute stretch/walk during breaks.');
      } else {
        lifestyleInsights.push(`Physical fitness is solid, with an average of ${avgExercise.toFixed(0)} mins/session.`);
      }
    } else {
      // Calculate from preferences and habits/attendance/events
      avgMood = 3.5; // default neutral-positive mood
      avgSleep = getSleepDurationFromPrefs(preferences);
      
      // Stress calculation from real data fallback
      const lowAttCount = lowAtt.length;
      const upcomingEventsCount = events.filter(e => {
        const isUpcoming = new Date(e.startTime) >= now && new Date(e.startTime) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        return isUpcoming && (e.type === 'assignment' || e.type === 'exam');
      }).length;
      avgStress = Math.min(5, 2.0 + (lowAttCount * 0.5) + (upcomingEventsCount * 0.5));

      // Exercise calculation from habits in the last 7 days
      const exerciseHabitsCount = habitLogs.filter(h => h.exercise).length;
      avgExercise = exerciseHabitsCount > 0 ? (exerciseHabitsCount / (habitLogs.length || 7)) * 30 : 0;

      const moodScore = (avgMood / 5) * 100;
      const sleepScore = Math.max(0, 100 - Math.abs(8 - avgSleep) * 15);
      const stressScore = ((6 - avgStress) / 5) * 100;
      const exerciseScore = Math.min(100, (avgExercise / 30) * 100);

      wellnessScore = Math.round((moodScore * 0.3) + (sleepScore * 0.3) + (stressScore * 0.2) + (exerciseScore * 0.2));
      
      if (avgStress <= 2) stressTrends = 'Low';
      else if (avgStress <= 3.5) stressTrends = 'Medium';
      else stressTrends = 'High';

      lifestyleInsights.push('No wellness logs recorded this month. Add a log to unlock lifestyle insights.');
    }

    const lifeCompanion = {
      wellnessScore,
      moodTrends,
      stressTrends,
      lifestyleInsights,
      wellnessLogs
    };

    // ====================================================
    // MODULE 3: Expense Intelligence (calculated dynamically)
    // ====================================================
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthlyExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d >= startOfMonth && d <= endOfMonth;
    });
    const totalSpent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);

    const latestBudget = allBudgets && allBudgets.length > 0 ? allBudgets[0] : null;
    const budgetAmount = activeBudget ? activeBudget.budgetAmount : (latestBudget ? latestBudget.budgetAmount : 500);
    const currency = activeBudget ? activeBudget.currency : (latestBudget ? latestBudget.currency : 'USD');
    const currencySymbol = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '$';

    const remainingBudget = budgetAmount > 0 ? budgetAmount - totalSpent : 0;
    const percentageUsed = budgetAmount > 0 ? Math.round((totalSpent / budgetAmount) * 100) : 0;

    // Daily Safe Spending Limit
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();
    const remainingDays = Math.max(1, totalDaysInMonth - currentDay + 1);
    const dailySafeLimit = remainingBudget > 0 ? parseFloat((remainingBudget / remainingDays).toFixed(2)) : 0;

    // Predicted Month-End Spending
    const avgDailySpend = currentDay > 0 ? totalSpent / currentDay : 0;
    const predictedEndSpent = parseFloat((avgDailySpend * totalDaysInMonth).toFixed(2));

    // Budget Health Status
    let budgetHealthStatus = 'SAFE';
    if (percentageUsed >= 90) {
      budgetHealthStatus = 'CRITICAL';
    } else if (percentageUsed >= 70) {
      budgetHealthStatus = 'WARNING';
    }

    // Category breakdown
    const categoryTotals = { Food: 0, Travel: 0, Education: 0, Shopping: 0, Entertainment: 0, Other: 0 };
    monthlyExpenses.forEach(e => {
      if (categoryTotals[e.category] !== undefined) {
        categoryTotals[e.category] += e.amount;
      }
    });

    const discretionarySpend = categoryTotals.Shopping + categoryTotals.Entertainment;
    const discretionaryPct = totalSpent > 0 ? discretionarySpend / totalSpent : 0;
    
    let savingsEstimates = 0;
    if (discretionarySpend > 175) {
      savingsEstimates = discretionarySpend - 175;
    }

    const financialInsights = [];
    if (budgetAmount > 0) {
      if (totalSpent > budgetAmount) {
        financialInsights.push(`Your spending is at ${currencySymbol}${totalSpent.toFixed(2)}, exceeding your ${currencySymbol}${budgetAmount} monthly budget limit.`);
      } else {
        financialInsights.push(`Spending is on track: ${currencySymbol}${totalSpent.toFixed(2)} out of ${currencySymbol}${budgetAmount}.00 limits.`);
      }
    } else {
      financialInsights.push('No monthly budget set. Configure a budget to unlock financial health tracking.');
    }

    if (discretionaryPct > 0.35) {
      financialInsights.push(`Discretionary spending (Shopping & Entertainment) represents ${(discretionaryPct * 100).toFixed(0)}% of your expenses.`);
    }

    const budgetScore = budgetAmount > 0 
      ? Math.max(0, Math.min(100, Math.round(100 - (totalSpent > budgetAmount ? ((totalSpent - budgetAmount) / budgetAmount) * 100 : 0))))
      : (totalSpent > 0 ? 0 : 100);

    const financialHealthScore = Math.max(0, Math.min(100, Math.round(
      (budgetScore * 0.6) + (Math.max(0, 1 - discretionaryPct) * 40)
    )));

    const expenseIntelligence = {
      budgetScore,
      financialHealthScore,
      spendingTrends: categoryTotals,
      savingsEstimates,
      financialInsights,
      expenses,
      activeBudget,
      allBudgets,
      totalSpent,
      remainingBudget,
      percentageUsed,
      dailySafeLimit,
      predictedEndSpent,
      budgetHealthStatus
    };

    // ====================================================
    // MODULE 4: Habit Tracker (calculated dynamically)
    // ====================================================
    const totalDaysLogged = habitLogs.length || 1;
    const completions = { sleep: 0, waterIntake: 0, exercise: 0, meditation: 0, studyHours: 0 };
    habitLogs.forEach(l => {
      if (l.sleep) completions.sleep++;
      if (l.waterIntake) completions.waterIntake++;
      if (l.exercise) completions.exercise++;
      if (l.meditation) completions.meditation++;
      if (l.studyHours) completions.studyHours++;
    });

    const progressReports = {
      sleep: Math.round((completions.sleep / totalDaysLogged) * 100),
      waterIntake: Math.round((completions.waterIntake / totalDaysLogged) * 100),
      exercise: Math.round((completions.exercise / totalDaysLogged) * 100),
      meditation: Math.round((completions.meditation / totalDaysLogged) * 100),
      studyHours: Math.round((completions.studyHours / totalDaysLogged) * 100),
    };

    const calculateStreak = (field) => {
      let streak = 0;
      for (let i = 0; i < 15; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const log = allHabitLogs.find(l => l.date === dStr);
        if (log && log[field]) {
          streak++;
        } else {
          if (i === 0) continue; // Allow today to not be checked yet
          break;
        }
      }
      return streak;
    };

    const streakStatistics = {
      sleep: calculateStreak('sleep'),
      waterIntake: calculateStreak('waterIntake'),
      exercise: calculateStreak('exercise'),
      meditation: calculateStreak('meditation'),
      studyHours: calculateStreak('studyHours'),
    };

    const totalChecks = completions.sleep + completions.waterIntake + completions.exercise + completions.meditation + completions.studyHours;
    const completionMetrics = habitLogs.length > 0 ? Math.round((totalChecks / (5 * habitLogs.length)) * 100) : 0;

    const habitTracker = {
      progressReports,
      streakStatistics,
      completionMetrics,
      habitLogs
    };

    // ====================================================
    // MODULE 5: Burnout Guardian (calculated dynamically)
    // ====================================================
    const stressFactor = (avgStress / 5) * 100;
    const sleepFactor = Math.max(0, (8 - avgSleep) / 8 * 100);
    const routineFactor = 100 - routineScore;
    const habitFactor = 100 - completionMetrics;

    const burnoutRiskScore = Math.max(0, Math.min(100, Math.round(
      (stressFactor * 0.4) + (sleepFactor * 0.2) + (routineFactor * 0.2) + (habitFactor * 0.2)
    )));

    let burnoutLevel = 'Low';
    if (burnoutRiskScore > 70) burnoutLevel = 'High';
    else if (burnoutRiskScore > 40) burnoutLevel = 'Moderate';

    const contributingFactors = [];
    if (stressFactor > 50) contributingFactors.push('Elevated average stress levels');
    if (sleepFactor > 25) contributingFactors.push('Inadequate sleep rest (less than 7 hours)');
    if (routineFactor > 40) contributingFactors.push('Inconsistent schedule routine');
    if (habitFactor > 40) contributingFactors.push('Low checklist habits execution');

    const recoveryGuidance = [];
    if (burnoutLevel === 'High') {
      recoveryGuidance.push('Initiate a dedicated rest day immediately.');
      recoveryGuidance.push('Commit to a 15-minute mindfulness block.');
      recoveryGuidance.push('Enforce a strict screen-free hour before sleep.');
    } else if (burnoutLevel === 'Moderate') {
      recoveryGuidance.push('Take brief 10-minute micro-breaks between classes.');
      recoveryGuidance.push('Try to schedule at least 7.5 hours of sleep tonight.');
    } else {
      recoveryGuidance.push('Maintain your balanced study-to-rest ratio.');
      recoveryGuidance.push('Keep tracking wellness details daily.');
    }

    const burnoutGuardian = {
      burnoutRiskScore,
      burnoutLevel,
      contributingFactors,
      recoveryGuidance
    };

    // ====================================================
    // MODULE 6: Caching & Recommendations Integration
    // ====================================================
    // Check cache using computed telemetry metrics
    const telemetryState = {
      userId,
      routineScore,
      workloadForecast,
      wellnessScore,
      moodTrends,
      stressTrends,
      totalSpent,
      budgetAmount,
      percentageUsed,
      budgetScore,
      completionMetrics,
      burnoutRiskScore,
      burnoutLevel,
      date: now.toISOString().split('T')[0]
    };
    const inputHash = computeHash(telemetryState);

    const cached = await CachedAnalysis.findOne({ userId, analysisType: 'life_companion_dashboard' });
    if (cached && cached.inputHash === inputHash) {
      console.log(`[CACHE HIT] Returning cached life companion dashboard for user ${userId}`);
      
      if (cached.payload && cached.payload.routineBrain) {
        routineBrain.scheduleInsights = cached.payload.routineBrain.scheduleInsights || routineBrain.scheduleInsights;
        routineBrain.productivityProfile = cached.payload.routineBrain.productivityProfile || routineBrain.productivityProfile;
        routineBrain.risks = cached.payload.routineBrain.risks || routineBrain.risks;
      }
      
      const payload = {
        userId,
        routineBrain,
        lifeCompanion,
        expenseIntelligence,
        habitTracker,
        burnoutGuardian,
        recommendations: cached.payload.recommendations
      };
      
      return res.status(200).json(payload);
    }

    console.log(`[CACHE MISS] Running Bedrock analysis for user ${userId}...`);

    // Run AI computation on cache miss
    const routineAnalysis = await runRoutineIntelligenceAnalysis({
      userId,
      events,
      attendance,
      studyPlan,
      focusSessions,
      notifications,
      feedback: routineFeedback,
      preferences
    });

    if (routineAnalysis) {
      routineBrain.scheduleInsights = routineAnalysis.keyInsights || routineBrain.scheduleInsights;
      routineBrain.productivityProfile = routineAnalysis.productivityProfile || routineBrain.productivityProfile;
      routineBrain.risks = routineAnalysis.risks || routineBrain.risks;
    }

    // Trigger upcoming overloaded week check
    const countNext7Days = upcomingEvents.length;
    if (countNext7Days > 12) {
      await checkAndCreateNotification(
        userId,
        'upcoming_overloaded_week',
        'high',
        'Overloaded Week Ahead',
        `You have ${countNext7Days} scheduled items next week.`,
        `We detected ${countNext7Days} classes, events, or assignments scheduled in the next 7 days, which may cause scheduling conflicts.`,
        'Use time-blocking and review your schedules to balance workload and avoid stress.'
      );
    }

    // Trigger Budget Notifications
    if (budgetAmount > 0 && totalSpent > budgetAmount) {
      await checkAndCreateNotification(
        userId,
        'budget_exceeded',
        'high',
        'Budget Limit Exceeded',
        `Monthly expenses (${currencySymbol}${totalSpent.toFixed(2)}) have exceeded the ${currencySymbol}${budgetAmount} target.`,
        `Your total expenditures for the current month stand at ${currencySymbol}${totalSpent.toFixed(2)}, which is above your target budget limit of ${currencySymbol}${budgetAmount}.00.`,
        'Identify unnecessary discretionary spending and freeze shopping/entertainment expenses.'
      );
    }

    if (discretionarySpend > 175) {
      await checkAndCreateNotification(
        userId,
        'savings_opportunity',
        'medium',
        'Savings Opportunity Identified',
        `Discretionary spending is high ($${discretionarySpend.toFixed(2)}).`,
        `Your spending on Shopping and Entertainment has reached $${discretionarySpend.toFixed(2)}, which exceeds 35% of your total budget.`,
        'Consider setting weekly limits on shopping and entertainment to start saving.'
      );
    }

    // Trigger Burnout Alert
    if (burnoutRiskScore > 70) {
      await checkAndCreateNotification(
        userId,
        'burnout_risk_increase',
        'critical',
        'Critical Burnout Risk Alert',
        `Burnout risk index has reached ${burnoutRiskScore}%.`,
        `Your composite burnout risk has been calculated at ${burnoutRiskScore}% due to elevated stress, low sleep, and inconsistent routines.`,
        'Execute recovery guidance immediately. Rest, schedule a meditation block, and prioritize sleep.'
      );
    }

    const recommendations = await runStudentLifeAICompanionAnalysis({
      userId,
      routineBrain,
      lifeCompanion,
      expenseIntelligence,
      habitTracker,
      burnoutGuardian
    });

    const payload = {
      userId,
      routineBrain,
      lifeCompanion,
      expenseIntelligence,
      habitTracker,
      burnoutGuardian,
      recommendations
    };

    // Save to Cache
    await CachedAnalysis.findOneAndUpdate(
      { userId, analysisType: 'life_companion_dashboard' },
      { inputHash, payload },
      { upsert: true, new: true }
    );

    return res.status(200).json(payload);

  } catch (error) {
    next(error);
  }
});

// POST /api/life-companion/wellness
router.post('/wellness', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { mood, sleepHours, stressLevel, exerciseMins } = req.body;

    if (mood === undefined || sleepHours === undefined || stressLevel === undefined || exerciseMins === undefined) {
      return res.status(400).json({ error: 'All fields (mood, sleepHours, stressLevel, exerciseMins) are required.' });
    }

    const log = new WellnessLog({
      userId,
      mood: Number(mood),
      sleepHours: Number(sleepHours),
      stressLevel: Number(stressLevel),
      exerciseMins: Number(exerciseMins)
    });
    await log.save();

    // Trigger `sleep_deficit` if sleepHours < 6
    if (Number(sleepHours) < 6) {
      await checkAndCreateNotification(
        userId,
        'sleep_deficit',
        'medium',
        'Sleep Deficit Alert',
        `You logged only ${sleepHours} hours of sleep.`,
        `Your logged sleep duration of ${sleepHours} hours falls below the recommended 6-hour threshold for optimal student performance.`,
        'Optimize your study times to allow for at least 7.5 hours of rest. Avoid screens 30 minutes before sleep.'
      );
    }

    // Trigger `wellness_decline` if mood <= 2 or stressLevel >= 4
    if (Number(mood) <= 2 || Number(stressLevel) >= 4) {
      await checkAndCreateNotification(
        userId,
        'wellness_decline',
        'high',
        'Wellness Decline Alert',
        'Elevated stress or low mood logged.',
        `You registered a low mood (${mood}/5) or high stress level (${stressLevel}/5) in your latest entry.`,
        'Take a 15-minute break. Try deep breathing exercises or a short walk to recharge.'
      );
    }

    return res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

// POST /api/life-companion/expense
router.post('/expense', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { amount, category, description, date } = req.body;

    if (amount === undefined || !category) {
      return res.status(400).json({ error: 'Amount and Category are required.' });
    }

    const expense = new Expense({
      userId,
      amount: Number(amount),
      category,
      description: description || '',
      date: date ? new Date(date) : new Date()
    });
    await expense.save();

    return res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/life-companion/expense/:id
router.delete('/expense/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await Expense.findOneAndDelete({ _id: id, userId });
    if (!result) {
      return res.status(404).json({ error: 'Expense not found.' });
    }

    return res.status(200).json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/life-companion/habits
router.post('/habits', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { date, sleep, waterIntake, exercise, meditation, studyHours } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required in format YYYY-MM-DD.' });
    }

    const updateFields = {};
    if (sleep !== undefined) updateFields.sleep = sleep;
    if (waterIntake !== undefined) updateFields.waterIntake = waterIntake;
    if (exercise !== undefined) updateFields.exercise = exercise;
    if (meditation !== undefined) updateFields.meditation = meditation;
    if (studyHours !== undefined) updateFields.studyHours = studyHours;

    const habitLog = await HabitLog.findOneAndUpdate(
      { userId, date },
      { $set: updateFields },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(habitLog);
  } catch (error) {
    next(error);
  }
});

// POST /api/life-companion/budget
router.post('/budget', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { month, year, currency, budgetAmount } = req.body;

    if (month === undefined || year === undefined || !currency || budgetAmount === undefined) {
      return res.status(400).json({ error: 'Month, Year, Currency, and Budget Amount are required.' });
    }

    const existingBudget = await MonthlyBudget.findOne({ userId, month: Number(month), year: Number(year) });
    if (existingBudget) {
      return res.status(400).json({ error: 'A budget already exists for this month and year.' });
    }

    const budget = new MonthlyBudget({
      userId,
      month: Number(month),
      year: Number(year),
      currency,
      budgetAmount: Number(budgetAmount)
    });
    await budget.save();

    return res.status(201).json(budget);
  } catch (error) {
    next(error);
  }
});

// PUT /api/life-companion/budget/:id
router.put('/budget/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { currency, budgetAmount } = req.body;

    if (!currency || budgetAmount === undefined) {
      return res.status(400).json({ error: 'Currency and Budget Amount are required.' });
    }

    const budget = await MonthlyBudget.findOneAndUpdate(
      { _id: id, userId },
      { $set: { currency, budgetAmount: Number(budgetAmount) } },
      { new: true }
    );

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found.' });
    }

    return res.status(200).json(budget);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/life-companion/budget/:id
router.delete('/budget/:id', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await MonthlyBudget.findOneAndDelete({ _id: id, userId });
    if (!result) {
      return res.status(404).json({ error: 'Budget not found.' });
    }

    return res.status(200).json({ message: 'Budget deleted successfully.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/life-companion/budget/history
router.get('/budget/history', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const history = await MonthlyBudget.find({ userId }).sort({ year: -1, month: -1 });
    return res.status(200).json(history);
  } catch (error) {
    next(error);
  }
});

export default router;

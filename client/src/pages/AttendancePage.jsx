import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import client from '../api/client';

export const AttendancePage = () => {
  const { addToast } = useToast();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);

  // Expanded card logs history
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStatus, setManualStatus] = useState('present');

  // Form states
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [type, setType] = useState('Theory');
  const [conducted, setConducted] = useState(0);
  const [attended, setAttended] = useState(0);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const res = await client.get('/attendance');
      setSubjects(res.data || []);
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to fetch attendance data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const openAddModal = () => {
    setEditingSubject(null);
    setSubjectName('');
    setSubjectCode('');
    setType('Theory');
    setConducted(0);
    setAttended(0);
    setModalOpen(true);
  };

  const openEditModal = (sub) => {
    setEditingSubject(sub);
    setSubjectName(sub.subjectName);
    setSubjectCode(sub.subjectCode);
    setType(sub.type);
    setConducted(sub.conducted);
    setAttended(sub.attended);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSubject(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!subjectName.trim()) {
      addToast('Subject name cannot be empty', 'error');
      return;
    }
    if (!subjectCode.trim()) {
      addToast('Subject code cannot be empty', 'error');
      return;
    }
    if (attended > conducted) {
      addToast('Attended classes cannot exceed conducted classes', 'error');
      return;
    }

    const payload = {
      subjectName: subjectName.trim(),
      subjectCode: subjectCode.trim().toUpperCase(),
      type,
      conducted: Number(conducted),
      attended: Number(attended)
    };

    try {
      if (editingSubject) {
        // Edit API
        const res = await client.put(`/attendance/${editingSubject._id}`, payload);
        addToast(`${payload.subjectName} updated successfully!`, 'success');
        setSubjects(prev => prev.map(s => s._id === editingSubject._id ? res.data : s));
      } else {
        // Add API
        const res = await client.post('/attendance', payload);
        addToast(`${payload.subjectName} added successfully!`, 'success');
        setSubjects(prev => [...prev, res.data]);
      }
      closeModal();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to save subject', 'error');
    }
  };

  const handleLog = async (id, action) => {
    try {
      const res = await client.patch(`/attendance/${id}/log`, { action });
      const verb = action === 'present' ? 'Present' : 'Absent';
      addToast(`Logged ${verb} successfully!`, 'success');
      setSubjects(prev => prev.map(s => s._id === id ? res.data : s));
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to update attendance log', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }
    try {
      await client.delete(`/attendance/${id}`);
      addToast(`${name} deleted successfully`, 'success');
      setSubjects(prev => prev.filter(s => s._id !== id));
      if (expandedSubjectId === id) setExpandedSubjectId(null);
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to delete subject', 'error');
    }
  };

  // Log history management
  const toggleExpanded = (id) => {
    setExpandedSubjectId(prev => prev === id ? null : id);
    setManualDate(new Date().toISOString().split('T')[0]);
    setManualStatus('present');
  };

  const handleToggleLogStatus = async (subjectId, logId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'present' ? 'absent' : 'present';
      const res = await client.patch(`/attendance/${subjectId}/logs/${logId}`, { status: newStatus });
      addToast('Class status updated successfully!', 'success');
      setSubjects(prev => prev.map(s => s._id === subjectId ? res.data : s));
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to toggle status', 'error');
    }
  };

  const handleDeleteLog = async (subjectId, logId) => {
    if (!window.confirm('Delete this class log entry?')) {
      return;
    }
    try {
      const res = await client.delete(`/attendance/${subjectId}/logs/${logId}`);
      addToast('Class log deleted successfully', 'success');
      setSubjects(prev => prev.map(s => s._id === subjectId ? res.data : s));
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to delete log', 'error');
    }
  };

  const handleAddManualLog = async (e, subjectId) => {
    e.preventDefault();
    try {
      const res = await client.post(`/attendance/${subjectId}/logs`, {
        date: manualDate,
        status: manualStatus
      });
      addToast('Class log added successfully!', 'success');
      setSubjects(prev => prev.map(s => s._id === subjectId ? res.data : s));
      setManualDate(new Date().toISOString().split('T')[0]);
      setManualStatus('present');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to log class', 'error');
    }
  };

  // Calculations
  const getPercentage = (att, cond) => {
    if (cond === 0) return 100;
    return (att / cond) * 100;
  };

  const getStatus = (pct) => {
    if (pct >= 75) return { label: 'SAFE', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5' };
    if (pct >= 65) return { label: 'WARNING', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-amber-500/5' };
    return { label: 'CRITICAL', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-rose-500/5' };
  };

  const getConsecutiveNeeded = (att, cond) => {
    const pct = getPercentage(att, cond);
    if (pct >= 75) return 0;
    return Math.max(0, Math.ceil(3 * cond - 4 * att));
  };

  const formatLogDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Summary counts
  const totalSubjects = subjects.length;
  
  let overallPercentage = 100;
  if (totalSubjects > 0) {
    const totalConducted = subjects.reduce((sum, s) => sum + s.conducted, 0);
    const totalAttended = subjects.reduce((sum, s) => sum + s.attended, 0);
    overallPercentage = getPercentage(totalAttended, totalConducted);
  }

  const warningCount = subjects.filter(s => {
    const pct = getPercentage(s.attended, s.conducted);
    return pct < 75 && pct >= 65;
  }).length;

  const criticalCount = subjects.filter(s => {
    const pct = getPercentage(s.attended, s.conducted);
    return pct < 65;
  }).length;

  const belowThresholdCount = warningCount + criticalCount;

  // Risky subjects list for calculations analytics
  const riskySubjects = subjects.filter(s => getPercentage(s.attended, s.conducted) < 75);

  return (
    <div className="space-y-8 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Attendance Monitor</h1>
          <p className="text-sm text-slate-400 mt-1">
            Keep track of your classes and labs. Ensure your attendance stays above the 75% cutoff.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="glass-btn-primary flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Subject
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Overall Attendance</div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className={`text-4xl font-extrabold tracking-tight ${
              overallPercentage >= 75 ? 'text-emerald-400' : overallPercentage >= 65 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {overallPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="text-slate-500 text-[11px] mt-2">
            Average across all logged classes
          </div>
          <div className="absolute right-4 bottom-4 text-slate-800 opacity-20">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Subjects</div>
          <div className="text-4xl font-extrabold text-white tracking-tight mt-4">
            {totalSubjects}
          </div>
          <div className="text-slate-500 text-[11px] mt-2">
            Theory courses and labs tracked
          </div>
          <div className="absolute right-4 bottom-4 text-slate-800 opacity-20">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Below 75% Cutoff</div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className={`text-4xl font-extrabold tracking-tight ${belowThresholdCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
              {belowThresholdCount}
            </span>
          </div>
          <div className="text-slate-500 text-[11px] mt-2">
            {warningCount} Warnings + {criticalCount} Critical status
          </div>
          <div className="absolute right-4 bottom-4 text-slate-800 opacity-20">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Critical Subjects</div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className={`text-4xl font-extrabold tracking-tight ${criticalCount > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-300'}`}>
              {criticalCount}
            </span>
          </div>
          <div className="text-slate-500 text-[11px] mt-2">
            Attendance falls below 65% limit
          </div>
          <div className="absolute right-4 bottom-4 text-slate-800 opacity-20">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Grid: Subject Cards (Left) and Analytics/Calculations (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left List of subjects */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Subject & Lab Tracking
          </h2>

          {loading ? (
            <div className="flex items-center justify-center min-h-[200px] glass-panel">
              <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : subjects.length === 0 ? (
            <div className="glass-panel p-12 text-center space-y-4">
              <p className="text-slate-400 text-sm">No subjects or labs added yet.</p>
              <button
                onClick={openAddModal}
                className="glass-btn-secondary px-4 py-2 text-xs"
              >
                Add Your First Course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {subjects.map((sub) => {
                const pct = getPercentage(sub.attended, sub.conducted);
                const status = getStatus(pct);
                return (
                  <div key={sub._id} className="glass-panel p-5 space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          sub.type === 'Theory' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {sub.type}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleExpanded(sub._id)}
                            className={`p-1 rounded transition-colors ${
                              expandedSubjectId === sub._id 
                                ? 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20' 
                                : 'text-slate-500 hover:text-white hover:bg-slate-800 border border-transparent'
                            }`}
                            title="View Daily Log History"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditModal(sub)}
                            className="p-1 text-slate-500 hover:text-white transition-colors"
                            title="Edit Subject"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(sub._id, sub.subjectName)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete Subject"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-white text-base truncate" title={sub.subjectName}>
                          {sub.subjectName}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{sub.subjectCode}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-end justify-between">
                        <div className="text-2xl font-extrabold text-white tracking-tight">
                          {pct.toFixed(1)}%
                        </div>
                        <div className="text-xs font-medium text-slate-400">
                          {sub.attended} / {sub.conducted} lectures
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div className="h-1.5 w-full bg-slate-950/60 rounded-full overflow-hidden border border-slate-800/20">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : pct >= 65 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-red-500'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>

                      <div className="flex justify-between items-center pt-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide border ${status.color}`}>
                          {status.label}
                        </span>

                        {pct < 75 && (
                          <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                            Needs +{getConsecutiveNeeded(sub.attended, sub.conducted)} classes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/60">
                      <button
                        onClick={() => handleLog(sub._id, 'present')}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-950/40 hover:bg-emerald-950/30 hover:text-emerald-400 border border-slate-800 hover:border-emerald-900/60 text-slate-300 transition-all active:scale-[0.98]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Present
                      </button>
                      <button
                        onClick={() => handleLog(sub._id, 'absent')}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-slate-950/40 hover:bg-rose-950/20 hover:text-rose-400 border border-slate-800 hover:border-rose-900/60 text-slate-300 transition-all active:scale-[0.98]"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Absent
                      </button>
                    </div>

                    {/* Detailed Logs Accordion */}
                    {expandedSubjectId === sub._id && (
                      <div className="pt-4 mt-4 border-t border-slate-800 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Class Logs List</h4>
                          <span className="text-[10px] text-slate-500 font-medium">({sub.logs?.length || 0} classes logged)</span>
                        </div>

                        {/* Scrollable logs list */}
                        <div className="max-h-48 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                          {!sub.logs || sub.logs.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic py-2 text-center">No logs history recorded.</p>
                          ) : (
                            sub.logs.map((log) => (
                              <div key={log._id} className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-900/60 hover:border-slate-800/80 transition-all">
                                <span className="text-[11px] text-slate-300 font-medium pl-1">{formatLogDate(log.date)}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    log.status === 'present' 
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}>
                                    {log.status === 'present' ? 'Present' : 'Absent'}
                                  </span>

                                  {/* Toggle Button */}
                                  <button
                                    onClick={() => handleToggleLogStatus(sub._id, log._id, log.status)}
                                    className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition-all"
                                    title="Toggle Class Status"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                    </svg>
                                  </button>

                                  {/* Delete Log Button */}
                                  <button
                                    onClick={() => handleDeleteLog(sub._id, log._id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-all"
                                    title="Delete Log Entry"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Inline form to log manual past class */}
                        <form onSubmit={(e) => handleAddManualLog(e, sub._id)} className="pt-3 border-t border-slate-800 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Log Historical Class</span>
                          <div className="flex gap-2 items-center">
                            <input
                              type="date"
                              required
                              value={manualDate}
                              max={new Date().toISOString().split('T')[0]}
                              onChange={e => setManualDate(e.target.value)}
                              className="glass-input flex-1 text-xs py-1.5 px-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300 h-8"
                            />
                            <select
                              value={manualStatus}
                              onChange={e => setManualStatus(e.target.value)}
                              className="glass-input text-xs py-1.5 px-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-300 h-8 font-medium"
                            >
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                            </select>
                            <button
                              type="submit"
                              className="h-8 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                              Add
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Sidebar: Analytics Calculation */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
            Deficit Analytics
          </h2>

          <div className="glass-panel p-6 space-y-4">
            <h3 className="font-bold text-white text-sm">Cutoff target: 75%</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              If your current attendance is below the institutional 75% requirement, see the target calculations below for the consecutive lectures needed to recover.
            </p>

            {loading ? (
              <div className="py-6 flex justify-center">
                <svg className="animate-spin h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : riskySubjects.length === 0 ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Amazing! All tracked subjects are currently in the SAFE zone (&ge; 75%).
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {riskySubjects.map((sub) => {
                  const pct = getPercentage(sub.attended, sub.conducted);
                  const needed = getConsecutiveNeeded(sub.attended, sub.conducted);
                  return (
                    <div key={sub._id} className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white truncate max-w-[70%]">{sub.subjectName}</span>
                        <span className={`text-xs font-mono font-bold ${pct >= 65 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        You must attend <strong className="text-indigo-400">{needed}</strong> consecutive classes without a single absence to cross 75%.
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Target projection: {sub.attended + needed} / {sub.conducted + needed} classes ({((sub.attended + needed) / (sub.conducted + needed) * 100).toFixed(0)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 relative animate-fade-in" onClick={e => e.stopPropagation()}>
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-xl font-bold text-white mb-6">
              {editingSubject ? 'Edit Subject Details' : 'Add Subject / Lab'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures"
                  value={subjectName}
                  onChange={e => setSubjectName(e.target.value)}
                  className="glass-input w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Subject Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS201"
                  value={subjectCode}
                  onChange={e => setSubjectCode(e.target.value)}
                  className="glass-input w-full uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="glass-input w-full bg-slate-900 border border-slate-800 text-slate-200"
                >
                  <option value="Theory">Theory</option>
                  <option value="Lab">Lab</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Classes Conducted</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={conducted}
                    onChange={e => setConducted(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Classes Attended</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={attended}
                    onChange={e => setAttended(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full text-center"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="glass-btn-secondary flex-1 py-3 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="glass-btn-primary flex-1 py-3 text-sm font-bold"
                >
                  {editingSubject ? 'Save Changes' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Slack, 
  Clock, 
  Calendar, 
  Check, 
  Save, 
  RefreshCw, 
  Play, 
  Bell, 
  Activity, 
  Gauge, 
  ShieldCheck, 
  AlertTriangle, 
  Terminal, 
  ArrowRight,
  Sparkles,
  CheckSquare,
  Square,
  Send,
  Zap
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserRole } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export const SlackIntegrationPanel: React.FC = () => {
  const { 
    currentUser, 
    systemSettings, 
    updateSystemSettings, 
    requisitions, 
    systemLogs,
    triggerToast 
  } = useRequisitions();

  // Local state for schedule settings, initialized from systemSettings
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "off">(
    systemSettings.slackScheduleFrequency || "off"
  );
  const [scheduleTime, setScheduleTime] = useState<string>(
    systemSettings.slackScheduleTime || "09:00"
  );
  const [scheduleDay, setScheduleDay] = useState<string>(
    systemSettings.slackScheduleDay || "Monday"
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    systemSettings.slackScheduledTypes || [
      "morning",
      "eod",
      "leaderboard",
      "stale",
      "anomalies",
      "search-daily"
    ]
  );

  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<Array<{ text: string; type: "info" | "success" | "warning" | "error"; timestamp: string }>>([]);
  const [immediateLoading, setImmediateLoading] = useState<{[key: string]: boolean}>({});

  // Available report types configuration
  const reportTypes = [
    { 
      id: "morning", 
      name: "☀️ Morning Pending Brief", 
      desc: "Compiles and alerts verifiers about unapproved tickets pending Action.",
      endpoint: "/api/slack/morning-briefing",
      getPayload: () => {
        const pending = requisitions.filter(r => r.status === "SUBMITTED" || r.status === "APPROVED_L1");
        return { pendingRequisitions: pending };
      }
    },
    { 
      id: "eod", 
      name: "🌙 EOD Operations Summary", 
      desc: "Delivers active user logs, processed items, and disbursement sums of the day.",
      endpoint: "/api/slack/eod-snapshot",
      getPayload: () => {
        const todayStr = new Date().toDateString();
        const logs = systemLogs || [];
        const uniqueUsers = new Set(
          logs
            .filter((l: any) => new Date(l.timestamp).toDateString() === todayStr)
            .map((l: any) => l.performedBy)
        );
        const dau = uniqueUsers.size || 1;
        const totalProcessed = requisitions.filter(r => new Date(r.updatedAt || r.submittedAt).toDateString() === todayStr).length;
        const totalDisbursed = requisitions
          .filter(r => r.status === "DISBURSED")
          .reduce((sum, r) => sum + (r.amount || 0), 0);
        return { dau, totalProcessed, totalDisbursed };
      }
    },
    { 
      id: "leaderboard", 
      name: "🏆 User Engagement Leaderboard", 
      desc: "Ranks top users dynamically from audit logs based on active interactions.",
      endpoint: "/api/slack/weekly-leaderboard",
      getPayload: () => {
        const logs = systemLogs || [];
        const userStats: { [name: string]: { logins: number; interactions: number; name: string; role: string } } = {};
        logs.forEach((log: any) => {
          const userName = log.performedBy || "System User";
          if (!userStats[userName]) {
            const roleMatch = userName.match(/\(([^)]+)\)/);
            const extractedRole = roleMatch ? roleMatch[1] : "Member";
            const cleanName = userName.split(" (")[0];
            userStats[userName] = { logins: 0, interactions: 0, name: cleanName, role: extractedRole };
          }
          const actionLower = (log.action || "").toLowerCase();
          if (actionLower.includes("login") || actionLower.includes("session")) {
            userStats[userName].logins++;
          } else {
            userStats[userName].interactions++;
          }
        });
        const leaderboard = Object.values(userStats)
          .sort((a, b) => b.interactions - a.interactions || b.logins - a.logins)
          .slice(0, 5);
        return { leaderboard };
      }
    },
    { 
      id: "stale", 
      name: "⏳ SLA Stale Queue Review", 
      desc: "Sweeps the pipeline and flags submissions stagnant for more than 48 hours.",
      endpoint: "/api/slack/alert-stale-requisitions",
      getPayload: () => {
        const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
        const staleRequisitions = requisitions.filter(r => {
          const isPending = ["SUBMITTED", "APPROVED_L1"].includes(r.status);
          const submittedTime = new Date(r.submittedAt).getTime();
          return isPending && submittedTime < fortyEightHoursAgo;
        });
        return { staleRequisitions };
      }
    },
    { 
      id: "anomalies", 
      name: "🛡️ Behavioral Velocity Anomalies", 
      desc: "Audits user velocity profiles for multiple high-value acquisitions in narrow windows.",
      endpoint: "/api/slack/alert-behavioral-anomalies",
      getPayload: () => {
        const userHighValueSubmissionTimes: { [user: string]: number[] } = {};
        const anomaliesList: any[] = [];
        requisitions.forEach(r => {
          const user = r.requesterEmail || "Member";
          const amount = r.amount || 0;
          if (amount >= 100000) {
            if (!userHighValueSubmissionTimes[user]) userHighValueSubmissionTimes[user] = [];
            const t = new Date(r.submittedAt).getTime();
            userHighValueSubmissionTimes[user].push(t);
          }
        });
        Object.entries(userHighValueSubmissionTimes).forEach(([user, times]) => {
          times.sort((a, b) => a - b);
          for (let i = 1; i < times.length; i++) {
            const diffMs = times[i] - times[i - 1];
            if (diffMs < (24 * 60 * 60 * 1000)) {
              anomaliesList.push({
                user,
                description: `Submitted multiple high-value transactions (>= 100,000 KES) within a 24-hour window. Risk score HIGH.`,
                timestamp: new Date(times[i]).toISOString()
              });
            }
          }
        });
        return { anomaliesList };
      }
    },
    { 
      id: "latency", 
      name: "⚡ Performance Latency Alert", 
      desc: "Dispatches database query SLA violation warning telemetry logs to Slack channels.",
      endpoint: "/api/slack/alert-latency",
      getPayload: () => {
        return { endpoint: "/api/check-balance", durationMs: 1420 };
      }
    },
    { 
      id: "search-daily", 
      name: "🔍 Daily Search Metrics Summary", 
      desc: "Delivers a report of the top 5 most searched system queries over the day.",
      endpoint: "/api/slack/search-daily",
      getPayload: () => ({ success: true })
    },
    { 
      id: "search-weekly", 
      name: "📊 Weekly Search Query Summary", 
      desc: "Compiles search query frequency profiles for the last 7 days.",
      endpoint: "/api/slack/search-weekly",
      getPayload: () => ({ success: true })
    }
  ];

  const daysOfWeek = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ];

  // Sync settings when loaded
  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.slackScheduleFrequency) setFrequency(systemSettings.slackScheduleFrequency);
      if (systemSettings.slackScheduleTime) setScheduleTime(systemSettings.slackScheduleTime);
      if (systemSettings.slackScheduleDay) setScheduleDay(systemSettings.slackScheduleDay);
      if (systemSettings.slackScheduledTypes) setSelectedTypes(systemSettings.slackScheduledTypes);
    }
  }, [systemSettings]);

  const addConsoleLog = (text: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [{ text, type, timestamp }, ...prev].slice(0, 50));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateSystemSettings({
        slackScheduleFrequency: frequency,
        slackScheduleTime: scheduleTime,
        slackScheduleDay: scheduleDay,
        slackScheduledTypes: selectedTypes
      });
      addConsoleLog(`Saved updated scheduling policy successfully.`, "success");
    } catch (err: any) {
      addConsoleLog(`Failed to save policy: ${err.message || String(err)}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleType = (id: string) => {
    setSelectedTypes(prev => {
      if (prev.includes(id)) {
        return prev.filter(t => t !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const calculateNextRun = (): string => {
    if (frequency === "off") {
      return "Schedule is currently paused (off).";
    }

    try {
      // Current system time: 2026-07-06T05:29:56-07:00 (which is a Monday)
      const currentSimTime = new Date("2026-07-06T05:29:56-07:00");
      const [hours, minutes] = scheduleTime.split(":").map(Number);
      
      let nextRun = new Date(currentSimTime);
      nextRun.setHours(hours, minutes, 0, 0);

      if (frequency === "daily") {
        if (nextRun.getTime() <= currentSimTime.getTime()) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        return `Tomorrow at ${nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Scheduled Daily)`;
      } else if (frequency === "weekly") {
        const targetDayIdx = daysOfWeek.indexOf(scheduleDay);
        // JS Date: 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
        // Our daysOfWeek: Monday is 0, Sunday is 6.
        // Convert JS Day to our 0-6 range (where Mon=0)
        let currentDayIdx = currentSimTime.getDay() - 1;
        if (currentDayIdx < 0) currentDayIdx = 6; // Sunday becomes 6

        let daysToAdd = targetDayIdx - currentDayIdx;
        if (daysToAdd < 0 || (daysToAdd === 0 && nextRun.getTime() <= currentSimTime.getTime())) {
          daysToAdd += 7;
        }
        
        nextRun.setDate(nextRun.getDate() + daysToAdd);
        return `${scheduleDay} at ${nextRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${nextRun.toLocaleDateString()})`;
      }
    } catch (e) {
      return "Invalid date/time parameters configured.";
    }
    return "Pending config...";
  };

  const handleSimulateScheduleTrigger = async () => {
    if (selectedTypes.length === 0) {
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "HIGH",
        message: "No report types are selected to simulate.",
        timestamp: new Date().toISOString()
      });
      return;
    }

    setSimulating(true);
    setConsoleLogs([]);
    addConsoleLog("🚀 Initializing automated schedule run simulation...", "info");
    addConsoleLog(`Frequency profile matched: ${frequency.toUpperCase()}`, "info");
    addConsoleLog(`Total selected report modules: ${selectedTypes.length}`, "info");

    let successCount = 0;
    let failCount = 0;

    for (const typeId of selectedTypes) {
      const config = reportTypes.find(t => t.id === typeId);
      if (!config) continue;

      addConsoleLog(`Dispatching report structure: ${config.name}...`, "info");
      
      try {
        const payload = config.getPayload ? config.getPayload() : {};
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        
        const data = await response.json().catch(() => ({}));
        
        if (response.ok && (data.success || data.ok)) {
          addConsoleLog(`🟢 [Success] ${config.name} delivered. Status code 200.`, "success");
          successCount++;
        } else {
          addConsoleLog(`🔴 [Failed] ${config.name} response error: ${data.error || "Unknown server response error."}`, "error");
          failCount++;
        }
      } catch (err: any) {
        addConsoleLog(`🔴 [Failed] ${config.name} network exception: ${err.message || String(err)}`, "error");
        failCount++;
      }

      // Brief sleep for visual progress in simulation console
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    addConsoleLog(`Schedule Run simulation completed. (${successCount} Succeeded, ${failCount} Failed).`, "info");
    setSimulating(false);

    triggerToast({
      type: "SYSTEM_INFO",
      severity: successCount > 0 ? "MEDIUM" : "HIGH",
      message: `Simulated schedule completed: ${successCount} sent, ${failCount} failed.`,
      timestamp: new Date().toISOString()
    });
  };

  const handleExecuteImmediately = async (id: string) => {
    const config = reportTypes.find(t => t.id === id);
    if (!config) return;

    setImmediateLoading(prev => ({ ...prev, [id]: true }));
    addConsoleLog(`Initiating manual dispatch for ${config.name}...`, "info");

    try {
      const payload = config.getPayload ? config.getPayload() : {};
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (response.ok && (data.success || data.ok)) {
        addConsoleLog(`🟢 [Success] ${config.name} delivered immediately. Status 200.`, "success");
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "MEDIUM",
          message: `Successfully dispatched Slack action: ${id.toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      } else {
        addConsoleLog(`🔴 [Failed] ${config.name} dispatch error: ${data.error || "Unknown server response error."}`, "error");
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "HIGH",
          message: data.error || `Failed to dispatch Slack ${id}.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      addConsoleLog(`🔴 [Failed] ${config.name} network exception: ${err.message || String(err)}`, "error");
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "HIGH",
        message: err.message || `Failed to contact Slack integration endpoint.`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setImmediateLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-8">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Slack size={120} className="text-primary" />
        </div>
        
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest">
            <Slack size={12} className="animate-spin" />
            Active Channel Integration Hub
          </div>
          
          <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
            Automated Slack Dispatcher
          </h2>
          
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Configure elegant schedules, map crucial operations reports, and establish direct webhook notifications for verifiers, church groups, and leadership teams.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Controls & Scheduling Configuration (8 cols) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Section 1: Scheduling Settings Policy */}
          <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                🗓️
              </span>
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Automated Run Cadence</h3>
                <p className="text-[9px] text-muted uppercase font-bold tracking-wider mt-0.5">Define frequency and alert times</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Frequency Selector */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-wider block">Frequency Mode</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-500/5 p-1 rounded-xl border border-border">
                  {(["off", "daily", "weekly"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFrequency(mode)}
                      className={cn(
                        "py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        frequency === mode 
                          ? "bg-primary text-white shadow-sm"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      {mode === "off" ? "Off" : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-wider block">Dispatch Time (24h)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Clock size={14} />
                  </span>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-500/5 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Weekly Day Selector */}
            <AnimatePresence>
              {frequency === "weekly" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-[10px] font-black text-muted uppercase tracking-wider block">Weekly Day</label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {daysOfWeek.map((day) => {
                      const isSelected = scheduleDay === day;
                      return (
                        <button
                          key={day}
                          onClick={() => setScheduleDay(day)}
                          className={cn(
                            "py-2 px-1 rounded-lg text-[9px] font-bold text-center transition-all cursor-pointer truncate",
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm font-black"
                              : "bg-slate-500/5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-border"
                          )}
                        >
                          {day.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Next Run Calculation Display */}
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[9px] font-extrabold uppercase text-primary/80 tracking-widest flex items-center gap-1.5">
                  <Calendar size={11} />
                  Next Scheduled Fire Date
                </div>
                <div className="text-[11px] font-black text-slate-700 dark:text-slate-200 font-mono">
                  {calculateNextRun()}
                </div>
              </div>
              
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <RefreshCw size={11} className="animate-spin" />
                ) : (
                  <Save size={11} />
                )}
                Save CADENCE
              </button>
            </div>
          </section>

          {/* Section 2: Selected Report Modules */}
          <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4 gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                  📊
                </span>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Report Modules</h3>
                  <p className="text-[9px] text-muted uppercase font-bold tracking-wider mt-0.5">Toggle report inclusion in schedule</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTypes(reportTypes.map(r => r.id))}
                  className="text-[8px] font-black uppercase text-primary hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setSelectedTypes([])}
                  className="text-[8px] font-black uppercase text-slate-500 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {reportTypes.map((report) => {
                const isChecked = selectedTypes.includes(report.id);
                return (
                  <div
                    key={report.id}
                    onClick={() => handleToggleType(report.id)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex items-center justify-between gap-3.5 cursor-pointer hover:border-primary/30",
                      isChecked 
                        ? "border-primary/20 bg-primary/5" 
                        : "border-border bg-background/50"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-primary transition-colors focus:outline-none"
                      >
                        {isChecked ? (
                          <CheckSquare size={16} className="text-primary" />
                        ) : (
                          <Square size={16} className="text-slate-300 dark:text-slate-700" />
                        )}
                      </button>
                      
                      <div className="space-y-1 min-w-0">
                        <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex flex-wrap items-center gap-2">
                          {report.name}
                          {isChecked && (
                            <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-emerald-500/10 text-emerald-500 uppercase border border-emerald-500/20">
                              Included
                            </span>
                          )}
                        </h4>
                        <p className="text-[9px] text-muted font-bold leading-relaxed truncate-2-lines">
                          {report.desc}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecuteImmediately(report.id);
                      }}
                      disabled={immediateLoading[report.id]}
                      className="shrink-0 px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                      title="Send report immediately to Slack"
                    >
                      {immediateLoading[report.id] ? (
                        <RefreshCw size={10} className="animate-spin" />
                      ) : (
                        <Send size={10} />
                      )}
                      <span>Send Now</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

        </div>

        {/* Right Side: Simulation & Channeled Console Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Simulation Trigger Widget */}
          <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                ⚡
              </span>
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Schedule Tester</h3>
                <p className="text-[9px] text-muted uppercase font-bold tracking-wider mt-0.5">Force execute automation simulation</p>
              </div>
            </div>

            <p className="text-[10px] text-muted font-semibold leading-relaxed">
              Dispatching the scheduled queue will trigger a safe API sweep simulating the live background runner. Highly recommended for pipeline audit confirmation.
            </p>

            <button
              onClick={handleSimulateScheduleTrigger}
              disabled={simulating}
              className={cn(
                "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md",
                simulating
                  ? "bg-slate-300 text-slate-500 dark:bg-slate-800 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.01]"
              )}
            >
              {simulating ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              {simulating ? "Simulating Automation..." : "Test Schedule Run Now"}
            </button>
          </section>

          {/* Console / Simulator Output Panel */}
          <section className="bg-slate-950 border border-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[480px]">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-emerald-500" />
                <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider">Channeled Slack Console</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono text-[9px] space-y-3.5 no-scrollbar bg-slate-950/95 scrollbar-thin">
              {consoleLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-600">
                  <Slack size={20} className="mb-2 text-slate-800 animate-pulse" />
                  <p className="uppercase tracking-widest font-black text-[8px]">Console Idle</p>
                  <p className="text-[8px] font-medium mt-1">Awaiting scheduler simulation or test output...</p>
                </div>
              ) : (
                consoleLogs.map((log, index) => (
                  <div key={index} className="space-y-1 border-l-2 border-slate-800 pl-3 leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] text-slate-600">{log.timestamp}</span>
                      <span className={cn(
                        "font-extrabold text-[8px] uppercase tracking-wider",
                        log.type === "success" ? "text-emerald-500" :
                        log.type === "warning" ? "text-amber-500" :
                        log.type === "error" ? "text-rose-500" : "text-blue-400"
                      )}>
                        [{log.type.toUpperCase()}]
                      </span>
                    </div>
                    <div className="text-slate-300 whitespace-pre-wrap">{log.text}</div>
                  </div>
                ))
              )}
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};

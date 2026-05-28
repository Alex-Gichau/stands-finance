/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Cpu, 
  Activity, 
  Database, 
  CheckCircle,
  Clock,
  Terminal,
  Zap,
  RefreshCw,
  AlertTriangle,
  ServerCrash,
  Radio,
  BellRing
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";

export const SystemHealth: React.FC<{ updateInterval?: number }> = ({ updateInterval = 2500 }) => {
  const { addSystemLog } = useRequisitions();

  // Simulated failure states
  const [downtimeActive, setDowntimeActive] = useState(false);
  const [latencyActive, setLatencyActive] = useState(false);
  const [lastNotificationStatus, setLastNotificationStatus] = useState<string | null>(null);

  // Real-time fluctuating metrics
  const [cpuUsage, setCpuUsage] = useState(14.8);
  const [memoryUsage, setMemoryUsage] = useState(1.42); // in GB
  const [dbLatency, setDbLatency] = useState(32); // in ms
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(144210); // Simulated baseline: ~40 hours

  // Update loop for lifelike, clean real-time metrics
  useEffect(() => {
    const interval = setInterval(() => {
      if (downtimeActive) {
        setCpuUsage(0);
        setDbLatency(999);
        return;
      }

      if (latencyActive) {
        setCpuUsage(prev => {
          const delta = (Math.random() - 0.5) * 4;
          const next = Math.min(Math.max(prev + delta, 82), 94);
          return Number(next.toFixed(1));
        });

        setDbLatency(prev => {
          const delta = Math.round((Math.random() - 0.5) * 15);
          const next = Math.min(Math.max(prev + delta, 340), 450);
          return next;
        });
        return;
      }

      setCpuUsage(prev => {
        const delta = (Math.random() - 0.5) * 4;
        const next = prev + delta;
        return Math.min(Math.max(Number(next.toFixed(1)), 5), 45); // bounded between 5% and 45%
      });

      setDbLatency(prev => {
        const delta = Math.round((Math.random() - 0.5) * 6);
        const next = prev + delta;
        return Math.min(Math.max(next, 18), 60); // bounded between 18ms and 60ms
      });

      setUptimeSeconds(prev => prev + updateInterval / 1000);
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval, downtimeActive, latencyActive]);

  // Format uptime cleanly
  const formatUptime = (totalSeconds: number) => {
    const rounded = Math.round(totalSeconds);
    const days = Math.floor(rounded / (3600 * 24));
    const hours = Math.floor((rounded % (3600 * 24)) / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const toggleDowntime = async () => {
    const nextState = !downtimeActive;
    setDowntimeActive(nextState);
    if (nextState) {
      setLatencyActive(false); // mutually exclusive
      setCpuUsage(0);
      setDbLatency(999);
      setLastNotificationStatus("Firing Outage Slack Alert...");
      try {
        await addSystemLog(
          "SYSTEM_DOWNTIME_DETECTED",
          "🚨 CRITICAL DOWNTIME ALERT: St. Andrews Church Group Portal experienced a total host container VPS network outage."
        );
        setLastNotificationStatus("Slack Outage Alert Fired successfully!");
      } catch (err) {
        setLastNotificationStatus("Failed to dispatch log to Firebase/Slack.");
      }
    } else {
      setLastNotificationStatus("Restored system status to online.");
      setCpuUsage(14.8);
      setDbLatency(32);
    }
  };

  const toggleLatencySpill = async () => {
    const nextState = !latencyActive;
    setLatencyActive(nextState);
    if (nextState) {
      setDowntimeActive(false); // mutually exclusive
      setDbLatency(380);
      setCpuUsage(84.5);
      setLastNotificationStatus("Firing Latency Underperformance Slack Alert...");
      try {
        await addSystemLog(
          "PERFORMANCE_UNDER_THRESHOLD",
          "⚠️ SYSTEM UNDERPERFORMANCE DEGRADATION: Database sync latency spike detected. Read/write operations averaging 380ms (standard limit is 60ms)."
        );
        setLastNotificationStatus("Slack under-performance alert dispatched!");
      } catch (err) {
        setLastNotificationStatus("Failed to dispatch log to Firebase/Slack.");
      }
    } else {
      setLastNotificationStatus("Latency normalized.");
      setCpuUsage(14.8);
      setDbLatency(32);
    }
  };

  const handleManualMetricsCheck = () => {
    if (downtimeActive || latencyActive) {
      setLastNotificationStatus("Restored all simulation states back to normal.");
      setDowntimeActive(false);
      setLatencyActive(false);
      setCpuUsage(14.8);
      setDbLatency(32);
      return;
    }
    setIsRefreshing(true);
    setTimeout(() => {
      setCpuUsage(Number((Math.random() * 15 + 8).toFixed(1)));
      setDbLatency(Math.round(Math.random() * 10 + 20));
      setIsRefreshing(false);
    }, 800);
  };

  // Simulated 14 days Uptime status
  const uptimeDays = [
    { day: "14d ago", status: "operational" },
    { day: "13d ago", status: "operational" },
    { day: "12d ago", status: "operational" },
    { day: "11d ago", status: "operational" },
    { day: "10d ago", status: "operational" },
    { day: "9d ago", status: "operational" },
    { day: "8d ago", status: "operational" },
    { day: "7d ago", status: "operational" },
    { day: "6d ago", status: "operational" },
    { day: "5d ago", status: "operational" },
    { day: "4d ago", status: "operational" },
    { day: "3d ago", status: "minor_latency" },
    { day: "2d ago", status: "operational" },
    { day: "Yesterday", status: "operational" },
    { day: "Today", status: "operational" }
  ];

  return (
    <div className="space-y-6">
      {/* Slack Integration Alert & Underperformance Simulator */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-[10px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
              <Radio size={14} className="text-indigo-600 animate-pulse" />
              Slack System Monitor & Performance Tester
            </h5>
            <p className="text-[9px] text-slate-500 font-medium mt-0.5">Integrates with channel rules to dispatch alerts for outages and degraded responses instantly.</p>
          </div>
          {lastNotificationStatus && (
            <div className="text-[8px] font-bold text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-950 font-mono">
              STATUS: {lastNotificationStatus}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Outage simulator card */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between space-y-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${downtimeActive ? "bg-rose-500 animate-ping" : "bg-slate-300"}`} />
                <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Outage Simulator</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                Trigger simulated system downtime. Sets status to Offline and posts a critical service down alert block to Slack.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleDowntime}
              className={`w-full py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                downtimeActive
                  ? "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-200/50"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
              }`}
            >
              <ServerCrash size={12} />
              {downtimeActive ? "Stop Simulation" : "Simulate Outage & Send Slack Alert"}
            </button>
          </div>

          {/* Underperformance simulator card */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between space-y-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${latencyActive ? "bg-amber-500 animate-pulse" : "bg-slate-300"}`} />
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">SLA Underperformance Simulator</span>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                Generates artificial database congestion. Exceeds standard 60ms threshold and fires a warning notification to Slack.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleLatencySpill}
              className={`w-full py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                latencyActive
                  ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200/50"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
              }`}
            >
              <AlertTriangle size={12} />
              {latencyActive ? "Stop Simulation" : "Simulate Congestion & Slack Notify"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Activity size={16} className="text-primary animate-pulse" />
            Infrastructure Monitors
          </h4>
          <p className="text-[10px] text-muted font-medium mt-0.5">Real-time workspace system resources & live sync parameters</p>
        </div>
        <button 
          onClick={handleManualMetricsCheck}
          disabled={isRefreshing}
          className="p-2 bg-background hover:bg-slate-500/5 dark:hover:bg-white/5 border border-border rounded-xl transition-all cursor-pointer flex items-center justify-center text-muted hover:text-foreground"
          title="Force System Status Verification"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Resource Unit */}
        <div className="bg-background border border-border/80 p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">CPU Allocation</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Cpu size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                {downtimeActive ? "0.0%" : `${cpuUsage}%`}
              </span>
              {downtimeActive ? (
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md animate-pulse">Crashed</span>
              ) : latencyActive ? (
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md">Overloaded</span>
              ) : (
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md">Healthy</span>
              )}
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${downtimeActive ? 0 : cpuUsage}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${downtimeActive ? "bg-rose-500" : latencyActive ? "bg-amber-500" : "bg-primary"}`}
              />
            </div>
            <p className="text-[9px] text-muted font-mono mt-2 uppercase tracking-tighter">Current Host Core Allocation</p>
          </div>
        </div>

        {/* System Memory (RAM) Unit */}
        <div className="bg-background border border-border/80 p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Memory Footprint</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Terminal size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                {downtimeActive ? "0.00 GB" : latencyActive ? "3.12 GB" : `${memoryUsage} GB`}
              </span>
              <span className="text-[9px] text-muted font-mono">
                {downtimeActive ? "0.00 GB of 4.00 GB" : "of 4.00 GB Max"}
              </span>
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                className={`h-full ${downtimeActive ? "bg-slate-300" : latencyActive ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${downtimeActive ? 0 : latencyActive ? 78 : (memoryUsage / 4) * 100}%` }}
              />
            </div>
            <p className="text-[9px] text-muted font-mono mt-2 uppercase tracking-tighter">Container Allocation (Host VPS)</p>
          </div>
        </div>

        {/* Database Sync Latency Unit */}
        <div className="bg-background border border-border/80 p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Firestore Live Sync</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Database size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between mb-1.5">
              <span className={`text-2xl font-black font-mono tracking-tight ${downtimeActive ? "text-rose-500 animate-pulse" : "text-foreground"}`}>
                {downtimeActive ? "TIMEOUT" : `${dbLatency} ms`}
              </span>
              {downtimeActive ? (
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                  Offline
                </span>
              ) : latencyActive ? (
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Degraded
                </span>
              ) : (
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                  Live Link
                </span>
              )}
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${downtimeActive ? 100 : (dbLatency / 100) * 100}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${downtimeActive ? "bg-rose-500" : latencyActive ? "bg-amber-500" : "bg-primary"}`}
              />
            </div>
            <p className="text-[9px] text-muted font-mono mt-2 uppercase tracking-tighter">Read/Write Transaction Latency</p>
          </div>
        </div>
      </div>

      {/* System Availability & Calendar-Style Timeline (last 15 days) */}
      <div className="bg-background border border-border/80 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 className="text-[10px] font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
              {downtimeActive ? (
                <ServerCrash size={14} className="text-rose-500 animate-bounce" />
              ) : latencyActive ? (
                <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
              ) : (
                <CheckCircle size={14} className="text-emerald-500" />
              )}
              {downtimeActive ? "Core API Status: DOWN (Outage)" : latencyActive ? "Core API Status: DEGRADED" : "Core API availability"}
            </h5>
            <p className="text-[9px] text-muted font-medium mt-0.5 font-mono">
              {downtimeActive 
                ? "CRITICAL: Container health-checks failing on production Cloud Run host" 
                : latencyActive 
                ? "WARNING: Latency thresholds breached. Sluggish response speeds warning dispatched." 
                : "Continuous automated availability pings (Uptime: 99.98%)"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] font-black font-mono text-foreground uppercase">
              <Clock size={12} className="text-muted" />
              Uptime:
            </div>
            <div className={`text-[10px] font-black font-mono px-3 py-1 rounded-lg border ${
              downtimeActive 
                ? "text-rose-600 bg-rose-50/50 border-rose-200" 
                : "text-primary bg-primary/5 border-primary/20"
            }`}>
              {downtimeActive ? "FROZEN" : formatUptime(uptimeSeconds)}
            </div>
          </div>
        </div>

        {/* Visual Pill Matrix for Availability history */}
        <div className="space-y-2">
          <div className="flex items-stretch justify-between gap-1 h-8">
            {uptimeDays.map((d, index) => {
              const isToday = index === uptimeDays.length - 1;
              const cellStatus = downtimeActive && isToday 
                ? "crashed" 
                : (latencyActive && isToday ? "minor_latency" : d.status);
              
              return (
                <div 
                  key={index} 
                  className="group relative flex-1 flex flex-col justify-end pointer-events-auto"
                >
                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {isToday ? "Today" : d.day}: {cellStatus === "operational" ? "100% Operational" : cellStatus === "crashed" ? "0% Host Outage Triggered" : "SLA breach (latency check triggered)"}
                  </div>
                  
                  <div className={`w-full rounded-md transition-all duration-300 hover:scale-y-110 ${
                    cellStatus === "operational" 
                      ? "bg-emerald-500 h-6 group-hover:bg-emerald-400" 
                      : cellStatus === "crashed"
                      ? "bg-rose-500 h-6 group-hover:bg-rose-400"
                      : "bg-amber-400 h-6 group-hover:bg-amber-300"
                  }`} />
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between items-center text-[8px] font-black text-muted uppercase tracking-wider pt-1 border-t border-border/30 font-mono">
            <span>14 Days Ago</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Operational
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Latency Spike
              </span>
              {(downtimeActive || latencyActive) && (
                <span className="flex items-center gap-1 text-rose-500 animate-pulse font-black uppercase">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Active Simulation
                </span>
              )}
            </span>
            <span>{downtimeActive ? "Today (Crashed)" : latencyActive ? "Today (Degraded)" : "Today (Healthy)"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

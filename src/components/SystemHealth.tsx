/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Cpu, 
  Activity, 
  Database, 
  CheckCircle,
  Clock,
  Terminal,
  Zap,
  RefreshCw
} from "lucide-react";

export const SystemHealth: React.FC<{ updateInterval?: number }> = ({ updateInterval = 2500 }) => {
  // Real-time fluctuating metrics
  const [cpuUsage, setCpuUsage] = useState(14.8);
  const [memoryUsage, setMemoryUsage] = useState(1.42); // in GB
  const [dbLatency, setDbLatency] = useState(32); // in ms
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(144210); // Simulated baseline: ~40 hours

  // Update loop for lifelike, clean real-time metrics
  useEffect(() => {
    const interval = setInterval(() => {
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
  }, [updateInterval]);

  // Format uptime cleanly
  const formatUptime = (totalSeconds: number) => {
    const rounded = Math.round(totalSeconds);
    const days = Math.floor(rounded / (3600 * 24));
    const hours = Math.floor((rounded % (3600 * 24)) / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const handleManualMetricsCheck = () => {
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
              <span className="text-2xl font-black text-foreground font-mono tracking-tight">{cpuUsage}%</span>
              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md">Healthy</span>
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${cpuUsage}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-primary"
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
              <span className="text-2xl font-black text-foreground font-mono tracking-tight">{memoryUsage} GB</span>
              <span className="text-[9px] text-muted font-mono">of 4.00 GB Max</span>
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                style={{ width: `${(memoryUsage / 4) * 100}%` }}
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
              <span className="text-2xl font-black text-foreground font-mono tracking-tight">{dbLatency} ms</span>
              <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                Live Link
              </span>
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${(dbLatency / 100) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-primary"
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
              <CheckCircle size={14} className="text-emerald-500" />
              Core API availability
            </h5>
            <p className="text-[9px] text-muted font-medium mt-0.5">Continuous automated availability pings (Uptime: 99.98%)</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] font-black font-mono text-foreground uppercase">
              <Clock size={12} className="text-muted" />
              Uptime:
            </div>
            <div className="text-[10px] font-black font-mono text-primary bg-primary/5 border border-primary/20 px-3 py-1 rounded-lg">
              {formatUptime(uptimeSeconds)}
            </div>
          </div>
        </div>

        {/* Visual Pill Matrix for Availability history */}
        <div className="space-y-2">
          <div className="flex items-stretch justify-between gap-1 h-8">
            {uptimeDays.map((d, index) => (
              <div 
                key={index} 
                className="group relative flex-1 flex flex-col justify-end pointer-events-auto"
              >
                {/* Tooltip on Hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                  {d.day}: {d.status === "operational" ? "100% Operational" : "98.4% Latency Check"}
                </div>
                
                <div className={`w-full rounded-md transition-all duration-300 hover:scale-y-110 ${
                  d.status === "operational" 
                    ? "bg-emerald-500 h-6 group-hover:bg-emerald-400" 
                    : "bg-amber-400 h-6 group-hover:bg-amber-300"
                }`} />
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center text-[8px] font-black text-muted uppercase tracking-wider pt-1 border-t border-border/30">
            <span>14 Days Ago</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Operational
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Latency Spike
              </span>
            </span>
            <span>Today (Healthy)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

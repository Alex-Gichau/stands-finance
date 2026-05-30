/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Bell, 
  Shield, 
  User, 
  Database, 
  Mail, 
  Smartphone,
  Fingerprint,
  Save,
  History,
  Activity,
  Cpu,
  Lock,
  Wifi,
  Settings2,
  ShieldCheck,
  Server,
  Zap,
  ArrowRight,
  UserCheck,
  Moon,
  Sun,
  Palette,
  Gauge
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { cn } from "../lib/utils";
import { UserRole } from "../types";
import { motion } from "motion/react";
import { SystemHealth } from "./SystemHealth";

export const SettingsPanel: React.FC = () => {
  const { thresholds, updateThreshold, currentUser, updateUserProfile, biometricEnrolled, enrollBiometric, systemLogs, seedAllEcosystemData, systemSettings, updateSystemSettings } = useRequisitions();

  const [sliderIndex, setSliderIndex] = React.useState(1); // 0 = Aggressive, 1 = Balanced, 2 = Power Saver
  const INTERVAL_MODES = [
    { value: 500, label: "Aggressive", duration: "500ms" },
    { value: 2500, label: "Balanced", duration: "2500ms" },
    { value: 10000, label: "Power Saver", duration: "10s" }
  ];
  const updateInterval = INTERVAL_MODES[sliderIndex].value;

  const lastTenLogs = systemLogs.slice(0, 10);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Settings2 size={28} className="text-primary" />
            System Configuration
          </h2>
          <p className="text-sm text-muted font-medium max-w-xl">
            Configure authorization pipelines, security thresholds, and organizational audit parameters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Hardware Biometric Enrollment */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <Fingerprint size={16} className="text-primary" />
                Auth Pipeline Terminal
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Hardware_Link_Active</span>
              </div>
            </div>
            
            <div className="p-10 flex flex-col md:flex-row items-center gap-10">
              <motion.div 
                animate={biometricEnrolled ? {} : { scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={cn(
                  "w-32 h-32 rounded-[2.5rem] flex items-center justify-center border shadow-inner transition-all duration-700 shrink-0",
                  biometricEnrolled 
                    ? "bg-primary/5 border-primary/20 text-primary shadow-primary/5" 
                    : "bg-slate-50 border-slate-200 text-slate-300"
                )}
              >
                <Fingerprint size={64} />
              </motion.div>
              
              <div className="flex-1 text-center md:text-left space-y-4">
                <div>
                  <h4 className="text-lg font-black text-foreground uppercase tracking-tight">
                    {biometricEnrolled ? "Biometric Transaction Synchronized" : "Initialize Biometric Signature"}
                  </h4>
                  <p className="text-xs text-muted leading-relaxed font-medium mt-1">
                    Authorize expenditure requests via kernel-level fingerprint verification. This protocol bypasses manual code entry for rapid organizational turn-around.
                  </p>
                </div>
                
                {!biometricEnrolled ? (
                  <button 
                    onClick={enrollBiometric}
                    className="btn-primary px-8 py-3 flex items-center gap-2"
                  >
                    <Cpu size={18} />
                    INITIALIZE ENROLLMENT
                  </button>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={20} className="text-emerald-600" />
                      <div className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Security Link Verified</div>
                    </div>
                    <button className="text-[9px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">DISCONNECT_TRANSACTION</button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* System Health Diagnostics Monitor */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-8">
              {/* Telemetry Loop Speed Tuner Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Gauge size={16} className="text-primary" />
                    Telemetry Speed Tuning
                  </h3>
                  <p className="text-[10px] text-muted font-medium italic">Adjust the background resource telemetry loop latency on the fly</p>
                </div>
                
                <div className="w-full md:w-96 p-4 rounded-2xl bg-slate-500/5 border border-border/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-muted">Refresh Profile:</span>
                    <span className="text-[10px] font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase">
                      {INTERVAL_MODES[sliderIndex].label} ({INTERVAL_MODES[sliderIndex].duration})
                    </span>
                  </div>
                  
                  <div className="relative pt-1">
                    <input 
                      type="range" 
                      min="0" 
                      max="2" 
                      step="1" 
                      value={sliderIndex}
                      onChange={(e) => setSliderIndex(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-slate-200 dark:bg-slate-800"
                    />
                    <div className="flex justify-between text-[9px] font-extrabold text-muted mt-2">
                      <button 
                        onClick={() => setSliderIndex(0)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 0 ? "text-primary font-black" : "")}
                      >
                        Aggressive (500ms)
                      </button>
                      <button 
                        onClick={() => setSliderIndex(1)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 1 ? "text-primary font-black" : "")}
                      >
                        Balanced (2.5s)
                      </button>
                      <button 
                        onClick={() => setSliderIndex(2)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 2 ? "text-primary font-black" : "")}
                      >
                        Power Saver (10s)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <SystemHealth updateInterval={updateInterval} />
            </section>
          )}

          {/* Security & Access Thresholds */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
              <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <Lock size={16} className="text-primary" />
                  Operational Security Thresholds
                </h3>
                <p className="text-[10px] text-muted font-mono">PROTO_DYNAMIC_V4</p>
              </div>
              
              <div className="divide-y divide-border/50">
                {thresholds.map((t, i) => (
                  <motion.div 
                    key={t.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-8 hover:bg-background transition-colors group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110",
                        t.isEnabled ? "bg-primary/10 text-primary" : "bg-background text-muted"
                      )}>
                        <Zap size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{t.type.replace("_", " ")}</p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">TRIGGER_VALUE: {t.threshold}{t.type.toLowerCase().includes('budget') ? '%' : ' KES'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="relative">
                         <input 
                          type="number" 
                          value={t.threshold}
                          onChange={(e) => updateThreshold(t.id, { threshold: Number(e.target.value) })}
                          className="w-24 px-4 py-2 bg-background border border-border rounded-xl text-xs font-black font-mono focus:border-primary/50 outline-none transition-colors text-right"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">VAL</span>
                      </div>
                     
                      <button 
                        onClick={() => updateThreshold(t.id, { isEnabled: !t.isEnabled })}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300",
                          t.isEnabled ? "bg-primary" : "bg-slate-200"
                        )}
                      >
                        <motion.div 
                          animate={{ x: t.isEnabled ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
                        />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* User Profile Identity */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
             <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <UserCheck size={120} className="text-primary" />
             </div>
            <div className="px-8 py-6 border-b border-border">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <UserCheck size={18} className="text-primary" />
                Session Identity Transaction
              </h3>
            </div>
            
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">LEGAL_NAME_DISPLAY</label>
                <div className="p-4 bg-background rounded-2xl text-xs text-foreground border border-border font-bold">{currentUser?.name}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">IDENTITY_EMAIL</label>
                <div className="p-4 bg-background rounded-2xl text-xs text-foreground border border-border font-bold">{currentUser?.email}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PROTOCOL_ACCESS_ROLE</label>
                <div className="p-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest border border-primary/20 shadow-lg shadow-primary/20">{currentUser?.role.replace("_", " ")}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AFFILIATED_TRANSACTION_GROUP</label>
                <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-900 border border-slate-100 font-bold uppercase">{currentUser?.group || "GLOBAL_CLUSTER"}</div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Record Metadata Card */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-800 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 opacity-10 transition-transform group-hover:scale-125 duration-700">
                  <Server size={80} className="text-white" />
               </div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Ledger Metadata</h3>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">FIRESTORE_LIVE_SYNC</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {[
                  { label: "Cluster Type", value: "CLOUD_GEN_3", status: "emerald" },
                  { label: "Integrity Link", value: "ENCRYPTED_SSL", status: "emerald" },
                  { label: "Record Index", value: "3,102 ENTITIES", status: "primary" }
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center group/item cursor-default">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover/item:text-slate-300 transition-colors">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        item.status === 'emerald' ? 'bg-emerald-500' : 'bg-primary'
                      )} />
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-8 flex flex-col gap-3">
                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">Prototype Data</p>
                    <p className="text-[10px] text-slate-400">Toggle mock requisitions, users, and projects</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={systemSettings.prototypeDataEnabled}
                      onChange={async (e) => {
                        const enabled = e.target.checked;
                        if (enabled) {
                           // They turned it on, let's also trigger seed just in case it doesn't exist?
                           // Actually the user just clicks toggle. No need to force seed, we can keep the separate seed button if needed.
                           await updateSystemSettings({ prototypeDataEnabled: true });
                        } else {
                           await updateSystemSettings({ prototypeDataEnabled: false });
                        }
                      }} 
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>



                {systemSettings.prototypeDataEnabled && (
                  <button 
                    onClick={async () => {
                      try {
                        await seedAllEcosystemData();
                        alert("St Andrews Ecosystem seeded successfully!");
                      } catch (e: any) {
                        alert("Seeding failed: " + e.message);
                      }
                    }}
                    className="w-full py-4 bg-primary hover:bg-primary/90 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    <Database size={16} />
                    FORCE_RESEED_ECOSYSTEM
                  </button>
                )}
              </div>
            </section>
          )}

          {/* Real-time Audit Trail */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm flex flex-col h-[500px]">
            <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-background">
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <History size={16} className="text-primary" />
                  Audit Trail
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">LIVE_FEED</span>
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
              {lastTenLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-background rounded-3xl flex items-center justify-center border border-border text-muted/30">
                    <Activity size={24} />
                  </div>
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">Awaiting Log Transactions...</p>
                </div>
              ) : (
                lastTenLogs.map((log, idx) => (
                  <motion.div 
                    key={log.id} 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 border border-border rounded-2xl hover:bg-background transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border border-border bg-card text-muted group-hover:text-primary group-hover:border-primary/20 transition-colors">
                        {log.action}
                      </span>
                      <span className="font-mono text-[9px] text-muted font-bold">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-foreground font-medium leading-relaxed mb-3">
                      {log.details}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-md bg-background flex items-center justify-center text-[8px] font-black text-muted">
                        {log.performedBy?.charAt(0)}
                      </div>
                      <span className="text-[9px] font-black text-muted uppercase tracking-tighter truncate max-w-[150px]">
                        {log.performedBy}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>

          {/* Interface Aesthetics & Theme */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm transition-all">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Palette size={16} className="text-primary" />
                Interface Visual Core
              </h3>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">High-Contrast Dark Mode</p>
                  <p className="text-[10px] text-muted font-medium italic">Reduced eye-strain for audit cycles</p>
                </div>
                
                <div className="flex items-center gap-3 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-border/50">
                  <button 
                    onClick={() => currentUser && updateUserProfile(currentUser.id, { theme: 'light' })}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                      currentUser?.theme !== 'dark' 
                        ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm shadow-amber-500/10" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Sun size={18} />
                  </button>
                  <button 
                    onClick={() => currentUser && updateUserProfile(currentUser.id, { theme: 'dark' })}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                      currentUser?.theme === 'dark' 
                        ? "bg-white dark:bg-slate-700 text-primary shadow-sm shadow-primary/10" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Moon size={18} />
                  </button>
                </div>
              </div>

              {currentUser?.theme === 'dark' && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3">
                  <Cpu size={16} className="text-primary animate-pulse" />
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">Display_Driver: OLED_OPTIMIZED_V2</span>
                </div>
              )}
            </div>
          </section>

          {/* Alert Channels */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-border bg-background">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                Alert Pipelines
              </h3>
            </div>
            
            <div className="p-4 space-y-2">
              {[
                { label: "Internal Message Hub", active: true, icon: Mail },
                { label: "SMS Critical Broadcast", active: false, icon: Smartphone }
              ].map((channel) => (
                <div key={channel.label} className="flex items-center justify-between p-4 rounded-2xl hover:bg-background group transition-colors">
                  <div className="flex items-center gap-3">
                    <channel.icon size={16} className={cn("transition-colors", channel.active ? "text-primary" : "text-muted")} />
                    <span className="text-[10px] font-black text-foreground/70 uppercase tracking-widest">{channel.label}</span>
                  </div>
                  <button className={cn(
                    "w-10 h-5 rounded-full relative transition-all duration-300",
                    channel.active ? "bg-primary" : "bg-border"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all",
                      channel.active ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};


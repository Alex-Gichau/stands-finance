import React, { useState, useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { 
  AUTOSEND_DEFAULT_EMAIL, 
  BackupEmailLog, 
  AutosendConfig, 
  fetchAutosendStatus, 
  updateAutosendConfigOnServer, 
  triggerAutosendBackupEmail,
  getNextBackupScheduledDate
} from "../services/autosendBackupService";
import { downloadBackupLocally, generateBackupPayload } from "../services/googleDriveBackupService";
import { 
  Mail, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  ShieldAlert, 
  FileCode, 
  Sparkles, 
  Save, 
  Activity, 
  Check, 
  Layers, 
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const AutosendBackupMonitoringPanel: React.FC = () => {
  const contextData = useRequisitions();
  
  const [config, setConfig] = useState<AutosendConfig>({
    targetEmail: AUTOSEND_DEFAULT_EMAIL,
    enabled: true,
    frequency: "WEEKLY",
    lastSentTimestamp: null,
    totalBackupsSent: 0
  });

  const [logs, setLogs] = useState<BackupEmailLog[]>([]);
  const [emailInput, setEmailInput] = useState<string>(AUTOSEND_DEFAULT_EMAIL);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStatus = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchAutosendStatus();
      setConfig(data.config);
      setLogs(data.logs);
      if (data.config?.targetEmail) {
        setEmailInput(data.config.targetEmail);
      }
    } catch (e) {
      console.error("Error loading autosend status:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSaveConfig = async () => {
    if (!emailInput || !emailInput.includes("@")) {
      setStatusNotification({ type: "error", message: "Please enter a valid target email address." });
      return;
    }

    setIsSavingConfig(true);
    try {
      const updated = await updateAutosendConfigOnServer({
        targetEmail: emailInput.trim(),
        enabled: config.enabled,
        frequency: config.frequency
      });
      setConfig(updated);
      setStatusNotification({ type: "success", message: `Autosend target email updated to ${updated.targetEmail}` });
    } catch (err: any) {
      setStatusNotification({ type: "error", message: err.message || "Failed to save configuration." });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleEnabled = async () => {
    const nextState = !config.enabled;
    const updated = await updateAutosendConfigOnServer({ enabled: nextState });
    setConfig(updated);
    setStatusNotification({
      type: "info",
      message: nextState ? "Autosend backup enabled." : "Autosend backup paused."
    });
  };

  const handleFrequencyChange = async (freq: "5-HOURS" | "DAILY" | "WEEKLY") => {
    const updated = await updateAutosendConfigOnServer({ frequency: freq });
    setConfig(updated);
    setStatusNotification({ type: "info", message: `Autosend frequency updated to ${freq}.` });
  };

  const handleSendNow = async () => {
    setIsDispatching(true);
    setStatusNotification({ type: "info", message: `Compiling ecosystem JSON snapshot & sending to ${emailInput}...` });

    try {
      const res = await triggerAutosendBackupEmail(emailInput, contextData, "MANUAL");
      if (res.success) {
        setStatusNotification({
          type: "success",
          message: `✅ ${res.message}`
        });
      } else {
        setStatusNotification({
          type: "error",
          message: `⚠️ ${res.message}`
        });
      }
      await loadStatus();
    } catch (err: any) {
      setStatusNotification({
        type: "error",
        message: err.message || "Failed to send backup JSON email."
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDownloadLocal = () => {
    const payload = generateBackupPayload(contextData);
    downloadBackupLocally(payload);
    setStatusNotification({ type: "success", message: "Local JSON backup downloaded to your machine." });
  };

  return (
    <div className="bg-card rounded-[2rem] border border-border p-6 sm:p-8 shadow-sm space-y-8 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-200 dark:border-indigo-800/40">
            <Mail size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-foreground">
                Super Admin Autosend JSON Backup & Monitoring
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                Super Admin Only
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              Automated system database snapshot dispatches directly as JSON file attachments to designated recipient.
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={isRefreshing}
          className="self-start sm:self-center px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-border cursor-pointer"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin text-indigo-600" : ""} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Target Email & Autosend Configuration Card */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-50/70 dark:from-indigo-950/20 dark:via-slate-900/40 dark:to-blue-950/20 border border-indigo-200/80 dark:border-indigo-900/40 rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-200/50 dark:border-indigo-900/40 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Cpu size={18} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Autosend Delivery Target & Channel Control
              </h4>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                Default Target: <span className="font-bold text-indigo-600 dark:text-indigo-400">{AUTOSEND_DEFAULT_EMAIL}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Autosend Channel:
            </span>
            <button
              onClick={handleToggleEnabled}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                config.enabled
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${config.enabled ? "bg-white animate-pulse" : "bg-slate-400"}`} />
              <span>{config.enabled ? "ACTIVE" : "PAUSED"}</span>
            </button>
          </div>
        </div>

        {/* Input Form & Frequency Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
          <div className="lg:col-span-7 space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Mail size={14} className="text-indigo-600 dark:text-indigo-400" />
              <span>Backup Recipient Email Address</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="e.g. geeshau.standsmedia@gmail.com"
                className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl text-xs font-semibold text-foreground focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              />
              <button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 shrink-0"
              >
                {isSavingConfig ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock size={14} className="text-indigo-600 dark:text-indigo-400" />
                <span>Autosend Interval Frequency</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                {config.frequency === "WEEKLY" ? "Friday 04:00 AM" : config.frequency === "DAILY" ? "Every 24h" : "Every 5h"}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-wider">
              {(["WEEKLY", "DAILY", "5-HOURS"] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => handleFrequencyChange(freq)}
                  className={`py-2 px-1 rounded-xl transition-all cursor-pointer text-center ${
                    config.frequency === freq
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {freq === "WEEKLY" ? "Weekly (Fri 04AM)" : freq === "DAILY" ? "Daily (24h)" : "5 Hours"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Mail size={13} className="text-indigo-500" />
            <span>Target Recipient</span>
          </div>
          <div className="text-xs font-black text-foreground truncate font-mono" title={config.targetEmail}>
            {config.targetEmail}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={11} /> Configured & Verified
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock size={13} className="text-blue-500" />
            <span>Schedule & Next Run</span>
          </div>
          <div className="text-xs font-black text-foreground truncate" title={getNextBackupScheduledDate(config).toLocaleString()}>
            {getNextBackupScheduledDate(config).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
            <Sparkles size={11} /> {config.frequency === "WEEKLY" ? "Weekly End of Week (Fri 04AM)" : `Cycle: ${config.frequency}`}
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Send size={13} className="text-purple-500" />
            <span>Total Sent Backups</span>
          </div>
          <div className="text-lg font-black text-foreground">
            {config.totalBackupsSent || logs.filter(l => l.status === "DELIVERED" || l.status === "SENT_ATTACHMENT").length} Snapshots
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Format: JSON File
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity size={13} className="text-emerald-500" />
            <span>Ecosystem Requisitions</span>
          </div>
          <div className="text-lg font-black text-foreground">
            {contextData.requisitions?.length || 0} Records
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            Ready for Packaging
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={handleSendNow}
          disabled={isDispatching}
          className="w-full sm:w-auto flex-1 py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-md hover:shadow-indigo-200/50 dark:hover:shadow-none disabled:opacity-50"
        >
          <Send size={16} className={isDispatching ? "animate-bounce" : ""} />
          <span>{isDispatching ? "Compiling & Dispatched Email..." : "Send JSON Backup Email Now"}</span>
        </button>

        <button
          onClick={handleDownloadLocal}
          className="w-full sm:w-auto py-4 px-6 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Download size={16} />
          <span>Download JSON Snapshot</span>
        </button>
      </div>

      {/* Notification Banner */}
      <AnimatePresence>
        {statusNotification && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              statusNotification.type === "success"
                ? "bg-emerald-500/10 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : statusNotification.type === "error"
                ? "bg-rose-500/10 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                : "bg-indigo-500/10 border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusNotification.type === "success" ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              ) : statusNotification.type === "error" ? (
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
              ) : (
                <Activity size={16} className="shrink-0 text-indigo-600 animate-pulse" />
              )}
              <span>{statusNotification.message}</span>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-xs font-mono opacity-60 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monitoring History Log Table */}
      <div className="space-y-4 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode size={16} className="text-indigo-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
              Autosend Dispatch Monitoring Logs
            </h4>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {logs.length} Total Logs
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center bg-muted/30 border border-border rounded-2xl space-y-2">
            <Activity size={24} className="mx-auto text-muted-foreground/60" />
            <p className="text-xs font-semibold text-muted-foreground">
              No email backup logs recorded yet. Click "Send JSON Backup Email Now" to execute an initial backup dispatch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Recipient</th>
                  <th className="p-3.5">File Name & Size</th>
                  <th className="p-3.5">Trigger</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Summary Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs font-medium">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-bold text-foreground font-mono text-[11px]">
                      {log.targetEmail}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-foreground font-mono text-[11px]">{log.fileName}</div>
                      <div className="text-[10px] text-muted-foreground">{log.sizeKb} KB</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider rounded-md">
                        {log.triggerType || "MANUAL"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {log.status === "DELIVERED" || log.status === "SENT_ATTACHMENT" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={12} /> DELIVERED
                        </span>
                      ) : log.status === "SIMULATED_LOCAL_STORE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200 dark:border-amber-800">
                          <Activity size={12} /> STORED LOCAL
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-rose-200 dark:border-rose-800">
                          <AlertCircle size={12} /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono text-[11px] text-muted-foreground">
                      {log.summary ? (
                        <span>
                          {log.summary.totalRequisitions} reqs | {log.summary.totalUsers} users | {log.summary.totalGroups} groups
                        </span>
                      ) : (
                        <span>Compiled Snapshot</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Autosend Backup Service
 * Automatically compiles system database snapshots into JSON files and sends them as email attachments
 * Default Target Recipient: geeshau.standsmedia@gmail.com
 */

export const AUTOSEND_DEFAULT_EMAIL = "geeshau.standsmedia@gmail.com";

export interface BackupEmailLog {
  id: string;
  timestamp: string;
  targetEmail: string;
  fileName: string;
  sizeKb: number;
  status: "DELIVERED" | "SENT_ATTACHMENT" | "SIMULATED_LOCAL_STORE" | "FAILED";
  warning?: string | null;
  triggerType?: "MANUAL" | "SCHEDULED" | "AUTO_DRIVE";
  summary?: {
    totalRequisitions: number;
    totalUsers: number;
    totalProjects: number;
    totalGroups: number;
  };
}

export interface AutosendConfig {
  targetEmail: string;
  enabled: boolean;
  frequency: "5-HOURS" | "DAILY" | "WEEKLY";
  lastSentTimestamp: string | null;
  totalBackupsSent: number;
}

const LOCAL_STORAGE_LOGS_KEY = "st_andrews_autosend_email_backup_logs";
const LOCAL_STORAGE_CONFIG_KEY = "st_andrews_autosend_email_backup_config";

export const getLocalAutosendConfig = (): AutosendConfig => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading local autosend config:", e);
  }
  return {
    targetEmail: AUTOSEND_DEFAULT_EMAIL,
    enabled: true,
    frequency: "WEEKLY",
    lastSentTimestamp: null,
    totalBackupsSent: 0
  };
};

export const getNextBackupScheduledDate = (config?: Partial<AutosendConfig>): Date => {
  const now = new Date();
  const freq = config?.frequency || "WEEKLY";
  const lastSent = config?.lastSentTimestamp ? new Date(config.lastSentTimestamp) : null;

  if (freq === "5-HOURS") {
    const base = lastSent || now;
    return new Date(base.getTime() + 5 * 60 * 60 * 1000);
  }

  if (freq === "DAILY") {
    const base = lastSent || now;
    return new Date(base.getTime() + 24 * 60 * 60 * 1000);
  }

  // WEEKLY: Every Friday at 04:00 AM
  const currentDay = now.getDay();
  let daysUntilFriday = (5 - currentDay + 7) % 7;
  if (daysUntilFriday === 0 && now.getHours() >= 4) {
    daysUntilFriday = 7;
  }
  const nextFriday = new Date(now);
  nextFriday.setDate(now.getDate() + daysUntilFriday);
  nextFriday.setHours(4, 0, 0, 0);
  return nextFriday;
};

export const saveLocalAutosendConfig = (config: AutosendConfig) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Error saving local autosend config:", e);
  }
};

export const getLocalBackupEmailLogs = (): BackupEmailLog[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading local backup email logs:", e);
  }
  return [];
};

export const addLocalBackupEmailLog = (log: BackupEmailLog) => {
  try {
    const current = getLocalBackupEmailLogs();
    const updated = [log, ...current].slice(0, 50);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Error writing local backup email log:", e);
  }
};

export const fetchAutosendStatus = async (): Promise<{ config: AutosendConfig; logs: BackupEmailLog[] }> => {
  try {
    const res = await fetch("/api/backup-email-status");
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        if (data.config) saveLocalAutosendConfig(data.config);
        return {
          config: data.config || getLocalAutosendConfig(),
          logs: data.logs || getLocalBackupEmailLogs()
        };
      }
    }
  } catch (err) {
    console.warn("Failed to fetch backend backup email status, using local cache:", err);
  }
  return {
    config: getLocalAutosendConfig(),
    logs: getLocalBackupEmailLogs()
  };
};

export const updateAutosendConfigOnServer = async (configUpdate: Partial<AutosendConfig>): Promise<AutosendConfig> => {
  const current = getLocalAutosendConfig();
  const newConfig = { ...current, ...configUpdate };
  saveLocalAutosendConfig(newConfig);

  try {
    const res = await fetch("/api/backup-email-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        saveLocalAutosendConfig(data.config);
        return data.config;
      }
    }
  } catch (err) {
    console.warn("Failed to update autosend config on server:", err);
  }
  return newConfig;
};

export const triggerAutosendBackupEmail = async (
  email?: string,
  contextData?: any,
  triggerType: "MANUAL" | "SCHEDULED" | "AUTO_DRIVE" = "MANUAL"
): Promise<{ success: boolean; message: string; log?: BackupEmailLog }> => {
  const targetEmail = (email || AUTOSEND_DEFAULT_EMAIL).trim();

  const payload = contextData ? {
    systemSettings: contextData.systemSettings || {},
    requisitions: contextData.requisitions || [],
    users: contextData.users || [],
    projects: contextData.projects || [],
    churchGroups: contextData.churchGroups || [],
    ledgerBooks: contextData.ledgerBooks || [],
    systemLogs: contextData.systemLogs || [],
    customCalendarEvents: contextData.customCalendarEvents || []
  } : {};

  try {
    const res = await fetch("/api/backup-autosend-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: targetEmail,
        triggerType,
        ...payload
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      const logEntry: BackupEmailLog = {
        id: `embak-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        targetEmail: data.targetEmail || targetEmail,
        fileName: data.fileName || `STANDS_eReqs_Backup_${new Date().toISOString().slice(0, 10)}.json`,
        sizeKb: data.sizeKb || 0,
        status: data.status || "DELIVERED",
        warning: data.warning,
        triggerType,
        summary: data.summary
      };

      addLocalBackupEmailLog(logEntry);

      const cfg = getLocalAutosendConfig();
      cfg.lastSentTimestamp = logEntry.timestamp;
      cfg.totalBackupsSent = (cfg.totalBackupsSent || 0) + 1;
      saveLocalAutosendConfig(cfg);

      return {
        success: true,
        message: data.message || `Autosend JSON backup sent to ${targetEmail}`,
        log: logEntry
      };
    } else {
      throw new Error(data.error || "Failed to autosend JSON backup email");
    }
  } catch (err: any) {
    console.error("Autosend backup email error:", err);
    const failedLog: BackupEmailLog = {
      id: `embak-err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      targetEmail,
      fileName: `STANDS_eReqs_Backup_Error.json`,
      sizeKb: 0,
      status: "FAILED",
      warning: err.message || "Email dispatch failed",
      triggerType
    };
    addLocalBackupEmailLog(failedLog);
    return {
      success: false,
      message: err.message || "Failed to autosend JSON backup email",
      log: failedLog
    };
  }
};

import { sendSlackNotification } from "./utils";

let isMonitoring = false;

export function getTimeUntilMidnightPT() {
  const now = new Date();
  
  // Midnight PT corresponds to 8:00 AM UTC (Standard Time) or 7:00 AM UTC (Daylight Saving Time).
  // Los Angeles Timezone
  const ptString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const ptDate = new Date(ptString);
  
  const nextMidnightPT = new Date(ptDate);
  nextMidnightPT.setHours(24, 0, 0, 0); // advance to tomorrow midnight

  const diffMs = nextMidnightPT.getTime() - ptDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${diffHours} hours and ${diffMins} minutes (reset at Midnight Pacific Time)`;
}

// Throttle Slack notifications to avoid rate limiting
const recentErrors = new Set<string>();

export function initErrorMonitor() {
  if (isMonitoring) return;
  isMonitoring = true;

  const originalConsoleError = console.error;

  const sendErrorAlert = (errorMsg: string, isFromConsole: boolean) => {
    // Basic deduplication (throttle same error for 5 mins)
    const errorSignature = errorMsg.substring(0, 100);
    if (recentErrors.has(errorSignature)) return;
    recentErrors.add(errorSignature);
    setTimeout(() => recentErrors.delete(errorSignature), 5 * 60 * 1000);

    const isQuotaError = errorMsg.toLowerCase().includes("quota exceeded") || errorMsg.includes("resource-exhausted");
    
    let action = isFromConsole ? "CONSOLE_ERROR" : "UNCAUGHT_EXCEPTION";
    let details = errorMsg.substring(0, 1500); // limit size
    let level: "normal" | "critical" = "normal";

    if (isQuotaError) {
      action = "DATABASE_RESOURCE_EXHAUSTED";
      level = "critical";
      const resetTime = getTimeUntilMidnightPT();
      details = `🔥 *DATABASE RESOURCE EXHAUSTED* 🔥\n\n*Error details:*\n${errorMsg}\n\n*Estimated Reset time:*\n${resetTime}\n\nPlease switch to local fallback or check the database console.`;
    } else {
      details = `*${isFromConsole ? "Console Error Detected" : "Uncaught Exception Detected"}:*\n\n${details}`;
    }

    sendSlackNotification({
      action,
      details,
      performedBy: "SYSTEM_MONITOR",
      level
    }).catch(originalConsoleError);
  };

  console.error = (...args: any[]) => {
    const errorMsg = args.map(arg => {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return 'Object'; }
      }
      return String(arg);
    }).join(' ');

    const lowerMsg = errorMsg.toLowerCase();
    if (
      lowerMsg.includes("database connection failed")
    ) {
      return;
    }

    if (
      lowerMsg.includes("websocket") ||
      lowerMsg.includes("[vite]") ||
      lowerMsg.includes("ws://") ||
      lowerMsg.includes("wss://")
    ) {
      // Still log to local console without reporting to monitor or alerts
      originalConsoleError(...args);
      return;
    }

    originalConsoleError(...args);

    if (errorMsg.includes('Slack notification failed') || errorMsg.includes('/api/notify-slack') || errorMsg.includes('SystemLogsPanel')) {
      return;
    }

    sendErrorAlert(errorMsg, true);
  };

  window.addEventListener("error", (event) => {
    const errorMsg = event.error ? (event.error.stack || event.error.message) : event.message;
    const msgStr = String(errorMsg);
    const lowerMsg = msgStr.toLowerCase();
    if (
      lowerMsg.includes("websocket") ||
      lowerMsg.includes("[vite]") ||
      lowerMsg.includes("ws://") ||
      lowerMsg.includes("wss://") ||
      lowerMsg.includes("closed without opened") ||
      lowerMsg.includes("database connection failed")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    sendErrorAlert(msgStr, false);
  }, { capture: true });

  window.addEventListener("unhandledrejection", (event) => {
    const errorMsg = event.reason ? (event.reason.stack || event.reason.message || String(event.reason)) : "Unhandled Promise Rejection";
    const msgStr = String(errorMsg);
    const lowerMsg = msgStr.toLowerCase();
    if (
      lowerMsg.includes("websocket") ||
      lowerMsg.includes("[vite]") ||
      lowerMsg.includes("ws://") ||
      lowerMsg.includes("wss://") ||
      lowerMsg.includes("closed without opened") ||
      lowerMsg.includes("database connection failed")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    sendErrorAlert(msgStr, false);
  }, { capture: true });
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { RequisitionStatus } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeAttachmentUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  
  // Convert absolute VPS HTTP URLs containing /uploads/ to relative /uploads/ path
  if (url.startsWith("http://") && url.includes("/uploads/")) {
    const parts = url.split("/uploads/");
    return "/uploads/" + parts[1];
  }
  
  return url;
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
  }).format(amount);
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi"
  });
}

export function isFinalStage(status?: RequisitionStatus | string): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return (
    s === RequisitionStatus.DISBURSED ||
    s === RequisitionStatus.REJECTED ||
    s === RequisitionStatus.CANCELLED ||
    s === "DISBURSED" ||
    s === "REJECTED" ||
    s === "CANCELLED"
  );
}

export function formatRequisitionAge(
  submittedAt: string | undefined,
  status?: RequisitionStatus | string,
  options?: { compact?: boolean }
): string | null {
  if (isFinalStage(status)) {
    return null;
  }
  if (!submittedAt) return null;

  const dateMs = new Date(submittedAt).getTime();
  if (isNaN(dateMs)) return null;

  const diffMs = Math.abs(Date.now() - dateMs);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days > 30) {
    const months = Math.max(1, Math.floor(days / 30));
    const label = months === 1 ? "1 month" : `${months} months`;
    return options?.compact ? `${label} old` : `${label} old`;
  } else {
    const label = `${days} ${days === 1 ? "day" : "days"}`;
    return options?.compact ? `${days}d old` : `${label} old`;
  }
}

export function getDaysSinceSubmission(submittedAt: string) {
  if (!submittedAt) return 0;
  const diffTime = Math.abs(new Date().getTime() - new Date(submittedAt).getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export async function sendSlackNotification(params: {
  action: string;
  details: string;
  performedBy: string;
  level?: "normal" | "critical";
  metadata?: Record<string, any>;
}) {
  try {
    const response = await fetch("/api/notify-slack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        timestamp: new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }),
      }),
    });
    
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      console.warn("Slack API returned non-JSON response:", text.substring(0, 100));
      return { success: true, simulated: true, warning: "Non-JSON response from server" };
    }
  } catch (error) {
    console.error("Slack notification failed:", error);
    return { error: "Failed to send notification" };
  }
}

export async function uploadAttachmentToLocalServer(att: string): Promise<string> {
  if (typeof att !== "string") return att;
  
  let fileName = "attachment";
  let dataUrl = att;
  
  if (att.includes("::")) {
    const parts = att.split("::");
    fileName = parts[0];
    dataUrl = parts[1];
  } else {
    // If it's a raw data URL without filename
    if (dataUrl.startsWith("data:")) {
      const mime = dataUrl.split(";")[0].split(":")[1] || "";
      const ext = mime.split("/")[1] || "png";
      fileName = `receipt_${Date.now()}.${ext}`;
    } else {
      // Already a URL or relative path
      return att;
    }
  }
  
  if (dataUrl && dataUrl.startsWith("data:")) {
    try {
      const res = await fetch("/api/attachments/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName, dataUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          return att.includes("::") ? `${fileName}::${data.url}` : data.url;
        }
      }
    } catch (err) {
      console.error("Local file upload failed:", err);
    }
  }
  return att;
}

export async function uploadAttachmentsToLocalServer(
  attachments: string[],
  onProgress?: (completed: number, total: number, lastFile: string) => void
): Promise<string[]> {
  if (!attachments || attachments.length === 0) {
    if (onProgress) onProgress(0, 0, "");
    return [];
  }
  let completed = 0;
  const total = attachments.length;
  if (onProgress) {
    onProgress(0, total, "Initializing...");
  }
  return Promise.all(
    attachments.map(async (att) => {
      let fileName = "attachment";
      if (typeof att === "string" && att.includes("::")) {
        fileName = att.split("::")[0];
      }
      const res = await uploadAttachmentToLocalServer(att);
      completed++;
      if (onProgress) {
        onProgress(completed, total, fileName);
      }
      return res;
    })
  );
}

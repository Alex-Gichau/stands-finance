import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function getDaysSinceSubmission(submittedAt: string) {
  const diffTime = Math.abs(new Date().getTime() - new Date(submittedAt).getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
    return await response.json();
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

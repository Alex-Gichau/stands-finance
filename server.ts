
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Activity {
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
  metadata?: any;
}

// Ensure activity_history.json exists or create it
function restoreActivities(): Activity[] {
  try {
    const filePath = path.join(process.cwd(), "activity_history.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading activity_history.json:", err);
  }
  return [];
}

function persistActivity(activity: Activity) {
  try {
    const filePath = path.join(process.cwd(), "activity_history.json");
    const activities = restoreActivities();
    activities.push(activity);
    fs.writeFileSync(filePath, JSON.stringify(activities, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing activity_history.json:", err);
  }
}

function generateSlackFullReport(): string {
  const activities = restoreActivities();
  if (activities.length === 0) {
    return "🤷‍♂️ *No historical user activities recorded yet. It's quiet in here!* 🦗";
  }

  // Sort chronologically/descending to display latest info on top
  const sorted = [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getEmojiForAction = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("login") || a.includes("sign_in")) return "👋";
    if (a.includes("logout") || a.includes("sign_out")) return "✌️";
    if (a.includes("create") || a.includes("add") || a.includes("submit")) return "✨";
    if (a.includes("update") || a.includes("edit") || a.includes("save")) return "📝";
    if (a.includes("delete") || a.includes("remove")) return "🗑️";
    if (a.includes("approve")) return "✅";
    if (a.includes("reject")) return "❌";
    if (a.includes("disburse") || a.includes("payment")) return "💸";
    if (a.includes("cancel")) return "🛑";
    if (a.includes("email")) return "📧";
    if (a.includes("sync")) return "🔄";
    return "🔹";
  };

  let report = "🚀 *FULL USER ACTIVITY REPORT* 🚀\r\n\r\n";

  sorted.forEach((act) => {
    const timeStr = new Date(act.timestamp).toLocaleString();
    const emoji = getEmojiForAction(act.action);
    report += `${emoji} *[${timeStr}]* 👤 _${act.performedBy}_ \r\n⚡ *${act.action}* 💬 ${act.details}\r\n`;
  });

  return report;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Sending Email
  app.post("/api/send-email", async (req, res) => {
    const { to, requesterName, amount, title } = req.body;
    console.log(`Sending disbursement email notification to ${to}...`);
    
    // Simulate real mail transfer delay (SMTP handshake, transfer)
    await new Promise(resolve => setTimeout(resolve, 1800));

    try {
      persistActivity({
        action: "EMAIL_DISPATCH",
        details: `Disbursement Confirmation Email sent to ${requesterName} <${to}> regarding '${title}' (Amount: KES ${Number(amount).toLocaleString()})`,
        performedBy: "SYSTEM_MAILER",
        timestamp: new Date().toISOString()
      });

      res.json({ success: true, deliveredTo: to, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to send email:", err);
      res.status(500).json({ error: "SMTP Dispatch simulation failed" });
    }
  });

  // API Route for Slack Notifications
  app.post("/api/notify-slack", async (req, res) => {
    const { action, details, performedBy, timestamp, metadata, level = "normal" } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn("SLACK_WEBHOOK_URL is not defined in environment variables.");
      return res.status(503).json({ error: "Slack integration not configured" });
    }

    try {
      // Persist the current activity first
      persistActivity({ action, details, performedBy, timestamp, metadata });

      // Build the long thread summary
      const summaryText = generateSlackFullReport();

      const color = level === "normal" ? "#36a64f" : "#ff0000";
      const slackBody = {
        attachments: [
          {
            color: color,
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "🚨 System Ledger Alert",
                  emoji: true
                }
              },
              {
                type: "section",
                fields: [
                  {
                    type: "mrkdwn",
                    text: `*Action:*\n${action}`
                  },
                  {
                    type: "mrkdwn",
                    text: `*User:*\n${performedBy}`
                  }
                ]
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Details:* ${details}`
                }
              },
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: `*Timestamp:* ${timestamp}`
                  }
                ]
              }
            ]
          },
          {
            color: "#4A5568",
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "🧵 FULL USER ACTIVITY REPORT",
                  emoji: true
                }
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: summaryText
                }
              }
            ]
          }
        ]
      };

      // Add metadata if present (like requisition amount, etc)
      if (metadata && Object.keys(metadata).length > 0) {
         slackBody.attachments[0].blocks.push({
           type: "section",
           text: {
             type: "mrkdwn",
             text: "*Extended Metadata:*\n" + Object.entries(metadata).map(([k, v]) => `• *${k}:* ${v}`).join("\n")
           }
         });
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });

      if (!response.ok) {
        throw new Error(`Slack responded with ${response.status}`);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to send Slack notification:", error);
      res.status(500).json({ error: "Failed to notify Slack" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

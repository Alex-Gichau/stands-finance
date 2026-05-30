import express from "express";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

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

function generateSlackThreadSummary(): string {
  const activities = restoreActivities();
  if (activities.length === 0) {
    return "No historical user activities recorded yet.";
  }

  // Sort chronologically/descending to display latest info on top
  const sorted = [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const loginsAndLogouts: string[] = [];
  const crudOps: string[] = [];
  const others: string[] = [];

  sorted.forEach(act => {
    const actionLower = act.action.toLowerCase();
    const detailsLower = act.details.toLowerCase();
    const timeStr = new Date(act.timestamp).toLocaleString();
    const line = `• *[${timeStr}]* _${act.performedBy}_ performed *${act.action}*: ${act.details}`;

    // Priority 1: Login & Logout
    if (
      actionLower.includes("login") || 
      actionLower.includes("logout") || 
      actionLower.includes("sign_in") ||
      actionLower.includes("sign_out") ||
      actionLower.includes("session")
    ) {
      loginsAndLogouts.push(line);
    } 
    // Priority 2: CRUD
    else if (
      actionLower.includes("create") || 
      actionLower.includes("update") || 
      actionLower.includes("delete") || 
      actionLower.includes("submit") || 
      actionLower.includes("approve") || 
      actionLower.includes("reject") ||
      actionLower.includes("disburse") ||
      actionLower.includes("cancel") ||
      actionLower.includes("add") ||
      actionLower.includes("save")
    ) {
      crudOps.push(line);
    } 
    // Others
    else {
      others.push(line);
    }
  });

  let text = "";
  text += "*🔐 USER ACTIVITY: LOGINS & LOGOUTS SESSION HISTORY (PRIORITY 1)*\r\n";
  if (loginsAndLogouts.length > 0) {
    text += loginsAndLogouts.join("\r\n") + "\r\n";
  } else {
    text += "• No session login/logout actions recorded yet.\r\n";
  }

  text += "\r\n*📂 USER ACTIVITY: LEDGER & RECORD CRUD OPERATIONS (PRIORITY 2)*\r\n";
  if (crudOps.length > 0) {
    text += crudOps.join("\r\n") + "\r\n";
  } else {
    text += "• No record mutations or CRUD operations recorded yet.\r\n";
  }

  if (others.length > 0) {
    text += "\r\n*⚙️ OTHER OPERATIONAL EVENTS AND SIGNALS*\r\n";
    text += others.join("\r\n") + "\r\n";
  }

  return text;
}

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
    const summaryText = generateSlackThreadSummary();

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
                text: "🧵 LONG ACTIVITY THREAD SUMMARY",
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
    console.error("Failed to send Slack notification on Vercel:", error);
    res.status(500).json({ error: "Failed to notify Slack" });
  }
});

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

// Standalone health endpoint for testing Vercel Serverless connectivity
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", host: "vercel-serverless-endpoint" });
});

// Wildcard API fallback
app.all("*", (req, res) => {
  res.status(404).json({ error: `Vercel Serverless: API route ${req.method} ${req.path} not matched.` });
});

export default app;

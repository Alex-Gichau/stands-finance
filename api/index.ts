import express from "express";

const app = express();
app.use(express.json());

// API Route for Slack Notifications
app.post("/api/notify-slack", async (req, res) => {
  const { action, details, performedBy, timestamp, metadata } = req.body;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK_URL is not defined in environment variables.");
    return res.status(503).json({ error: "Slack integration not configured" });
  }

  try {
    const slackBody = {
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
    };

    if (metadata && Object.keys(metadata).length > 0) {
      slackBody.blocks.push({
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

// Standalone health endpoint for testing Vercel Serverless connectivity
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", host: "vercel-serverless-endpoint" });
});

// Wildcard API fallback
app.all("*", (req, res) => {
  res.status(404).json({ error: `Vercel Serverless: API route ${req.method} ${req.path} not matched.` });
});

export default app;

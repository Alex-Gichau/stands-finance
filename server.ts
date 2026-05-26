
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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

      // Add metadata if present (like requisition amount, etc)
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

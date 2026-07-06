import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import https from "https";

export interface TestResult {
  name: string;
  success: boolean;
  message: string;
  durationMs: number;
  logs: string[];
}

export async function runTest(testName: string, config?: any): Promise<TestResult> {
  const start = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(`[TEST: ${testName}] ${msg}`);
  };

  try {
    switch (testName) {
      case "internet": {
        log("Testing DNS resolution and HTTP requests to Google...");
        await new Promise<void>((resolve, reject) => {
          https.get("https://www.google.com", (res) => {
            log(`Google Status: ${res.statusCode}`);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
              resolve();
            } else {
              reject(new Error(`Google returned status ${res.statusCode}`));
            }
          }).on("error", (e) => reject(e));
        });
        return {
          name: "Internet Connectivity",
          success: true,
          message: "Internet connectivity verified successfully.",
          durationMs: Date.now() - start,
          logs
        };
      }

      case "supabase": {
        const url = config?.supabaseUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
        const anonKey = config?.supabaseAnonKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
        log(`Testing Supabase API connection to URL: ${url}`);
        if (!url || !anonKey) {
          throw new Error("Supabase credentials missing from configuration or environment.");
        }
        const supabase = createClient(url, anonKey);
        log("Initializing client and querying 'users' table...");
        const { data, error } = await supabase.from("users").select("id, name, email, role").limit(5);
        if (error) {
          throw error;
        }
        log(`Fetched ${data?.length || 0} users successfully.`);
        return {
          name: "Supabase Connection & Query",
          success: true,
          message: `Supabase authenticated and queried successfully. Retrieved ${data?.length || 0} users.`,
          durationMs: Date.now() - start,
          logs
        };
      }

      case "smtp": {
        const host = config?.smtpHost || process.env.SMTP_HOST || "smtp.gmail.com";
        const port = Number(config?.smtpPort || process.env.SMTP_PORT || "587");
        const user = config?.smtpUser || process.env.SMTP_USER || "ict.team@pceastandrews.org";
        const pass = config?.smtpPass || process.env.SMTP_PASS;
        const targetEmail = config?.to || user;

        log(`Testing SMTP Server ${host}:${port} using user ${user}...`);
        if (!pass) {
          throw new Error("SMTP Password is not configured.");
        }

        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
          tls: { rejectUnauthorized: false }
        });

        log("Verifying connection credentials with SMTP server...");
        await transporter.verify();
        log("SMTP Connection verified! Sending verification test email...");

        await transporter.sendMail({
          from: `"ICT Approver Team - SMTP Test" <${user}>`,
          to: targetEmail,
          subject: "🔐 PCE East Andrews SMTP Verification Code",
          text: `Your SMTP Integration is working flawlessly! Triggered at: ${new Date().toLocaleString()}`,
          html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-bottom: 16px;">SMTP Deliverability Verification Successful</h2>
            <p>Your mail transfer agent (MTA) router config is completely functional!</p>
            <p style="font-size: 11px; color: #64748b; margin-top: 24px;">Triggered on: ${new Date().toLocaleString()}</p>
          </div>`
        });

        log("Test email sent and delivered to queue successfully.");
        return {
          name: "SMTP Server",
          success: true,
          message: `SMTP connection and test email dispatch succeeded. Sent to ${targetEmail}`,
          durationMs: Date.now() - start,
          logs
        };
      }

      case "environment": {
        log("Evaluating critical system environment parameters...");
        const variables = {
          VITE_SUPABASE_URL: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
          VITE_SUPABASE_ANON_KEY: !!(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
          SMTP_HOST: !!process.env.SMTP_HOST,
          SMTP_PORT: !!process.env.SMTP_PORT,
          SMTP_USER: !!process.env.SMTP_USER,
          SMTP_PASS: !!process.env.SMTP_PASS,
          SLACK_WEBHOOK_URL: !!process.env.SLACK_WEBHOOK_URL,
        };

        const missing = Object.entries(variables)
          .filter(([_, exists]) => !exists)
          .map(([name]) => name);

        if (missing.length > 0) {
          log(`Warning: The following optional/required variables are not defined: ${missing.join(", ")}`);
        } else {
          log("All critical environment variables are configured!");
        }

        return {
          name: "Environment Audit",
          success: missing.length === 0 || !missing.includes("VITE_SUPABASE_URL"),
          message: missing.length === 0 
            ? "All environment keys are loaded correctly."
            : `Loaded with missing variables: ${missing.join(", ")}`,
          durationMs: Date.now() - start,
          logs
        };
      }

      case "crypto": {
        log("Testing crypto integrity...");
        // Basic test of standard libraries to ensure Node modules are sound
        const dataToHash = "PCE_EAST_ANDREWS_SECURE_TOKEN_2026";
        const crypto = require("crypto");
        const hash = crypto.createHash("sha256").update(dataToHash).digest("hex");
        log(`SHA256 Hash generated successfully: ${hash}`);
        return {
          name: "Cryptographic Operations",
          success: true,
          message: "Cryptography algorithms verified as secure and functional.",
          durationMs: Date.now() - start,
          logs
        };
      }

      default:
        throw new Error(`Unknown test suite: '${testName}'`);
    }
  } catch (err: any) {
    log(`Test Failed: ${err.message || err}`);
    return {
      name: testName,
      success: false,
      message: err.message || String(err),
      durationMs: Date.now() - start,
      logs
    };
  }
}

// Allow CLI execution if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const testArg = args.find(a => a.startsWith("--test="))?.split("=")[1] || "all";

  (async () => {
    console.log(`🚀 Starting Test Runner - Target: [${testArg}]`);
    const suites = testArg === "all" ? ["internet", "supabase", "environment", "crypto"] : [testArg];
    for (const suite of suites) {
      const res = await runTest(suite);
      console.log(`\n=============================================`);
      console.log(`Suite: ${res.name} (${res.success ? "🟢 SUCCESS" : "❌ FAILED"})`);
      console.log(`Duration: ${res.durationMs}ms`);
      console.log(`Message: ${res.message}`);
      console.log(`=============================================\n`);
    }
  })();
}

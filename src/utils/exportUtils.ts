/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Requisition, SystemLog } from "../types";
import { formatCurrency, formatDate } from "../lib/utils";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

/**
 * Generates high-fidelity, printer-friendly HTML ledger for System Audit Logs.
 */
export function generatePrintableLogsHtml(
  logs: SystemLog[],
  reportTitle: string,
  currentUser: any
): string {
  const fileDate = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fileTime = new Date().toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const tableRowsHtml = logs.map((log, index) => {
    return `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: bold;">${index + 1}</td>
        <td style="font-family: monospace; font-size: 8.5px; color: #475569;">
          ${formatDate(log.timestamp)}
          <div style="font-size: 7px; color: #94a3b8; margin-top: 2px;">
            ${new Date(log.timestamp).toLocaleTimeString()}
          </div>
        </td>
        <td>
          <div style="font-weight: bold; color: #0f172a; font-size: 9.5px;">${log.action.replace(/_/g, " ")}</div>
          <div style="font-size: 8px; font-family: monospace; color: #64748b; margin-top: 2px;">
            ID: ${log.id.toUpperCase()}
          </div>
        </td>
        <td style="font-size: 9px; color: #334155;">
          ${log.details}
        </td>
        <td style="font-weight: 500; font-size: 9px; color: #475569;">
          ${log.performedBy}
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>St. Andrews Church - System Audit Logs</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1e293b;
      margin: 40px;
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      border-bottom: 3px double #334155;
      padding-bottom: 16px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      background-color: #4f46e5;
      color: #ffffff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
    }
    .title-area {
      flex: 1;
    }
    .title {
      font-weight: 800;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0;
    }
    .subtitle {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      font-weight: 700;
      margin: 3px 0 0 0;
    }
    .meta-file-id {
      text-align: right;
      font-family: monospace;
      font-size: 9px;
      color: #64748b;
    }
    .meta-file-title {
      font-weight: 800;
      font-size: 12px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    .meta-item {
      background-color: #f8fafc;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .meta-label {
      font-weight: 700;
      font-size: 8px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }
    .meta-value {
      font-weight: 700;
      font-size: 11px;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 30px;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      text-transform: uppercase;
      font-weight: 800;
      font-size: 8.5px;
      letter-spacing: 0.5px;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .system-log {
      margin-top: 50px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-logo">✝</div>
      <div class="title-area">
        <h1 class="title">St. Andrews Church</h1>
        <p class="subtitle">System Audit Management Ledger</p>
      </div>
    </div>
    <div class="meta-file-id">
      <div class="meta-file-title">AUDIT LOG EXPORT</div>
      <div>REF: LOG-${Date.now().toString(36).toUpperCase()}</div>
      <div>OFFICIAL SECURE SYSTEM RECORD</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Report Title</div>
      <div class="meta-value">${reportTitle}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Exported By</div>
      <div class="meta-value">${currentUser?.name || "System Operator"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Generated On</div>
      <div class="meta-value">${fileDate} at ${fileTime}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 4%; text-align: center;">#</th>
        <th style="width: 15%;">Timestamp</th>
        <th style="width: 20%;">Action Type</th>
        <th style="width: 46%;">Narrative Description</th>
        <th style="width: 15%;">Operator</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml || `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">No audit records found in selected scope.</td></tr>`}
    </tbody>
  </table>

  <div class="system-log">
    ST. ANDREWS PARISH FISCAL v3 PROTOCOL • AUDITED SYSTEM LOG RECORD • PRINTED SECURELY ON ${fileDate} AT ${fileTime}
  </div>
</body>
</html>
  `;
}

/**
 * Prints system audit logs.
 */
export function printSystemLogs(
  logs: SystemLog[],
  reportTitle: string,
  currentUser: any
): void {
  const html = generatePrintableLogsHtml(logs, reportTitle, currentUser);

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Print execution fault:", err);
      }
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }, 500);
  }
}

/**
 * Generates high-fidelity, standalone, printer-friendly HTML ledger for physical filing.
 */
export function generatePrintableHtml(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): string {
  const fileDate = new Date().toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fileTime = new Date().toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalCount = requisitions.length;
  const totalValue = requisitions.reduce((acc, r) => acc + r.amount, 0);
  const totalDisbursed = requisitions
    .filter((r) => r.status === "DISBURSED")
    .reduce((acc, r) => acc + r.amount, 0);
  const totalPending = requisitions
    .filter((r) => r.status === "SUBMITTED" || r.status === "APPROVED_L1")
    .reduce((acc, r) => acc + r.amount, 0);

  const tableRowsHtml = requisitions.map((req, index) => {
    const isMissingReceipt =
      req.status === "DISBURSED" && (!req.receipts || req.receipts.length === 0);
    const approvalsList = req.approvalHistory && req.approvalHistory.length > 0
      ? req.approvalHistory
          .map((a) => `${a.approverName} [${a.role.replace("APPROVER_", "L")}]`)
          .join(", ")
      : "None";

    return `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: bold;">${index + 1}</td>
        <td>
          <div style="font-weight: bold; color: #0f172a;">${req.title}</div>
          <div style="font-size: 8px; font-family: monospace; color: #64748b; margin-top: 2px;">
            REF: ${req.id.toUpperCase()}
          </div>
          ${
            req.description
              ? `<div style="font-size: 8.5px; color: #475569; margin-top: 4px; font-style: italic;">"${req.description}"</div>`
              : ""
          }
        </td>
        <td>
          <div style="font-weight: 500;">${req.requesterName}</div>
          <div style="font-size: 9px; color: #64748b;">${req.groupName}</div>
        </td>
        <td style="color: #475569;">${formatDate(req.submittedAt)}</td>
        <td style="font-size: 9.5px; color: #334155;">
          <div>${approvalsList}</div>
          ${
            req.rejectionReason
              ? `<div style="font-size: 8px; color: #dc2626; margin-top: 2px;">REJECT REASON: ${req.rejectionReason}</div>`
              : ""
          }
        </td>
        <td style="text-align: center;">
          <span class="status status-${req.status}">
            ${req.status.replace("_", " ")}
          </span>
          ${
            isMissingReceipt
              ? `<div style="font-size: 7.5px; font-weight: 800; color: #dc2626; margin-top: 4px; letter-spacing: 0.5px;">⚠️ R_MISSING</div>`
              : ""
          }
        </td>
        <td class="amount" style="font-weight: bold; font-family: monospace; text-align: right; color: #0f172a;">
          ${formatCurrency(req.amount)}
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>St. Andrews Church - Physical Requisitions Ledger</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1e293b;
      margin: 40px;
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      border-bottom: 3px double #334155;
      padding-bottom: 16px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      background-color: #4f46e5;
      color: #ffffff;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
    }
    .title-area {
      flex: 1;
    }
    .title {
      font-weight: 800;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0;
    }
    .subtitle {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #64748b;
      font-weight: 700;
      margin: 3px 0 0 0;
    }
    .meta-file-id {
      text-align: right;
      font-family: monospace;
      font-size: 9px;
      color: #64748b;
    }
    .meta-file-title {
      font-weight: 800;
      font-size: 12px;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    .meta-item {
      background-color: #f8fafc;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    .meta-label {
      font-weight: 700;
      font-size: 8px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 3px;
    }
    .meta-value {
      font-weight: 700;
      font-size: 12px;
      color: #1e293b;
    }
    .meta-mono {
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 30px;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      text-transform: uppercase;
      font-weight: 800;
      font-size: 8.5px;
      letter-spacing: 0.5px;
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      vertical-align: top;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .status {
      display: inline-block;
      font-weight: 800;
      font-size: 8px;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 3px;
      letter-spacing: 0.3px;
    }
    .status-SUBMITTED { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .status-APPROVED_L1 { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }
    .status-APPROVED_L2 { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .status-DISBURSED { background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; }
    .status-REJECTED { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .status-DRAFT { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .status-CANCELLED { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    .grand-total {
      text-align: right;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 800;
      color: #0d1527;
      margin-bottom: 50px;
    }
    .grand-total span {
      font-family: monospace;
      font-size: 14px;
      color: #059669;
    }
    .sign-section {
      margin-top: 60px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 30px;
      page-break-inside: avoid;
    }
    .sign-box {
      border-top: 1.5px solid #64748b;
      padding-top: 10px;
      text-align: center;
      font-size: 9.5px;
      color: #475569;
    }
    .sign-title {
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .system-log {
      margin-top: 50px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 12px;
      font-size: 8px;
      color: #94a3b8;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    @media print {
      body {
        margin: 15mm 10mm;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-logo">✝</div>
      <div class="title-area">
        <h1 class="title">St. Andrews Church</h1>
        <p class="subtitle">Official Fiscal Requisitions Register</p>
      </div>
    </div>
    <div class="meta-file-id">
      <div class="meta-file-title">PHYSICAL LEDGER DEPOSIT</div>
      <div>REF: REG-${Date.now().toString(36).toUpperCase()}</div>
      <div>COMPILED APPROVED SYSTEM FILE</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="meta-label">Ledger Target Title</div>
      <div class="meta-value">${reportTitle}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Operational Period / Query</div>
      <div class="meta-value" style="font-size: 11px;">${filterSummary}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Export Compiled By</div>
      <div class="meta-value">${currentUser?.name || "System Operator"}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Date Compiled</div>
      <div class="meta-value">${fileDate} <span style="font-size: 10px; opacity: 0.7;">${fileTime}</span></div>
    </div>
  </div>

  <div class="meta-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 25px;">
    <div class="meta-item" style="border-left: 3px solid #64748b;">
      <div class="meta-label">Total Transaction Count</div>
      <div class="meta-value meta-mono">${totalCount} entries</div>
    </div>
    <div class="meta-item" style="border-left: 3px solid #10b981;">
      <div class="meta-label">Disbursed Volume (KES)</div>
      <div class="meta-value meta-mono">${formatCurrency(totalDisbursed)}</div>
    </div>
    <div class="meta-item" style="border-left: 3px solid #f59e0b;">
      <div class="meta-label">Pending / Unreleased (KES)</div>
      <div class="meta-value meta-mono">${formatCurrency(totalPending)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 4%; text-align: center;">#</th>
        <th style="width: 38%;">Requisition Description & ID</th>
        <th style="width: 20%;">Requester & Group</th>
        <th style="width: 12%;">Submission Date</th>
        <th style="width: 16%;">Approval Ledger Checkpoints</th>
        <th style="width: 10%; text-align: center;">Filing Status</th>
        <th style="width: 12%; text-align: right;">Amount (KES)</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml || `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">No records found in selected scope view.</td></tr>`}
    </tbody>
  </table>

  <div class="grand-total">
    GRAND LEDGER VALUE IN QUERY: &nbsp;&nbsp;<span>${formatCurrency(totalValue)}</span>
  </div>

  <div class="sign-section">
    <div class="sign-box">
      <div class="sign-title">PREPARED & VERIFIED BY</div>
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 15px; color: #0f172a;">
        ${currentUser?.name || "System Admin"}
      </div>
      <div style="height: 1.5cm;"></div>
      <div>Clerk Signature & Stamp / Date</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">FINANCIAL CONTROLLER CHECK</div>
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 15px; color: #0f172a; opacity: 0.3;">
        ___________________________
      </div>
      <div style="height: 1.5cm;"></div>
      <div>Finance Secretary / Controller / Date</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">SENIOR MINISTER / VICAR ENDORSEMENT</div>
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 15px; color: #0f172a; opacity: 0.3;">
        ___________________________
      </div>
      <div style="height: 1.5cm;"></div>
      <div>Authorized Signee & Stamp / Date</div>
    </div>
  </div>

  <div class="system-log">
    ST. ANDREWS PARISH FISCAL v3 PROTOCOL • COMPILED AUDITED RECORD UNDER SYSTEM REFERENCE #${Date.now().toString(36).toUpperCase()} • PRINTED SECURELY ON ${fileDate} AT ${fileTime}
  </div>
</body>
</html>
  `;
}

/**
 * Focuses/prints the compiled HTML inside a hidden iframe to prevent popup blocks.
 */
export function printRequisitions(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): void {
  const html = generatePrintableHtml(requisitions, reportTitle, currentUser, filterSummary);

  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Standard print execution suffered a fault:", err);
      }
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }, 500);
  }
}

/**
 * Saves and triggers a download of the compiled HTML.
 */
export function downloadRequisitionsHtml(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): void {
  const html = generatePrintableHtml(requisitions, reportTitle, currentUser, filterSummary);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  link.download = `${safeName}_ledger_physical_filing_${Date.now()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Saves and triggers a download of the compiled CSV.
 */
export function downloadRequisitionsCsv(
  requisitions: Requisition[],
  reportTitle: string
): void {
  const headers = ["ID", "Title", "RequesterName", "GroupName", "Amount", "Status", "SubmittedAt", "Description"];
  
  const csvRows = [
    headers.join(","),
    ...requisitions.map((req) => {
      const id = `"${(req.id || "").replace(/"/g, '""')}"`;
      const title = `"${(req.title || "").replace(/"/g, '""')}"`;
      const name = `"${(req.requesterName || "").replace(/"/g, '""')}"`;
      const groupName = `"${(req.groupName || "").replace(/"/g, '""')}"`;
      const amount = req.amount;
      const status = `"${(req.status || "").replace(/"/g, '""')}"`;
      const submitted = req.submittedAt ? `"${new Date(req.submittedAt).toLocaleDateString()}"` : `""`;
      const desc = `"${(req.description || "").replace(/\r?\n|\r/g, " ").replace(/"/g, '""')}"`;
      
      return [id, title, name, groupName, amount, status, submitted, desc].join(",");
    })
  ].join("\n");

  const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  link.download = `${safeName}_ledger_${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Saves and triggers a download of the compiled PDF using jsPDF.
 */
export function downloadRequisitionsPdf(
  requisitions: Requisition[],
  reportTitle: string,
  currentUser: any,
  filterSummary = "All Listed Transactions"
): void {
  const doc = new jsPDF("landscape", "mm", "a4");

  // Document brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ST. ANDREWS DIOCESAN CATHEDRAL", 14, 15);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`FINANCIAL EXPENDITURE STATEMENT: ${reportTitle.toUpperCase()}`, 14, 21);
  doc.text(`Filters applied: ${filterSummary}`, 14, 26);
  doc.text(`Generated by: ${currentUser?.name || "System"} (${currentUser?.role || "Clergy Admin"}) on ${new Date().toLocaleDateString()}`, 14, 31);

  // Totals calculations
  const totalCount = requisitions.length;
  const totalValue = requisitions.reduce((acc, r) => acc + r.amount, 0);
  const totalDisbursed = requisitions
    .filter(r => r.status === "DISBURSED")
    .reduce((acc, r) => acc + r.amount, 0);
  const totalPending = requisitions
    .filter(r => r.status !== "DISBURSED" && r.status !== "REJECTED")
    .reduce((acc, r) => acc + r.amount, 0);

  doc.setFont("helvetica", "bold");
  doc.text(`Records: ${totalCount}  |  Total Sum: KES ${totalValue.toLocaleString()}  |  Settled: KES ${totalDisbursed.toLocaleString()}  |  Pending: KES ${totalPending.toLocaleString()}`, 14, 37);

  // Table rows mapping
  const headers = [["#", "Voucher ID", "Title / Technical Narrative", "Ministry Group / User", "Submitted On", "Ledger Status", "Amount (KES)"]];
  const tableRows = requisitions.map((req, i) => [
    i + 1,
    req.id.toUpperCase().substr(0, 10),
    `${req.title}\n${req.description || ""}`,
    `${req.groupName}\nBy: ${req.requesterName}`,
    req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : "N/A",
    req.status,
    req.amount.toLocaleString()
  ]);

  (doc as any).autoTable({
    startY: 42,
    head: headers,
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] }, // Slate 900
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 80 },
      3: { cellWidth: 60 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 35 }
    }
  });

  const safeName = reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  doc.save(`${safeName}_financial_ledger_${Date.now()}.pdf`);
}

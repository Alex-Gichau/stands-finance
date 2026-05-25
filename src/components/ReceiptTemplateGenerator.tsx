/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Requisition } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { Printer, Download, X, FileText, CheckCircle, Shield, Paperclip, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { useRequisitions } from "../contexts/RequisitionContext";

interface ReceiptTemplateGeneratorProps {
  req: Requisition;
  onClose: () => void;
}

export const ReceiptTemplateGenerator: React.FC<ReceiptTemplateGeneratorProps> = ({ req, onClose }) => {
  const { uploadReceipts, addSystemLog } = useRequisitions();
  const [isAttaching, setIsAttaching] = useState(false);
  const [attached, setAttached] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const printReceipt = () => {
    const html = generateReceiptHtml(req);
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
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  const downloadReceipt = () => {
    const html = generateReceiptHtml(req);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt_${req.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const attachToRequisition = async () => {
    if (!receiptRef.current) return;
    
    setIsAttaching(true);
    try {
      // Lazily import html2canvas to safeguard against iframe sandbox restrictions on initial application load
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;

      // Capture the receipt as an image
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2, // Higher quality
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });
      
      const imageData = canvas.toDataURL("image/png");
      
      // Attach to requisition
      await uploadReceipts(req.id, [imageData]);
      await addSystemLog("RECEIPT_ATTACHED", `Self-generated template receipt attached to Requisition ID: ${req.id}`);
      
      setAttached(true);
      setTimeout(() => setAttached(false), 3000);
    } catch (error) {
      console.error("Failed to attach receipt:", error);
      alert("Failed to attach receipt to ledger.");
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Receipt Template Generator</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Formal Expenditure Proof Protocol</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200 text-slate-400 hover:text-rose-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 bg-slate-100/50">
          {/* Scrollable Receipt Preview (Optimized exactly for A5 Portrait Sizing & Aspect Ratio) */}
          <div 
            ref={receiptRef}
            className="bg-white shadow-xl border border-slate-200 rounded-2xl p-8 w-full max-w-[440px] aspect-[148/210] min-h-[620px] mx-auto transform scale-95 origin-top mb-10 flex flex-col justify-between relative overflow-hidden select-none"
          >
            {/* Elegant, Subtle Watermark Vector Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none z-0">
              <svg viewBox="0 0 100 100" className="w-72 h-72 text-slate-900" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="50" cy="50" r="44" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx="50" cy="50" r="40" strokeWidth="1" />
                <line x1="22" y1="22" x2="78" y2="78" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="78" y1="22" x2="22" y2="78" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="50" y1="18" x2="50" y2="82" strokeWidth="3.5" />
                <line x1="32" y1="38" x2="68" y2="38" strokeWidth="3.5" />
                <circle cx="50" cy="38" r="8" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Receipt Content Container with elevated z-index */}
            <div className="relative z-10 flex flex-col justify-between h-full space-y-5">
              <div>
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-sm border border-slate-800">
                      ✝
                    </div>
                    <div className="space-y-0.5 animate-fade-in">
                      <h1 className="text-[14px] font-black uppercase text-slate-900 leading-none tracking-tight">St. Andrews</h1>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Expenditure Receipt</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Receipt #</div>
                    <div className="font-mono text-xs font-bold text-slate-900">#{req.id.toUpperCase()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-0.5">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Issued To</div>
                    <div className="text-[10px] font-bold text-slate-900 leading-snug">{req.requesterName}</div>
                    <div className="text-[8px] text-slate-500 uppercase font-black tracking-tight">{req.groupName}</div>
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</div>
                    <div className="text-[10px] font-bold text-slate-900 leading-snug">{formatDate(req.submittedAt)}</div>
                  </div>
                </div>

                <div className="border-b border-slate-100 mb-4">
                  <table className="w-full text-left border-collapse">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="pb-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                        <th className="pb-1 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 align-top">
                          <div className="text-[10px] font-bold text-slate-900 mb-1 truncate max-w-[210px]">{req.title}</div>
                          <div className="text-[8px] text-slate-500 leading-relaxed italic pr-2">"{req.description}"</div>
                        </td>
                        <td className="py-3 text-right align-top">
                          <div className="font-mono font-bold text-slate-900 text-[10px]">{formatCurrency(req.amount)}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-0.5 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Amount in Words</div>
                  <div className="text-[9px] font-bold text-slate-800 leading-tight uppercase font-serif">{req.amountWords}</div>
                </div>
              </div>

              <div className="pt-4 border-t border-dashed border-slate-200 mt-auto">
                <div className="flex justify-between items-end">
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle size={12} />
                      <span className="text-[8px] font-black uppercase tracking-widest">Authorized Digitally</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1 w-28">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Ministry Stamp</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-black text-slate-900 font-mono leading-none mb-0.5">{formatCurrency(req.amount)}</div>
                    <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Total Value Paid</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-10 py-8 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Template Preview Active</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={attachToRequisition}
              disabled={isAttaching || attached}
              className={cn(
                "px-6 py-3 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                attached 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                  : "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
              )}
            >
              {isAttaching ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </>
              ) : attached ? (
                <>
                  <CheckCircle size={16} />
                  Attached to Ledger
                </>
              ) : (
                <>
                  <Paperclip size={16} />
                  Attach to Requisition
                </>
              )}
            </button>
            <button 
              onClick={printReceipt}
              className="btn-primary px-8 py-3 flex items-center gap-2"
            >
              <Printer size={16} />
              Print
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};const generateReceiptHtml = (req: Requisition) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Receipt - ${req.id}</title>
  <style>
    @page {
      size: A5 portrait;
      margin: 10mm;
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .receipt {
      position: relative;
      width: 100%;
      max-width: 128mm; /* Designed for perfect fit inside A5 printable limits */
      margin: 0 auto;
      padding: 5px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      min-height: 180mm;
    }
    
    /* Elegant, Subtle Watermark SVG placement */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 260px;
      height: 260px;
      opacity: 0.035;
      pointer-events: none;
      z-index: 0;
    }
    
    .content-wrapper {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      height: 100%;
      justify-content: space-between;
    }

    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-logo {
      width: 30px;
      height: 30px;
      background: #0f172a;
      color: white;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 16px;
    }
    .church-info h1 {
      font-size: 14px;
      font-weight: 900;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .church-info p {
      font-size: 8px;
      font-weight: 900;
      color: #64748b;
      margin: 2px 0 0 0;
      text-transform: uppercase;
      letter-spacing: 1.2px;
    }
    .receipt-meta {
      text-align: right;
    }
    .meta-label {
      font-size: 8px;
      font-weight: 900;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .meta-value {
      font-family: monospace;
      font-weight: 700;
      font-size: 11px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 15px;
    }
    .info-item label {
      display: block;
      font-size: 8px;
      font-weight: 900;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .info-item div {
      font-size: 10px;
      font-weight: 700;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    th {
      border-bottom: 1.5px solid #0f172a;
      padding: 6px 0;
      font-size: 8px;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      text-align: left;
      letter-spacing: 1px;
    }
    td {
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .amount-words {
      background: #f8fafc;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      margin-bottom: 15px;
    }
    .amount-words label {
      display: block;
      font-size: 8px;
      font-weight: 900;
      color: #94a3b8;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .amount-words div {
      font-size: 9px;
      font-weight: 700;
      font-style: italic;
      text-transform: uppercase;
    }
    
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 15px;
      border-top: 1px dashed #cbd5e1;
      margin-top: auto;
    }
    .signature-area {
      border-top: 1px solid #cbd5e1;
      width: 110px;
      padding-top: 3px;
      margin-top: 15px;
      font-size: 7px;
      font-weight: 900;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grand-total {
      text-align: right;
    }
    .grand-total .val {
      font-size: 14px;
      font-weight: 900;
      font-family: monospace;
      margin-bottom: 1px;
    }
    .grand-total .lab {
      font-size: 7px;
      font-weight: 900;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    @media print {
      body {
        padding: 0;
        margin: 0;
        background: white;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .receipt {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 auto !important;
        width: 100% !important;
        max-width: 100% !important;
        height: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Inline SVG Watermark to prevent CORS exceptions and load instantaneously during rendering -->
    <div class="watermark">
      <svg viewBox="0 0 100 100" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="50" cy="50" r="44" stroke-width="1.5" stroke-dasharray="3 3"></circle>
        <circle cx="50" cy="50" r="40" stroke-width="1"></circle>
        <line x1="22" y1="22" x2="78" y2="78" stroke-width="1" stroke-dasharray="2 2"></line>
        <line x1="78" y1="22" x2="22" y2="78" stroke-width="1" stroke-dasharray="2 2"></line>
        <line x1="50" y1="18" x2="50" y2="82" stroke-width="3.5"></line>
        <line x1="32" y1="38" x2="68" y2="38" stroke-width="3.5"></line>
        <circle cx="50" cy="38" r="8" stroke-width="1.5"></circle>
      </svg>
    </div>

    <!-- Printable container with dynamic vertical sizing layout -->
    <div class="content-wrapper">
      <div>
        <div class="header">
          <div class="brand">
            <div class="brand-logo">✝</div>
            <div class="church-info">
              <h1>St. Andrews</h1>
              <p>Expenditure Receipt</p>
            </div>
          </div>
          <div class="receipt-meta">
            <label class="meta-label">Receipt #</label>
            <div class="meta-value">#${req.id.toUpperCase()}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <label>Issued To</label>
            <div>${req.requesterName}</div>
            <div style="color: #64748b; font-size: 8px; margin-top: 1px; text-transform: uppercase; font-weight: bold;">${req.groupName}</div>
          </div>
          <div class="info-item" style="text-align: right;">
            <label>Transaction Date</label>
            <div>${formatDate(req.submittedAt)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style="font-weight: 700; font-size: 10px; margin-bottom: 2px;">${req.title}</div>
                <div style="font-size: 8px; color: #64748b; font-style: italic;">"${req.description}"</div>
              </td>
              <td style="text-align: right; font-family: monospace; font-weight: 700; font-size: 10px;">
                ${formatCurrency(req.amount)}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="amount-words">
          <label>Amount in Words</label>
          <div>${req.amountWords}</div>
        </div>
      </div>

      <div class="footer">
        <div>
          <div style="color: #10b981; font-size: 7px; font-weight: 900; margin-bottom: 3px; display: flex; align-items: center; gap: 4px;">✓ AUTHORIZED DIGITALLY</div>
          <div class="signature-area">Ministry Stamp</div>
        </div>
        <div class="grand-total">
          <div class="val">${formatCurrency(req.amount)}</div>
          <div class="lab">Total Value Paid</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

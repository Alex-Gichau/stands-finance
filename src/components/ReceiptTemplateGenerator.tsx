/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Requisition } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { Printer, Download, X, FileText, CheckCircle, Shield, Paperclip, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import html2canvas from "html2canvas";
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
          {/* Scrollable Receipt Preview */}
          <div 
            ref={receiptRef}
            className="bg-white shadow-xl border border-slate-200 rounded-lg p-12 max-w-lg mx-auto transform scale-95 origin-top mb-10 min-h-[600px] flex flex-col"
          >
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
              <div className="space-y-1">
                <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-black text-xl mb-2">✝</div>
                <h1 className="text-xl font-black uppercase text-slate-900 leading-tight">St. Andrews Church</h1>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Official Expenditure Receipt</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt Number</div>
                <div className="font-mono text-sm font-bold text-slate-900">#{req.id.toUpperCase()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-10">
              <div className="space-y-1">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Issued To</div>
                <div className="text-[11px] font-bold text-slate-900">{req.requesterName}</div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">{req.groupName}</div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</div>
                <div className="text-[11px] font-bold text-slate-900">{formatDate(req.submittedAt)}</div>
              </div>
            </div>

            <div className="flex-1">
              <table className="w-full text-left mb-10 border-collapse">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                    <th className="py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-6 align-top">
                      <div className="text-[11px] font-bold text-slate-900 mb-2 truncate max-w-[250px]">{req.title}</div>
                      <div className="text-[9px] text-slate-500 leading-relaxed italic pr-4">"{req.description}"</div>
                    </td>
                    <td className="py-6 text-right align-top">
                      <div className="font-mono font-bold text-slate-900 text-[11px]">{formatCurrency(req.amount)}</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="space-y-1 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-10">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Amount in Words</div>
                <div className="text-[10px] font-bold text-slate-800 leading-tight uppercase font-serif">{req.amountWords}</div>
              </div>
            </div>

            <div className="mt-auto space-y-6 pt-10 border-t border-dashed border-slate-200">
               <div className="flex justify-between items-end">
                  <div className="space-y-4">
                     <div className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Authorized Digitally</span>
                     </div>
                     <div className="border-t border-slate-300 pt-1 w-32">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ministry Stamp</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <div className="text-[14px] font-black text-slate-900 font-mono mb-1">{formatCurrency(req.amount)}</div>
                     <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Value Paid</div>
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
};

const generateReceiptHtml = (req: Requisition) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Receipt - ${req.id}</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: white; }
    .receipt { max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 8px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
    .church-info h1 { font-size: 20px; font-weight: 900; margin: 0; text-transform: uppercase; }
    .church-info p { font-size: 8px; font-weight: 900; color: #64748b; margin: 3px 0; text-transform: uppercase; letter-spacing: 1px; }
    .receipt-meta { text-align: right; }
    .meta-label { font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
    .meta-value { font-family: monospace; font-weight: 700; font-size: 14px; }
    
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
    .info-item label { display: block; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
    .info-item div { font-size: 11px; font-weight: 700; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    th { border-bottom: 1px solid #e2e8f0; padding: 10px 0; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; text-align: left; }
    td { padding: 20px 0; border-bottom: 1px solid #f1f5f9; }
    
    .amount-words { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 40px; }
    .amount-words label { display: block; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px; }
    .amount-words div { font-size: 10px; font-weight: 700; font-style: italic; text-transform: uppercase; }
    
    .footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 30px; border-top: 1px dashed #cbd5e1; }
    .signature-area { border-top: 1px solid #cbd5e1; width: 120px; padding-top: 5px; margin-top: 30px; font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
    .grand-total { text-align: right; }
    .grand-total .val { font-size: 18px; font-weight: 900; font-family: monospace; margin-bottom: 2px; }
    .grand-total .lab { font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
    
    @media print {
      body { padding: 0; }
      .receipt { border: none; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="church-info">
        <h1>St. Andrews Church</h1>
        <p>Official Expenditure Receipt</p>
      </div>
      <div class="receipt-meta">
        <label class="meta-label">Receipt Number</label>
        <div class="meta-value">#${req.id.toUpperCase()}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-item">
        <label>Issued To</label>
        <div>${req.requesterName}</div>
        <div style="color: #64748b; font-size: 9px; margin-top: 2px;">${req.groupName}</div>
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
            <div style="font-weight: 700; font-size: 11px; margin-bottom: 4px;">${req.title}</div>
            <div style="font-size: 9px; color: #64748b; font-style: italic;">"${req.description}"</div>
          </td>
          <td style="text-align: right; font-family: monospace; font-weight: 700; font-size: 11px;">
            ${formatCurrency(req.amount)}
          </td>
        </tr>
      </tbody>
    </table>

    <div class="amount-words">
      <label>Amount in Words</label>
      <div>${req.amountWords}</div>
    </div>

    <div class="footer">
      <div>
        <div style="color: #10b981; font-size: 8px; font-weight: 900; margin-bottom: 5px; display: flex; align-items: center; gap: 4px;">✓ AUTHORIZED DIGITALLY</div>
        <div class="signature-area">Ministry Stamp & Signature</div>
      </div>
      <div class="grand-total">
        <div class="val">${formatCurrency(req.amount)}</div>
        <div class="lab">Total Value Paid</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
};

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
import { printRequisitionReceipt, downloadRequisitionsCsv, generateReceiptHtml } from "../utils/exportUtils";

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
    printRequisitionReceipt(req);
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
      // Lazily import dom-to-image-more to handle modern CSS like oklch better than html2canvas
      const domToImageModule = await import("dom-to-image-more");
      const domToImage = domToImageModule.default;

      // Capture the receipt as an image with high quality
      const imageData = await domToImage.toPng(receiptRef.current, {
        bgcolor: "#ffffff",
        quality: 1,
        width: receiptRef.current.offsetWidth * 2,
        height: receiptRef.current.offsetHeight * 2,
        style: {
          transform: "scale(2)",
          transformOrigin: "top left",
          width: receiptRef.current.offsetWidth + "px",
          height: receiptRef.current.offsetHeight + "px",
        }
      });
      
      // Attach to requisition
      await uploadReceipts(req.id, [imageData]);
      await addSystemLog("RECEIPT_ATTACHED", `Self-generated template receipt attached to Requisition ID: ${req.id}`, { requisitionId: req.id });
      
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-900/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-none md:rounded-[2.5rem] w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 flex flex-col"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 sticky top-0 z-10">
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
          {/* Scrollable Receipt Preview (Optimized for Printing) */}
          <div 
            ref={receiptRef}
            className="bg-white shadow-xl border border-slate-200 rounded-lg p-16 w-full max-w-[210mm] min-h-[297mm] mx-auto mb-10 flex flex-col justify-between relative overflow-hidden select-none print:shadow-none print:border-0 print:p-0 print:m-0"
          >
            {/* Elegant, Subtle Watermark Vector Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none z-0">
              <svg viewBox="0 0 100 100" className="w-[500px] h-[500px] text-slate-900" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
              <div>
                <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-3xl shadow-sm border border-slate-800">
                      ✝
                    </div>
                    <div className="space-y-1 animate-fade-in">
                      <h1 className="text-2xl font-black uppercase text-slate-900 leading-none tracking-tight">St. Andrews</h1>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Expenditure Receipt</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Receipt #</div>
                    <div className="font-mono text-xl font-bold text-slate-900">#{req.id.toUpperCase()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Issued To</div>
                    <div className="text-lg font-bold text-slate-900 leading-snug">{req.requesterName}</div>
                    <div className="text-xs text-slate-500 uppercase font-black tracking-tight">{req.groupName}</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Date</div>
                    <div className="text-lg font-bold text-slate-900 leading-snug">{formatDate(req.submittedAt)}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Fiscal Year</div>
                    <div className="text-sm font-bold text-slate-900 leading-snug">{req.fiscalYear || '2026'}</div>
                  </div>
                </div>

                <div className="border-b-2 border-slate-900 mb-8">
                  <table className="w-full text-left border-collapse">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className="pb-3 text-xs font-black text-slate-400 uppercase tracking-widest">Item Description</th>
                        <th className="pb-3 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-6 align-top">
                          <div className="text-lg font-bold text-slate-900 mb-2">{req.title}</div>
                          <div className="text-sm text-slate-600 leading-relaxed italic">"{req.description}"</div>
                          <div className="mt-4 text-[10px] uppercase font-black text-slate-400">Status: {req.status}</div>
                        </td>
                        <td className="py-6 text-right align-top">
                          <div className="font-mono font-bold text-slate-900 text-lg">{formatCurrency(req.amount)}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-2 bg-slate-50/80 p-6 rounded-2xl border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount in Words</div>
                  <div className="text-base font-bold text-slate-800 leading-tight uppercase font-serif">{req.amountWords}</div>
                </div>
              </div>

              <div className="pt-8 border-t-2 border-dashed border-slate-300 mt-auto">
                <div className="flex justify-between items-end">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle size={16} />
                      <span className="text-xs font-black uppercase tracking-widest">Authorized Digitally</span>
                    </div>
                    <div className="border-t-2 border-slate-300 pt-3 w-48">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ministry Stamp</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-900 font-mono leading-none mb-1">{formatCurrency(req.amount)}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Value Paid</div>
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
};

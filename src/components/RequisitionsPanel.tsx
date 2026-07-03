/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  X,
  Trash2, 
  Pencil,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Paperclip,
  Printer,
  Download,
  ArrowUpDown,
  History,
  ShieldCheck,
  CalendarDays,
  MoreVertical,
  Loader2,
  Repeat,
  FileText,
  ChevronDown,
  Users,
  Flag,
  TrendingUp,
  Check,
  User,
  FileSignature,
  Fingerprint,
  KeyRound,
  Coins,
  ArrowRight,
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Copy,
  Share2,
  Store
} from "lucide-react";
import { useRequisitions, getActiveFiscalYear } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, formatDate, cn, getDaysSinceSubmission } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { printRequisitions, downloadRequisitionsHtml, downloadRequisitionsCsv, downloadRequisitionsPdf, printRequisitionVoucher, printRequisitionReceipt } from "../utils/exportUtils";
import { NewRequisitionForm } from "./NewRequisitionForm";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";
import { EditRequisitionModal } from "./EditRequisitionModal";
import { ReceiptGallery } from "./ReceiptGallery";
import { CameraCapture } from "./CameraCapture";
import { ConfirmationModal } from "./ConfirmationModal";

const RichDocumentViewer = ({ 
  docProps 
}: { 
  docProps: { 
    name: string; 
    url: string; 
    ext: string; 
    isPdf: boolean; 
    isWord: boolean; 
    isLegacyWord: boolean;
    isExcel: boolean; 
    isLegacyExcel: boolean; 
    isCsv: boolean; 
    isText: boolean; 
  } 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textVal, setTextVal] = useState<string>("");
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [wordHtml, setWordHtml] = useState<string>("");
  const [excelSheets, setExcelSheets] = useState<{ [key: string]: any[][] }>({});
  const [excelTabs, setExcelTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const fetchAndParse = async () => {
      setLoading(true);
      setError(null);
      setTextVal("");
      setCsvRows([]);
      setWordHtml("");
      setExcelSheets({});
      setExcelTabs([]);
      setActiveTab("");

      try {
        const response = await fetch(docProps.url);
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        if (!isMounted) return;

        if (docProps.isText) {
          const decoder = new TextDecoder("utf-8");
          const text = decoder.decode(arrayBuffer);
          setTextVal(text);
        } else if (docProps.isCsv) {
          const decoder = new TextDecoder("utf-8");
          const text = decoder.decode(arrayBuffer);
          const rows = text.split(/\r?\n/).map(line => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          }).filter(r => r.some(cell => cell !== ""));
          setCsvRows(rows);
        } else if (docProps.isWord) {
          try {
            const mammoth = await import("mammoth");
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setWordHtml(result.value || "<p class='text-slate-450 italic'>This document is empty.</p>");
          } catch (mErr: any) {
            console.error("Mammoth DOCX parsing failed:", mErr);
            throw new Error("Word document conversion failed. The file format or content might be corrupted.");
          }
        } else if (docProps.isExcel) {
          try {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const sheets: { [key: string]: any[][] } = {};
            workbook.SheetNames.forEach(name => {
              const worksheet = workbook.Sheets[name];
              const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
              sheets[name] = json;
            });
            setExcelSheets(sheets);
            setExcelTabs(workbook.SheetNames);
            if (workbook.SheetNames.length > 0) {
              setActiveTab(workbook.SheetNames[0]);
            }
          } catch (xErr: any) {
            console.error("SheetJS Excel parsing failed:", xErr);
            throw new Error("Excel spreadsheet parsing failed. Please verify the spreadsheet integrity.");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Could not read this document format inside the browser.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (!docProps.isPdf) {
      fetchAndParse();
    }

    return () => {
      isMounted = false;
    };
  }, [docProps.url, docProps.name, docProps.ext]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 select-none">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-xs font-bold tracking-widest uppercase text-indigo-400 font-mono">Parsing Document...</p>
        <p className="text-[10px] text-slate-500 mt-1">Extracting browser-compatible structured nodes for rendering.</p>
      </div>
    );
  }

  // Error/Fallback view
  if (error || docProps.isLegacyWord || docProps.isLegacyExcel) {
    const displayMsg = error || (docProps.isLegacyWord 
      ? "Legacy Word Binary (.doc) files are not natively viewable. Try converting this file to .docx or download it directly to view." 
      : "Legacy Excel Binary (.xls) files are not natively viewable. Try converting this spreadsheet to .xlsx or download it directly.");
    return (
      <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md shadow-2xl">
        <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-slate-500 mx-auto mb-4 border border-slate-800 shadow-inner">
          <AlertTriangle size={32} className="text-amber-500" />
        </div>
        <h4 className="text-xs font-black uppercase tracking-widest text-slate-300">Detailed Viewer Warning</h4>
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
          {displayMsg}
        </p>
        <button
          onClick={() => {
            const link = document.createElement("a");
            link.href = docProps.url;
            link.download = docProps.name;
            link.click();
          }}
          className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-indigo-950 flex items-center gap-2 mx-auto border-transparent border"
        >
          <Download size={14} />
          Download {docProps.ext} File
        </button>
      </div>
    );
  }

  // Text / MD Documents
  if (docProps.isText) {
    return (
      <div className="w-[80vw] max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[50vh] md:h-[58vh] shadow-2xl">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider shrink-0 select-none">
          <span>Plain Text Reader ({docProps.ext})</span>
          <span>{textVal.split(/\r?\n/).length} lines parsed</span>
        </div>
        <div className="flex-1 overflow-auto p-6 text-left font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text selection:bg-indigo-500/30">
          {textVal || <span className="text-slate-500 italic">Empty text document</span>}
        </div>
      </div>
    );
  }

  // CSV Documents
  if (docProps.isCsv) {
    return (
      <div className="w-[80vw] max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[50vh] md:h-[58vh] shadow-2xl">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider shrink-0 select-none">
          <span>Responsive CSV table reader</span>
          <span>{csvRows.length} rows x {csvRows[0]?.length || 0} columns</span>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {csvRows.length > 0 ? (
            <table className="min-w-full text-xs text-left border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/65 font-semibold text-slate-300 font-mono">
                  <th className="p-2 border-r border-slate-800 text-slate-500 text-[10px] text-center w-8 bg-slate-950">#</th>
                  {csvRows[0].map((_, cIdx) => (
                    <th key={`csv-th-${cIdx}`} className="p-2.5 border-r border-slate-800 text-slate-200">
                      {String.fromCharCode(65 + (cIdx % 26))}{cIdx >= 26 ? Math.floor(cIdx / 26) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row, rIdx) => (
                  <tr key={`csv-tr-${rIdx}`} className="border-b border-slate-800 hover:bg-slate-900/40 group">
                    <td className="p-2 border-r border-slate-800 text-slate-500 text-[10px] font-mono text-center select-none w-8 bg-slate-950">
                      {rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => (
                      <td key={`csv-td-${rIdx}-${cIdx}`} className="p-2.5 border-r border-slate-850 text-slate-300 font-medium whitespace-pre">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-center text-slate-500 py-10 italic">No spreadsheet records found</p>
          )}
        </div>
      </div>
    );
  }

  // Excel Documents (.xlsx)
  if (docProps.isExcel) {
    const currentSheetData = excelSheets[activeTab] || [];
    return (
      <div className="w-[80vw] max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-[50vh] md:h-[58vh] shadow-2xl">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-[10px] font-mono font-bold text-emerald-400 tracking-wider shrink-0 select-none">
          <span>Excel Workbook ({docProps.ext})</span>
          <span>{currentSheetData.length} active rows shown</span>
        </div>
        
        <div className="flex-1 overflow-auto p-2 bg-slate-950">
          {currentSheetData.length > 0 ? (
            <table className="min-w-full text-xs text-left border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 font-semibold text-slate-300 font-mono">
                  <th className="p-2 border-r border-slate-800 text-slate-500 text-[10px] text-center w-8 bg-slate-950">#</th>
                  {Array.from({ length: Math.max(...currentSheetData.map(r => r.length), 1) }).map((_, cIdx) => (
                    <th key={`xls-th-${cIdx}`} className="p-2.5 border-r border-slate-800 text-slate-200">
                      {String.fromCharCode(65 + (cIdx % 26))}{cIdx >= 26 ? Math.floor(cIdx / 26) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentSheetData.map((row, rIdx) => (
                  <tr key={`xls-tr-${rIdx}`} className="border-b border-slate-800 hover:bg-slate-900/40 group">
                    <td className="p-2 border-r border-slate-800 text-slate-500 text-[10px] font-mono text-center select-none w-8 bg-slate-950">
                      {rIdx + 1}
                    </td>
                    {Array.from({ length: Math.max(...currentSheetData.map(r => r?.length || 0), 1) }).map((_, cIdx) => {
                      const val = row[cIdx];
                      return (
                        <td key={`xls-td-${rIdx}-${cIdx}`} className="p-2.5 border-r border-slate-850 text-slate-300 font-medium whitespace-pre">
                          {val !== undefined && val !== null ? String(val) : ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-10">
              <span className="italic mb-2">No structured rows found in spreadsheet sheet "{activeTab}"</span>
              <span className="text-[10px] text-slate-600">The page might contain drawings or custom formula nodes.</span>
            </div>
          )}
        </div>

        {excelTabs.length > 1 && (
          <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center gap-1.5 shrink-0 select-none overflow-x-auto no-scrollbar">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-2 font-mono">Sheets:</span>
            {excelTabs.map(tab => (
              <button
                key={`tab-btn-${tab}`}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                  activeTab === tab
                    ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 shadow-md font-bold"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-slate-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Word Documents (.docx)
  if (docProps.isWord) {
    return (
      <div className="w-[80vw] max-w-3xl bg-white text-slate-800 border border-slate-300 rounded-2xl overflow-hidden flex flex-col h-[50vh] md:h-[58vh] shadow-2xl">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider shrink-0 select-none">
          <span>Microsoft Word Preview (DOCX Document)</span>
          <span>Formatted Page layout</span>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
          <div className="w-full max-w-[800px] bg-white shadow-lg border border-slate-200 p-10 md:p-14 text-left rounded-lg text-sm font-serif leading-relaxed text-slate-800 break-words select-text selection:bg-indigo-500/20 antialiased overflow-wrap-break-word">
            <style dangerouslySetInnerHTML={{ __html: `
              .word-doc-content h1 { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; font-size: 1.8em; font-weight: bold; margin-top: 1em; margin-bottom: 0.5em; color: #111827; line-height: 1.25; }
              .word-doc-content h2 { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; font-size: 1.4em; font-weight: bold; margin-top: 0.8em; margin-bottom: 0.4em; color: #1f2937; line-height: 1.3; }
              .word-doc-content h3 { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; font-size: 1.15em; font-weight: bold; margin-top: 0.6em; margin-bottom: 0.3em; color: #374151; }
              .word-doc-content p { margin-bottom: 0.8em; line-height: 1.6; text-align: justify; }
              .word-doc-content table { border-collapse: collapse; width: 100%; margin: 1.25em 0; font-size: 0.9em; font-family: ui-sans-serif, system-ui, sans-serif; }
              .word-doc-content th { background-color: #f3f4f6; font-weight: bold; padding: 8px 10px; border: 1px solid #d1d5db; text-align: left; }
              .word-doc-content td { padding: 8px 10px; border: 1px solid #e5e7eb; }
              .word-doc-content ul { list-style-type: disc; margin-left: 1.5em; margin-bottom: 0.8em; }
              .word-doc-content ol { list-style-type: decimal; margin-left: 1.5em; margin-bottom: 0.8em; }
              .word-doc-content li { margin-bottom: 0.3em; }
              .word-doc-content blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; color: #6b7280; font-style: italic; margin-bottom: 0.8em; }
            `}} />
            <div className="word-doc-content" dangerouslySetInnerHTML={{ __html: wordHtml }} />
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md shadow-2xl">
      <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center text-slate-500 mx-auto mb-4 border border-slate-800 shadow-inner">
        <FileText size={32} />
      </div>
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-300 font-mono">Unsupported Document View</h4>
      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
        This format ({docProps.ext}) cannot be directly parsed inside the browser sandboxed iframe. Please download to view normally.
      </p>
      <button
        onClick={() => {
          const link = document.createElement("a");
          link.href = docProps.url;
          link.download = docProps.name;
          link.click();
        }}
        className="mt-5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-indigo-950 flex items-center gap-2 mx-auto border-transparent border"
      >
        <Download size={14} />
        Download {docProps.ext}
      </button>
    </div>
  );
};

const DocumentPreviewModal = ({ 
  attachments: rawAttachments = [], 
  initialIndex = 0, 
  onClose 
}: { 
  attachments: string[]; 
  initialIndex: number; 
  onClose: () => void;
}) => {
  const attachments = Array.isArray(rawAttachments) 
    ? rawAttachments 
    : (typeof rawAttachments === "string" && rawAttachments ? [rawAttachments] : []);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [viewMode, setViewMode] = useState<"detail" | "grid">("detail");
  const [zoomScale, setZoomScale] = useState(1);

  // Swipe support states
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  const handleNext = () => {
    if (attachments.length <= 1) return;
    setZoomScale(1);
    setCurrentIndex((prev) => (prev + 1) % attachments.length);
  };

  const handlePrev = () => {
    if (attachments.length <= 1) return;
    setZoomScale(1);
    setCurrentIndex((prev) => (prev - 1 + attachments.length) % attachments.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (viewMode === "detail") {
        if (e.key === "ArrowRight") {
          handleNext();
        } else if (e.key === "ArrowLeft") {
          handlePrev();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, attachments, viewMode]);

  if (!attachments || attachments.length === 0) return null;

  // Helper to parse individual doc properties
  const getDocProps = (doc: any) => {
    if (!doc) return { 
      name: "Unknown", 
      url: "", 
      ext: "DOC", 
      isImage: false, 
      isPdf: false, 
      isWord: false, 
      isLegacyWord: false, 
      isExcel: false, 
      isLegacyExcel: false, 
      isCsv: false, 
      isText: false 
    };
    
    let dName = "";
    let dUrl = "";
    
    if (typeof doc === "string") {
      dName = doc;
      dUrl = doc;
      if (doc.includes("::")) {
        const parts = doc.split("::");
        dName = parts[0];
        dUrl = parts[1];
      } else if (doc.toLowerCase().includes("simulated") || !/^(https?:\/\/|data:|blob:|\/)/i.test(doc)) {
        // If it's a simulated file or has no valid URL scheme, generate a beautiful simulated HTML preview
        dName = doc;
        const htmlContent = `
          <html>
            <head>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                  background-color: #0f172a;
                  color: #cbd5e1;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  margin: 0;
                  padding: 24px;
                  box-sizing: border-box;
                  text-align: center;
                }
                .card {
                  background: #1e293b;
                  border: 1px solid #334155;
                  border-radius: 16px;
                  padding: 32px;
                  max-width: 480px;
                  box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
                }
                .icon {
                  font-size: 48px;
                  margin-bottom: 16px;
                }
                h2 {
                  font-size: 18px;
                  font-weight: 700;
                  margin: 0 0 8px 0;
                  text-transform: uppercase;
                  letter-spacing: 0.05em;
                  color: #f1f5f9;
                }
                p {
                  font-size: 13px;
                  color: #94a3b8;
                  line-height: 1.5;
                  margin: 0 0 20px 0;
                }
                .badge {
                  background: rgba(99, 102, 241, 0.15);
                  border: 1px solid rgba(99, 102, 241, 0.3);
                  color: #818cf8;
                  padding: 6px 12px;
                  border-radius: 8px;
                  font-size: 11px;
                  font-weight: 600;
                  word-break: break-all;
                  display: inline-block;
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">📄</div>
                <h2>Simulated Attachment</h2>
                <p>This is a simulated secure preview of the requisition document attachment:</p>
                <div class="badge">${dName.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              </div>
            </body>
          </html>
        `;
        try {
          const base64Html = btoa(unescape(encodeURIComponent(htmlContent)));
          dUrl = `data:text/html;base64,${base64Html}`;
        } catch (e) {
          dUrl = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
        }
      }
    } else if (typeof doc === "object") {
      dName = doc.name || doc.title || "Attachment";
      dUrl = doc.url || doc.link || "";
    } else {
      dName = String(doc);
      dUrl = String(doc);
    }
    
    let filenameNoSim = dName.replace(" (Simulated)", "");

    // If filename is just a URL, try to extract a plausible filename from it
    if (filenameNoSim.startsWith("http") || filenameNoSim.startsWith("/")) {
      const urlParts = filenameNoSim.split("/");
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart.includes(".")) {
        filenameNoSim = lastPart.split("?")[0].split("#")[0];
      }
    }

    // Detect and rewrite Google Drive URLs to utilize our server-side secure proxy
    if (dUrl.includes("drive.google.com")) {
      const driveMatch = dUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || dUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        const fileId = driveMatch[1];
        dUrl = `/api/attachments/${fileId}`;
      }
    }

    const ext = filenameNoSim.split('.').pop()?.toUpperCase() || "DOC";
    
    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(filenameNoSim) || dUrl.startsWith('blob:') || dUrl.startsWith('data:image/');
    const isPf = /\.(pdf)$/i.test(filenameNoSim) || dUrl.startsWith('data:application/pdf') || dUrl.startsWith('data:text/html') || dUrl.includes('/api/attachments/'); // Fallback for proxied PDFs
    const isWord = /\.(docx)$/i.test(filenameNoSim) || dUrl.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const isLegacyWord = /\.(doc)$/i.test(filenameNoSim) || dUrl.startsWith('data:application/msword');
    const isExcel = /\.(xlsx)$/i.test(filenameNoSim) || dUrl.startsWith('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const isLegacyExcel = /\.(xls)$/i.test(filenameNoSim) || dUrl.startsWith('data:application/vnd.ms-excel');
    const isCsv = /\.(csv)$/i.test(filenameNoSim) || dUrl.startsWith('data:text/csv');
    const isText = /\.(txt|md|json|xml|log|yaml|yml|js|ts|html|css)$/i.test(filenameNoSim) || dUrl.startsWith('data:text/plain');
    
    return { 
      name: filenameNoSim, 
      url: dUrl, 
      isImage: isImg, 
      isPdf: isPf, 
      isWord, 
      isLegacyWord,
      isExcel, 
      isLegacyExcel,
      isCsv, 
      isText, 
      ext 
    };
  };

  const currentProps = getDocProps(attachments[currentIndex]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-6 bg-slate-950/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-905 w-full h-full max-w-6xl shadow-2xl overflow-hidden border border-slate-800 flex flex-col relative text-slate-100 md:rounded-3xl bg-slate-900"
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/50 sticky top-0 z-10 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/10 shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">
                  FILE {currentIndex + 1} OF {attachments.length}
                </span>
                {currentProps.isImage && (
                  <span className="text-[9px] bg-indigo-500/25 text-indigo-300 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">
                    IMAGE
                  </span>
                )}
                {currentProps.isPdf && (
                  <span className="text-[9px] bg-emerald-500/25 text-emerald-300 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">
                    PDF
                  </span>
                )}
                {currentProps.isWord && (
                  <span className="text-[9px] bg-sky-500/25 text-sky-300 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">
                    WORD DOC
                  </span>
                )}
                {currentProps.isExcel && (
                  <span className="text-[9px] bg-teal-500/25 text-teal-300 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">
                    SPREADSHEET
                  </span>
                )}
                {currentProps.isCsv && (
                  <span className="text-[9px] bg-amber-500/25 text-amber-300 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">
                    CSV TABLE
                  </span>
                )}
                {currentProps.isText && (
                  <span className="text-[9px] bg-purple-500/25 text-purple-300 font-bold px-1.5 py-0.5 rounded-full font-mono uppercase">
                    TEXT FILE
                  </span>
                )}
              </div>
              <h3 className="text-xs md:text-sm font-bold text-slate-200 truncate max-w-[200px] sm:max-w-md md:max-w-xl mt-0.5">
                {currentProps.name}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Toggle Grid/Detail mode */}
            <button
              onClick={() => setViewMode(prev => prev === "detail" ? "grid" : "detail")}
              className={`p-2.5 rounded-xl transition-colors cursor-pointer border ${
                viewMode === "grid" 
                  ? "bg-indigo-600 border-indigo-500 text-white" 
                  : "bg-slate-850 border-slate-700 text-slate-300 hover:bg-slate-705 hover:text-white"
              }`}
              title={viewMode === "detail" ? "Switch to Thumbnail Grid" : "Back to Detail View"}
            >
              <LayoutGrid size={18} />
            </button>

            {/* Zoom Controls for Images */}
            {viewMode === "detail" && currentProps.isImage && (
              <div className="hidden sm:flex items-center bg-slate-850 border border-slate-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setZoomScale(z => Math.max(z - 0.25, 0.5))}
                  disabled={zoomScale <= 0.5}
                  className="p-2.5 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="px-2 text-[10px] font-black font-mono text-slate-400 w-12 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale(z => Math.min(z + 0.25, 3))}
                  disabled={zoomScale >= 3}
                  className="p-2.5 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            )}

            {/* Download Button */}
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = currentProps.url;
                link.download = currentProps.name;
                link.click();
              }}
              className="p-2.5 bg-slate-850 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
              title="Download Document"
            >
              <Download size={18} />
            </button>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="p-2.5 bg-slate-850 border border-slate-700 hover:bg-rose-950/40 hover:border-rose-800 hover:text-rose-400 rounded-xl text-slate-300 transition-colors cursor-pointer"
              title="Close Gallery"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {viewMode === "grid" ? (
          /* GRID MODE */
          <div className="flex-1 overflow-y-auto p-8 bg-slate-950/35">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-widest font-sans">
                  Attachment Catalog ({attachments.length} files)
                </h4>
                <p className="text-xs text-slate-500 mt-1">Select an attachment below to inspect its contents in full resolution.</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {attachments.map((attachment, idx) => {
                  const props = getDocProps(attachment);
                  const isCur = idx === currentIndex;
                  return (
                    <motion.div
                      key={`grid-doc-${idx}`}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setViewMode("detail");
                      }}
                      className={`cursor-pointer rounded-2xl border transition-all overflow-hidden flex flex-col h-36 relative group shadow-lg ${
                        isCur 
                          ? "border-indigo-500/80 bg-indigo-950/20 shadow-indigo-950/40 shadow-xl"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/80"
                      }`}
                    >
                      {/* Image Preview / File Icon */}
                      <div className="flex-1 bg-slate-950/30 flex items-center justify-center overflow-hidden relative">
                        {props.isImage ? (
                          <img 
                            src={props.url} 
                            alt={props.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors">
                              <FileText size={32} />
                            </span>
                          </div>
                        )}
                        {/* Overlay with document indicator */}
                        <div className="absolute top-2 right-2 flex gap-1">
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-950/80 text-slate-300 border border-slate-800/60 font-mono">
                            {props.ext}
                          </span>
                        </div>
                      </div>

                      {/* Footer Title */}
                      <div className="p-3 bg-slate-950/60 border-t border-slate-800/50 flex flex-col justify-center">
                        <p className={`text-[11px] font-semibold truncate ${
                          isCur ? "text-indigo-300" : "text-slate-300 group-hover:text-white"
                        }`}>
                          {props.name}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5 font-medium">Click to examine</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* DETAIL VIEWER MODE */
          <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-950/50">
            {/* Prev/Next Buttons */}
            {attachments.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-white rounded-full flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:scale-110 shadow-lg cursor-pointer shrink-0 animate-pulse-subtle"
                  title="Previous Attachment"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-25 w-11 h-11 bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-white rounded-full flex items-center justify-center transition-all opacity-80 hover:opacity-100 hover:scale-110 shadow-lg cursor-pointer shrink-0 animate-pulse-subtle"
                  title="Next Attachment"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}

            {/* Slide Container (Viewport) */}
            <div 
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center min-h-[350px] relative"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={`preview-${currentIndex}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  style={{ transform: `scale(${zoomScale})` }}
                  className="max-w-full max-h-full flex items-center justify-center transition-transform duration-200"
                >
                  {currentProps.isImage ? (
                    <img 
                      src={currentProps.url} 
                      alt={currentProps.name} 
                      className="max-w-[85vw] max-h-[50vh] md:max-h-[58vh] object-contain rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-800"
                      referrerPolicy="no-referrer"
                    />
                  ) : currentProps.isPdf ? (
                    <iframe 
                      src={currentProps.url} 
                      className="w-[80vw] h-[50vh] md:h-[58vh] max-w-4xl rounded-xl shadow-2xl bg-white border border-slate-800"
                      title={currentProps.name}
                    />
                  ) : (
                    <RichDocumentViewer docProps={currentProps} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Gallery/Thumbnail Strip */}
            {attachments.length > 1 && (
              <div className="w-full bg-slate-950/80 border-t border-slate-800/80 p-4 sticky bottom-0 z-10 flex items-center justify-center gap-3 select-none">
                <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full no-scrollbar">
                  {attachments.map((attachment, idx) => {
                    const props = getDocProps(attachment);
                    const isCur = idx === currentIndex;
                    return (
                      <div 
                        key={`strip-doc-${idx}`} 
                        onClick={() => {
                          setZoomScale(1);
                          setCurrentIndex(idx);
                        }}
                        className={`w-12 h-12 rounded-lg cursor-pointer overflow-hidden border-2 shrink-0 transition-all ${
                          isCur 
                            ? "border-indigo-500 scale-105 shadow-md shadow-indigo-500/20" 
                            : "border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700"
                        }`}
                      >
                        {props.isImage ? (
                          <img 
                            src={props.url} 
                            alt={props.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
                            <FileText size={14} className="text-slate-500" />
                            <span className="text-[7px] font-black text-slate-400 font-mono scale-90">
                              {props.ext}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer info bar */}
        <div className="px-6 py-4.5 bg-slate-950 border-t border-slate-800 text-slate-400 flex items-center justify-between select-none">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {viewMode === "grid" ? "GRID VIEWING CATALOG" : `CURRENTLY VIEWING DETAIL FILE - ${currentIndex + 1} OF ${attachments.length}`}
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
              Secure Cloud Sandbox Verified
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() 
          ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-px px-px font-bold underline decoration-amber-500/30 decoration-2">{part}</mark> 
          : part
      )}
    </>
  );
};

export const RequisitionsPanel: React.FC = () => {
  const { 
    requisitions, 
    projects,
    deleteRequisition, 
    currentUser, 
    globalSearchTerm, 
    setGlobalSearchTerm,
    searchFilter,
    canPerform,
    loading,
    systemSettings,
    advancedSearchActive,
    advancedDateRangePreset,
    advancedCustomStartDate,
    advancedCustomEndDate,
    advancedBudgetLine,
    triggerToast
  } = useRequisitions();

  const handleCopyShareLinkForReq = async (req: Requisition) => {
    const rawUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${rawUrl}?reqId=${req.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Direct shareable link for Requisition "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy share link: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy shareable link to clipboard.",
        timestamp: new Date().toISOString()
      });
    }
  };

  // Budget logic
  const activeYear = getActiveFiscalYear();
  const projectSummaries = projects.filter(p => p.fiscalYear === activeYear || (!p.fiscalYear && activeYear === activeYear)).map(proj => {
    const reqs = requisitions.filter(r => 
      r.groupName === proj.groupId && 
      (r.fiscalYear === activeYear || (!r.fiscalYear && activeYear === activeYear))
    );
    const usedAmount = reqs
      .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
      .reduce((sum, r) => sum + r.amount, 0);
    const spentAmount = reqs
      .filter(r => r.status === RequisitionStatus.DISBURSED)
      .reduce((sum, r) => sum + r.amount, 0);

    return {
      ...proj,
      usedAmount,
      spentAmount,
      percentage: proj.allocatedBudget > 0 ? (usedAmount / proj.allocatedBudget) * 100 : 0
    };
  }).sort((a,b) => b.percentage - a.percentage);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingReq, setViewingReq] = useState<Requisition | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPreset, setFilterPreset] = useState<"ALL" | "URGENT" | "FLAGGED" | "OVERDUE" | "L1_APPROVED">("ALL");
  const [dateRangePreset, setDateRangePreset] = useState<"ALL" | "WEEK" | "MONTH" | "CUSTOM">("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  const [editingReq, setEditingReq] = useState<Requisition | null>(null);
  const [requisitionToDelete, setRequisitionToDelete] = useState<Requisition | null>(null);
  const [now, setNow] = useState(Date.now());
  
  // Trending Searches Logic
  const [trendingSearches, setTrendingSearches] = useState<{term: string, count: number}[]>([]);
  const [showTrending, setShowTrending] = useState(false);

  useEffect(() => {
    // Load trending from localStorage on mount
    const saved = localStorage.getItem('trending_requisition_searches');
    if (saved) {
      try {
        setTrendingSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse trending searches", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!globalSearchTerm || globalSearchTerm.length < 3) return;

    const timer = setTimeout(() => {
      setTrendingSearches(prev => {
        const term = globalSearchTerm.trim().toLowerCase();
        const existing = prev.find(t => t.term === term);
        let updated;
        if (existing) {
          updated = prev.map(t => t.term === term ? { ...t, count: t.count + 1 } : t);
        } else {
          updated = [...prev, { term, count: 1 }];
        }
        
        const sorted = updated.sort((a, b) => b.count - a.count).slice(0, 5);
        localStorage.setItem('trending_requisition_searches', JSON.stringify(sorted));
        return sorted;
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [globalSearchTerm]);

  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [disbursedPage, setDisbursedPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const ITEMS_PER_PAGE = 15;

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const projectMap = useMemo(() => {
    const map = new Map<string, typeof projects[0]>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const filtered = requisitions.filter(req => {
    const term = globalSearchTerm.toLowerCase();
    
    let matchesSearch = false;
    if (!term) {
      matchesSearch = true;
    } else {
      const inTitle = req.title.toLowerCase().includes(term);
      const inGroup = req.groupName.toLowerCase().includes(term);
      const inRequester = req.requesterName?.toLowerCase().includes(term);
      const inId = req.id.toLowerCase().includes(term);

      if (searchFilter === "ALL") {
        matchesSearch = inTitle || inGroup || inRequester || inId;
      } else if (searchFilter === "TITLE") {
        matchesSearch = inTitle;
      } else if (searchFilter === "GROUP") {
        matchesSearch = inGroup;
      } else if (searchFilter === "REQUESTER") {
        matchesSearch = inRequester;
      }
    }

    const matchesStatus = filterStatus === "ALL" || req.status === filterStatus;
    
    const matchesDateRange = () => {
      const activePreset = advancedSearchActive ? advancedDateRangePreset : dateRangePreset;
      const activeStart = advancedSearchActive ? advancedCustomStartDate : customStartDate;
      const activeEnd = advancedSearchActive ? advancedCustomEndDate : customEndDate;

      if (activePreset === "ALL") return true;
      const submittedTime = req.submittedAt ? new Date(req.submittedAt).getTime() : (req.updatedAt ? new Date(req.updatedAt).getTime() : 0);
      const nowTime = Date.now();
      
      if (activePreset === "WEEK") {
        const oneWeekAgo = nowTime - 7 * 24 * 60 * 60 * 1000;
        return submittedTime >= oneWeekAgo;
      }
      if (activePreset === "MONTH") {
        const oneMonthAgo = nowTime - 30 * 24 * 60 * 60 * 1000;
        return submittedTime >= oneMonthAgo;
      }
      if (activePreset === "CUSTOM") {
        let matches = true;
        if (activeStart) {
          const start = new Date(activeStart + "T00:00:00").getTime();
          matches = matches && submittedTime >= start;
        }
        if (activeEnd) {
          const end = new Date(activeEnd + "T23:59:59").getTime();
          matches = matches && submittedTime <= end;
        }
        return matches;
      }
      return true;
    };

    const matchesPreset = () => {
      if (filterPreset === "ALL") return true;
      if (filterPreset === "FLAGGED") return req.flaggedForAudit === true;
      if (filterPreset === "L1_APPROVED") return req.status === RequisitionStatus.APPROVED_L1;
      if (filterPreset === "OVERDUE") {
        const days = Math.ceil(Math.abs(Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
        return days > 3 && (req.status === RequisitionStatus.SUBMITTED || req.status === RequisitionStatus.APPROVED_L1);
      }
      if (filterPreset === "URGENT") {
        const hoursRemaining = req.expiresAt ? (new Date(req.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60) : null;
        return (hoursRemaining !== null && hoursRemaining < 48 && hoursRemaining > 0) || req.amount > 20000;
      }
      return true;
    };

    const matchesBudgetLine = () => {
      if (!advancedSearchActive || advancedBudgetLine === "ALL" || !advancedBudgetLine.trim()) return true;
      const budgetLineLower = advancedBudgetLine.toLowerCase();
      const inGroupName = req.groupName.toLowerCase().includes(budgetLineLower);
      const inGroupId = req.groupId?.toLowerCase().includes(budgetLineLower);
      const project = req.projectId ? projectMap.get(req.projectId) : undefined;
      const inProjectName = project ? project.name.toLowerCase().includes(budgetLineLower) : false;
      const inProjectId = req.projectId?.toLowerCase().includes(budgetLineLower);
      return inGroupName || inGroupId || inProjectName || inProjectId;
    };

    const canSee = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN || req.groupId === currentUser?.group;
    
    return matchesSearch && matchesStatus && matchesDateRange() && matchesPreset() && matchesBudgetLine() && canSee;
  }).sort((a, b) => {
    // Priority: submittedAt, then updatedAt, then 0
    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
    return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
  });

  // Split into active and disbursed
  const activeList = filtered.filter(r => r.status !== RequisitionStatus.DISBURSED);
  const disbursedList = filtered.filter(r => r.status === RequisitionStatus.DISBURSED);

  // Paginated slices
  const activeItems = activeList.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const disbursedItems = disbursedList.slice((disbursedPage - 1) * ITEMS_PER_PAGE, disbursedPage * ITEMS_PER_PAGE);

  const activeTotalPages = Math.max(1, Math.ceil(activeList.length / ITEMS_PER_PAGE));
  const disbursedTotalPages = Math.max(1, Math.ceil(disbursedList.length / ITEMS_PER_PAGE));

  // Reset pages when filters change
  React.useEffect(() => {
    setActivePage(1);
    setDisbursedPage(1);
  }, [globalSearchTerm, filterStatus, dateRangePreset, customStartDate, customEndDate]);

  const Pagination = ({ current, total, onChange }: { current: number, total: number, onChange: (p: number) => void }) => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 sm:px-6">
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => onChange(Math.max(1, current - 1))}
          disabled={current === 1}
          className="relative inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(Math.min(total, current + 1))}
          disabled={current === total}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-slate-900">{Math.min(total === 0 ? 0 : (current - 1) * ITEMS_PER_PAGE + 1, activeList.length + disbursedList.length)}</span> to <span className="text-slate-900">{Math.min(current * ITEMS_PER_PAGE, total === 0 ? 0 : 99999)}</span> of <span className="text-slate-900">{total * ITEMS_PER_PAGE > 0 ? "..." : 0}</span> results
          </p>
        </div>
        <div>
          <nav className="inline-flex -space-x-px rounded-md shadow-sm isolate" aria-label="Pagination">
            <button
              onClick={() => onChange(Math.max(1, current - 1))}
              disabled={current === 1}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 border border-slate-300 rounded-l-md hover:bg-slate-50 focus:z-20 disabled:opacity-30"
            >
              <span className="sr-only">Previous</span>
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            {[...Array(total)].map((_, i) => (
              <button
                key={i}
                onClick={() => onChange(i + 1)}
                className={cn(
                  "relative inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest border focus:z-20",
                  current === i + 1
                    ? "z-10 bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50"
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => onChange(Math.min(total, current + 1))}
              disabled={current === total}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 border border-slate-300 rounded-r-md hover:bg-slate-50 focus:z-20 disabled:opacity-30"
            >
              <span className="sr-only">Next</span>
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  const getStatusColor = (status: RequisitionStatus) => {
    switch (status) {
      case RequisitionStatus.APPROVED_L2: return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case RequisitionStatus.DISBURSED: return "bg-blue-50 text-blue-600 border-blue-100";
      case RequisitionStatus.SUBMITTED: return "bg-amber-50 text-amber-600 border-amber-100";
      case RequisitionStatus.REJECTED: return "bg-rose-50 text-rose-600 border-rose-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkPrint = () => {
    const selectedReqs = requisitions.filter(r => selectedIds.has(r.id));
    printRequisitions(selectedReqs, "Consolidated Transaction Report", currentUser);
  };

  const handleBulkExportCsv = () => {
    const selectedReqs = requisitions.filter(r => selectedIds.has(r.id));
    downloadRequisitionsCsv(selectedReqs, "Bulk_Export_Transactions");
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} requisitions?`)) {
      selectedIds.forEach(id => deleteRequisition(id));
      setSelectedIds(new Set());
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-pulse p-4 md:p-8">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-48 bg-slate-100 rounded-md"></div>
          </div>
          <div className="flex gap-2">
             <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
             <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
             <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        {/* Filter bar skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 flex-1 bg-slate-200 rounded-xl border border-slate-100"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl hidden md:block"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl hidden md:block"></div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
           <div className="h-8 bg-slate-100/50 rounded-xl mb-6"></div>
           {[...Array(6)].map((_, i) => (
             <div key={i} className="h-16 bg-slate-100/50 rounded-2xl border border-slate-100/80"></div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Requisitions</h2>
          <p className="text-sm text-slate-500">Master ledger for all ministry group funding requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex bg-white border border-slate-200 rounded-xl shadow-sm">
             <button 
              onClick={() => printRequisitions(filtered, "Requisition Ledger", currentUser)}
              className="p-2.5 hover:bg-slate-50 border-r border-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Print Ledger"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="p-2.5 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
              title="Download Data"
            >
              <Download size={16} />
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 text-left">
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
                    Export Filtered Table ({filtered.length} transactions)
                  </div>
                  <button
                    onClick={() => {
                      downloadRequisitionsPdf(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Download PDF Document
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsCsv(filtered, "Requisitions List Ledger");
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Download CSV Sheet
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsHtml(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Download Classic HTML
                  </button>
                </div>
              </>
            )}
          </div>
          
          {canPerform('canCreateRequisition') && (
            systemSettings?.fiscalYearStatus === "ARCHIVED" ? (
              <button 
                onClick={() => alert("This financial period is ARCHIVED. Creation of new requisitions is disabled.")}
                className="opacity-50 btn-primary flex items-center gap-2 cursor-not-allowed bg-slate-400 hover:bg-slate-400 border-none"
              >
                <Plus size={18} />
                ARCHIVED PERIOD
              </button>
            ) : (
              <button 
                onClick={() => setIsAdding(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                NEW REQUISITION
              </button>
            )
          )}
        </div>
      </div>

      {systemSettings?.fiscalYearStatus === "ARCHIVED" && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-400 animate-in slide-in-from-top duration-300">
          <div className="p-2 bg-amber-500/15 rounded-xl">
            <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-0.5 animate-in fade-in">
            <p className="text-xs font-black uppercase tracking-wider">ARCHIVED FINANCIAL PERIOD VIEW</p>
            <p className="text-[10px] opacity-90 leading-relaxed">
              This financial period ({systemSettings?.currentFiscalYear}) has been **ARCHIVED**. All historical transactions are preserved in a read-only ledger. Editing, deletions, and operational state changes are suspended.
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterPreset("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer",
              filterPreset === "ALL" 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            Show All
          </button>
          <button
            onClick={() => setFilterPreset("URGENT")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "URGENT" 
                ? "bg-amber-500 text-white border-amber-500 shadow-sm" 
                : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50"
            )}
          >
            <AlertTriangle size={12} />
            Urgent
          </button>
          <button
            onClick={() => setFilterPreset("FLAGGED")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "FLAGGED" 
                ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                : "bg-white text-rose-600 border-rose-200 hover:bg-rose-50"
            )}
          >
            <Flag size={12} />
            Flagged
          </button>
          <button
            onClick={() => setFilterPreset("OVERDUE")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "OVERDUE" 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            )}
          >
            <History size={12} />
            Approvals Overdue
          </button>
          <button
            onClick={() => setFilterPreset("L1_APPROVED")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "L1_APPROVED" 
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            )}
          >
            <CheckCircle size={12} />
            L1 Approved
          </button>
        </div>

        <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search documents..." 
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            onFocus={() => setShowTrending(true)}
            onBlur={() => setTimeout(() => setShowTrending(false), 200)}
          />
          
          {/* Trending Searches Dropdown */}
          <AnimatePresence>
            {showTrending && trendingSearches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
              >
                <div className="p-3 border-bottom border-slate-50 flex items-center gap-2">
                  <TrendingUp size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trending Searches</span>
                </div>
                <div className="flex flex-col p-1">
                  {trendingSearches.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setGlobalSearchTerm(item.term);
                        setShowTrending(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between group"
                    >
                      <span className="font-medium">"{item.term}"</span>
                      <span className="text-[9px] text-slate-400 group-hover:text-primary transition-colors bg-slate-50 px-1.5 py-0.5 rounded uppercase font-bold">
                        {item.count} searches
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[130px]">
            <Filter size={12} className="text-slate-400" />
            <select 
              className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">ALL STATUSES</option>
              {Object.values(RequisitionStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[150px]">
            <CalendarDays size={12} className="text-slate-400" />
            <select 
              className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
            >
              <option value="ALL">ALL TIME</option>
              <option value="WEEK">LAST WEEK</option>
              <option value="MONTH">LAST MONTH</option>
              <option value="CUSTOM">CUSTOM RANGE</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {dateRangePreset === "CUSTOM" && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 animate-fadeIn">
              <input 
                type="date"
                title="Start Date"
                className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer border-none p-0 focus:ring-0 w-24"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span className="text-[9px] text-slate-400 font-black uppercase">to</span>
              <input 
                type="date"
                title="End Date"
                className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer border-none p-0 focus:ring-0 w-24"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Clear Custom Dates"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            Active Requisitions 
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({activeList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    checked={activeList.length > 0 && activeList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allActiveInSelected = activeList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      activeList.forEach(r => {
                        if (allActiveInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-primary whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-primary">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Expiry</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {activeItems.map((req, i) => {
                  const isExpired = req.expiresAt && new Date(req.expiresAt) < new Date();
                  const hoursRemaining = req.expiresAt ? (new Date(req.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60) : null;
                  const daysRemaining = req.expiresAt ? (new Date(req.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null;
                  const isNearingExpiry = !isExpired && hoursRemaining !== null && hoursRemaining <= 24 && hoursRemaining > 0;
                  
                  const updateAge = now - new Date(req.updatedAt).getTime();
                  const isRecentlyApprovedOrDisbursed = (req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) && updateAge < 8000;

                  return (
                    <motion.tr 
                      key={req.id} 
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ 
                        opacity: 1,
                        y: 0,
                        backgroundColor: isRecentlyApprovedOrDisbursed ? "rgba(16, 185, 129, 0.08)" : undefined
                      }}
                      exit={{ opacity: 0, scale: 0.95, y: -15 }}
                      transition={{ 
                        opacity: { duration: 0.2 },
                        layout: { type: "spring", stiffness: 300, damping: 30 },
                        y: { type: "spring", stiffness: 300, damping: 30 }
                      }}
                      onClick={() => setViewingReq(req)}
                      className={cn(
                        "transition-colors group cursor-pointer border-l-2",
                        selectedIds.has(req.id) ? "bg-primary/5 border-l-primary" :
                        isRecentlyApprovedOrDisbursed
                          ? "border-l-emerald-500 shadow-[inset_4px_0_0_0_#10b981]" 
                          : isNearingExpiry 
                            ? "bg-amber-50/60 hover:bg-amber-100/60 border-l-amber-500" 
                            : "hover:bg-slate-50/80 border-l-transparent"
                      )}
                    >
                      <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                        />
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-none">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-[11px] md:text-sm truncate">
                              <HighlightText text={req.title} highlight={globalSearchTerm} />
                            </span>
                            {req.status !== RequisitionStatus.DISBURSED && (
                              <span className="ml-2 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                                {getDaysSinceSubmission(req.submittedAt)}d
                              </span>
                            )}
                            {req.flaggedForAudit && (
                              <span title="Flagged for Audit" className="inline-flex shrink-0">
                                <Flag size={11} className="text-rose-500 fill-rose-500" />
                              </span>
                            )}
                            {req.inProcurement && (
                              <span className="text-[8px] md:text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                                PROCUREMENT
                              </span>
                            )}
                            {req.requiresMoreInfo && (
                              <span className="text-[8px] md:text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                                INFO REQ
                              </span>
                            )}
                            {req.recurrence && req.recurrence !== "NONE" && (
                              <Repeat size={10} className="text-primary animate-pulse shrink-0" />
                            )}
                            {req.attachments && req.attachments.length > 0 && (
                              <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                <Paperclip size={10} />
                                {req.attachments.length}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                            <span className="text-[7.5px] md:text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate shrink-0">{req.id}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50/80 border border-indigo-200/50 text-indigo-700 rounded-md text-[7.5px] md:text-[9px] font-extrabold uppercase tracking-wider leading-none w-fit">
                              💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                            {req.requesterName}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-[8px]">
                            {req.groupName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                        <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shrink-0",
                            getStatusColor(req.status)
                          )}>
                            {req.status}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                        {req.expiresAt ? (
                          <div className="flex items-center gap-1.5">
                            <Clock size={10} className={isExpired ? "text-rose-500" : isNearingExpiry ? "text-amber-600 animate-pulse" : "text-slate-400"} />
                            <span className={cn(
                              "text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-tighter truncate",
                              isExpired ? "text-rose-500" : isNearingExpiry ? "text-amber-650 font-extrabold" : "text-slate-500"
                            )}>
                              {isExpired 
                                ? "EXPIRED" 
                                : daysRemaining !== null && daysRemaining >= 1 
                                  ? `${Math.ceil(daysRemaining)} DAYS LEFT` 
                                  : `${Math.ceil(hoursRemaining || 0)} HOURS LEFT`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingReq(req);
                            }}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyShareLinkForReq(req);
                            }}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                            title="Copy Shareable Link"
                          >
                            <Share2 size={16} />
                          </button>
                          {/* Edit button: Drafts can be edited by requester or admin/super-admin, others only if admin, rejected can NEVER be edited */}
                          {req.status !== RequisitionStatus.REJECTED && (
                            canPerform('canDeleteRequisition') || 
                            (req.status === RequisitionStatus.DRAFT && (req.requesterId === currentUser?.id || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN))
                          ) && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingReq(req);
                              }}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-amber-500 transition-all"
                              title="Edit Requisition"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {/* Delete button: only admins */}
                          {canPerform('canDeleteRequisition') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setRequisitionToDelete(req);
                              }}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-rose-500 transition-all"
                              title="Delete Permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
            {activeList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Active Requisitions
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-rose-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(activeList.reduce((sum, r) => sum + r.amount, 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({activeList.length} items total)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {activeList.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No matching active requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Adjust your filters or initiate a new request transaction.</p>
            </div>
          )}
        </div>
        {activeTotalPages > 1 && (
          <Pagination 
            current={activePage} 
            total={activeTotalPages} 
            onChange={setActivePage} 
          />
        )}
      </div>

      {/* Disbursed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle size={16} className="text-blue-600" />
            Disbursed History
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({disbursedList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                    checked={disbursedList.length > 0 && disbursedList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allDisbursedInSelected = disbursedList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      disbursedList.forEach(r => {
                        if (allDisbursedInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-blue-600 whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-blue-600">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Date Disbursed</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {disbursedItems.map((req, i) => (
                  <motion.tr 
                    key={req.id} 
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -15 }}
                    transition={{ 
                      opacity: { duration: 0.2 },
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                      y: { type: "spring", stiffness: 300, damping: 30 }
                    }}
                    onClick={() => setViewingReq(req)}
                    className={cn(
                      "transition-colors group cursor-pointer border-l-2",
                      selectedIds.has(req.id) ? "bg-blue-50/50 border-l-blue-600" : "hover:bg-slate-50/80 border-l-transparent"
                    )}
                  >
                    <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                        />
                      </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-none">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-[11px] md:text-sm truncate">
                            <HighlightText text={req.title} highlight={globalSearchTerm} />
                          </span>
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={11} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                          {req.attachments && req.attachments.length > 0 && (
                            <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                              <Paperclip size={10} />
                              {req.attachments.length}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                          <span className="text-[7.5px] md:text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate shrink-0">{req.id}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50/80 border border-blue-200/50 text-blue-700 rounded-md text-[7.5px] md:text-[9px] font-extrabold uppercase tracking-wider leading-none w-fit">
                            💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                          {req.requesterName}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-[8px]">
                          {req.groupName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                      <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex justify-center">
                        <span className="px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-600 text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shrink-0">
                          {req.status}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                      <span className="text-[9px] md:text-[10px] font-mono font-bold text-slate-500">
                        {formatDate(req.updatedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyShareLinkForReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                          title="Copy Shareable Link"
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
            {disbursedList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Disbursed Funds
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-blue-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(disbursedList.reduce((sum, r) => sum + r.amount, 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({disbursedList.length} items history)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {disbursedList.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <History size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No disbursed requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Disbursed items will appear here for historical archiving.</p>
            </div>
          )}
        </div>
        {disbursedTotalPages > 1 && (
          <Pagination 
            current={disbursedPage} 
            total={disbursedTotalPages} 
            onChange={setDisbursedPage} 
          />
        )}
      </div>

      {/* Budget Status Summaries */}
      {projectSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-6 mt-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} className="text-indigo-500" />
            Budget Allocations FY {activeYear}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectSummaries.map((proj) => {
              const capHit = proj.percentage >= 100;
              const nearCap = proj.percentage > 85 && !capHit;
              
              return (
                <div key={proj.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 transition-colors hover:bg-slate-100/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-bold text-slate-900 truncate pr-2">{proj.groupId}</p>
                    <div className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                      capHit ? "bg-rose-100 text-rose-700" :
                      nearCap ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {proj.percentage.toFixed(0)}% Used
                    </div>
                  </div>
                  <div className="flex justify-between items-end mb-1">
                    <div className="flex flex-col">
                      <p className="text-lg font-black text-slate-900 tracking-tight leading-none">{formatCurrency(proj.usedAmount)}</p>
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                        Spent: {formatCurrency(proj.spentAmount)}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/ {formatCurrency(proj.allocatedBudget)}</p>
                  </div>
                  
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-3">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(proj.percentage, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        capHit ? "bg-rose-500" :
                        nearCap ? "bg-amber-500" :
                        "bg-emerald-500"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-4 pr-6 border-r border-white/10">
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center font-black text-lg border border-primary/20">
                {selectedIds.size}
              </div>
              <div className="hidden md:block">
                <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-white/90">Items Selected</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Consolidated Batch Ready</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkPrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
              >
                <Printer size={16} />
                Bulk Reports PDF
              </button>
              <button
                onClick={handleBulkExportCsv}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 border border-white/5"
              >
                <Download size={16} className="text-emerald-400" />
                Table Export
              </button>
              {canPerform('canDeleteRequisition') && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest active:scale-95"
                >
                  <Trash2 size={16} />
                  Purge Batch
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              title="Clear Selection"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal for Adding */}
      <AnimatePresence>
        {isAdding && <NewRequisitionForm onClose={() => setIsAdding(false)} />}
      </AnimatePresence>

      {/* Modal for Details */}
      <AnimatePresence>
        {viewingReq && (
          <RequisitionDetailModal 
            req={viewingReq} 
            onClose={() => setViewingReq(null)} 
            onDelete={() => {
              setRequisitionToDelete(viewingReq);
              setViewingReq(null);
            }}
            onGenerateReceipt={() => {
              setIsGeneratingReceipt(viewingReq);
            }}
            onEdit={() => {
              setEditingReq(viewingReq);
              setViewingReq(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal for Editing */}
      <AnimatePresence>
        {editingReq && (
          <EditRequisitionModal 
            req={editingReq} 
            onClose={() => setEditingReq(null)} 
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {requisitionToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 text-center space-y-6"
            >
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Confirm Deletion</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to permanently delete requisition <strong className="text-slate-800 font-bold">{requisitionToDelete.title}</strong>? This action is irreversible and will erase the financial ledger entry.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setRequisitionToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    await deleteRequisition(requisitionToDelete.id);
                    setRequisitionToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 transition-all cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Receipt Generator */}
      <AnimatePresence>
        {isGeneratingReceipt && (
          <ReceiptTemplateGenerator 
            req={isGeneratingReceipt} 
            onClose={() => setIsGeneratingReceipt(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export interface DetailModalProps {
  req: Requisition;
  onClose: () => void;
  onDelete: () => void;
  onGenerateReceipt: () => void;
  onEdit?: () => void;
}

export const RequisitionDetailModal: React.FC<DetailModalProps> = ({ req, onClose, onDelete, onGenerateReceipt, onEdit }) => {
  const { currentUser, updateRequisitionStatus, updateRequisition, uploadReceipts, globalSearchTerm, projects, triggerToast, vendors, requisitions } = useRequisitions();
  const [decisionNote, setDecisionNote] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [showDecisionForm, setShowDecisionForm] = useState<"APPROVE" | "REJECT" | "ESCALATE" | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [isGroupVerified, setIsGroupVerified] = useState(false);
  const [isAmountVerified, setIsAmountVerified] = useState(false);
  const decisionFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showDecisionForm && decisionFormRef.current) {
      decisionFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showDecisionForm]);

  const handleCopyDetails = async () => {
    const formattedAmount = formatCurrency(req.amount);
    const timelineEvents = getConsolidatedTimeline();
    
    let text = `=========================================\n`;
    text += `REQUISITION: ${req.title}\n`;
    text += `=========================================\n`;
    text += `ID: ${req.id}\n`;
    text += `Status: ${req.status}\n`;
    text += `Amount: ${formattedAmount} (${req.amountWords || "N/A"})\n`;
    text += `Group: ${req.groupName || "N/A"}\n`;
    text += `Requester: ${req.requesterName}\n`;
    text += `Submitted At: ${formatDate(req.submittedAt)}\n`;
    text += `Expiry Date: ${req.expiresAt ? formatDate(req.expiresAt) : "N/A"}\n`;
    if (req.recurrence && req.recurrence !== "NONE") {
      text += `Recurrence: ${req.recurrence}\n`;
    }
    text += `\nDescription:\n${req.description}\n\n`;
    
    text += `=========================================\n`;
    text += `TIMELINE & AUDIT HISTORY\n`;
    text += `=========================================\n`;
    
    timelineEvents.forEach((event, idx) => {
      text += `${idx + 1}. ${formatDate(event.timestamp)} - [${event.type}] ${event.title}\n`;
      text += `   Operator: ${event.actorName}${event.role ? ` (${event.role})` : ""}\n`;
      if (event.note) {
        text += `   Note: "${event.note}"\n`;
      }
      text += `-----------------------------------------\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Requisition details for "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy clipboard text: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy requisition details to clipboard. Please try again.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleCopyShareLink = async () => {
    const rawUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${rawUrl}?reqId=${req.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Direct shareable link for Requisition "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy share link: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy shareable link to clipboard.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleCaptureReceipt = async (file: File) => {
    setIsUploadingReceipt(true);
    try {
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read captured image as data URL"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      await uploadReceipts(req.id, [base64data]);
    } catch (error) {
      console.error("Error saving captured receipt physical photo:", error);
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const getConsolidatedTimeline = () => {
    interface TimelineEvent {
      id: string;
      timestamp: string;
      title: string;
      subtitle: string;
      type: "CREATED" | "L1_APPROVED" | "L2_APPROVED" | "DISBURSED" | "REJECTED" | "ESCALATED" | "GENERIC";
      actorName: string;
      role?: string;
      note?: string;
      method?: string;
      approvalCode?: string;
    }

    const timeline: TimelineEvent[] = [];

    // 1. Initial Submission
    timeline.push({
      id: "submission",
      timestamp: req.submittedAt,
      title: "Requisition Created",
      subtitle: "Entry logged into the ledger system",
      type: "CREATED",
      actorName: req.requesterName,
      role: "Church Group 代表 (General Rep)"
    });

    // 2. Map existing approvalHistory entries
    if (req.approvalHistory && req.approvalHistory.length > 0) {
      req.approvalHistory.forEach((note, idx) => {
        let type: TimelineEvent["type"] = "GENERIC";
        let title = "Process Step Documented";
        let subtitle = `Validated by ${note.approverName}`;

        const decision = note.decision;
        const roleStr = note.role || "";
        
        if (decision === "APPROVE") {
          if (roleStr.includes("L1") || roleStr.includes("APPROVER_L1") || roleStr.toLowerCase().includes("compliance")) {
            type = "L1_APPROVED";
            title = "L1 Compliance Clearance Granted";
            subtitle = "First level verification & audit clearance";
          } else if (roleStr.includes("L2") || roleStr.includes("APPROVER_L2") || roleStr.toLowerCase().includes("keymaster")) {
            type = "L2_APPROVED";
            title = "L2 Keymaster Signing Certified";
            subtitle = "Second level consensus consent";
          } else if (roleStr.toLowerCase().includes("finance") || (note.note || "").toLowerCase().includes("disburs") || (note.note || "").toLowerCase().includes("payment")) {
            type = "DISBURSED";
            title = "Requisition Funds Disbursed";
            subtitle = "Financial transaction settled and paid";
          } else {
            type = "GENERIC";
            title = "Validated & Approved";
          }
        } else if (decision === "REJECT") {
          type = "REJECTED";
          title = "Requisition Returned / Rejected";
          subtitle = "Process halted by reviewer";
        } else if (decision === "ESCALATE") {
          type = "ESCALATED";
          title = "Transaction Escalated";
          subtitle = "Review forwarded to higher authority";
        }

        timeline.push({
          id: note.id || `hist-${idx}`,
          timestamp: note.timestamp,
          title,
          subtitle,
          type,
          actorName: note.approverName,
          role: note.role,
          note: note.note,
          method: note.method,
          approvalCode: note.approvalCode
        });
      });
    }

    // 3. Robust checks for explicit timestamps to ensure no missed milestones
    if (req.approvedAtL1 && !timeline.some(t => t.type === "L1_APPROVED")) {
      timeline.push({
        id: "legacy-l1",
        timestamp: req.approvedAtL1,
        title: "L1 Compliance Clearance Granted",
        subtitle: "First level verification & audit clearance",
        type: "L1_APPROVED",
        actorName: "Compliance Verifier L1"
      });
    }

    if (req.approvedAtL2 && !timeline.some(t => t.type === "L2_APPROVED")) {
      timeline.push({
        id: "legacy-l2",
        timestamp: req.approvedAtL2,
        title: "L2 Keymaster Signing Certified",
        subtitle: "Second level consensus consent",
        type: "L2_APPROVED",
        actorName: "Keymaster L2 Leader"
      });
    }

    if (req.disbursedAt && !timeline.some(t => t.type === "DISBURSED")) {
      timeline.push({
        id: "legacy-disbursal",
        timestamp: req.disbursedAt,
        title: "Requisition Funds Disbursed",
        subtitle: "Financial transaction settled and paid",
        type: "DISBURSED",
        actorName: "Finance Auditor"
      });
    }

    // Sort chronologically (oldest to newest)
    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const handleToggleAuditFlag = async () => {
    try {
      await updateRequisition(req.id, {
        flaggedForAudit: !req.flaggedForAudit
      });
    } catch (error) {
      console.error("Failed to toggle audit flag:", error);
    }
  };

  const canAct = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN) return true;
    if (currentUser.role === UserRole.APPROVER_L1 && req.status === RequisitionStatus.SUBMITTED) return true;
    if (currentUser.role === UserRole.APPROVER_L2 && (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED)) return true;
    return false;
  };

  const handleDecision = async (decision: "APPROVE" | "REJECT" | "ESCALATE") => {
    setLoading(true);
    try {
      let nextStatus = req.status;
      if (decision === "APPROVE") {
        nextStatus = req.status === RequisitionStatus.SUBMITTED ? RequisitionStatus.APPROVED_L1 : RequisitionStatus.APPROVED_L2;
      } else if (decision === "REJECT") {
        nextStatus = RequisitionStatus.REJECTED;
      } else if (decision === "ESCALATE") {
        nextStatus = RequisitionStatus.ESCALATED;
      }

      await updateRequisitionStatus(
        req.id, 
        nextStatus, 
        decision, 
        decisionNote, 
        "CODE", 
        decision === "REJECT" ? decisionNote : undefined,
        approvalCode
      );
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-none md:rounded-2xl w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 flex flex-col"
      >
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 md:gap-3">
            <span className={cn(
              "p-1.5 md:p-2 rounded-xl border",
              req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/5 text-primary border-primary/10"
            )}>
              <ShieldCheck size={18} className="md:w-5 md:h-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[12px] md:text-sm font-black text-slate-900 uppercase tracking-[0.1em] truncate">
                  <HighlightText text={req.title} highlight={globalSearchTerm || ""} />
                </h3>
                {req.flaggedForAudit && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em]">
                    <Flag size={10} className="fill-current" />
                    Audit Flagged
                  </span>
                )}
              </div>
              <p className="text-[8px] md:text-[10px] font-mono text-slate-400 uppercase tracking-widest">{req.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full transition-colors">
              <X size={20} className="text-slate-500 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top workflow progress timeline component */}
          {(() => {
            const isRejected = req.status === RequisitionStatus.REJECTED;
            const isCancelled = req.status === RequisitionStatus.CANCELLED;
            const isEscalated = req.status === RequisitionStatus.ESCALATED;

            let currentStep = 0;
            if (req.status === RequisitionStatus.SUBMITTED) {
              currentStep = 0;
            } else if (req.status === RequisitionStatus.APPROVED_L1 || isEscalated) {
              currentStep = 1;
            } else if (req.status === RequisitionStatus.APPROVED_L2) {
              currentStep = 2;
            } else if (req.status === RequisitionStatus.DISBURSED) {
              currentStep = 3;
            }

            const steps = [
              {
                title: "Submitted",
                desc: "Entry logged",
                icon: User,
                status: currentStep > 0 ? "completed" : currentStep === 0 ? "current" : "upcoming"
              },
              {
                title: "L1 Approved",
                desc: "Leader Verify",
                icon: ShieldCheck,
                status: isRejected && req.rejectionReason?.includes("L1") ? "rejected" : (currentStep > 1 ? "completed" : currentStep === 1 ? "active" : "upcoming")
              },
              {
                title: "L2 Approved",
                desc: "Board Consent",
                icon: ShieldCheck,
                status: isEscalated ? "escalated" : (isRejected && !req.rejectionReason?.includes("L1") ? "rejected" : (currentStep > 2 ? "completed" : currentStep === 2 ? "active" : "upcoming"))
              },
              {
                title: "Disbursed",
                desc: "Funds Paid",
                icon: Coins,
                status: currentStep === 3 ? "completed" : "upcoming"
              }
            ];

            return (
              <div className="bg-slate-50 border-b border-slate-100 p-6 md:p-8 shrink-0">
                <div className="max-w-4xl mx-auto">
                  <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-0">
                    
                    {/* Horizontal connection line for desktop */}
                    <div className="hidden md:block absolute left-4 right-4 top-1/2 -translate-y-6 h-1 bg-slate-200 z-0 w-[calc(100%-2rem)] rounded-full">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${
                            isRejected || isCancelled ? (currentStep * 33.33) :
                            currentStep === 3 ? 100 : (currentStep * 33.33 + 16.66)
                          }%` 
                        }}
                        className={cn(
                          "h-full transition-all duration-700 rounded-full",
                          isRejected || isCancelled ? "bg-rose-400" : isEscalated ? "bg-amber-400" : "bg-emerald-500"
                        )}
                      />
                    </div>

                    {steps.map((step, idx) => {
                      const StepIcon = step.icon;
                      const isUpcoming = step.status === "upcoming";
                      const isActive = step.status === "active" || step.status === "current";
                      const isCompleted = step.status === "completed";
                      const isError = step.status === "rejected";
                      const isWarning = step.status === "escalated";

                      return (
                        <div key={idx} className="flex md:flex-col items-center gap-4 md:gap-3 z-10 w-full md:w-auto relative">
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-sm",
                              isCompleted ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-200" :
                              isActive ? "bg-white border-primary text-primary shadow-primary/20 ring-4 ring-primary/10" :
                              isError ? "bg-rose-500 border-rose-600 text-white shadow-rose-200" :
                              isWarning ? "bg-amber-500 border-amber-600 text-white shadow-amber-200" :
                              "bg-slate-50 border-slate-200 text-slate-300"
                            )}
                          >
                            {isCompleted ? (
                              <Check size={20} className="stroke-[3]" />
                            ) : (
                              <StepIcon size={20} className={cn(isActive && "animate-pulse")} />
                            )}
                          </motion.div>
                          
                          <div className="text-left md:text-center space-y-0.5">
                            <h4 className={cn(
                              "text-[10px] md:text-[11px] font-black uppercase tracking-widest",
                              isCompleted ? "text-emerald-700" :
                              isActive ? "text-primary" :
                              isError ? "text-rose-700" :
                              isWarning ? "text-amber-700" :
                              "text-slate-400"
                            )}>
                              {step.title}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(isRejected || isCancelled) && (
                    <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <XCircle size={18} className="text-rose-600" />
                      </div>
                      <div className="space-y-0.5">
                         <p className="text-[10px] md:text-xs font-black uppercase tracking-wider">
                           Process Terminated: {req.status}
                         </p>
                         <p className="text-[9px] font-bold text-rose-600/70 uppercase">Requisition removed from active ledger workflow</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-3 overflow-y-auto lg:overflow-hidden">
            {/* Left Content */}
            <div className="lg:col-span-2 p-4 md:p-8 space-y-5 md:space-y-8 border-b lg:border-b-0 lg:border-r border-slate-100 lg:h-full lg:overflow-y-auto h-auto overflow-visible">
              <section className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em]">Contextual Data</h4>
                </div>
                <div className="bg-slate-50 rounded-xl md:rounded-2xl p-3 md:p-6 border border-slate-100 space-y-4 text-[10px] md:text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                  <HighlightText text={req.description} highlight={globalSearchTerm || ""} />
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Breakdown</h4>
                  <div className="space-y-1">
                    <p className="text-xl md:text-2xl font-bold text-slate-900 font-mono">{formatCurrency(req.amount)}</p>
                    <p className="text-[9px] md:text-[11px] text-slate-500 italic font-medium">{req.amountWords}</p>
                  </div>
                </section>
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Requisition Ownership</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs md:text-base shrink-0">
                      {req.requesterName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{req.requesterName}</p>
                      <p className="text-[8px] md:text-[10px] text-slate-500 uppercase tracking-wider truncate">{req.groupName}</p>
                    </div>
                  </div>
                </section>
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor / Recipient</h4>
                  {(() => {
                    const vendorName = req.payableTo || "";
                    if (!vendorName.trim()) {
                      return (
                        <div className="text-xs text-slate-400 italic py-1">
                          No vendor specified
                        </div>
                      );
                    }
                    const matchedVendor = vendors.find(
                      v => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase()
                    );
                    const vendorContact = matchedVendor?.contact || "N/A";
                    const reqCount = requisitions.filter(
                      r => r.payableTo && r.payableTo.trim().toLowerCase() === vendorName.trim().toLowerCase()
                    ).length;

                    return (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                          <Store size={16} className="md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0 space-y-0.5 animate-in fade-in duration-200">
                          <p className="text-xs md:text-sm font-bold text-slate-900 truncate" title={vendorName}>{vendorName}</p>
                          <p className="text-[8px] md:text-[10px] text-slate-500 font-semibold truncate">
                            Contact: <span className="font-extrabold text-slate-755">{vendorContact}</span>
                          </p>
                          <div className="pt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-indigo-700/80 rounded font-black uppercase tracking-wider font-mono text-[7px] md:text-[8px] border border-indigo-100/30">
                              Appeared in {reqCount} {reqCount === 1 ? "requisition" : "requisitions"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </div>

              <section className="space-y-3 md:space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Attachments</h4>
                  <button 
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isUploadingReceipt}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 border border-slate-200 hover:border-slate-300 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
                  >
                    {isUploadingReceipt ? <Loader2 size={12} className="animate-spin text-primary" /> : <Camera size={12} className="text-primary" />}
                    <span>{isUploadingReceipt ? "Uploading..." : "Snap Receipt Image"}</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-4">
                   <button 
                     onClick={() => setIsCameraOpen(true)}
                     disabled={isUploadingReceipt}
                     className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 border border-dashed border-slate-300 rounded-2xl hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 overflow-hidden relative shadow-sm shrink-0 group"
                     title="Snap Receipt using Camera"
                   >
                     <div className="text-slate-400 group-hover:text-primary transition-colors">
                       {isUploadingReceipt ? <Loader2 size={18} className="animate-spin text-primary" /> : <Camera size={18} />}
                     </div>
                     <span className="text-[7.5px] font-black text-slate-500 group-hover:text-primary transition-colors uppercase tracking-widest leading-none mt-1 text-center font-sans">
                       {isUploadingReceipt ? "Uploading..." : "Snap Camera"}
                     </span>
                   </button>

                   {req.attachments?.map((attachment: any, i: number) => {
                     let name = typeof attachment === 'string' ? attachment : (attachment?.name || 'Attachment');
                     let url = typeof attachment === 'string' ? attachment : (attachment?.url || '');
                     
                     if (typeof attachment === 'string' && attachment.includes("::")) {
                       const parts = attachment.split("::");
                       name = parts[0];
                       url = parts[1];
                     }
                     
                     const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || (typeof url === 'string' && (url.startsWith('data:image/') || url.startsWith('blob:')));
                     const fileExt = name.split('.').pop()?.toUpperCase() || "DOC";
                     return (
                    <div 
                      key={`doc-${i}`} 
                      onClick={() => setPreviewIndex(i)}
                      className="w-20 h-20 md:w-24 md:h-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group flex flex-col items-center justify-center overflow-hidden relative shadow-sm shrink-0"
                      title={name}
                    >
                      {isImage ? (
                        <img 
                          src={url} 
                          alt={name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-1.5 text-center w-full h-full">
                          <div className="text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors mb-1">
                            <FileText size={20} />
                          </div>
                          <span className="text-[7.5px] font-black text-slate-500 dark:text-slate-400 truncate w-full px-1.5 uppercase tracking-wider font-mono">
                            {fileExt === "PDF" || fileExt === "XLSX" || fileExt === "DOCX" ? fileExt : "DOCUMENT"}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-all flex items-center justify-center">
                        <span className="text-[7.5px] font-black tracking-widest uppercase bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 px-1.5 py-1 rounded-xl shadow border border-slate-100 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity transform translateY(15px) group-hover:translateY(0)">
                          View
                        </span>
                      </div>
                    </div>
                  );
                })}
                  {req.receipts && req.receipts.length > 0 && (
                    <div className="w-full mt-2">
                      <ReceiptGallery receipts={req.receipts} />
                    </div>
                  )}
                  {(!req.attachments || req.attachments.length === 0) && (!req.receipts || req.receipts.length === 0) && (
                    <div className="w-full py-8 flex flex-col items-center justify-center text-slate-300 border border-dashed border-slate-200 rounded-3xl">
                      <p className="text-[10px] font-black uppercase tracking-widest">No Attachments</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Decision Form integration */}
              {showDecisionForm && (
                <motion.div 
                  ref={decisionFormRef}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "p-4 md:p-6 rounded-2xl border bg-slate-50",
                    showDecisionForm === "APPROVE" ? "border-emerald-100" : showDecisionForm === "REJECT" ? "border-rose-100" : "border-amber-100"
                  )}
                >
                  <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest mb-4">
                    {showDecisionForm === "APPROVE" ? "Authorize Ledger Transaction" : showDecisionForm === "REJECT" ? "Reject Transaction" : "Escalate Transaction"}
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason For Approval</label>
                      <textarea 
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="input-field bg-white text-xs"
                        placeholder="Provide reasoning..."
                        rows={3}
                      />
                    </div>
                    {showDecisionForm === "APPROVE" && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Security Code</label>
                        <input 
                          type="password"
                          value={approvalCode}
                          onChange={(e) => setApprovalCode(e.target.value)}
                          className="input-field bg-white font-mono text-xs"
                          placeholder="••••••"
                        />
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                       <button 
                        onClick={() => setShowDecisionForm(null)}
                        className="px-4 md:px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button 
                        disabled={loading || (showDecisionForm === "APPROVE" && !approvalCode) || (showDecisionForm === "REJECT" && !decisionNote.trim())}
                        onClick={() => handleDecision(showDecisionForm)}
                        className={cn(
                          "btn-primary px-5 md:px-8 flex items-center gap-2",
                          showDecisionForm === "REJECT" ? "bg-rose-600 hover:bg-rose-700" : 
                          showDecisionForm === "ESCALATE" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : ""
                        )}
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span className="text-[10px] md:text-xs">CONFIRM</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Sidebar - History & Status */}
            <div className="bg-slate-50/50 p-6 md:p-8 space-y-6 md:space-y-8 lg:h-full lg:overflow-y-auto h-auto overflow-visible">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase tracking-widest">History & Audit Timeline</h4>
                  <span className="text-[8px] font-mono font-bold bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider">{getConsolidatedTimeline().length} events</span>
                </div>
                <div className="space-y-6 relative ml-1">
                  {/* Vertical Timeline Connector Line */}
                  <div className="absolute left-3.5 top-3.5 bottom-3.5 w-[2px] bg-slate-200 rounded-full" />
                  
                  {getConsolidatedTimeline().map((event) => {
                    let StepIcon = Activity;
                    let cardColor = "blue";
                    
                    if (event.type === "CREATED") {
                      StepIcon = User;
                      cardColor = "blue";
                    } else if (event.type === "L1_APPROVED") {
                      StepIcon = ShieldCheck;
                      cardColor = "teal";
                    } else if (event.type === "L2_APPROVED") {
                      StepIcon = ShieldCheck;
                      cardColor = "indigo";
                    } else if (event.type === "DISBURSED") {
                      StepIcon = Coins;
                      cardColor = "emerald";
                    } else if (event.type === "REJECTED") {
                      StepIcon = XCircle;
                      cardColor = "rose";
                    } else if (event.type === "ESCALATED") {
                      StepIcon = AlertTriangle;
                      cardColor = "amber";
                    } else {
                      StepIcon = Activity;
                      cardColor = "slate";
                    }

                    // Security Method details
                    let methodLabel = "System authorization protocol";
                    let MethodIcon = Activity;
                    if (event.method === "CODE") {
                      methodLabel = "Secure passcode verified";
                      MethodIcon = KeyRound;
                    } else if (event.method === "FINGERPRINT") {
                      methodLabel = "Biometric authenticated";
                      MethodIcon = Fingerprint;
                    } else if (event.method === "SIGNATURE") {
                      methodLabel = "Cryptographic signature signed";
                      MethodIcon = FileSignature;
                    }

                    return (
                      <div key={event.id} className="relative pl-9 group">
                        {/* Circle badge marker with icon */}
                        <div className={cn(
                          "absolute left-0 top-1 w-7.5 h-7.5 rounded-full border-2 border-white flex items-center justify-center ring-4 transition-transform group-hover:scale-105 shadow-sm z-10",
                          cardColor === "blue" ? "bg-blue-50 text-blue-650 border-blue-200 ring-blue-50/50" :
                          cardColor === "teal" ? "bg-teal-50 text-teal-650 border-teal-200 ring-teal-50/50" :
                          cardColor === "indigo" ? "bg-indigo-50 text-indigo-650 border-indigo-200 ring-indigo-50/50" :
                          cardColor === "emerald" ? "bg-emerald-50 text-emerald-650 border-emerald-250 ring-emerald-50/50" :
                          cardColor === "rose" ? "bg-rose-50 text-rose-650 border-rose-200 ring-rose-50/50" :
                          cardColor === "amber" ? "bg-amber-50 text-amber-650 border-amber-200 ring-amber-50/50" :
                          "bg-slate-50 text-slate-500 border-slate-200 ring-slate-50/50"
                        )}>
                          <StepIcon size={13} className="stroke-[2.5]" />
                        </div>
                        
                        <div>
                          <p className="text-[9px] md:text-[10px] font-semibold text-slate-400 mb-0.5">{formatDate(event.timestamp)}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <h5 className="text-[11px] font-extrabold text-slate-900 leading-tight uppercase tracking-tight">{event.title}</h5>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                              cardColor === "blue" ? "bg-blue-100 text-blue-850" :
                              cardColor === "teal" ? "bg-teal-100 text-teal-855" :
                              cardColor === "indigo" ? "bg-indigo-100 text-indigo-855" :
                              cardColor === "emerald" ? "bg-emerald-100 text-emerald-855" :
                              cardColor === "rose" ? "bg-rose-100 text-rose-855" :
                              cardColor === "amber" ? "bg-amber-100 text-amber-855" :
                              "bg-slate-100 text-slate-855"
                            )}>
                              {event.type}
                            </span>
                            {event.role && (
                              <span className="px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[6.5px] font-black uppercase tracking-wider">
                                {event.role.split('_').pop()?.replace(')', '')}
                              </span>
                            )}
                          </div>

                          <div className={cn(
                            "p-3 rounded-xl border space-y-2 bg-white transition-all shadow-sm",
                            cardColor === "blue" ? "hover:border-blue-200" :
                            cardColor === "teal" ? "hover:border-teal-200" :
                            cardColor === "indigo" ? "hover:border-indigo-200" :
                            cardColor === "emerald" ? "hover:border-emerald-200" :
                            cardColor === "rose" ? "hover:border-rose-200" :
                            cardColor === "amber" ? "hover:border-amber-200" :
                            "hover:border-slate-200"
                          )}>
                            <div className="flex items-center justify-between text-[9px] border-b border-slate-50 pb-1.5">
                              <span className="font-medium text-slate-405">Operator:</span>
                              <span className="font-extrabold text-slate-800">{event.actorName}</span>
                            </div>

                            {/* Authentication and security info (only for non-created, non-legacy generic steps) */}
                            {event.type !== "CREATED" && (event.method || event.approvalCode) && (
                              <div className="flex items-center justify-between text-[8px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <MethodIcon size={10} className="text-slate-400" />
                                  {methodLabel}
                                </span>
                                {event.approvalCode && (
                                  <span className="font-mono bg-slate-50 px-1 py-0.5 rounded text-slate-500 font-extrabold uppercase tracking-wide">
                                    Auth block verified
                                  </span>
                                )}
                              </div>
                            )}

                            {event.type === "CREATED" && (
                              <div className="flex items-center justify-between text-[8px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Activity size={10} className="text-slate-400" />
                                  Ledger genesis block registered
                                </span>
                              </div>
                            )}

                            {/* Event text note or comments */}
                            {event.note && (
                              <div className="pt-2 border-t border-slate-50">
                                <p className="text-[9px] md:text-[9.5px] text-slate-600 leading-relaxed italic bg-emerald-50/15 p-2 rounded-lg border border-slate-100">
                                  "{event.note}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="pt-6 md:pt-8 border-t border-slate-200/60 space-y-4">
                 <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</h4>
                 <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><Users size={13} className="text-primary shrink-0" /> Church Group</span>
                      <span className="font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded transition-all uppercase tracking-wider text-[9px] truncate max-w-[150px]">{req.groupName || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><CalendarDays size={13} /> Submitted</span>
                      <span className="font-bold text-slate-700">{formatDate(req.submittedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><Clock size={13} /> Expiry</span>
                      <span className="font-bold text-rose-500">{req.expiresAt ? formatDate(req.expiresAt) : "N/A"}</span>
                    </div>
                    {req.recurrence && req.recurrence !== "NONE" && (
                      <div className="flex items-center justify-between text-[10px] md:text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5"><Repeat size={13} /> Recurrence</span>
                        <span className="font-black text-primary uppercase tracking-widest">{req.recurrence}</span>
                      </div>
                    )}
                 </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 py-3 md:py-6 border-t border-slate-100 bg-white flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-center">
          <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
            <button 
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="p-2.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all border border-slate-100 md:border-0"
              title="Delete Document"
            >
              <Trash2 size={16} />
            </button>
            {onEdit && req.status !== RequisitionStatus.REJECTED && (
              currentUser?.role === UserRole.ADMIN ||
              currentUser?.role === UserRole.SUPER_ADMIN ||
              (req.status === RequisitionStatus.DRAFT && req.requesterId === currentUser?.id)
            ) && (
              <button 
                onClick={onEdit}
                className="p-2.5 hover:bg-amber-50 text-slate-400 hover:text-amber-500 rounded-xl transition-all border border-slate-100 md:border-0"
                title="Edit Requisition details"
              >
                <Pencil size={16} />
              </button>
            )}
            {currentUser?.role === UserRole.ADMIN && (
              <button 
                onClick={handleToggleAuditFlag}
                className={cn(
                  "p-2.5 rounded-xl transition-all border border-slate-100 md:border-0 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider",
                  req.flaggedForAudit 
                    ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100" 
                    : "bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                )}
                title={req.flaggedForAudit ? "Remove Flag for Audit" : "Flag for Audit"}
              >
                <Flag size={16} className={req.flaggedForAudit ? "fill-rose-600" : ""} />
                <span className="hidden sm:inline">{req.flaggedForAudit ? "Flagged" : "Flag for Audit"}</span>
              </button>
            )}
            <button 
              onClick={onGenerateReceipt}
              className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-primary rounded-xl transition-all border border-slate-100 md:border-0" 
              title="Generate Receipt Template"
            >
              <FileText size={16} />
            </button>
            <button 
              onClick={() => printRequisitionReceipt(req)}
              className="p-2.5 hover:bg-slate-100 text-slate-500 hover:text-primary rounded-xl transition-all border border-slate-100 md:border-0" 
              title="Print Formal Receipt"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={handleCopyDetails}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-primary rounded-xl transition-all border border-slate-200/60 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider" 
              title="Copy Requisition Details"
            >
              <Copy size={16} />
              <span>Copy Details</span>
            </button>
            <button 
              onClick={handleCopyShareLink}
              className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100/80 text-indigo-600 dark:text-indigo-400 hover:text-primary rounded-xl transition-all border border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider" 
              title="Copy Direct Shareable Link"
            >
              <Share2 size={16} />
              <span>Share Link</span>
            </button>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-4 md:px-8 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[9px] md:text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest"
            >
              EXIT
            </button>
            
            {!showDecisionForm && canAct() && (
              <div className="flex flex-1 md:flex-none items-center gap-1.5 md:gap-2">
                {req.status !== RequisitionStatus.DISBURSED && (
                  <button 
                    onClick={() => setShowDecisionForm("REJECT")}
                    className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[9px] md:text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer uppercase tracking-widest"
                  >
                    REJECT
                  </button>
                )}
                {req.status === RequisitionStatus.SUBMITTED && (
                  <>
                    <button 
                      onClick={() => setShowDecisionForm("ESCALATE")}
                      className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[9px] md:text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer uppercase tracking-widest"
                    >
                      ESCALATE
                    </button>
                    <button 
                      onClick={() => setShowDecisionForm("APPROVE")}
                      className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100"
                    >
                      APPROVE
                    </button>
                  </>
                )}
                {(req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED) && (
                   <button 
                     onClick={() => setShowDecisionForm("APPROVE")}
                     className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100"
                   >
                     APPROVE L2
                   </button>
                )}
              </div>
            )}

            {req.status === RequisitionStatus.APPROVED_L2 && (
               <button 
                 onClick={() => {
                   setIsGroupVerified(false);
                   setIsAmountVerified(false);
                   setShowAssignConfirm(true);
                 }}
                 className="flex-1 md:flex-none px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-indigo-100"
               >
                ASSIGN TO BUDGET
              </button>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showAssignConfirm}
          title="Verify Budget Assignment"
          message={`Are you sure you want to assign and move this requisition to the active budget pool? This will deduct the funds from the group's active allocation.`}
          confirmText="YES, ASSIGN NOW"
          confirmDisabled={!isGroupVerified || !isAmountVerified}
          onConfirm={async () => {
             setShowAssignConfirm(false);
             try {
               // Assign to matching budget project if missing
               let targetProjectId = req.projectId;
               if (!targetProjectId) {
                 const match = projects.find(p => p.groupId === req.groupName || p.name === req.groupName);
                 if (match) {
                   targetProjectId = match.id;
                   await updateRequisition(req.id, { projectId: match.id });
                 }
               }

               await updateRequisitionStatus(req.id, RequisitionStatus.DISBURSED, "APPROVE");
               
               alert(`Requisition successfully assigned to Budget Pool${targetProjectId ? ' and allocations deducted.' : '.'}`);
             } catch (err: any) {
               alert("Failed to assign to budget: " + err.message);
             }
          }}
          onCancel={() => setShowAssignConfirm(false)}
        >
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Double-Verification Safety Check</p>
            
            <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={isGroupVerified}
                onChange={(e) => setIsGroupVerified(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 mt-0.5 shrink-0"
              />
              <span>I verify destination Ministry/Group is: <strong className="text-indigo-600 block text-[11px] uppercase tracking-wide">{req.groupName}</strong></span>
            </label>

            <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none border-t border-slate-200/60 pt-2">
              <input 
                type="checkbox"
                checked={isAmountVerified}
                onChange={(e) => setIsAmountVerified(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 mt-0.5 shrink-0"
              />
              <span>I verify transaction amount is correct: <strong className="text-indigo-600 block text-[11px] font-mono">KES {req.amount.toLocaleString()}</strong></span>
            </label>
          </div>
        </ConfirmationModal>

        {/* Document Preview Overlay */}
        <AnimatePresence>
          {previewIndex !== null && req.attachments && (
            <DocumentPreviewModal 
              attachments={req.attachments}
              initialIndex={previewIndex}
              onClose={() => setPreviewIndex(null)} 
            />
          )}
          {isCameraOpen && (
            <CameraCapture 
              onCapture={handleCaptureReceipt} 
              onClose={() => setIsCameraOpen(false)} 
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, Maximize2, ExternalLink, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

interface ReceiptGalleryProps {
  receipts: string[];
}

export const ReceiptGallery: React.FC<ReceiptGalleryProps> = ({ receipts }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!receipts || receipts.length === 0) return null;

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
          Attached Receipts ({receipts.length})
        </label>
      </div>
      
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {receipts.map((receipt, index) => (
          <motion.div
            key={index}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => downloadImage(receipt, `receipt_${index + 1}.png`)}
            className="relative flex-shrink-0 w-32 h-44 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 cursor-pointer group shadow-sm"
          >
            <img 
              src={receipt} 
              alt={`Receipt ${index + 1}`} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
              <Download size={24} className="text-white" />
              <span className="text-[8px] font-black text-white uppercase tracking-widest">Download</span>
            </div>
            
            {/* Overlay button for expansion instead of whole card click */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImage(receipt);
              }}
              className="absolute top-2 right-2 p-2 bg-white/20 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all hover:bg-white/40"
              title="Expand View"
            >
              <Maximize2 size={14} />
            </button>

            <div className="absolute bottom-2 left-2 right-2">
              <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/50 text-[8px] font-black text-slate-900 truncate uppercase tracking-tighter shadow-sm">
                Receipt #{index + 1}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-slate-900/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl w-full max-h-full flex flex-col items-center justify-center"
            >
              <div className="absolute top-0 right-0 p-4 z-10 flex gap-2">
                <button 
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = selectedImage;
                    link.download = `receipt_${Date.now()}.png`;
                    link.click();
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
                  title="Download Receipt"
                >
                  <Download size={20} />
                </button>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl">
                <img 
                  src={selectedImage} 
                  alt="Full Receipt" 
                  className="max-w-full max-h-full object-contain shadow-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="mt-6 flex items-center gap-4 text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                <span>St Andrews Ledger System</span>
                <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                <span>Encrypted Asset View</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

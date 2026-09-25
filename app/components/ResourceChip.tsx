"use client";

import { useState } from "react";
import { FileText, FileDown, Video } from "lucide-react";

interface ResourceChipProps {
  type: "notes" | "dppPdf" | "dppVideo";
  available: boolean;
  onClick?: () => void;
}

const chipConfig = {
  notes: { icon: FileText, label: "Notes" },
  dppPdf: { icon: FileDown, label: "DPP PDF" },
  dppVideo: { icon: Video, label: "DPP Video" },
};

export const ResourceChip = ({ type, available, onClick }: ResourceChipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = chipConfig[type];
  const Icon = config.icon;

  return (
    <div className="relative">
      {/* Tooltip */}
      {showTooltip && !available && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap px-2.5 py-1 text-[11px] font-medium rounded-md bg-gray-800 text-gray-300 border border-gray-700 shadow-lg pointer-events-none animate-fade-in">
          Not available
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-gray-800" />
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (available && onClick) onClick();
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold
          transition-all duration-300 ease-out border
          ${
            available
              ? "bg-[#7c3aed]/15 text-[#a78bfa] border-[#7c3aed]/30 hover:bg-[#7c3aed]/25 hover:border-[#7c3aed]/60 hover:shadow-[0_0_12px_rgba(124,58,237,0.25)] cursor-pointer active:scale-95"
              : "bg-[#1a1a2e]/60 text-gray-600 border-gray-700/40 cursor-not-allowed opacity-50"
          }
        `}
        disabled={!available}
      >
        <Icon size={13} strokeWidth={2} />
        <span>{config.label}</span>
      </button>
    </div>
  );
};

"use client";

import { Download } from "lucide-react";

interface ResourceBadgeProps {
  /** "dpp" | "notes" */
  type: "dpp" | "notes";
  available: boolean;
  onClick?: () => void;
}

export const ResourceBadge = ({ type, available, onClick }: ResourceBadgeProps) => {
  const label = type === "dpp" ? "DPP PDF" : "Notes";
  const absentLabel = type === "dpp" ? "No DPP" : "No Notes";

  if (!available) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium text-gray-600 select-none">
        {absentLabel}
      </span>
    );
  }

  const colorClasses =
    type === "dpp"
      ? "bg-spring-leaf/10 text-spring-forest dark:text-spring-mint border-spring-leaf/20 dark:border-spring-leaf-dark/20 hover:bg-spring-leaf/20 dark:hover:bg-spring-leaf-dark/20 hover:border-spring-leaf/40 dark:hover:border-spring-leaf-dark/40 hover:shadow-spring-sm"
      : "bg-spring-sky/15 text-[#0066b2] dark:text-spring-sky border-spring-sky/20 dark:border-spring-sky-dark/20 hover:bg-spring-sky/25 dark:hover:bg-spring-sky-dark/25 hover:border-spring-sky/50 dark:hover:border-spring-sky-dark/50 hover:shadow-spring-sm";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold
        border transition-all duration-200 cursor-pointer active:scale-95
        ${colorClasses}
      `}
    >
      <Download size={11} strokeWidth={2.5} />
      {label} ↓
    </button>
  );
};

"use client";

import { useState } from "react";
import { ChevronDown, FileText, Download, Eye } from "lucide-react";

interface DocItem {
  _id: string;
  title: string;
  date: string;
  onView: () => void;
}

interface CollapsibleDocSectionProps {
  icon: string;
  title: string;
  items: DocItem[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export const CollapsibleDocSection = ({
  icon,
  title,
  items,
  loading = false,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: CollapsibleDocSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-300 bg-white dark:bg-[var(--spring-glass-card)] border border-gray-200/60 dark:border-[rgba(109,212,119,0.2)] shadow-sm dark:shadow-md">
      {/* ── Header ───────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
      >
        <span className="flex items-center gap-2.5 text-[15px] font-semibold text-gray-800 dark:text-gray-200">
          <span className="text-lg">{icon}</span>
          {title}
          {items.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400">
              {items.length}
            </span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`text-gray-400 dark:text-gray-500 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ── Content ──────────────────────────── */}
      <div
        className={`overflow-hidden transition-all duration-400 ease-out ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-4">
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={`skel-${i}`}
                  className="flex items-center justify-between py-3 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-800" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
                      <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                    </div>
                  </div>
                  <div className="h-7 w-7 rounded bg-gray-200 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm py-3 text-center">
              No items available
            </p>
          )}

          {/* Document rows */}
          {!loading && items.length > 0 && (
            <div className="space-y-0.5">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[0.02] group/row cursor-pointer"
                  onClick={item.onView}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-spring-leaf/10 dark:bg-spring-mint/10">
                      <FileText size={15} className="text-spring-leaf dark:text-spring-mint" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate group-hover/row:text-gray-900 dark:group-hover/row:text-gray-100 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {item.date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onView();
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-spring-leaf dark:hover:text-spring-mint hover:bg-spring-leaf/10 dark:hover:bg-spring-mint/10 transition-all duration-150"
                      title="View"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onView();
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-[#22c55e] hover:bg-[#22c55e]/10 transition-all duration-150"
                      title="Download"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {!loading && hasMore && (
            <div className="flex justify-center pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLoadMore?.();
                }}
                disabled={loadingMore}
                className="px-5 py-1.5 rounded-lg text-[12px] font-medium text-gray-500 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-200 disabled:opacity-40"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-[1.5px] border-gray-400 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
                    Loading…
                  </span>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

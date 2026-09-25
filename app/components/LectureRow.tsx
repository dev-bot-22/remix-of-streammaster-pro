// Updated LectureRow component matching the new PW card design
"use client";

import { Play, Clock, Check, FileText, Eye, Download, Search } from "lucide-react";
import Image from "next/image";
import { BRAND_LOGO } from "@/lib/branding";
import { useState, useEffect } from "react";

interface LectureRowProps {
  lectureId: string;
  thumbnail?: string;
  title?: string;
  instructor?: string;
  duration?: string;
  date?: string;
  alt?: string;
  isPlaceholder?: boolean;
  onClick?: () => void;
  dppAvailable?: boolean;
  notesAvailable?: boolean;
  onDppClick?: () => void;
  onNotesClick?: () => void;
  type?: string;
}

export const LectureRow = ({
  lectureId,
  thumbnail,
  title,
  instructor,
  duration,
  date,
  alt,
  isPlaceholder = false,
  onClick,
  dppAvailable = false,
  notesAvailable = false,
  onDppClick,
  onNotesClick,
  type = "LECTURE",
}: LectureRowProps) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (lectureId) {
      try {
        const list = JSON.parse(localStorage.getItem("completedLectures") || "[]") || [];
        setIsCompleted(list.includes(lectureId));
      } catch {
        setIsCompleted(false);
      }
    }
  }, [lectureId]);

  const handleMarkComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lectureId) return;
    try {
      const list = JSON.parse(localStorage.getItem("completedLectures") || "[]") || [];
      let updatedList: string[];
      if (list.includes(lectureId)) {
        updatedList = list.filter((id: string) => id !== lectureId);
        setIsCompleted(false);
      } else {
        updatedList = [...list, lectureId];
        setIsCompleted(true);
      }
      localStorage.setItem("completedLectures", JSON.stringify(updatedList));
    } catch {
      /* ignore */
    }
  };

  /* ── Skeleton ───────────────────────────────── */
  if (isPlaceholder) {
    return (
      <div className="flex gap-4 p-4 rounded-2xl animate-pulse spring-glass-card">
        {/* Avatar skeleton */}
        <div className="w-[84px] h-[84px] rounded-xl shrink-0 bg-gray-200 dark:bg-gray-800" />
        {/* Content skeleton */}
        <div className="flex-1 flex flex-col justify-between py-1">
          <div className="space-y-2">
            <div className="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="flex gap-3 mt-3">
            <div className="h-7 w-20 rounded-lg bg-gray-200 dark:bg-gray-800" />
            <div className="h-7 w-24 rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Actual Card ────────────────────────────── */
  const isVideo = type.toUpperCase() === "LECTURE" || type.toUpperCase() === "DPP_VIDEO" || type.toUpperCase() === "VIDEO";
  const isDppPdf = type.toUpperCase() === "DPP_PDF" || type.toUpperCase() === "DPP" || type.toUpperCase() === "DPP_NOTES";
  
  const displayType = type.toUpperCase() === "LECTURE" 
    ? "Lecture" 
    : type.toUpperCase() === "NOTES" 
    ? "Notes" 
    : isDppPdf
    ? "DPP PDF"
    : type.toUpperCase() === "DPP_VIDEO"
    ? "DPP Video"
    : "Content";

  return (
    <div
      onClick={isVideo ? onClick : (onNotesClick || onDppClick || onClick)}
      className="group relative flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl cursor-pointer hover-3d-card animate-card-shine spring-glass-card transition-all duration-300"
    >
      {/* ── Avatar / Thumbnail ─────────────────────────── */}
      <div className="relative w-16 h-16 sm:w-[84px] sm:h-[84px] rounded-lg sm:rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-[#e8f5e9] dark:bg-[#1b2b1d] border border-spring-leaf/10">
        {isDppPdf ? (
          // DPP PDF Custom peach background container
          <div className="absolute inset-0 bg-[#ffe8d6] dark:bg-[#3d241d] border border-[#ffd0b0] flex items-center justify-center">
            <img
              src="https://static.pw.live/study-mf/assets/svg/dpp-android-1764086906.svg"
              alt="DPP Icon"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
              draggable={false}
            />
            {/* Magnifier glass bottom right badge */}
            <span className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5 w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full bg-[#fbc02d] text-white flex items-center justify-center border border-white dark:border-gray-900 shadow-sm">
              <Search size={6} className="sm:hidden" strokeWidth={3} />
              <Search size={8} className="hidden sm:block" strokeWidth={3} />
            </span>
          </div>
        ) : !thumbnail || thumbnail.includes("placeholder") || thumbnail.includes("defaultSubject") ? (
          <Image
            src={BRAND_LOGO}
            alt="PW-MARCO"
            fill
            className="object-contain p-2 opacity-85"
            draggable={false}
          />
        ) : (
          <Image
            src={thumbnail}
            alt={alt ?? "Thumbnail"}
            fill
            className="object-cover object-top"
            draggable={false}
          />
        )}
        {/* Play overlay for videos */}
        {isVideo && (
          <div className="absolute bottom-1 right-1 w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-red-500 flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-110">
            <Play size={8} className="text-white ml-0.5 sm:hidden" fill="#ffffff" strokeWidth={0} />
            <Play size={10} className="text-white ml-0.5 hidden sm:block" fill="#ffffff" strokeWidth={0} />
          </div>
        )}
      </div>

      {/* ── Content Details ───────────────────────────── */}
      <div className="flex-1 flex flex-col justify-between min-w-0 text-left py-0.5">
        <div>
          {/* Subtitle meta */}
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            <span>{displayType}</span>
            {date && (
              <>
                <span>•</span>
                <span>{date}</span>
              </>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[12px] sm:text-[14px] font-bold text-gray-800 dark:text-gray-200 leading-snug line-clamp-2 mt-0.5 sm:mt-1 hover:text-[var(--spring-leaf)] dark:hover:text-white transition-colors duration-200">
            {title || "Untitled Content"}
          </h3>
        </div>

        {/* Buttons / Actions Row */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
          {isVideo ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
                className="flex items-center gap-1 px-3 py-1 sm:px-5 sm:py-1.5 rounded-lg sm:rounded-xl bg-gray-100 hover:bg-gray-255 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-850 dark:text-gray-100 text-[10px] sm:text-[11px] font-bold active:scale-95 transition-all"
              >
                <Play size={9} fill="currentColor" className="text-gray-850 dark:text-gray-100 sm:hidden" />
                <Play size={11} fill="currentColor" className="text-gray-850 dark:text-gray-100 hidden sm:block" />
                Watch
              </button>
              {(notesAvailable || dppAvailable) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onNotesClick) onNotesClick();
                    else if (onDppClick) onDppClick();
                  }}
                  className="flex items-center gap-1 px-3 py-1 sm:px-5 sm:py-1.5 rounded-lg sm:rounded-xl bg-gray-100 hover:bg-gray-255 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-850 dark:text-gray-100 text-[10px] sm:text-[11px] font-bold active:scale-95 transition-all"
                >
                  Notes & more
                </button>
              )}
            </>
          ) : isDppPdf ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDppClick) onDppClick();
                  else if (onNotesClick) onNotesClick();
                }}
                className="flex items-center gap-1 px-3 py-1 sm:px-5 sm:py-1.5 rounded-lg sm:rounded-xl bg-gray-100 hover:bg-gray-255 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-850 dark:text-gray-100 text-[10px] sm:text-[11px] font-bold active:scale-95 transition-all"
              >
                <Eye size={10} className="text-gray-850 dark:text-gray-100 sm:hidden" />
                <Eye size={12} className="text-gray-850 dark:text-gray-100 hidden sm:block" />
                View DPP PDF
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDppClick) onDppClick();
                  else if (onNotesClick) onNotesClick();
                }}
                className="flex items-center justify-center p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gray-100 hover:bg-gray-255 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-850 dark:text-gray-100 active:scale-95 transition-all"
              >
                <Download size={11} className="sm:hidden" />
                <Download size={13} className="hidden sm:block" />
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onNotesClick) onNotesClick();
                else if (onDppClick) onDppClick();
              }}
              className="flex items-center gap-1 px-3 py-1 sm:px-5 sm:py-1.5 rounded-lg sm:rounded-xl bg-gray-100 hover:bg-gray-255 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-850 dark:text-gray-100 text-[10px] sm:text-[11px] font-bold active:scale-95 transition-all"
            >
              <FileText size={10} className="sm:hidden" />
              <FileText size={11} className="hidden sm:block" />
              Open PDF
            </button>
          )}

          {duration && (
            <span className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] text-gray-405 dark:text-gray-500 font-semibold ml-1 sm:ml-2">
              <Clock size={10} className="sm:hidden" />
              <Clock size={11} className="hidden sm:block" />
              {duration}
            </span>
          )}
        </div>
      </div>

      {/* ── Mark Complete Checkbox (Top Right) ─────────── */}
      {isMounted && (
        <button
          onClick={handleMarkComplete}
          className={`absolute top-3 right-3 sm:top-4 sm:right-4 rounded-full border p-0.5 sm:p-1 transition-all duration-200 active:scale-90 ${
            isCompleted
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-sm"
              : "bg-transparent border-gray-255 dark:border-gray-800 text-gray-400 hover:border-emerald-500 hover:text-emerald-500"
          }`}
          title={isCompleted ? "Completed" : "Mark Complete"}
        >
          <Check size={10} className="sm:hidden" strokeWidth={isCompleted ? 3 : 2} />
          <Check size={14} className="hidden sm:block" strokeWidth={isCompleted ? 3 : 2} />
        </button>
      )}
    </div>
  );
};

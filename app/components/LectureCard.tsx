"use client";

import { Play, Clock5 } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { ResourceChip } from "./ResourceChip";

interface LectureCardProps {
  thumbnail?: string;
  title?: string;
  duration?: string;
  date?: string;
  alt?: string;
  subject?: string;
  instructor?: string;
  isPlaceholder?: boolean;
  onClick?: () => void;
  lectureId?: string;
  // Resource availability
  notesAvailable?: boolean;
  dppPdfAvailable?: boolean;
  dppVideoAvailable?: boolean;
  onNotesClick?: () => void;
  onDppPdfClick?: () => void;
  onDppVideoClick?: () => void;
}

export const LectureCard = ({
  thumbnail,
  title,
  duration,
  date,
  alt,
  subject,
  instructor,
  isPlaceholder = false,
  onClick,
  lectureId,
  notesAvailable = false,
  dppPdfAvailable = false,
  dppVideoAvailable = false,
  onNotesClick,
  onDppPdfClick,
  onDppVideoClick,
}: LectureCardProps) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (lectureId) {
      try {
        const completedLectures =
          JSON.parse(localStorage.getItem("completedLectures") || "[]") || [];
        setIsCompleted(completedLectures.includes(lectureId));
      } catch {
        setIsCompleted(false);
      }
    }
  }, [lectureId]);

  const handleMarkComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lectureId) return;

    try {
      const completedLectures =
        JSON.parse(localStorage.getItem("completedLectures") || "[]") || [];

      if (completedLectures.includes(lectureId)) {
        const filtered = completedLectures.filter(
          (id: string) => id !== lectureId
        );
        localStorage.setItem("completedLectures", JSON.stringify(filtered));
        setIsCompleted(false);
      } else {
        completedLectures.push(lectureId);
        localStorage.setItem(
          "completedLectures",
          JSON.stringify(completedLectures)
        );
        setIsCompleted(true);
      }
    } catch {
      // localStorage error, silently ignore
    }
  };

  // ─── Skeleton / Placeholder ─────────────────────────
  if (isPlaceholder) {
    return (
      <article className="relative rounded-xl overflow-hidden animate-pulse"
        style={{ background: "#1a1a2e" }}
      >
        {/* Thumbnail skeleton */}
        <div className="w-full aspect-video" style={{ background: "#252542" }} />

        {/* Content skeleton */}
        <div className="p-4 space-y-3">
          <div className="h-3 w-16 rounded-full" style={{ background: "#252542" }} />
          <div className="h-4 w-3/4 rounded" style={{ background: "#252542" }} />
          <div className="h-3 w-1/2 rounded" style={{ background: "#252542" }} />
          <div className="flex gap-2 mt-3">
            <div className="h-3 w-20 rounded" style={{ background: "#252542" }} />
            <div className="h-3 w-14 rounded" style={{ background: "#252542" }} />
          </div>

          {/* Resource tray skeleton */}
          <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid #252542" }}>
            <div className="h-7 w-16 rounded-full" style={{ background: "#252542" }} />
            <div className="h-7 w-20 rounded-full" style={{ background: "#252542" }} />
            <div className="h-7 w-24 rounded-full" style={{ background: "#252542" }} />
          </div>
        </div>
      </article>
    );
  }

  // ─── Subject color helper ─────────────────────────
  const getSubjectColor = (subj?: string) => {
    if (!subj) return { bg: "rgba(124,58,237,0.15)", text: "#a78bfa", border: "rgba(124,58,237,0.3)" };
    const s = subj.toLowerCase();
    if (s.includes("physics"))
      return { bg: "rgba(59,130,246,0.15)", text: "#93c5fd", border: "rgba(59,130,246,0.3)" };
    if (s.includes("chemistry"))
      return { bg: "rgba(16,185,129,0.15)", text: "#6ee7b7", border: "rgba(16,185,129,0.3)" };
    if (s.includes("math"))
      return { bg: "rgba(245,158,11,0.15)", text: "#fcd34d", border: "rgba(245,158,11,0.3)" };
    if (s.includes("biology"))
      return { bg: "rgba(236,72,153,0.15)", text: "#f9a8d4", border: "rgba(236,72,153,0.3)" };
    return { bg: "rgba(124,58,237,0.15)", text: "#a78bfa", border: "rgba(124,58,237,0.3)" };
  };

  const subjectColor = getSubjectColor(subject);

  return (
    <article
      onClick={onClick}
      className="group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-400 ease-out hover:-translate-y-1"
      style={{
        background: "#1a1a2e",
        border: "1px solid rgba(124,58,237,0.08)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(124,58,237,0.35)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(124,58,237,0.15), 0 2px 8px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(124,58,237,0.08)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* ─── Thumbnail ─────────────────────────── */}
      <div className="relative w-full aspect-video overflow-hidden">
        <Image
          alt={alt ?? "Lecture thumbnail"}
          src={thumbnail ?? "/assets/img/video-placeholder.svg"}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          width={400}
          height={225}
        />

        {/* Play overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <span className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(124,58,237,0.5)]"
          style={{ background: "#7c3aed" }}
        >
          <Play size={18} className="text-white ml-0.5" fill="#ffffff" strokeWidth={0} />
        </span>

        {/* Completed tick */}
        {isMounted && lectureId && (
          <button
            onClick={handleMarkComplete}
            className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
              isCompleted
                ? "bg-green-500 border border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                : "bg-gray-700/70 border border-gray-600 hover:bg-gray-600"
            } hover:scale-110`}
            title={isCompleted ? "Mark as incomplete" : "Mark as completed"}
          >
            {isCompleted ? (
              <span className="text-white font-bold text-xs">✓</span>
            ) : (
              <span className="text-white/60 font-bold text-xs">○</span>
            )}
          </button>
        )}

        {/* Subject tag */}
        {subject && (
          <span
            className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm"
            style={{
              background: subjectColor.bg,
              color: subjectColor.text,
              border: `1px solid ${subjectColor.border}`,
            }}
          >
            {subject}
          </span>
        )}
      </div>

      {/* ─── Content ─────────────────────────── */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-snug mb-2 group-hover:text-[#c4b5fd] transition-colors duration-300">
          {title || "Lecture"}
        </h3>

        {/* Instructor + Meta */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-3">
          <span className="truncate">
            {instructor && (
              <span className="text-gray-400">{instructor}</span>
            )}
          </span>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            {date && <time className="text-gray-500">{date}</time>}
            {duration && (
              <span className="flex items-center gap-1 text-gray-500">
                <Clock5 size={11} />
                {duration}
              </span>
            )}
          </div>
        </div>

        {/* ─── Resource Tray ─────────────────────── */}
        <div
          className="flex flex-wrap items-center gap-2 pt-3 transition-all duration-300 ease-out opacity-80 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0"
          style={{ borderTop: "1px solid rgba(124,58,237,0.1)" }}
        >
          <ResourceChip
            type="notes"
            available={notesAvailable}
            onClick={onNotesClick}
          />
          <ResourceChip
            type="dppPdf"
            available={dppPdfAvailable}
            onClick={onDppPdfClick}
          />
          <ResourceChip
            type="dppVideo"
            available={dppVideoAvailable}
            onClick={onDppVideoClick}
          />
        </div>
      </div>
    </article>
  );
};

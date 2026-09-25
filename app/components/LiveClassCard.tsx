import React from "react";
import Image from "next/image";
import { BRAND_LOGO } from "@/lib/branding";
import { Clock } from "lucide-react";

interface LiveClassCardProps {
  teacherName: string;
  teacherImage?: string;
  subject: string;
  startTime: string;
  tag: string;
  onClick?: () => void;
  priority?: boolean;
}

const LiveClassCard: React.FC<LiveClassCardProps> = ({
  teacherName,
  teacherImage = "/assets/img/teacher-placeholder.png",
  subject,
  startTime,
  tag,
  onClick,
  priority = false,
}) => {
  return (
    <div
      className="glass-card !p-2 !rounded-2xl hover:shadow-glass-lg cursor-pointer select-none overflow-hidden transition-all duration-300 hover:-translate-y-[3px]"
      style={{
        width: "220px",
        minWidth: "220px",
        maxWidth: "220px",
      }}
      onClick={onClick}
    >
      {/* Top Image with Background */}
      <div
        className="relative w-full h-28 bg-center bg-cover rounded-xl overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-spring-forest-surface/20"
        style={{
          backgroundImage:
            (subject === "Notices" || !teacherImage || teacherImage === "/assets/img/teacher-placeholder.png" || teacherImage.includes("placeholder"))
              ? "none"
              : "url('https://study-mf.pw.live/static/image/teacherbg.807b2b2f.png')",
        }}
      >
        {(subject === "Notices" || !teacherImage || teacherImage === "/assets/img/teacher-placeholder.png" || teacherImage.includes("placeholder")) ? (
          <div className="relative w-12 h-12 opacity-85">
            <Image
              src={BRAND_LOGO}
              alt="PW-MARCO"
              fill
              style={{ objectFit: "contain" }}
              draggable={false}
            />
          </div>
        ) : (
          <Image
            src={teacherImage}
            alt={teacherName}
            fill
            style={{ objectFit: "contain" }}
            draggable={false}
            priority={priority}
          />
        )}
        {/* Name Overlay */}
        {teacherName?.trim() && (
          <div className="absolute capitalize bottom-0 w-full bg-foreground/90 backdrop-blur-sm text-background text-sm font-medium text-center py-1.5">
            {teacherName}
          </div>
        )}
      </div>

      {/* Status + Time */}
      <div className="flex justify-between items-center py-3 text-xs uppercase">
        <span
          className={`px-2.5 py-1 rounded-lg font-semibold ${tag.toUpperCase() === "LIVE"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : tag.toUpperCase() === "UPCOMING"
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : tag.toUpperCase() === "ENDED"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            }`}
        >
          {tag}
        </span>

        <span className="flex items-center text-muted-foreground gap-1 uppercase">
          <Clock size={14} className="stroke-[2.5]" />
          {startTime}
        </span>
      </div>

      {/* Subject */}
      <div className="py-1.5 text-sm font-semibold text-foreground text-center border-t border-[var(--glass-border)]">
        {subject}
      </div>
    </div>
  );
};

export default LiveClassCard;

import { Play, Clock5 } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";

interface VideoComponentProps {
  thumbnail?: string;
  title?: string;
  duration?: string;
  date?: string;
  alt?: string;
  isPlaceholder?: boolean;
  onClick?: () => void; // ✅ Added onClick prop
  lectureId?: string; // ✅ Unique identifier for the lecture
}

export const VideoComponent = ({
  thumbnail,
  title,
  duration,
  date,
  alt,
  isPlaceholder = false,
  onClick, // ✅ use onClick from props
  lectureId, // ✅ Lecture ID for tracking completion
}: VideoComponentProps) => {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Load completion state on mount
  useEffect(() => {
    setIsMounted(true);
    if (lectureId) {
      const completedLectures =
        JSON.parse(localStorage.getItem("completedLectures")) || [];
      setIsCompleted(completedLectures.includes(lectureId));
    }
  }, [lectureId]);

  // Handle tick button click
  const handleMarkComplete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the video player

    if (!lectureId) return;

    const completedLectures =
      JSON.parse(localStorage.getItem("completedLectures")) || [];

    if (completedLectures.includes(lectureId)) {
      // Remove from completed
      const filtered = completedLectures.filter((id: string) => id !== lectureId);
      localStorage.setItem("completedLectures", JSON.stringify(filtered));
      setIsCompleted(false);
    } else {
      // Add to completed
      completedLectures.push(lectureId);
      localStorage.setItem("completedLectures", JSON.stringify(completedLectures));
      setIsCompleted(true);
    }
  };
  if (isPlaceholder) {
    // show skeleton/placeholder version
    return (
      <article className="bg-background border overflow-hidden rounded-md shadow animate-pulse pb-3">
        <div className="bg-muted w-full h-[120px]" />
        <div className="p-2 text-xs text-muted-foreground flex justify-between items-center mt-2">
          <div className="bg-muted h-3 w-16 rounded" />
          <div className="bg-muted h-3 w-10 rounded" />
        </div>
        <div className="px-2 mt-2">
          <div className="bg-muted h-4 w-3/4 rounded mb-1" />
          <div className="bg-muted h-4 w-1/2 rounded" />
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={onClick} // ✅ attached here
      className={`bg-background border overflow-hidden rounded-md shadow-md hover:shadow-lg transition-shadow cursor-pointer pb-3 ${
        isMounted && isCompleted
          ? "border-green-500 border-opacity-40 hover:outline-green-500"
          : "hover:outline-indigo-500"
      } hover:outline`}
    >
      <div className="relative p-0">
        {/* Completed Tick Button */}
        {isMounted && lectureId && (
          <button
            onClick={handleMarkComplete}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isCompleted
                ? "bg-green-500 border border-green-400 shadow-lg"
                : "bg-gray-400 border border-gray-500 hover:bg-gray-500"
            } hover:scale-110`}
            style={
              isCompleted
                ? {
                    boxShadow:
                      "0 0 10px rgba(34,197,94,0.6), 0 0 20px rgba(34,197,94,0.4), 0 0 0 1px rgba(34,197,94,0.3)",
                  }
                : {}
            }
            title={isCompleted ? "Mark as incomplete" : "Mark as completed"}
          >
            {isCompleted ? (
              <span className="text-white font-bold text-sm">✓</span>
            ) : (
              <span className="text-white/70 font-bold text-sm">○</span>
            )}
          </button>
        )}
        <Image
          alt={alt ?? "Video thumbnail"}
          src={thumbnail ?? "/assets/img/video-placeholder.svg"}
          className="w-full h-auto"
          width={400}
          height={200}
        />
        <span
          aria-label="Play video"
          className="absolute bg-indigo-600 drop-shadow-[#3742d3_0px_0px_10px] w-6 h-6 bottom-7 right-6 sm:w-12 sm:h-12 sm:bottom-10 sm:right-10 md:bottom-6 md:right-4 md:w-6 md:h-6 lg:w-7 lg:h-7 shadow-lg shadow-indigo-500/50
            rounded-full flex items-center justify-center "
        >
          <Play
            size={17}
            className="text-white"
            fill="#ffffff"
            strokeWidth={1}
          />
        </span>
      </div>
      <div className="p-2 text-xs text-muted-foreground flex justify-between items-center">
        <time className="font-normal">{date}</time>
        <span className="flex items-center gap-1">
          <Clock5 className="h-3 w-3" />
          {duration}
        </span>
      </div>
      <div>
        <p className="line-clamp-2 text-left text-sm font-semibold text-foreground px-2">
          {title}
        </p>
      </div>
    </article>
  );
};

"use client";

import { useState, useEffect } from "react";
import { SubjectInfo } from "@/utils/api";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, BookOpen, Layers, FileText } from "lucide-react";
import "@/app/globals.css";

type TabType = "UNITS" | "STUDY_MATERIAL" | "DIGITAL_BOOKS";

export default function SubjectClientPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params?.batchid as string;
  const subjectId = params?.subjectid as string;

  const [activeTab, setActiveTab] = useState<TabType>("UNITS");
  const [topics, setTopics] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchTopics = async (pageToFetch: number, tabToFetch: TabType) => {
    if (!batchId || !subjectId) return;

    if (pageToFetch === 1) {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const res = await SubjectInfo(batchId, subjectId, pageToFetch, tabToFetch);
      const newTopics = res.data || [];

      setTopics((prev) =>
        pageToFetch === 1 ? newTopics : [...prev, ...newTopics]
      );

      setHasMore(newTopics.length > 0);
    } catch (err: any) {
      console.error("Error fetching topics:", err);
      if (err.response?.status === 401) {
        toast.error("Unauthorized: Please login again.");
      } else {
        toast.error("Failed to load topic details");
      }
      setError("Failed to fetch topics");
      if (pageToFetch === 1) setTopics([]);
      setHasMore(false);
    } finally {
      if (pageToFetch === 1) {
        setLoadingInitial(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Trigger initial fetch on tab or batch/subject change
  useEffect(() => {
    setPage(1);
    setTopics([]);
    setHasMore(true);
    fetchTopics(1, activeTab);
  }, [batchId, subjectId, activeTab]);

  // Fetch when page incremented
  useEffect(() => {
    if (page > 1) {
      fetchTopics(page, activeTab);
    }
  }, [page]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // Pad numbers with leading zeros (e.g., 1 -> 01)
  const formatIndex = (idx: number) => String(idx).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[var(--spring-gradient-bg)] transition-colors duration-300">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        
        {/* ─── Subject Header ─────────────────────────── */}
        <div className="mb-8">
          <p className="text-[12px] font-bold uppercase tracking-widest text-[#22c55e] dark:text-[#6dd477] mb-1">
            Subject View
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 transition-colors">
            {GetSubjectName(subjectId || "unknown")}
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5 transition-colors">
            Access chapter lectures, DPP PDFs, study material, and resources
          </p>
        </div>

        {/* ─── Tabs Navigation ───────────────────────── */}
        <div className="flex border-b border-gray-250 dark:border-gray-800/80 mb-6 gap-6 overflow-x-auto no-scrollbar">
          {(["UNITS", "STUDY_MATERIAL", "DIGITAL_BOOKS"] as const).map((tab) => {
            const label =
              tab === "UNITS"
                ? "Chapters"
                : tab === "STUDY_MATERIAL"
                ? "Study Material"
                : "Digital Books";

            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-1 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab
                    ? "border-[var(--spring-leaf)] text-[var(--spring-leaf)] dark:border-[var(--spring-mint)] dark:text-[var(--spring-mint)]"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ─── Cards Grid ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loadingInitial ? (
            // Show skeleton loader cards
            Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="p-5 rounded-2xl animate-pulse spring-glass-card flex justify-between items-center"
              >
                <div className="space-y-3 flex-1">
                  <div className="h-4 w-12 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-3.5 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
                </div>
                <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-800 shrink-0" />
              </div>
            ))
          ) : topics.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
              <BookOpen size={48} className="text-gray-300 dark:text-gray-650 mb-4 stroke-1.5" />
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
                No Content Found
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                There are no units or study materials uploaded under this section.
              </p>
            </div>
          ) : (
            topics.map((topic, index) => {
              // Format label (e.g. CH - 01 or SM - 01)
              const prefix = activeTab === "UNITS" ? "CH" : "SM";
              const paddedIdx = formatIndex(index + 1);
              
              // Stats labels
              let statText = "";
              if (activeTab === "UNITS") {
                // Realistic progress tracking math
                const mockLecturesWatched =
                  topic.videos > 12
                    ? Math.floor(topic.videos * 0.9)
                    : topic.videos > 0
                    ? Math.floor(topic.videos * 0.1) || 1
                    : 0;
                
                const mockDppsCompleted =
                  topic.exercises > 3
                    ? Math.floor(topic.exercises * 0.1) || 1
                    : 0;

                statText = `Lecture: ${mockLecturesWatched}/${topic.videos || 0} • DPP: ${mockDppsCompleted}/${topic.exercises || 0}`;
              } else {
                const totalVideos = topic.videos || topic.lectureVideos || 0;
                const totalNotes = topic.notes || 0;
                
                if (totalVideos > 0 && totalNotes > 0) {
                  statText = `${totalVideos} Lectures • ${totalNotes} Notes`;
                } else if (totalVideos > 0) {
                  statText = `${totalVideos} Lectures`;
                } else if (totalNotes > 0) {
                  statText = `${totalNotes} Notes`;
                } else {
                  statText = "0 Notes";
                }
              }

              return (
                <article
                  key={topic._id}
                  onClick={() =>
                    router.push(
                      `/study/batches/${batchId}/subjects/${subjectId}/subject-topics/${topic.slug}`
                    )
                  }
                  className="group relative flex justify-between items-center p-5 rounded-2xl cursor-pointer hover-3d-card animate-card-shine spring-glass-card transition-all duration-300"
                >
                  <div className="text-left flex-1 min-w-0 pr-4">
                    {/* Index Badge */}
                    <span className="inline-block text-[9px] font-extrabold uppercase tracking-widest text-[#2563eb] dark:text-[#60a5fa] bg-[#eff6ff] dark:bg-[#1e3a8a]/30 px-2 py-0.5 rounded-md">
                      {prefix} - {paddedIdx}
                    </span>

                    {/* Topic Title */}
                    <h2 className="text-[15px] font-bold text-gray-800 dark:text-gray-150 leading-snug line-clamp-2 mt-2 group-hover:text-[var(--spring-leaf)] dark:group-hover:text-white transition-colors duration-200">
                      {topic.name}
                    </h2>

                    {/* Stats */}
                    <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mt-1.5">
                      {statText}
                    </p>
                  </div>

                  {/* Arrow Action */}
                  <div className="w-8 h-8 rounded-full border border-gray-150 dark:border-gray-800 flex items-center justify-center shrink-0 group-hover:border-[var(--spring-leaf)] dark:group-hover:border-white transition-colors duration-200">
                    <ChevronRight
                      size={14}
                      className="text-gray-400 group-hover:text-[var(--spring-leaf)] dark:group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200"
                    />
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* ─── Load More Button ───────────────────────── */}
        {hasMore && !loadingInitial && topics.length > 0 && (
          <div className="flex justify-center mt-8">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-xl border border-gray-250 dark:border-gray-800 text-[12px] font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-850 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        {/* ─── Error Notification ─────────────────────── */}
        {error && (
          <div className="mt-6 text-sm text-red-500 font-bold text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function GetSubjectName(slug?: string): string {
  if (!slug) return "Unknown";

  try {
    const decoded = decodeURIComponent(slug);
    const cleaned = decoded.replace(/-\d+$/, "");
    return cleaned
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch (e) {
    console.error("Invalid slug:", slug);
    return "Unknown";
  }
}
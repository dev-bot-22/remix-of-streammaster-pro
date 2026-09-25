"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { TopicInfo, GetPdf } from "@/utils/api";
import { toast } from "sonner";
import { LectureRow } from "@/app/components/LectureRow";
import { VideoOff } from "lucide-react";

interface LectureItem {
  _id: string;
  topic?: string;
  date: string;
  urlType?: string;
  isLocked?: boolean;
  contentType?: string;
  teacherImage?: string;
  videoDetails?: {
    _id?: string;
    id?: string;
    name?: string;
    image?: string;
    duration?: string;
    videoUrl?: string;
    embedCode?: string;
  };
  homeworkIds?: Array<{
    _id: string;
    topic?: string;
    note?: string;
    attachmentIds?: Array<{
      _id: string;
      baseUrl: string;
      key: string;
      name: string;
    }>;
  }>;
}

export default function BatchContentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const batchId = params?.batchid as string;
  const subjectId = params?.subjectid as string;
  const topicId = params?.topicid as string;

  const isKhazana = searchParams?.get("isKhazana") === "true";
  const khazanaProgramId = searchParams?.get("programId") || "";
  const khazanaChapterId = searchParams?.get("chapterId") || "";

  // Active Tab state: "all" | "lectures" | "dpps" | "notes" | "dppPdfs" | "dppVideos"
  const [activeTab, setActiveTab] = useState<string>("all");

  // Content items state
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ─── Attachments Modal State ───────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<LectureItem | null>(null);
  const [attachmentsData, setAttachmentsData] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const handleOpenAttachments = useCallback(
    async (lectureItem: LectureItem) => {
      setSelectedLecture(lectureItem);
      setIsModalOpen(true);
      setModalLoading(true);
      setAttachmentsData(null);
      try {
        const res = await fetch(
          `/api/Schedule?BatchId=${batchId}&SubjectId=${subjectId}&ContentId=${lectureItem._id}`
        );
        if (!res.ok) throw new Error("Failed to load attachments");
        const json = await res.json();
        if (json.success && json.data) {
          setAttachmentsData(json.data);
        } else {
          throw new Error("No attachments found");
        }
      } catch (err: any) {
        console.error("Failed to load attachments:", err);
        // Fallback to local lecture properties if API fails or fails to return data
        setAttachmentsData({
          homeworkIds: lectureItem.homeworkIds || [],
          exerciseIds: [],
        });
      } finally {
        setModalLoading(false);
      }
    },
    [batchId, subjectId]
  );

  // ─── Helpers ──────────────────────────────────────────
  function getDisplayName(slug: string): string {
    if (!slug) return "Unknown";
    try {
      const decoded = decodeURIComponent(slug);
      const cleaned = decoded
        .replace(/-+\d+$/, "")
        .replace(/-+/g, " ")
        .trim();
      return cleaned
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    } catch {
      return "Unknown";
    }
  }

  // ─── PDF open handler ─────────────────────────────────
  const handleOpenPdf = useCallback(
    async (pdfItem: any) => {
      if (!pdfItem) return;
      try {
        const attachment = pdfItem.homeworkIds?.[0]?.attachmentIds?.[0];
        if (attachment?.key && attachment?.baseUrl) {
          const fullUrl = attachment.baseUrl + attachment.key;
          try {
            const headRes = await fetch(fullUrl, { method: "HEAD" });
            if (headRes.ok) {
              window.open(fullUrl, "_blank");
              return;
            }
          } catch (err) {
            console.warn("HEAD check failed:", err);
          }
        }

        await toast.promise(
          (async () => {
            const result = await GetPdf(batchId, subjectId, pdfItem._id);
            const key = result?.data?.key;
            const baseUrl = result?.data?.baseUrl;
            if (key && baseUrl) {
              const fullUrl = baseUrl + key;
              const headRes = await fetch(fullUrl, { method: "HEAD" });
              if (headRes.ok) {
                window.open(fullUrl, "_blank");
              } else {
                throw new Error("PDF exists but couldn't be opened.");
              }
            } else {
              throw new Error("PDF not available.");
            }
          })(),
          {
            loading: "Fetching PDF…",
            success: "PDF opened!",
            error: (err) => err?.message || "Error opening PDF.",
          }
        );
      } catch (error: any) {
        console.error("handleOpenPdf error:", error);
        toast.error(error.message || "Something went wrong opening the PDF.");
      }
    },
    [batchId, subjectId]
  );

  // ─── Reset on route change ────────────────────────────
  useEffect(() => {
    setPage(1);
    setLectures([]);
    setHasMore(true);
    setActiveTab("all");
  }, [batchId, subjectId, topicId]);

  // ─── Reset page on tab change ────────────────────────
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
    setLectures([]);
    setHasMore(true);
  };

  // ─── Fetch contents ───────────────────────────────────
  useEffect(() => {
    if (!batchId || !subjectId || !topicId) return;

    const fetchContents = async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        let apiContentType = "all";
        if (activeTab === "all") apiContentType = "all";
        else if (activeTab === "lectures") apiContentType = "videos";
        else if (activeTab === "dpps") apiContentType = "dpps";
        else if (activeTab === "notes") apiContentType = "notes";
        else if (activeTab === "dppPdfs") apiContentType = "dppPdfs";
        else if (activeTab === "dppVideos") apiContentType = "dppVideos";

        const response = await TopicInfo(
          batchId,
          subjectId,
          topicId,
          apiContentType,
          page,
          isKhazana,
          khazanaProgramId,
          khazanaChapterId
        );

        const items = response.data || [];
        setLectures((prev) => (page === 1 ? items : [...prev, ...items]));
        setHasMore(items.length > 0);
      } catch (err: any) {
        console.error("Error fetching contents:", err);
        if (err.response?.status === 401) {
          toast.error("Unauthorized: Please login again.");
        } else {
          toast.error("Failed to load contents");
        }
        if (page === 1) setLectures([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    fetchContents();
  }, [batchId, subjectId, topicId, activeTab, page, isKhazana, khazanaProgramId, khazanaChapterId]);

  const subjectTitle = getDisplayName(subjectId);

  return (
    <div className="min-h-screen bg-[var(--spring-gradient-bg)] transition-colors duration-300">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* ─── Page Header ─────────────────────────── */}
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#22c55e] dark:text-[#6dd477] mb-1">
            {subjectTitle}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 transition-colors">
            {topicId === "all" ? "All Lectures" : getDisplayName(topicId)}
          </h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5 transition-colors">
            Lectures, notes &amp; practice problems in one place
          </p>
        </div>

        {/* ─── Navigation Tabs ─────────────────────── */}
        <div className="flex border-b border-gray-200 dark:border-gray-800/80 mb-6 gap-6 overflow-x-auto no-scrollbar">
          {(["all", "lectures", "notes", "dppPdfs", "dppVideos"] as const).map((tab) => {
            const label =
              tab === "all"
                ? "All"
                : tab === "lectures"
                ? "Lectures"
                : tab === "notes"
                ? "Notes"
                : tab === "dppPdfs"
                ? "DPP PDFs"
                : "DPP Videos";

            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`px-1 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
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

        {/* ─── Tab Content List ────────────────────── */}
        <div className="space-y-3 mb-10">
          {page === 1 && loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <LectureRow key={`skel-${i}`} lectureId="" isPlaceholder />
            ))
          ) : lectures.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
              <VideoOff size={48} className="text-gray-300 dark:text-gray-650 mb-4 stroke-1.5" />
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No Content Found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
                There are no items uploaded for this topic under this tab yet.
              </p>
            </div>
          ) : (
            lectures.map((item) => {
              const isVideo =
                item.contentType?.toUpperCase() === "LECTURE" ||
                item.contentType?.toUpperCase() === "DPP_VIDEO" ||
                item.contentType?.toUpperCase() === "VIDEO";
              const hasAttachment = !!(item.homeworkIds && item.homeworkIds.length > 0);

              return (
                <LectureRow
                  key={item._id}
                  lectureId={item._id}
                  type={item.contentType || (isVideo ? "LECTURE" : "NOTES")}
                  thumbnail={item.teacherImage || item.videoDetails?.image || undefined}
                  title={item.topic || item.videoDetails?.name || item.homeworkIds?.[0]?.topic || "Untitled Content"}
                  duration={item.videoDetails?.duration || undefined}
                  date={
                    item.date
                      ? new Date(item.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : undefined
                  }
                  onClick={() => {
                    router.push(
                      `/watch?batchId=${batchId}&SubjectId=${subjectId}&ChildId=${item._id}&Type=${
                        item.urlType || "penpencilvdo"
                      }&isLocked=${item.isLocked || false}&topicId=${encodeURIComponent(topicId)}${
                        item.videoDetails?._id || item.videoDetails?.id
                          ? `&videoId=${item.videoDetails?._id || item.videoDetails?.id}`
                          : ""
                      }${
                        isKhazana
                          ? `&isKhazana=true&programId=${khazanaProgramId}&chapterId=${khazanaChapterId}`
                          : ""
                      }`
                    );
                  }}
                  dppAvailable={hasAttachment && item.contentType?.toUpperCase()?.includes("DPP")}
                  notesAvailable={hasAttachment}
                  onDppClick={() => handleOpenAttachments(item)}
                  onNotesClick={() => handleOpenAttachments(item)}
                />
              );
            })
          )}
        </div>

        {/* ─── Load More Button ────────────────────── */}
        {hasMore && lectures.length > 0 && (
          <div className="flex justify-center mb-12">
            <button
              onClick={() => {
                if (!loadingMore) setPage((p) => p + 1);
              }}
              disabled={loadingMore}
              className="px-8 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 disabled:opacity-40 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-spring-leaf dark:hover:border-spring-mint/40 hover:text-spring-leaf dark:hover:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-gray-400 dark:border-gray-700 border-t-gray-700 dark:border-t-gray-300 rounded-full animate-spin" />
                  Loading…
                </span>
              ) : (
                "Load More Content"
              )}
            </button>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-12" />

        {/* ─── Attachments Modal ────────────────────── */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#1a2b1d]/95 dark:border border-spring-leaf/10 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl animate-scaleUp">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Attachments
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                {modalLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <span className="w-8 h-8 border-3 border-spring-leaf/30 border-t-spring-leaf rounded-full animate-spin" />
                    <p className="text-xs text-gray-400">Loading attachments…</p>
                  </div>
                ) : (
                  <>
                    {/* Collapsible Section for NOTES */}
                    {((attachmentsData?.homeworkIds && attachmentsData.homeworkIds.length > 0) ||
                      (attachmentsData?.dpp?.homeworkIds && attachmentsData.dpp.homeworkIds.length > 0)) && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-extrabold tracking-wider text-gray-400 uppercase">
                          <span>Notes & PDFs</span>
                          <span className="h-px bg-gray-100 dark:bg-gray-800 flex-1 ml-4" />
                        </div>
                        <div className="space-y-2">
                          {[
                            ...(attachmentsData.homeworkIds || []),
                            ...(attachmentsData.dpp?.homeworkIds || []),
                          ].map((homework: any) => {
                            const att = homework.attachmentIds?.[0];
                            if (!att) return null;
                            const fullUrl = att.baseUrl + att.key;
                            return (
                              <div
                                key={homework._id || att._id}
                                onClick={() => window.open(fullUrl, "_blank")}
                                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-850 hover:border-spring-leaf/30 bg-gray-50/40 dark:bg-white/[0.01] hover:bg-spring-leaf/5 dark:hover:bg-spring-leaf/5 cursor-pointer transition group"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* PDF Icon container */}
                                  <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/20 flex items-center justify-center shrink-0">
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                  </div>
                                  <div className="text-left min-w-0">
                                    <h4 className="text-sm font-bold text-gray-850 dark:text-gray-200 truncate group-hover:text-spring-leaf dark:group-hover:text-spring-mint transition">
                                      {homework.topic || att.name}
                                    </h4>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                      {homework.note || "PDF Attachment"}
                                    </p>
                                  </div>
                                </div>
                                <button className="p-2 text-gray-400 hover:text-spring-leaf dark:hover:text-spring-mint rounded-lg bg-transparent">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Collapsible Section for EXERCISES / QUIZ */}
                    {attachmentsData?.exerciseIds && attachmentsData.exerciseIds.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-extrabold tracking-wider text-gray-400 uppercase">
                          <span>DPP Quizzes</span>
                          <span className="h-px bg-gray-100 dark:bg-gray-800 flex-1 ml-4" />
                        </div>
                        <div className="space-y-2">
                          {attachmentsData.exerciseIds.map((ex: any) => (
                            <div
                              key={ex._id}
                              onClick={() =>
                                router.push(
                                  `/study/batches/${batchId}/subjects/${subjectId}/tests/${ex._id}`
                                )
                              }
                              className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-850 hover:border-spring-leaf/30 bg-gray-50/40 dark:bg-white/[0.01] hover:bg-spring-leaf/5 dark:hover:bg-spring-leaf/5 cursor-pointer transition group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Quiz / Trophy Icon */}
                                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center shrink-0">
                                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.375a3.375 3.375 0 11-6.75 0h-.375c-.621 0-1.125.504-1.125 1.125v3.375m9 0h-9m10.125-9h-.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h.375c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125zm-12.375 0h-.375C3.504 3.75 3 4.254 3 4.879v1.5c0 .621.504 1.125 1.125 1.125h.375c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125z" />
                                  </svg>
                                </div>
                                <div className="text-left min-w-0">
                                  <h4 className="text-sm font-bold text-gray-850 dark:text-gray-200 truncate group-hover:text-spring-leaf dark:group-hover:text-spring-mint transition">
                                    {ex.title}
                                  </h4>
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {ex.content?.[0]?.exerciseId?.totalQuestions || 0} Questions •{" "}
                                    {ex.content?.[0]?.exerciseId?.maxDuration || 0} Mins
                                  </p>
                                </div>
                              </div>
                              <button className="px-3 py-1.5 text-[10px] font-bold text-amber-600 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 active:scale-95 transition">
                                Start Quiz
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!attachmentsData ||
                      ((!attachmentsData.homeworkIds || attachmentsData.homeworkIds.length === 0) &&
                        (!attachmentsData.dpp?.homeworkIds || attachmentsData.dpp.homeworkIds.length === 0) &&
                        (!attachmentsData.exerciseIds || attachmentsData.exerciseIds.length === 0))) && (
                      <div className="flex flex-col items-center justify-center py-10 text-center select-none">
                        <span className="text-3xl mb-2">📁</span>
                        <p className="text-sm font-bold text-gray-500">No attachments found</p>
                        <p className="text-xs text-gray-400 mt-1">There are no files or quizzes uploaded for this lecture yet.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

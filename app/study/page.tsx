"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BRAND_LOGO } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import PromotionPopup from "@/app/components/PromotionPopup";

import {
  getEnrolledBatches,
  getTodaysSchedule,
  getUserDetailsList,
} from "@/utils/api";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Clock, Search, X, Share2, Bell } from "lucide-react";
import { BatchVerificationBadge } from "@/app/components/BatchVerificationBadge";

type EnrolledBatch = { _id: string; batchId: string; name: string };

export default function Home() {
  const router = useRouter();
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [availableClasses, setAvailableClasses] = useState<EnrolledBatch[]>([]);
  const [schedule, setSchedule] = useState([]);
  const [teacherMap, setTeacherMap] = useState<
    Record<string, { name: string; imageUrl: string }>
  >({});

  const [selectedClass, setSelectedClass] = useState<EnrolledBatch>({
    _id: "",
    batchId: "",
    name: "Select Batch",
  });
  
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Drawer / Sidebar state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tempSelectedBatchId, setTempSelectedBatchId] = useState<string>("");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);

  // Floating movable widget state & drag handlers
  const [isWidgetDragging, setIsWidgetDragging] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Load custom position from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ai_guru_position");
      if (saved && widgetRef.current) {
        try {
          const { left, top } = JSON.parse(saved);
          widgetRef.current.style.left = `${left}px`;
          widgetRef.current.style.top = `${top}px`;
          widgetRef.current.style.bottom = "auto";
          widgetRef.current.style.right = "auto";
        } catch (e) {}
      }
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsWidgetDragging(false);
    dragStart.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStart.current.x;
      const dy = moveEvent.clientY - dragStart.current.y;
      
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        setIsWidgetDragging(true);
      }

      if (widgetRef.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        const currentTop = moveEvent.clientY - rect.height / 2;
        const currentLeft = moveEvent.clientX - rect.width / 2;
        
        widgetRef.current.style.top = `${currentTop}px`;
        widgetRef.current.style.left = `${currentLeft}px`;
        widgetRef.current.style.bottom = "auto";
        widgetRef.current.style.right = "auto";
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      
      if (widgetRef.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const snapLeft = rect.left < viewportWidth / 2;
        const finalLeft = snapLeft ? 24 : viewportWidth - rect.width - 24;
        const finalTop = Math.max(24, Math.min(viewportHeight - rect.height - 24, rect.top));
        
        widgetRef.current.style.transition = "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
        widgetRef.current.style.left = `${finalLeft}px`;
        widgetRef.current.style.top = `${finalTop}px`;
        
        localStorage.setItem(
          "ai_guru_position",
          JSON.stringify({ left: finalLeft, top: finalTop })
        );
        
        setTimeout(() => {
          if (widgetRef.current) {
            widgetRef.current.style.transition = "";
          }
        }, 300);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsWidgetDragging(false);
    const touch = e.touches[0];
    dragStart.current = { x: touch.clientX, y: touch.clientY };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const touchMove = moveEvent.touches[0];
      const dx = touchMove.clientX - dragStart.current.x;
      const dy = touchMove.clientY - dragStart.current.y;
      
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        setIsWidgetDragging(true);
      }

      if (widgetRef.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        const currentTop = touchMove.clientY - rect.height / 2;
        const currentLeft = touchMove.clientX - rect.width / 2;
        
        widgetRef.current.style.top = `${currentTop}px`;
        widgetRef.current.style.left = `${currentLeft}px`;
        widgetRef.current.style.bottom = "auto";
        widgetRef.current.style.right = "auto";
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      
      if (widgetRef.current) {
        const rect = widgetRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        const snapLeft = rect.left < viewportWidth / 2;
        const finalLeft = snapLeft ? 24 : viewportWidth - rect.width - 24;
        const finalTop = Math.max(24, Math.min(viewportHeight - rect.height - 24, rect.top));
        
        widgetRef.current.style.transition = "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)";
        widgetRef.current.style.left = `${finalLeft}px`;
        widgetRef.current.style.top = `${finalTop}px`;
        
        localStorage.setItem(
          "ai_guru_position",
          JSON.stringify({ left: finalLeft, top: finalTop })
        );
        
        setTimeout(() => {
          if (widgetRef.current) {
            widgetRef.current.style.transition = "";
          }
        }, 300);
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
  };


  const TgChannel = serverInfo?.tg_channel || process.env.NEXT_PUBLIC_TG;

  const promotion = {
    title: "Telegram Community !!",
    message: `Join The Channel For Latest Updates 👍 Don't miss any Future updates!`,
    imageUrl: "/telegram-banner.png",
    button: { Name: "Join Now!", Link: TgChannel },
  };

  useEffect(() => {
    async function fetchServerInfo() {
      try {
        const res = await fetch("/api/auth/serverInfo");
        if (!res.ok) throw new Error("Failed to fetch server info");
        const data = await res.json();
        setServerInfo(data);
      } catch (err) {
        setError("Could not load server info");
      } finally {
        setLoading(false);
      }
    }
    fetchServerInfo();
  }, []);

  const OpenTelegramChannel = () => {
    window.open(TgChannel, "_blank");
  };

  const fetchTodaysSchedule = async (batchId: string) => {
    try {
      const scheduleRes = await getTodaysSchedule(batchId);
      const scheduleData = scheduleRes.data || [];
      const videoSchedule = scheduleData;

      const teacherIdSet = new Set<string>();
      videoSchedule.forEach((item: any) => {
        if (Array.isArray(item.teachers) && item.teachers.length > 0) {
          item.teachers.forEach((id: string) => teacherIdSet.add(id));
        }
      });
      const uniqueTeacherIds = Array.from(teacherIdSet);

      let teacherList: any[] = [];
      if (uniqueTeacherIds.length > 0) {
        const teacherRes = await getUserDetailsList(uniqueTeacherIds);
        teacherList = teacherRes.data || [];
      }

      const teacherMapTemp: Record<string, { name: string; imageUrl: string }> =
        {};

      teacherList.forEach((teacher: any) => {
        teacherMapTemp[teacher._id] = {
          name: teacher.name,
          imageUrl: teacher.imageId
            ? `${teacher.imageId.baseUrl}${teacher.imageId.key}`
            : "/assets/img/teacher-placeholder.png",
        };
      });

      videoSchedule.forEach((item: any) => {
        const hasTeachers =
          Array.isArray(item.teachers) && item.teachers.length > 0;

        if (!hasTeachers && item.videoDetails?.image) {
          const fallbackId = item._id;
          teacherMapTemp[fallbackId] = {
            name: "",
            imageUrl: item.videoDetails.image,
          };
        }
      });

      setSchedule(videoSchedule);
      setTeacherMap(teacherMapTemp);
      setErrorMsg("");
    } catch (err: any) {
      let message = "Failed to fetch today's schedule.";
      if (
        err?.message?.includes("401") ||
        err?.message?.toLowerCase().includes("unauthorized")
      ) {
        message = "You are not authorized. Please log in again.";
      } else if (err?.message) {
        message = err.message;
      }
      setErrorMsg(message);
      setSchedule([]);
      setTeacherMap({});
    }
  };

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await getEnrolledBatches();
        const fetchedBatches = data.enrolledBatches || [];

        setAvailableClasses(fetchedBatches);
        localStorage.setItem("enrolledBatches", JSON.stringify(fetchedBatches));
        localStorage.setItem("USER_DATA", JSON.stringify(data.user));

        const savedSelectionRaw = localStorage.getItem("selectedBatch");
        let finalSelectedBatch = fetchedBatches[0] || {
          _id: "",
          batchId: "",
          name: "Select Batch",
        };

        if (savedSelectionRaw && savedSelectionRaw !== "undefined") {
          try {
            const savedSelection = JSON.parse(savedSelectionRaw);
            const found = fetchedBatches.find(
              (batch: EnrolledBatch) => batch._id === savedSelection._id
            );
            if (found) finalSelectedBatch = found;
          } catch (parseError) {
            finalSelectedBatch = fetchedBatches[0] || {
              _id: "",
              batchId: "",
              name: "Select Batch",
            };
          }
        }

        setSelectedClass(finalSelectedBatch);
        setTempSelectedBatchId(finalSelectedBatch.batchId);
        localStorage.setItem(
          "selectedBatch",
          JSON.stringify(finalSelectedBatch)
        );

        if (finalSelectedBatch.batchId) {
          fetchTodaysSchedule(finalSelectedBatch.batchId);
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          toast.error("Unauthorized: Please login again.");
        } else {
          toast.error("Failed to load enrolled batches");
        }
        console.error("Failed to load enrolled batches", err);

        setAvailableClasses([]);
        setSelectedClass({
          _id: "",
          batchId: "",
          name: "Select Batch",
        });
      }
    };

    fetchBatches();
  }, []);

  const handleOpenDrawer = () => {
    setTempSelectedBatchId(selectedClass.batchId);
    setSearchQuery("");
    setIsDrawerOpen(true);
  };

  const handleSelectBatch = () => {
    const found = availableClasses.find((b) => b.batchId === tempSelectedBatchId);
    if (found) {
      setSelectedClass(found);
      localStorage.setItem("selectedBatch", JSON.stringify(found));
      window.dispatchEvent(new Event("selectedBatchChanged"));
      fetchTodaysSchedule(found.batchId);
      toast.success(`Selected batch: ${found.name}`);
    }
    setIsDrawerOpen(false);
  };

  // Filter batches by name
  const filteredBatches = availableClasses.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Grouping logic for matching visual layout
  const starredBatches = filteredBatches.slice(0, 2);
  const paidBatches = filteredBatches.slice(2);

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1400px]">
      
      {/* ─── Sleek Header Block ──────────────────────── */}
      {availableClasses.length > 0 && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          <div className="relative z-10 text-left">
            <p className="text-[10px] font-extrabold uppercase tracking-widest !text-gray-400">
              Your Batch
            </p>
            <div 
              onClick={handleOpenDrawer}
              className="flex items-center gap-2 mt-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight !text-white max-w-[220px] sm:max-w-[450px] md:max-w-[600px] lg:max-w-[800px] truncate" title={selectedClass.name}>
                {selectedClass.name}
              </h1>
              <ChevronDown className="w-5 h-5 !text-gray-300" />
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 mt-4 md:mt-0">
            {/* Share Batch Button */}
            <button 
              onClick={() => {
                if (selectedClass.batchId) {
                  const link = `${window.location.origin}/study/batches/${selectedClass.batchId}`;
                  navigator.clipboard.writeText(link);
                  toast.success("Batch link copied to clipboard! 📋");
                } else {
                  toast.error("Please select a batch first");
                }
              }}
              title="Share Batch"
              className="w-9 h-9 rounded-full border border-gray-700 flex items-center justify-center hover:bg-gray-800 hover:border-gray-500 transition-all duration-200 active:scale-90"
            >
              <Share2 size={15} className="text-gray-300 hover:text-white" />
            </button>

            {/* Announcements Bell Button */}
            <button 
              onClick={() => {
                if (selectedClass.batchId) {
                  router.push(`/study/batches/${selectedClass.batchId}?view=announcements`);
                } else {
                  toast.error("Please select a batch first");
                }
              }}
              title="Announcements"
              className="w-9 h-9 rounded-full border border-gray-700 flex items-center justify-center hover:bg-gray-800 hover:border-gray-500 transition-all duration-200 active:scale-90 relative"
            >
              <Bell size={15} className="text-gray-300 hover:text-white" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Batch Offerings ─────────────────────────── */}
      {availableClasses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 text-left mb-4">
            Batch Offerings
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            
            {/* All Classes */}
            <div
              onClick={() => {
                if (selectedClass.batchId) {
                  router.push(`/study/batches/${selectedClass.batchId}?tab=classes`);
                } else {
                  toast.error("Please select a batch first");
                }
              }}
              className="group spring-glass-card hover-3d-card animate-card-shine flex flex-col items-center justify-center p-2.5 sm:p-5 rounded-xl sm:rounded-2xl cursor-pointer hover:border-spring-leaf/30 transition-all duration-300"
            >
              <div className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform">
                <img
                  src="https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/9c943d5d-9eb6-4bc2-92b0-01a5c1a185a4.png"
                  alt="All Classes"
                  className="w-6 h-6 sm:w-10 sm:h-10 object-contain"
                />
              </div>
              <span className="text-[10px] sm:text-[13px] font-bold text-gray-800 dark:text-gray-200">
                All Classes
              </span>
            </div>

            {/* All Tests */}
            <div
              onClick={() => {
                if (selectedClass.batchId) {
                  router.push(`/study/batches/${selectedClass.batchId}?tab=tests`);
                } else {
                  toast.error("Please select a batch first");
                }
              }}
              className="group spring-glass-card hover-3d-card animate-card-shine flex flex-col items-center justify-center p-2.5 sm:p-5 rounded-xl sm:rounded-2xl cursor-pointer hover:border-spring-leaf/30 transition-all duration-300"
            >
              <div className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform">
                <img
                  src="https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/a7950bce-5d91-4940-a8ca-897e695c5f18.svg"
                  alt="All Tests"
                  className="w-6 h-6 sm:w-10 sm:h-10 object-contain"
                />
              </div>
              <span className="text-[10px] sm:text-[13px] font-bold text-gray-800 dark:text-gray-200">
                All Tests
              </span>
            </div>

            {/* Khazana */}
            <div
              onClick={() => {
                if (selectedClass.batchId) {
                  router.push(`/study/batches/${selectedClass.batchId}?tab=infinite`);
                } else {
                  toast.error("Please select a batch first");
                }
              }}
              className="group spring-glass-card hover-3d-card animate-card-shine flex flex-col items-center justify-center p-2.5 sm:p-5 rounded-xl sm:rounded-2xl cursor-pointer hover:border-spring-leaf/30 transition-all duration-300"
            >
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-4.5 h-4.5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <span className="text-[10px] sm:text-[13px] font-bold text-gray-800 dark:text-gray-200">
                Khazana
              </span>
            </div>

            {/* Community */}
            <div
              onClick={() => {
                if (selectedClass.batchId) {
                  router.push(
                    `/community?batchId=${selectedClass.batchId}&batchName=${encodeURIComponent(selectedClass.name)}`
                  );
                } else {
                  toast.error("Please select a batch first");
                }
              }}
              className="group spring-glass-card hover-3d-card animate-card-shine flex flex-col items-center justify-center p-2.5 sm:p-5 rounded-xl sm:rounded-2xl cursor-pointer hover:border-spring-leaf/30 transition-all duration-300"
            >
              <div className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center mb-1.5 sm:mb-3 group-hover:scale-110 transition-transform">
                <img
                  src="https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/07bb7f6c-9710-4ec0-a2cb-a2c488a7888d.svg"
                  alt="Community"
                  className="w-6 h-6 sm:w-10 sm:h-10 object-contain"
                />
              </div>
              <span className="text-[10px] sm:text-[13px] font-bold text-gray-800 dark:text-gray-200">
                Community
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ─── Class Schedule / Live Section ───────────── */}
      <div className="glass-card !rounded-2xl p-4 sm:p-6 mb-6">
        {availableClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none animate-fadeIn">
            <div className="text-5xl mb-4 animate-float">📚</div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
              Not enrolled in any batch
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-sm leading-relaxed">
              Explore our educational batches, search for your curriculum, and get started on your learning journey today.
            </p>
            <button
              onClick={() => router.push("/study/batches")}
              className="mt-6 spring-btn-primary flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300"
            >
              Enroll Now 🍃
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-150 text-left">
                  Upcoming Events ({schedule.length})
                </h3>
                {schedule.length > 4 && (
                  <button
                    onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold border border-spring-leaf/20 dark:border-spring-mint/15 hover:border-spring-leaf text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 rounded-xl transition-all duration-200 active:scale-95 flex items-center gap-1 shrink-0"
                  >
                    <span>{showAllUpcoming ? "Show Less" : "Show All"}</span>
                    <svg
                      className={`w-3.5 h-3.5 transform transition-transform duration-200 ${
                        showAllUpcoming ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                )}
              </div>
              
              {errorMsg && (
                <div className="bg-red-100 text-red-700 p-3 rounded-xl mb-4 text-center text-sm font-semibold">
                  {errorMsg}
                </div>
              )}

              {schedule.length === 0 ? (
                <div className="glass-card !p-8 text-center text-foreground w-full !rounded-2xl border border-gray-100 dark:border-gray-800">
                  Classes not Scheduled yet
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(showAllUpcoming ? schedule : schedule.slice(0, 4)).map((cls: any) => {
                    const teacherId = cls.teachers?.[0];
                    const teacher = teacherMap[teacherId] || teacherMap[cls._id];

                    const teacherName = teacher?.name || "";
                    const teacherImage = teacher?.imageUrl;

                    const startTime = new Date(cls.startTime);
                    const endTime = new Date(cls.endTime);
                    const now = new Date();

                    const isBefore = now < startTime;
                    const isDuring = now >= startTime && now <= endTime;
                    const isAfter = now > endTime;

                    const hoursLeft = Math.floor(
                      (startTime.getTime() - now.getTime()) / (1000 * 60 * 60)
                    );
                    const minutesLeft = Math.floor(
                      ((startTime.getTime() - now.getTime()) / (1000 * 60)) % 60
                    );

                    const handleClick = () => {
                      const { batchId, subjectId, _id: childId, urlType } = cls;

                      const isActuallyVideo =
                        cls.isVideoLecture ||
                        urlType === "penpencilvdo" ||
                        urlType === "awsVideo" ||
                        urlType === "vimeo" ||
                        cls.videoDetails?.videoUrl ||
                        cls.videoDetails?.id ||
                        cls.videoDetails?._id;

                      // Open notice attachments directly on click
                      if (cls.subjectId?.name === "Notices" || (!isActuallyVideo && cls.hasAttachment)) {
                        const attachment = cls.homeworkIds?.[0]?.attachmentIds?.[0];
                        if (attachment?.key && attachment?.baseUrl) {
                          window.open(attachment.baseUrl + attachment.key, "_blank");
                        } else {
                          toast.error("No attachment PDF found for this notice.");
                        }
                        return;
                      }

                      if (
                        urlType === "vimeo" ||
                        (urlType === "awsVideo" && isBefore)
                      ) {
                        if (startTime > now) {
                          toast.error(
                            `Upcoming live class in ${hoursLeft > 0 ? `${hoursLeft}h ` : ""
                            }${minutesLeft}m`
                          );
                        } else {
                          toast.error(
                            "This class has not started yet. Try refreshing..."
                          );
                        }
                      } else if (urlType === "penpencilvdo") {
                        const videoIdParam = cls.videoDetails?._id || cls.videoDetails?.id
                          ? `&videoId=${cls.videoDetails?._id || cls.videoDetails?.id}`
                          : "";
                        router.push(
                          `/watch?batchId=${batchId}&SubjectId=${subjectId?._id}&ChildId=${childId}&Type=penpencilvdo&isLocked=false${videoIdParam}`
                        );
                      } else if (urlType === "awsVideo") {
                        if (isDuring) {
                          router.push(
                            `/live?batchId=${batchId}&SubjectId=${subjectId?._id}&ChildId=${childId}&Type=awsVideo&startTime=${cls.startTime}`
                          );
                        } else if (isAfter) {
                          toast.error("Live session has ended.");
                        }
                      }
                    };

                    const formattedTime = startTime.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    const subjectName = cls.subjectId?.name || "Subject";
                    const isNotice = subjectName === "Notices";

                    return (
                      <div
                        key={cls._id}
                        onClick={handleClick}
                        className="hover-3d-card animate-card-shine spring-glass-card flex items-center justify-between p-4 rounded-2xl cursor-pointer hover:border-spring-leaf/30 transition-all duration-200"
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          {/* Rounded green avatar box */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-[#e8f5e9] dark:bg-[#1b2b1d] border border-spring-leaf/10 relative">
                            {isNotice || !teacherImage || teacherImage === "/assets/img/teacher-placeholder.png" || teacherImage.includes("placeholder") ? (
                              <Image
                                src={BRAND_LOGO}
                                alt="PW-MARCO"
                                fill
                                className="object-contain p-2 opacity-85"
                              />
                            ) : (
                              <Image
                                src={teacherImage}
                                alt={teacherName || "Teacher"}
                                fill
                                className="object-cover object-top"
                              />
                            )}
                          </div>

                          {/* Details info */}
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Clock size={12} />
                                <span>{formattedTime}</span>
                              </div>
                              {cls.tag && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    cls.tag.toUpperCase() === "LIVE"
                                      ? "bg-red-500/10 text-red-500 border border-red-500/20 dark:bg-red-500/20 dark:text-red-400"
                                      : cls.tag.toUpperCase() === "UPCOMING"
                                      ? "bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400"
                                      : cls.tag.toUpperCase() === "ENDED"
                                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400"
                                      : "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400"
                                  }`}
                                >
                                  {cls.tag}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-gray-855 dark:text-gray-250 truncate mt-1">
                              {isNotice ? cls.topic : `Lecture • ${subjectName}`}
                            </h4>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5" title={cls.topic}>
                              {isNotice ? (cls.homeworkIds?.[0]?.attachmentIds?.[0]?.name || "Class Schedule PDF") : cls.topic}
                            </p>
                          </div>
                        </div>

                        {/* Right chevron */}
                        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 ml-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-center mt-6">
              <button
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-[#1c2b22]/50 text-gray-800 dark:text-gray-200 font-bold text-xs active:scale-95 transition-all shadow-sm"
                onClick={() => {
                  if (selectedClass.batchId) {
                    router.push(`/study/batches/${selectedClass.batchId}`);
                  } else {
                    toast.error("You haven't enrolled in any batches!!");
                  }
                }}
              >
                View Batch Details
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── Telegram Community ─────────────────────── */}
      <div className="glass-card !rounded-2xl p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 text-left">
          <div>
            <h2 className="text-xl font-semibold">Join Our Community 🚀</h2>
            <p className="text-muted-foreground mt-1">
              Join our Telegram channel to receive the latest updates 📢 and
              batch information 📚
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            className="flex items-center gap-2"
            onClick={() => OpenTelegramChannel()}
          >
            Join Telegram Channel
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <PromotionPopup promotion={promotion} />

      {/* ─── Sidebar Drawer Overlay for Select Batch ──── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
          ></div>

          {/* Drawer container */}
          <div className="relative z-10 w-full sm:w-[400px] h-full bg-white dark:bg-[#111] shadow-2xl flex flex-col justify-between p-6 transform translate-x-0 transition-transform duration-300 animate-slideLeft select-none text-left">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-150 dark:border-gray-850">
                <h2 className="text-lg font-extrabold text-gray-800 dark:text-gray-100">
                  Select your batch
                </h2>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-850 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search input */}
              <div className="relative mt-5 mb-5">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for your batches"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-800 dark:text-gray-250 transition-colors"
                />
              </div>

              {/* Batch list scroll */}
              <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-250px)] pr-1 no-scrollbar">
                
                {/* Starred Batches */}
                {starredBatches.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2.5">
                      Starred Batches ({starredBatches.length})
                    </h3>
                    <div className="space-y-1">
                      {starredBatches.map((batch) => (
                        <label
                          key={batch._id}
                          className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                            tempSelectedBatchId === batch.batchId
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-extrabold"
                              : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-amber-500 shrink-0 text-sm">★</span>
                            <span className="truncate text-[13px]">{batch.name}</span>
                          </div>
                          <input
                            type="radio"
                            name="starredBatchSelect"
                            checked={tempSelectedBatchId === batch.batchId}
                            onChange={() => setTempSelectedBatchId(batch.batchId)}
                            className="w-4 h-4 accent-purple-600 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer shrink-0"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paid Batches */}
                {paidBatches.length > 0 && (
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 mb-2.5">
                      Paid Batches ({paidBatches.length})
                    </h3>
                    <div className="space-y-1">
                      {paidBatches.map((batch) => (
                        <label
                          key={batch._id}
                          className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                            tempSelectedBatchId === batch.batchId
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 font-extrabold"
                              : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-gray-300 dark:text-gray-600 shrink-0 text-sm">☆</span>
                            <span className="truncate text-[13px]">{batch.name}</span>
                          </div>
                          <input
                            type="radio"
                            name="paidBatchSelect"
                            checked={tempSelectedBatchId === batch.batchId}
                            onChange={() => setTempSelectedBatchId(batch.batchId)}
                            className="w-4 h-4 accent-purple-600 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer shrink-0"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {filteredBatches.length === 0 && (
                  <div className="text-center py-8 text-sm text-gray-400">
                    No batches match your search
                  </div>
                )}
              </div>
            </div>

            {/* Action Footer */}
            <div className="pt-4 border-t border-gray-150 dark:border-gray-850">
              <button
                onClick={handleSelectBatch}
                className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 font-bold text-sm shadow-md active:scale-98 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Floating AI Guru Widget */}
      <div 
        ref={widgetRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="fixed bottom-6 right-6 z-50 cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <button
          onClick={() => {
            if (!isWidgetDragging) {
              router.push("/ai-guru");
            }
          }}
          className="flex items-center justify-center w-16 h-16 rounded-full bg-white dark:bg-gray-800 shadow-2xl border border-gray-150 dark:border-gray-700 hover:scale-110 active:scale-95 transition-all duration-300 relative group"
          title="AI Guru"
        >
          <img
            src="https://www.pw.live/study-v2/static/svg/gyan-guru-widget.49c6a623.svg"
            alt="AI Guru"
            className="w-12 h-12 object-contain pointer-events-none"
          />
          {/* Tooltip */}
          <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all duration-200 bg-gray-900 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg pointer-events-none">
            Talk to AI Guru 🤖
          </span>
        </button>
      </div>

    </div>
  );
}

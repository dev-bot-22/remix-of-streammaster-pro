"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useParams, useRouter, usePathname } from "next/navigation";
import axios from "axios";
import { BatchInfo, getTodaysSchedule, getUserDetailsList, getTests, getTestSyllabus, getKhazanaInfo, getKhazanaChapters, getKhazanaTopics } from "@/utils/api";
import LiveClassCard from "@/app/components/LiveClassCard";
import { Button } from "@/components/ui/button";
import { BellDot, MessagesSquare, BookmarkPlus, Clock, ChevronRight, ChevronDown } from "lucide-react";
import he from "he";
import BatchCard from "@/app/components/BatchCard";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { BatchVerificationBadge } from "@/app/components/BatchVerificationBadge";

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter(); //
  const batchId = params?.batchid as string;
  const [hasMore, setHasMore] = useState(true);
  const pathname = usePathname();
  const [pageView, setPageView] = useState<"batch" | "announcement">("batch");
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(
    null
  );
  const [announcementPage, setAnnouncementPage] = useState<number>(1);

  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"description" | "classes" | "tests" | "infinite">(
    "classes"
  );
  // Tests Tab states
  const [testsList, setTestsList] = useState<any[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsLoaded, setTestsLoaded] = useState(false);
  const [testType, setTestType] = useState<"objective" | "subjective">("objective");
  // Syllabus Modal states
  const [syllabusModalOpen, setSyllabusModalOpen] = useState(false);
  const [selectedSyllabus, setSelectedSyllabus] = useState<any>(null);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [batchInternalId, setBatchInternalId] = useState<string | null>(null); // 👈 additional state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [teacherMap, setTeacherMap] = useState<
    Record<string, { name: string; imageUrl: string }>
  >({});

  // ♾️ Infinite Learning (Khazana) states
  const [khazanaFilters, setKhazanaFilters] = useState<any>(null);
  const [khazanaTeachers, setKhazanaTeachers] = useState<any[]>([]);
  const [khazanaLoading, setKhazanaLoading] = useState(false);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [showTeachersList, setShowTeachersList] = useState(false);
  const [khazanaSubjectsData, setKhazanaSubjectsData] = useState<Record<string, any[]>>({});
  const [chaptersLoadingMap, setChaptersLoadingMap] = useState<Record<string, boolean>>({});

  // Sub-views for Infinite Learning
  const [khazanaView, setKhazanaView] = useState<"main" | "view_all" | "topics">("main");
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [khazanaTopics, setKhazanaTopics] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsPage, setTopicsPage] = useState(1);
  const [topicsHasMore, setTopicsHasMore] = useState(true);

  // View All states for Infinite Learning subjects
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [viewAllChapters, setViewAllChapters] = useState<any[]>([]);
  const [viewAllPage, setViewAllPage] = useState(1);
  const [viewAllLoading, setViewAllLoading] = useState(false);
  const [viewAllHasMore, setViewAllHasMore] = useState(true);

  const searchParams = useSearchParams();

  useEffect(() => {
    const toastMsg = searchParams?.get("toast");
    if (toastMsg) {
      toast.success(decodeURIComponent(toastMsg));
    }
    const tabParam = searchParams?.get("tab");
    console.log("🔍 [BatchDetail] tabParam is:", tabParam);
    if (tabParam === "tests") {
      setActiveTab("tests");
    } else if (tabParam === "infinite" || tabParam === "khazana") {
      setActiveTab("infinite");
    } else if (tabParam === "classes") {
      setActiveTab("classes");
    }
    const viewParam = searchParams?.get("view");
    if (viewParam === "announcement" || viewParam === "announcements") {
      setPageView("announcement");
    } else if (viewParam === "batch") {
      setPageView("batch");
    }
  }, [searchParams, toast]);

  const fetchAnnouncements = async () => {
    if (pageView !== "announcement" || !batchInternalId) return;

    setAnnouncementLoading(true);
    setAnnouncementError(null);

    try {
      const res = await BatchInfo(
        batchInternalId,
        "announcement",
        announcementPage
      );
      const newAnnouncements = res.data || [];

      // If loading page 1 → replace; else → append
      setAnnouncements((prev) =>
        announcementPage === 1
          ? newAnnouncements
          : [...prev, ...newAnnouncements]
      );

      // ✅ If empty array returned → no more pages
      if (newAnnouncements.length === 0) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        toast.error("Unauthorized: Please login again.");
      } else {
        toast.error("Failed to load enrolled batches");
      }
      setAnnouncementError(
        err?.response?.data?.message || "Failed to fetch announcements"
      );
      // Optional: stop trying further pages on error
      setHasMore(false);
    } finally {
      setAnnouncementLoading(false);
    }
  };
  useEffect(() => {
    if (pageView === "announcement") {
      setAnnouncementPage(1); // Reset page when switching tab
      setHasMore(true); // Reset hasMore too
    }
  }, [pageView]);

  useEffect(() => {
    fetchAnnouncements();
  }, [pageView, batchId, batchInternalId, announcementPage]);

  const fetchTodaysSchedule = async (targetBatchId: string) => {
    try {
      const scheduleRes = await getTodaysSchedule(targetBatchId);
      const scheduleData = scheduleRes.data || [];

      // Show all scheduled classes (not just video lectures)
      const videoSchedule = scheduleData;

      // Extract unique teacher IDs
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
    } catch (err: any) {
      console.error("Failed to fetch batch today's schedule:", err);
      setSchedule([]);
      setTeacherMap({});
    }
  };

  useEffect(() => {
    const fetchBatchDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await BatchInfo(batchId, "details");

        const data = res.data;
        setBatchDetails(data);
        if (data?._id) {
          setBatchInternalId(data._id);
        }

        if (batchId) {
          fetchTodaysSchedule(batchId);
        }
      } catch (error: any) {
        setError(
          error?.response?.data?.message || "Error fetching batch details"
        );
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (batchId) fetchBatchDetails();
  }, [batchId]);

  // ─── Fetch Khazana Filters, Chapters & Teachers ───────
  useEffect(() => {
    if (activeTab !== "infinite" || !batchDetails?.khazanaProgramId || khazanaFilters) return;

    const fetchFilters = async () => {
      setKhazanaLoading(true);
      try {
        const res = await getKhazanaInfo(batchDetails.khazanaProgramId, "filters");
        if (res && res.success) {
          setKhazanaFilters(res.data);
        }
      } catch (err) {
        console.warn("Failed to fetch khazana filters:", err);
        toast.error("Failed to load Infinite Learning details");
      } finally {
        setKhazanaLoading(false);
      }
    };

    fetchFilters();
  }, [activeTab, batchDetails, khazanaFilters]);

  // Automatically fetch teachers list for browse section
  useEffect(() => {
    if (activeTab !== "infinite" || !batchDetails?.khazanaProgramId || khazanaTeachers.length > 0) return;

    const fetchTeachers = async () => {
      setTeachersLoading(true);
      try {
        const res = await getKhazanaInfo(batchDetails.khazanaProgramId, "teachers");
        if (res && res.success) {
          setKhazanaTeachers(res.data || []);
        }
      } catch (err) {
        console.warn("Failed to fetch khazana teachers:", err);
      } finally {
        setTeachersLoading(false);
      }
    };

    fetchTeachers();
  }, [activeTab, batchDetails, khazanaTeachers]);

  // Fetch chapters list for each subject
  useEffect(() => {
    if (activeTab !== "infinite" || !batchDetails?.khazanaProgramId || !khazanaFilters) return;

    const subjectsFilter = khazanaFilters?.filters?.find((f: any) => f.key === "subjectId");
    const subjectsList = subjectsFilter?.options?.filter((o: any) => o.value !== "all") || [];
    if (subjectsList.length === 0) return;

    const fetchAllChapters = async () => {
      const programId = batchDetails.khazanaProgramId;
      for (const sub of subjectsList) {
        const subId = sub.value;
        if (khazanaSubjectsData[subId] || chaptersLoadingMap[subId]) continue;

        setChaptersLoadingMap((prev) => ({ ...prev, [subId]: true }));
        try {
          const res = await getKhazanaChapters(programId, subId);
          if (res && res.success) {
            setKhazanaSubjectsData((prev) => ({
              ...prev,
              [subId]: res.data || []
            }));
          }
        } catch (err) {
          console.warn(`Failed to fetch chapters for subject ${sub.name}:`, err);
        } finally {
          setChaptersLoadingMap((prev) => ({ ...prev, [subId]: false }));
        }
      }
    };

    fetchAllChapters();
  }, [activeTab, batchDetails, khazanaFilters, khazanaSubjectsData, chaptersLoadingMap]);

  const handleChapterClick = async (chapter: any) => {
    setSelectedChapter(chapter);
    setKhazanaView("topics");
    setKhazanaTopics([]);
    setTopicsPage(1);
    setTopicsLoading(true);
    setTopicsHasMore(true);

    try {
      const res = await getKhazanaTopics(chapter.programId, chapter.subjectId, chapter._id, 1, 10);
      if (res && res.success) {
        const items = res.data || [];
        setKhazanaTopics(items);
        setTopicsHasMore(items.length >= 10);
      }
    } catch (err) {
      console.warn("Failed to fetch khazana topics:", err);
      toast.error("Failed to load topics");
      setTopicsHasMore(false);
    } finally {
      setTopicsLoading(false);
    }
  };

  const handleLoadMoreTopics = async () => {
    if (topicsLoading || !topicsHasMore || !selectedChapter) return;

    const nextPage = topicsPage + 1;
    setTopicsLoading(true);

    try {
      const res = await getKhazanaTopics(
        selectedChapter.programId,
        selectedChapter.subjectId,
        selectedChapter._id,
        nextPage,
        10
      );
      if (res && res.success) {
        const items = res.data || [];
        setKhazanaTopics((prev) => [...prev, ...items]);
        setTopicsPage(nextPage);
        setTopicsHasMore(items.length >= 10);
      }
    } catch (err) {
      console.warn("Failed to load more topics:", err);
      setTopicsHasMore(false);
    } finally {
      setTopicsLoading(false);
    }
  };

  const handleViewAllClick = async (subject: any) => {
    setSelectedSubject(subject);
    setKhazanaView("view_all");
    setViewAllChapters([]);
    setViewAllPage(1);
    setViewAllLoading(true);
    setViewAllHasMore(true);

    if (!batchDetails?.khazanaProgramId) return;

    try {
      const res = await getKhazanaChapters(batchDetails.khazanaProgramId, subject.value, 1, 10);
      if (res && res.success) {
        const items = res.data || [];
        setViewAllChapters(items);
        setViewAllHasMore(items.length >= 10);
      }
    } catch (err) {
      console.warn("Failed to fetch chapters for View All:", err);
      toast.error("Failed to load chapters");
      setViewAllHasMore(false);
    } finally {
      setViewAllLoading(false);
    }
  };

  const handleLoadMoreChapters = async () => {
    if (viewAllLoading || !viewAllHasMore || !batchDetails?.khazanaProgramId || !selectedSubject) return;

    const nextPage = viewAllPage + 1;
    setViewAllLoading(true);

    try {
      const res = await getKhazanaChapters(batchDetails.khazanaProgramId, selectedSubject.value, nextPage, 10);
      if (res && res.success) {
        const items = res.data || [];
        setViewAllChapters((prev) => [...prev, ...items]);
        setViewAllPage(nextPage);
        setViewAllHasMore(items.length >= 10);
      }
    } catch (err) {
      console.warn("Failed to load more chapters:", err);
      setViewAllHasMore(false);
    } finally {
      setViewAllLoading(false);
    }
  };

  // ─── Fetch Tests ──────────────────────────────────────
  useEffect(() => {
    if (!batchId || activeTab !== "tests") return;
    const fetchTests = async () => {
      setTestsLoading(true);
      try {
        const response = await getTests(batchId, testType === "subjective");
        const items = response.data || [];
        setTestsList(items);
      } catch (err) {
        console.warn("Error fetching tests list:", err);
        setTestsList([]);
      } finally {
        setTestsLoading(false);
        setTestsLoaded(true);
      }
    };
    fetchTests();
  }, [batchId, activeTab, testType]);

  const handleViewSyllabus = async (testId: string) => {
    setSyllabusLoading(true);
    setSelectedSyllabus(null);
    setSyllabusModalOpen(true);
    try {
      const response = await getTestSyllabus(testId);
      if (response && response.success) {
        setSelectedSyllabus(response.data);
      } else {
        toast.error("Failed to load syllabus");
        setSyllabusModalOpen(false);
      }
    } catch (err: any) {
      console.error("View syllabus error:", err);
      toast.error(err.message || "Failed to load syllabus");
      setSyllabusModalOpen(false);
    } finally {
      setSyllabusLoading(false);
    }
  };

  if (pageView === "announcement") {
    return (
      <>
        {previewSrc && (
          <div
            className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center"
            onClick={() => setPreviewSrc(null)}
          >
            <div className="relative max-w-3xl w-full p-4 dark:border bg-foreground rounded divshadow">
              {/* <p className="text-white mb-2">Preview src: {previewSrc}</p> */}
              <img
                src={previewSrc}
                alt="Preview"
                className="rounded-lg max-h-[80vh] mx-auto"
              />
            </div>
          </div>
        )}
        <div className="p-5">
          <div className="container mx-auto px-0 py-6">
            <div className="divshadow bg-background border rounded-lg p-6">
              <div className="flex flex-wrap justify-between items-center mb-4">
                <Button
                  onClick={() => setPageView("batch")}
                  className="sm:p-1 sm:h-min"
                >
                  ← Back to Batch
                </Button>
                <h3 className="text-xl font-bold">📢 Announcements</h3>
                {/* <span></span> */}
              </div>
              <div className="">
                {announcementLoading && announcementPage === 1 ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2 lg:grid-cols-3">
                      <BatchCard isPlaceholder />
                      <BatchCard isPlaceholder />
                      <BatchCard isPlaceholder />
                    </div>
                  </>
                ) : announcements.length ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2 lg:grid-cols-3">
                      {announcements.map((item, idx) => (
                        <div
                          key={idx}
                          className="no-scrollbar flex flex-col gap-4 
                    overflow-y-scroll justify-between
                     bg-background border p-4 divshadow max-h-96 rounded-lg"
                        >
                          {/* Header */}
                          <div className="flex items-start gap-4">
                            <img
                              className="h-11 w-11"
                              src="/assets/img/defaultSubject.svg"
                              alt="PW Logo"
                            />
                            <div>
                              <span className="mt-3 text-sm font-bold">
                                PW Team
                              </span>
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="text-sm space-y-2">
                            <p className="break-words whitespace-pre-wrap">
                              {item.announcement}
                            </p>
                          </div>

                          {/* Optional: Image */}
                          {item.attachment && (
                            <div
                              onClick={() => {
                                const url =
                                  item.attachment.baseUrl + item.attachment.key;
                                console.log("Preview URL:", url);
                                setPreviewSrc(url);
                              }}
                              className="cursor-pointer"
                            >
                              <div className="relative aspect-video w-full">
                                <Image
                                  src={
                                    item.attachment.baseUrl +
                                    item.attachment.key
                                  }
                                  alt="Announcement visual"
                                  className="object-contain rounded"
                                  fill
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                      <div className="flex justify-center mt-4">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setAnnouncementPage((prev) => prev + 1)
                          }
                          disabled={announcementLoading}
                        >
                          {announcementLoading ? "Loading..." : "Load More"}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="p-3 border rounded-md text-center">
                      <p className="p-4">No announcements available.</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (pageView === "batch") {
    return (
      <>
        <div className="p-5">
          {/* Header */}
          <div className="bg-background border rounded-[20px] overflow-hidden mb-6">
            <div className="bg-[url(/assets/img/descriptionHeader.svg)] bg-no-repeat bg-cover bg-center container mx-auto px-4 py-6">
              {batchDetails ? (
                <h1 className="text-2xl font-bold text-white p-2 max-w-[260px] sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] truncate" title={batchDetails.name}>
                  {batchDetails.name}
                </h1>
              ) : (
                <div className="h-8 w-64 bg-muted-foreground/30 animate-pulse rounded p-2" />
              )}
            </div>
          </div>

          {activeTab === "description" && (
            <div className="container mx-auto px-0 py-6">
              {/* Description Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* This Batch Includes */}
                  <div className="divshadow bg-background border rounded-lg p-6 !text-foreground">
                    <h2 className="text-xl font-semibold mb-4">
                      This Batch Includes
                    </h2>
                    {/* Display the description */}
                    {batchDetails?.shortDescription ? (
                      <div
                        className="text-foreground !dark:text-white"
                        dangerouslySetInnerHTML={{
                          __html: he.decode(batchDetails.shortDescription),
                        }}
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="h-4 w-full bg-muted-foreground/30 animate-pulse rounded" />
                        <div className="h-4 w-5/6 bg-muted-foreground/30 animate-pulse rounded" />
                        <div className="h-4 w-4/6 bg-muted-foreground/30 animate-pulse rounded" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1">
                  <div className="sticky top-20">
                    <div className="bg-background border rounded-lg overflow-hidden shadow-md">
                      <div className="relative">
                        {batchDetails ? (
                          <>
                            <Image
                              src={
                                batchDetails.previewImage.baseUrl +
                                batchDetails.previewImage.key
                              }
                              alt={batchDetails.name}
                              width={400}
                              height={200}
                              className="w-full object-contain"
                              priority={true}
                            />
                          </>
                        ) : (
                          <>
                            <div className="h-8 w-full bg-muted-foreground/30 animate-pulse rounded p-2" />
                            <div className="h-8 w-full bg-muted-foreground/30 animate-pulse rounded p-2" />
                            <div className="h-8 w-full bg-muted-foreground/30 animate-pulse rounded p-2" />
                            <div className="h-8 w-full bg-muted-foreground/30 animate-pulse rounded p-2" />
                            <div className="h-8 w-full bg-muted-foreground/30 animate-pulse rounded p-2" />
                          </>
                        )}

                        <span className="absolute top-2 right-2 bg-yellow-400 text-xs px-2 py-1 rounded">
                          New
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          {batchDetails ? (
                            <>
                              <span className="text-sm text-muted-foreground">
                                {batchDetails.byName}
                              </span>
                              <span className="rounded-md bg-pink-50 dark:text-white dark:bg-muted px-2 py-1 text-xs font-medium text-pink-700 ring-1 ring-pink-700/10 ring-inset">
                                {batchDetails.language}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="h-8 w-full bg-muted-foreground/30 animate-pulse rounded p-2" />
                            </>
                          )}
                        </div>
                        <div className="bg-green-50 dark:bg-muted rounded-lg p-3 mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">🎯</span>
                            <span className="text-sm font-medium">
                              Enroll Now, To Ease Access
                            </span>
                          </div>
                        </div>
                        <button
                          className="w-full spring-btn-primary py-3 flex items-center justify-center gap-2 font-semibold hover:scale-[1.02] active:scale-95 transition-all duration-200 shadow-spring-sm hover:shadow-spring-md"
                          onClick={() =>
                            router.push(`/study/batches?batchid=/${batchId}/`)
                          }
                        >
                          ENROLL NOW
                          <BookmarkPlus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "classes" && (
            <div className="container mx-auto px-0 py-6">
              <div className="lg:col-span-2 space-y-6">

                {/* Subjects */}
                <div id="subjects-section" className="divshadow bg-background border rounded-lg p-6">
                  <h3 className="text-2xl font-bold text-static-black max-md:text-xl max-sm:text-base mb-2">
                    Subjects
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    {/* subjects */}

                    {/* Iterate over subjects */}
                    {batchDetails?.subjects?.length ? (
                      batchDetails.subjects.map((subject: any) => {
                        const imageUrl = subject.imageId
                          ? subject.imageId.baseUrl + subject.imageId.key
                          : `/assets/img/defaultSubject.svg`;

                        return (
                          <div
                            key={subject._id}
                            className="flex items-center gap-4 bg-white/90 dark:bg-spring-forest-surface/70 border border-spring-leaf/10 dark:border-spring-mint/15 rounded-xl p-4 hover:shadow-spring-md hover:-translate-y-0.5 cursor-pointer divshadow transition-all duration-300"
                            onClick={() =>
                              router.push(
                                `/study/batches/${batchDetails.batchId ?? batchDetails._id ?? batchDetails.slug}/subjects/${subject.slug}`
                              )
                            }
                          >
                            <div className="text-[#2a4365] text-xl flex-shrink-0">
                              <Image
                                src={imageUrl}
                                alt={subject.subject}
                                width={40}
                                height={40}
                              />
                            </div>
                            <div>
                              <div className="max-w-full sm:max-w-[140px] overflow-hidden">
                                <p className="font-semibold text-foreground truncate text-sm sm:text-base md:text-lg">
                                  {subject.subject}
                                </p>
                              </div>

                              <p className="text-xs text-muted-foreground">
                                {subject.tagCount} Chapters
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        {[...Array(6)].map((_, index) => (
                          <div key={index} className="space-y-3">
                            <div className="h-4 w-full bg-muted-foreground/30 animate-pulse rounded" />
                            <div className="h-4 w-5/6 bg-muted-foreground/30 animate-pulse rounded" />
                            <div className="h-4 w-4/6 bg-muted-foreground/30 animate-pulse rounded" />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tests" && (
            <div className="container mx-auto px-0 py-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Toggle options between Objective and Subjective */}
                <div className="flex justify-start items-center gap-2 mb-6 bg-gray-100/50 dark:bg-black/10 p-1 rounded-xl w-fit">
                  <button
                    onClick={() => setTestType("objective")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                      testType === "objective"
                        ? "bg-white dark:bg-gray-800 text-spring-leaf dark:text-spring-mint shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    Objective Tests
                  </button>
                  <button
                    onClick={() => setTestType("subjective")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                      testType === "subjective"
                        ? "bg-white dark:bg-gray-800 text-spring-leaf dark:text-spring-mint shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                    }`}
                  >
                    Subjective Tests
                  </button>
                </div>

                <div className="divshadow bg-background border rounded-lg p-6">
                  {testsLoading && (
                    <div className="space-y-3 animate-pulse">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                      ))}
                    </div>
                  )}

                  {testsLoaded && testsList.length === 0 && !testsLoading && (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Image
                        src="/assets/img/coming-soon.png"
                        width={280}
                        height={180}
                        className="object-contain opacity-50 mb-4"
                        alt="No tests"
                      />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No {testType === "objective" ? "objective" : "subjective"} tests available yet
                      </p>
                    </div>
                  )}

                  {testsList.length > 0 && !testsLoading && (
                    <div className="space-y-4">
                      {testsList.map((test) => {
                        const tag = test.tag2 || "Start";
                        
                        // Style colors based on tag status
                        let tagBg = "bg-green-500/10 text-green-600 dark:text-green-400";
                        if (tag === "Resume") {
                          tagBg = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
                        } else if (tag === "Reattempt") {
                          tagBg = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
                        } else if (tag === "Result" || tag === "Analysis") {
                          tagBg = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
                        }

                        const isSubjective = test.isSubjective || testType === "subjective";
                        const fallbackSubject = batchDetails?.subjects?.[0];
                        const subSlug = fallbackSubject?.slug || "subject";

                        return (
                          <div
                            key={test._id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.01] hover:bg-gray-100/50 dark:hover:bg-white/[0.02] transition-all duration-200"
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {!isSubjective && (
                                  <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full ${tagBg}`}>
                                    {tag}
                                  </span>
                                )}
                                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                                  {isSubjective ? "Subjective Test" : "Objective Test"} • {test.totalQuestions || 0} Qs
                                </span>
                              </div>
                              <h4 className="text-[14.5px] font-bold text-gray-800 dark:text-gray-200 truncate">
                                {test.name || "Untitled Test"}
                              </h4>
                              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>⏱️ {test.maxDuration || 0} mins</span>
                                {!isSubjective && <span>🎯 {test.totalMarks || 0} Marks</span>}
                                {test.tag1 && <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 text-[10px]">{test.tag1}</span>}
                              </div>
                            </div>

                            {isSubjective ? (
                              <div className="mt-3 sm:mt-0 flex items-center gap-2">
                                <button
                                  onClick={() => handleViewSyllabus(test._id)}
                                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-spring-leaf/25 dark:border-spring-mint/20 text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 transition-all duration-200"
                                >
                                  Syllabus
                                </button>
                                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-200/50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                  Subjective view only
                                </span>
                              </div>
                            ) : (
                              <div className="mt-3 sm:mt-0 flex items-center gap-2">
                                <button
                                  onClick={() => handleViewSyllabus(test._id)}
                                  className="px-3.5 py-2 rounded-xl text-xs font-bold border border-spring-leaf/25 dark:border-spring-mint/20 text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 transition-all duration-200"
                                >
                                  Syllabus
                                </button>
                                <button
                                  onClick={() => {
                                    router.push(
                                      `/study/batches/${batchId}/subjects/${subSlug}/tests/${test._id}?scheduleId=${test._id}&tag=${tag}`
                                    );
                                  }}
                                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-spring-leaf hover:bg-spring-leaf/90 dark:bg-spring-mint dark:hover:bg-spring-mint/90 dark:text-gray-900 transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  {tag === "Reattempt" ? "Reattempt" : tag === "Resume" ? "Resume" : tag === "Result" || tag === "Analysis" ? "View Result" : "Start Test"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "infinite" && (
            <div className="container mx-auto px-0 py-6 animate-fadeIn space-y-8">
              {khazanaLoading && !khazanaFilters ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-10 h-10 rounded-full border-4 border-t-spring-leaf dark:border-t-spring-mint border-transparent animate-spin" />
                  <p className="text-sm text-gray-500">Loading Infinite Learning...</p>
                </div>
              ) : khazanaView === "topics" ? (
                <div className="space-y-6 animate-fadeIn">
                  {/* Back button & Chapter header */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setKhazanaView(selectedSubject ? "view_all" : "main")}
                      className="w-fit flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-spring-leaf/25 dark:border-spring-mint/20 text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 hover:border-spring-leaf transition-all duration-200 active:scale-95"
                    >
                      &larr; Back
                    </button>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-250 mt-2">
                      {selectedChapter?.name}
                    </h3>
                  </div>

                  {/* Topics List in 2-column grid */}
                  <div className="space-y-3">
                    {topicsLoading && khazanaTopics.length === 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-16 bg-gray-105 dark:bg-gray-800 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : khazanaTopics.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        No topics found for this chapter.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {khazanaTopics.map((topic: any) => (
                            <div
                              key={topic._id}
                              onClick={() => {
                                router.push(
                                  `/study/batches/${batchId}/subjects/${selectedChapter.subjectId}/subject-topics/${topic.slug ?? topic._id}?isKhazana=true&programId=${selectedChapter.programId}&chapterId=${selectedChapter._id}`
                                );
                              }}
                              className="flex items-center gap-3 p-4 rounded-xl border border-gray-150 dark:border-gray-800 bg-white/95 dark:bg-[#0c1424] hover:bg-gray-50 dark:hover:bg-white/[0.02] hover:border-spring-leaf/30 hover:shadow-spring-sm transition-all duration-205 cursor-pointer active:scale-[0.99] group"
                            >
                              <div className="w-[4px] h-[24px] bg-[#3b82f6] rounded-full shrink-0" />
                              <span className="font-semibold text-sm text-gray-850 dark:text-gray-250 leading-snug text-left">
                                {topic.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        {topicsLoading && (
                          <div className="flex justify-center py-4">
                            <div className="w-8 h-8 rounded-full border-4 border-t-spring-leaf dark:border-t-spring-mint border-transparent animate-spin" />
                          </div>
                        )}

                        {topicsHasMore && !topicsLoading && (
                          <div className="flex justify-center pt-8">
                            <button
                              onClick={handleLoadMoreTopics}
                              className="px-6 py-2.5 rounded-xl text-xs font-bold border border-spring-leaf/25 dark:border-spring-mint/20 text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 hover:border-spring-leaf transition-all duration-200 active:scale-95 shadow-sm"
                            >
                              Load More
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : khazanaView === "view_all" ? (
                <div className="space-y-6 animate-fadeIn">
                  {/* Back button & Subject Title */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setKhazanaView("main")}
                      className="w-fit flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-spring-leaf/25 dark:border-spring-mint/20 text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 hover:border-spring-leaf transition-all duration-200 active:scale-95"
                    >
                      &larr; Back
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-150 mt-2">
                      {`Complete ${selectedSubject?.name || ""}${batchDetails?.class ? ` - ${batchDetails.class}th` : ""}`}
                    </h2>
                  </div>

                  {/* 2-column Grid of chapters */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {viewAllChapters.map((item: any) => {
                        const teacherImg = item.teacher?.imageId
                          ? `${item.teacher.imageId.baseUrl}${item.teacher.imageId.key}`
                          : "/assets/img/teacher-placeholder.png";

                        return (
                          <div 
                            key={item._id}
                            onClick={() => handleChapterClick(item)}
                            className="w-full shrink-0 border border-gray-100 dark:border-gray-850 bg-white/90 dark:bg-spring-forest-surface/70 rounded-2xl overflow-hidden hover:shadow-spring-sm hover:-translate-y-0.5 transition-all duration-300 cursor-pointer hover:border-spring-leaf/30"
                          >
                            {/* Card Header with image & avatar overlay */}
                            <div 
                              className="h-[140px] w-full bg-cover bg-center relative flex items-center justify-center"
                              style={{ backgroundImage: `url(${item.backgroundImage || '/assets/img/defaultSubject.svg'})` }}
                            >
                              <div className="absolute inset-0 bg-black/10" />
                              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white dark:border-gray-900 relative shadow-md z-10">
                                <Image 
                                  src={teacherImg} 
                                  alt={item.teacherName || "Teacher"}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            </div>
                            {/* Card Footer Info */}
                            <div className="p-4 bg-gray-50/50 dark:bg-black/25 text-left space-y-0.5">
                              <h5 className="font-bold text-sm text-gray-850 dark:text-gray-200 truncate" title={item.name}>
                                {item.name}
                              </h5>
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                                By {item.teacherName || item.teacher?.firstName + " " + item.teacher?.lastName || "Instructor"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {viewAllLoading && (
                      <div className="flex justify-center py-4">
                        <div className="w-8 h-8 rounded-full border-4 border-t-spring-leaf dark:border-t-spring-mint border-transparent animate-spin" />
                      </div>
                    )}

                    {viewAllHasMore && !viewAllLoading && (
                      <div className="flex justify-center pt-8">
                        <button
                          onClick={handleLoadMoreChapters}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold border border-spring-leaf/25 dark:border-spring-mint/20 text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 hover:border-spring-leaf transition-all duration-200 active:scale-95 shadow-sm"
                        >
                          Load More
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Back Button and Title */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setActiveTab("classes")}
                      className="w-fit flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-spring-leaf/25 dark:border-spring-mint/20 text-spring-leaf dark:text-spring-mint hover:bg-spring-leaf/5 dark:hover:bg-spring-mint/5 hover:border-spring-leaf transition-all duration-200 active:scale-95"
                    >
                      &larr; Back
                    </button>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-150 mt-2">
                      {batchDetails?.name}
                    </h2>
                  </div>

                  {/* Subject Sections */}
                  {(() => {
                    const subjectsFilter = khazanaFilters?.filters?.find((f: any) => f.key === "subjectId");
                    const subjectsList = subjectsFilter?.options?.filter((o: any) => o.value !== "all") || [];

                    return subjectsList.map((subject: any) => {
                      const subId = subject.value;
                      const chapters = khazanaSubjectsData[subId] || [];
                      const isLoadingChapters = chaptersLoadingMap[subId];

                      // Don't show if not loading and has no chapters
                      if (!isLoadingChapters && chapters.length === 0) return null;

                      const classSuffix = batchDetails?.class ? ` - ${batchDetails.class}th` : "";
                      const displaySubjectName = `Complete ${subject.name}${classSuffix}`;

                      return (
                        <div key={subId} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                              {displaySubjectName}
                            </h4>
                            <button 
                              onClick={() => handleViewAllClick(subject)}
                              className="text-xs font-semibold text-gray-500 hover:text-spring-leaf dark:hover:text-spring-mint transition-colors"
                            >
                              View All
                            </button>
                          </div>

                          <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar">
                            {isLoadingChapters ? (
                              Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="w-[180px] h-[150px] bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse shrink-0" />
                              ))
                            ) : (
                              chapters.map((item: any) => {
                                const teacherImg = item.teacher?.imageId
                                  ? `${item.teacher.imageId.baseUrl}${item.teacher.imageId.key}`
                                  : "/assets/img/teacher-placeholder.png";

                                return (
                                  <div 
                                    key={item._id}
                                    onClick={() => handleChapterClick(item)}
                                    className="w-[180px] shrink-0 border border-gray-100 dark:border-gray-850 bg-white/90 dark:bg-spring-forest-surface/70 rounded-2xl overflow-hidden hover:shadow-spring-sm hover:-translate-y-0.5 transition-all duration-300 cursor-pointer hover:border-spring-leaf/30"
                                  >
                                    {/* Card Header with image & avatar overlay */}
                                    <div 
                                      className="h-[100px] w-full bg-cover bg-center relative flex items-center justify-center"
                                      style={{ backgroundImage: `url(${item.backgroundImage || '/assets/img/defaultSubject.svg'})` }}
                                    >
                                      <div className="absolute inset-0 bg-black/10" />
                                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white dark:border-gray-900 relative shadow-md z-10">
                                        <Image 
                                          src={teacherImg} 
                                          alt={item.teacherName || "Teacher"}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    </div>
                                    {/* Card Footer Info */}
                                    <div className="p-3 bg-gray-50/50 dark:bg-black/25 text-left space-y-0.5">
                                      <h5 className="font-bold text-xs text-gray-850 dark:text-gray-200 truncate" title={item.name}>
                                        {item.name}
                                      </h5>
                                      <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                        By {item.teacherName || item.teacher?.firstName + " " + item.teacher?.lastName || "Instructor"}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}

                  {/* Browse By Teachers Section */}
                  <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-850">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      Browse By Teachers
                    </h3>

                    {teachersLoading ? (
                      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="w-[100px] sm:w-[120px] h-[150px] bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse shrink-0" />
                        ))}
                      </div>
                    ) : khazanaTeachers.length === 0 ? (
                      <div className="text-center py-6 text-xs text-gray-500">
                        No teachers found.
                      </div>
                    ) : (
                      <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar">
                        {khazanaTeachers.map((teacher: any) => {
                          const teacherImg = teacher.imageId
                            ? `${teacher.imageId.baseUrl}${teacher.imageId.key}`
                            : "/assets/img/teacher-placeholder.png";

                          return (
                            <div 
                              key={teacher._id}
                              className="w-[100px] sm:w-[120px] shrink-0 border border-gray-150 dark:border-gray-850 rounded-2xl overflow-hidden bg-white/95 dark:bg-spring-forest-surface/75 hover:shadow-spring-sm hover:-translate-y-0.5 transition-all duration-300"
                            >
                              <div className="h-[120px] w-full relative">
                                <Image 
                                  src={teacherImg} 
                                  alt={teacher.name} 
                                  fill
                                  className="object-cover object-top"
                                />
                              </div>
                              <div className="p-2 bg-gray-50 dark:bg-black/20 text-center">
                                <p className="font-bold text-[10px] sm:text-xs text-gray-800 dark:text-gray-200 truncate leading-tight">
                                  {teacher.name}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Syllabus Modal */}
        {syllabusModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
            onClick={() => setSyllabusModalOpen(false)}
          >
            <div
              className="w-full max-w-2xl bg-white dark:bg-[#121c16] rounded-3xl border border-spring-leaf/15 dark:border-spring-mint/20 shadow-xl p-6 transform transition-all animate-scale-in flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-gray-800/40">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  📋 Test Syllabus
                </h3>
                <button
                  onClick={() => setSyllabusModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700/80 transition-all"
                >
                  <span className="text-sm font-bold">✕</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-5 pr-1 text-sm text-gray-700 dark:text-gray-300 no-scrollbar">
                {syllabusLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="w-10 h-10 rounded-full border-4 border-t-spring-leaf dark:border-t-spring-mint border-transparent animate-spin" />
                    <p className="text-xs text-gray-500">Fetching syllabus details...</p>
                  </div>
                ) : selectedSyllabus?.en ? (
                  <div
                    className="prose dark:prose-invert max-w-none prose-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: selectedSyllabus.en }}
                  />
                ) : (
                  <div className="text-center py-10">
                    <p className="text-gray-500">No syllabus details found for this test.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800/40 flex justify-end">
                <button
                  onClick={() => setSyllabusModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-spring-leaf hover:bg-spring-leaf/90 dark:bg-spring-mint dark:hover:bg-spring-mint/90 dark:text-gray-900 transition-all duration-200 shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Share Modal */}
        {isShareModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={() => setIsShareModalOpen(false)}
          >
            <div
              className="w-full max-w-sm bg-white/95 dark:bg-[#1c2b22]/95 backdrop-blur-md rounded-3xl border border-spring-leaf/15 dark:border-spring-mint/20 shadow-spring-xl p-6 text-center transform transition-all animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-spring-leaf/10 dark:bg-spring-mint/10 flex items-center justify-center animate-leaf-sway">
                  <MessagesSquare className="w-6 h-6 text-spring-leaf dark:text-spring-mint" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-spring-forest dark:text-[#E8F5E9] mb-2">
                Share Batch
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                Share "{batchDetails?.name || "this batch"}" with your friends to study together! 🍃
              </p>

              <div className="space-y-3">
                {/* WhatsApp Option */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hey! Study this PW batch: "${batchDetails?.name}" here for free:\n${typeof window !== "undefined" ? window.location.href : ""}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-sm text-sm"
                >
                  <span>💬</span> Share on WhatsApp
                </a>

                {/* Telegram Option */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&text=${encodeURIComponent(
                    `Study this PW batch: "${batchDetails?.name}" here for free `
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 shadow-sm text-sm"
                >
                  <span>✈️</span> Share on Telegram
                </a>

                {/* Copy Link Option */}
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Batch link copied to clipboard! 📋");
                      setIsShareModalOpen(false);
                    }
                  }}
                  className="w-full py-3 bg-spring-leaf/12 dark:bg-spring-mint/10 text-spring-leaf dark:text-spring-mint border border-spring-leaf/20 dark:border-spring-mint/20 hover:bg-spring-leaf/18 dark:hover:bg-spring-mint/15 font-semibold rounded-xl transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <span>🔗</span> Copy Link
                </button>
              </div>

              <button
                onClick={() => setIsShareModalOpen(false)}
                className="mt-6 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  }
}

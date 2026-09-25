"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import katex from "katex";
import "katex/dist/katex.min.css";
import renderMathInElement from "katex/dist/contrib/auto-render";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { ArrowLeft, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Award } from "lucide-react";

const DashPlayer = dynamic(() => import("@/app/components/dashPlayer"), {
  ssr: false,
});

interface Option {
  _id: string;
  texts?: {
    en?: string;
  };
  imageIds?: {
    en?: {
      baseUrl: string;
      key: string;
    };
  };
}

interface Question {
  _id: string;
  type: string;
  questionNumber: number;
  positiveMarks: number;
  negativeMarks: number;
  texts?: {
    en?: string;
  };
  imageIds?: {
    en?: {
      baseUrl: string;
      key: string;
    };
  };
  options: Option[];
  difficultyLevel: number;
  topicId?: {
    name: string;
    _id: string;
  };
  solutions: string[]; // Correct option IDs
  solutionDescription?: {
    _id: string;
    texts?: {
      en?: string;
    };
    imageIds?: {
      en?: {
        baseUrl: string;
        key: string;
      };
    };
    videoType?: string;
    videoDetails?: {
      videoUrl?: string;
    };
  }[];
}

interface QuizData {
  sections: {
    _id: string;
    name: string;
    questions: Question[];
  }[];
  remainingDuration: number; // in seconds
  test: {
    _id: string;
    name: string;
    maxDuration: number;
  };
}

function renderMathHtml(html: string | undefined): string {
  if (!html) return "";

  // 1. Render display math: \[ ... \]
  let processed = html.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
    try {
      return katex.renderToString(math, { displayMode: true, throwOnError: false });
    } catch (err) {
      console.error("KaTeX display render error:", err);
      return match;
    }
  });

  // 2. Render inline math: \( ... \)
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
    try {
      return katex.renderToString(math, { displayMode: false, throwOnError: false });
    } catch (err) {
      console.error("KaTeX inline render error:", err);
      return match;
    }
  });

  return processed;
}

export default function QuizPlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const batchId = params?.batchid as string;
  const subjectId = params?.subjectid as string;
  const testId = params?.testid as string;
  const scheduleId = searchParams?.get("scheduleId") || "";
  const tag = searchParams?.get("tag") || "Start";

  const [loading, setLoading] = useState(true);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  
  // Quiz State
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> selectedOptionId
  const [showExpl, setShowExpl] = useState<Record<string, boolean>>({}); // questionId -> boolean
  const [timeLeft, setTimeLeft] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (isFinished) {
      setShowResultsModal(true);
    }
  }, [isFinished]);

  // Video Solution Modal
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render math when current question changes, or finished state changes, or data is loaded
  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      if (containerRef.current) {
        try {
          const autoRenderFn = typeof renderMathInElement === "function"
            ? renderMathInElement
            : (renderMathInElement as any)?.default;

          if (typeof autoRenderFn === "function") {
            autoRenderFn(containerRef.current, {
              delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true },
                { left: "$", right: "$", display: false },
              ],
              throwOnError: false,
            });
          }
        } catch (err) {
          console.error("KaTeX rendering error:", err);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentIdx, isFinished, loading, questions]);

  // 1. Fetch Quiz Data on mount
  useEffect(() => {
    if (!batchId || !subjectId || !testId || !scheduleId) {
      toast.error("Invalid quiz parameters.");
      setLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/StartTest?batchId=${batchId}&subjectId=${subjectId}&testId=${testId}&scheduleId=${scheduleId}&type=${tag}`
        );
        const json = await res.json();

        if (json.success && json.data) {
          setQuizData(json.data);
          const allQuestions: Question[] = [];
          json.data.sections?.forEach((sec: any) => {
            if (sec.questions) {
              allQuestions.push(...sec.questions);
            }
          });
          setQuestions(allQuestions);
          setTimeLeft(json.data.remainingDuration || (json.data.test?.maxDuration * 60) || 1200);
        } else {
          throw new Error(json.message || "Failed to load quiz details");
        }
      } catch (err: any) {
        console.error("Quiz Fetch error:", err);
        toast.error(err.message || "Something went wrong starting the quiz.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [batchId, subjectId, testId, scheduleId, tag]);

  // 2. Count down timer
  useEffect(() => {
    if (loading || isFinished || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsFinished(true);
          toast.info("Time is up! Quiz finished.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, isFinished, timeLeft]);

  // 3. Format timer output
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? `${hrs}:` : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (isFinished) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  // 4. Calculate Running Score
  const getStats = () => {
    let score = 0;
    let correct = 0;
    let incorrect = 0;
    let totalPossible = 0;

    questions.forEach((q) => {
      totalPossible += q.positiveMarks;
      const ans = answers[q._id];
      if (ans) {
        const isCorrect = q.solutions?.includes(ans) || false;
        if (isCorrect) {
          score += q.positiveMarks;
          correct++;
        } else {
          score -= q.negativeMarks;
          incorrect++;
        }
      }
    });

    return { score, correct, incorrect, totalPossible, attempted: correct + incorrect };
  };

  const stats = getStats();
  const currentQuestion = questions[currentIdx];

  // Loader State
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#eef7f0] via-[#e4f6e8] to-[#f5f8ff] dark:from-[#0f1908] dark:via-[#1c2b22] dark:to-[#151d1a] transition-colors duration-300">
        <div className="p-8 rounded-2xl bg-white/80 dark:bg-[#1c2b22]/80 border border-emerald-500/10 shadow-lg flex flex-col items-center max-w-sm w-full text-center">
          <div className="relative w-16 h-16 mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10 dark:border-emerald-400/10" />
            <div className="absolute inset-0 rounded-full border-4 border-t-spring-leaf dark:border-t-spring-mint border-r-transparent animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center text-2xl">📝</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Starting Quiz</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Loading questions & sections...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--spring-gradient-bg)] text-center p-6">
        <div className="max-w-md p-8 rounded-2xl bg-white dark:bg-gray-800 shadow-md">
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">No questions found for this quiz.</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-spring-leaf hover:bg-spring-leaf/90 dark:bg-spring-mint dark:hover:bg-spring-mint/90 dark:text-gray-900 font-bold rounded-xl transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[var(--spring-gradient-bg)] transition-colors duration-300 pb-16">
      
      {/* ─── Quiz Header ────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#1c2b22]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/50 shadow-sm transition-all duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100 truncate">
                {quizData?.test?.name || "Quiz Player"}
              </h1>
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                {stats.attempted} of {questions.length} Answered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* View Scorecard Button (post-finish) */}
            {isFinished && (
              <button
                onClick={() => setShowResultsModal(true)}
                className="px-3 py-1.5 rounded-xl bg-spring-leaf/10 dark:bg-spring-mint/10 text-spring-leaf dark:text-spring-mint font-bold text-xs sm:text-sm border border-spring-leaf/10 dark:border-spring-mint/10 active:scale-95 transition"
              >
                View Scorecard
              </button>
            )}

            {/* Timer Banner (active test only) */}
            {!isFinished && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-mono text-xs sm:text-sm font-bold border border-orange-500/10">
                <Clock size={15} />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            {/* Score Pill (post-finish only) */}
            {isFinished && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-spring-leaf/10 dark:bg-spring-mint/10 text-spring-leaf dark:text-spring-mint font-bold text-xs sm:text-sm border border-spring-leaf/10 dark:border-spring-mint/10">
                <Award size={15} />
                <span>Score: {stats.score}</span>
              </div>
            )}

            {/* Finish Quiz Button (active test only) */}
            {!isFinished && (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 shadow-sm transition"
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Content Layout ────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Current Question Card */}
        <section className="lg:col-span-2 space-y-6">
          
          {/* Question Card */}
          <div className="bg-white dark:bg-[var(--spring-glass-card)] border border-gray-100 dark:border-[rgba(109,212,119,0.15)] rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-md transition-all duration-300">
            
            {/* Question Header Meta */}
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/50 pb-3.5 mb-4 text-xs font-medium text-gray-500 dark:text-gray-400 flex-wrap gap-2">
              <span className="font-extrabold uppercase px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                Question {currentIdx + 1}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-[#22c55e] dark:text-[#6dd477] font-semibold">
                  +{currentQuestion.positiveMarks} Correct
                </span>
                <span className="text-red-500 dark:text-red-400 font-semibold">
                  -{currentQuestion.negativeMarks} Incorrect
                </span>
              </div>
            </div>

            {/* Question Text / Image */}
            <div className="text-gray-800 dark:text-gray-200 text-sm sm:text-base leading-relaxed overflow-x-auto select-text font-inter mb-6">
              {currentQuestion.texts?.en ? (
                <div dangerouslySetInnerHTML={{ __html: renderMathHtml(currentQuestion.texts.en) }} />
              ) : currentQuestion.imageIds?.en?.baseUrl && currentQuestion.imageIds?.en?.key ? (
                <img
                  src={`${currentQuestion.imageIds.en.baseUrl}${currentQuestion.imageIds.en.key}`}
                  alt="Question Image"
                  className="max-w-full h-auto rounded-lg mx-auto"
                />
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic">No question content available.</p>
              )}
            </div>

            {/* Options List */}
            <div className="space-y-3">
              {currentQuestion.options.map((opt, i) => {
                const optLetter = String.fromCharCode(65 + i); // A, B, C, D
                const isSelected = answers[currentQuestion._id] === opt._id;
                const isCorrectAnswer = currentQuestion.solutions?.includes(opt._id) || false;
                const hasAnswered = !!answers[currentQuestion._id];

                // Dynamic Styling based on answer state
                let optionStyle = "border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-white/[0.01] hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-100/30 dark:hover:bg-white/[0.02]";
                let letterStyle = "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
                
                if (isFinished) {
                  if (isCorrectAnswer) {
                    optionStyle = "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300";
                    letterStyle = "bg-green-500/20 text-green-700 dark:text-green-300";
                  } else if (isSelected) {
                    optionStyle = "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
                    letterStyle = "bg-red-500/20 text-red-700 dark:text-red-300";
                  }
                } else if (isSelected) {
                  optionStyle = "border-spring-leaf dark:border-spring-mint bg-spring-leaf/5 dark:bg-spring-mint/5 text-spring-leaf dark:text-spring-mint";
                  letterStyle = "bg-spring-leaf/25 dark:bg-spring-mint/25 text-spring-leaf dark:text-spring-mint";
                }

                return (
                  <button
                    key={opt._id}
                    onClick={() => handleSelectOption(currentQuestion._id, opt._id)}
                    disabled={isFinished}
                    className={`w-full flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all duration-250 cursor-pointer ${optionStyle} ${!isFinished ? "active:scale-[0.995]" : ""}`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold font-mono transition-colors ${letterStyle}`}>
                      {optLetter}
                    </span>
                    <div className="text-sm font-medium leading-normal flex-1 select-text">
                      {opt.texts?.en ? (
                        <div dangerouslySetInnerHTML={{ __html: renderMathHtml(opt.texts.en) }} />
                      ) : opt.imageIds?.en?.baseUrl && opt.imageIds?.en?.key ? (
                        <img
                          src={`${opt.imageIds.en.baseUrl}${opt.imageIds.en.key}`}
                          alt={`Option ${optLetter} Image`}
                          className="max-w-full h-auto rounded-lg"
                        />
                      ) : (
                        <p className="text-gray-400 italic">Empty Option</p>
                      )}
                    </div>
                    {isFinished && isCorrectAnswer && (
                      <CheckCircle2 size={18} className="text-green-600 dark:text-green-400 shrink-0" />
                    )}
                    {isFinished && isSelected && !isCorrectAnswer && (
                      <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Solution & Video Explanation Section */}
          {isFinished && (
            <div className="bg-white dark:bg-[var(--spring-glass-card)] border border-gray-100 dark:border-[rgba(109,212,119,0.15)] rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/40 pb-3 mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-extrabold text-gray-800 dark:text-gray-200">
                  💡 Solution Explanation
                </h3>
              </div>
              
              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed overflow-x-auto select-text font-inter">
                {currentQuestion.solutionDescription?.[0]?.texts?.en ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMathHtml(currentQuestion.solutionDescription[0].texts.en) }} />
                ) : currentQuestion.solutionDescription?.[0]?.imageIds?.en?.baseUrl && currentQuestion.solutionDescription?.[0]?.imageIds?.en?.key ? (
                  <img
                    src={`${currentQuestion.solutionDescription[0].imageIds.en.baseUrl}${currentQuestion.solutionDescription[0].imageIds.en.key}`}
                    alt="Solution Image"
                    className="max-w-full h-auto rounded-lg mx-auto"
                  />
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 italic">No written solution explanation is available.</p>
                )}
              </div>
            </div>
          )}

          {/* Previous / Next Footers */}
          <div className="flex items-center justify-between gap-4 mt-2">
            <button
              onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
              disabled={currentIdx === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            {currentIdx === questions.length - 1 ? (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-spring-leaf hover:bg-spring-leaf/90 dark:bg-spring-mint dark:hover:bg-spring-mint/90 dark:text-gray-900 transition flex items-center gap-1.5 active:scale-95"
              >
                Submit Quiz
                <CheckCircle2 size={16} />
              </button>
            ) : (
              <button
                onClick={() => setCurrentIdx((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-1.5 disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>

        </section>

        {/* Right Column: Question Grid Dashboard */}
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[var(--spring-glass-card)] border border-gray-100 dark:border-[rgba(109,212,119,0.15)] rounded-2xl p-5 shadow-sm dark:shadow-md transition-all duration-300">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
              Quiz Navigation Dashboard
            </h3>

            {/* Questions Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-4 gap-2.5">
              {questions.map((q, idx) => {
                const isSelected = idx === currentIdx;
                const ans = answers[q._id];
                const hasAnswered = !!ans;
                const isCorrect = q.solutions?.includes(ans) || false;

                let badgeStyle = "border-gray-100 dark:border-gray-800/80 bg-gray-50/50 dark:bg-white/[0.01] text-gray-600 dark:text-gray-400";
                
                if (hasAnswered) {
                  if (isFinished) {
                    badgeStyle = isCorrect
                      ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400 font-bold"
                      : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 font-bold";
                  } else {
                    badgeStyle = "border-spring-leaf/30 dark:border-spring-mint/30 bg-spring-leaf/5 dark:bg-spring-mint/5 text-spring-leaf dark:text-spring-mint font-bold";
                  }
                }

                if (isSelected) {
                  badgeStyle += " ring-2 ring-spring-leaf dark:ring-spring-mint ring-offset-2 dark:ring-offset-gray-900";
                }

                return (
                  <button
                    key={q._id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xs font-semibold transition-all ${badgeStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Score Stats Summary */}
            <div className="border-t border-gray-100 dark:border-gray-800/50 mt-5 pt-4 space-y-2.5 text-xs font-semibold">
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Total Possible Marks:</span>
                <span>{stats.totalPossible} Marks</span>
              </div>
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Attempted Questions:</span>
                <span>{stats.attempted} / {questions.length}</span>
              </div>
              {isFinished && (
                <>
                  <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                    <span>Correct Answers:</span>
                    <span>{stats.correct} (+{stats.correct * 4} Marks)</span>
                  </div>
                  <div className="flex items-center justify-between text-red-500 dark:text-red-400">
                    <span>Wrong Answers:</span>
                    <span>{stats.incorrect} (-{stats.incorrect * 1} Marks)</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* ─── Video Solution Modal Overlay ───────── */}
      {isVideoOpen && activeVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative bg-zinc-950 rounded-2xl overflow-hidden w-full max-w-3xl border border-zinc-800 shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 text-white shrink-0">
              <span className="text-xs font-extrabold uppercase tracking-wide">Video Solution</span>
              <button
                onClick={() => {
                  setIsVideoOpen(false);
                  setActiveVideoUrl(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              >
                Close Player
              </button>
            </div>

            {/* DashPlayer Panel */}
            <div className="aspect-video w-full bg-black">
              <DashPlayer
                src={activeVideoUrl}
                type="dash"
                ContentId={`solution-${currentQuestion._id}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Finished Overlay Screen ────────────── */}
      {isFinished && showResultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-gray-100 dark:border-gray-700 shadow-2xl flex flex-col items-center text-center animate-scaleIn">
            <span className="text-5xl mb-4 animate-bounce">🏆</span>
            
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100 mb-2">
              Quiz Completed!
            </h2>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[280px] leading-relaxed mb-6">
              You have completed "{quizData?.test?.name || "the quiz"}". Here is your performance overview:
            </p>

            {/* Results Grid Banner */}
            <div className="w-full bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-4 text-left">
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase">Final Score</p>
                <p className="text-lg font-black text-spring-leaf dark:text-spring-mint mt-0.5">{stats.score} Marks</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase">Accuracy</p>
                <p className="text-lg font-black text-gray-800 dark:text-gray-200 mt-0.5">
                  {stats.attempted > 0 ? `${Math.round((stats.correct / stats.attempted) * 100)}%` : "0%"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase">Attempted</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-0.5">
                  {stats.attempted} / {questions.length} Qs
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase">Correct/Wrong</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-0.5 text-green-600 dark:text-green-400">
                  {stats.correct} <span className="text-gray-400">/</span> <span className="text-red-500">{stats.incorrect}</span>
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <button
                onClick={() => {
                  setShowResultsModal(false); // Close modal to review answers!
                }}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-spring-leaf hover:bg-spring-leaf/90 dark:bg-spring-mint dark:hover:bg-spring-mint/90 dark:text-gray-900 shadow-md transition active:scale-95"
              >
                Review Answers
              </button>
              <button
                onClick={() => {
                  // Restart the quiz
                  setAnswers({});
                  setShowExpl({});
                  setTimeLeft(quizData?.remainingDuration || (quizData?.test?.maxDuration * 60) || 1200);
                  setIsFinished(false);
                  setCurrentIdx(0);
                }}
                className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold transition active:scale-95"
              >
                Retake Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirmation Modal Overlay ─────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#121c16] rounded-3xl border border-spring-leaf/15 dark:border-spring-mint/20 shadow-xl p-6 text-center transform transition-all animate-scale-in">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Finish Quiz?
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Are you sure you want to submit and finish this quiz? You won't be able to change your answers.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold transition active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setIsFinished(true);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-spring-leaf hover:bg-spring-leaf/90 dark:bg-spring-mint dark:hover:bg-spring-mint/90 dark:text-gray-900 shadow-md transition active:scale-95"
              >
                Yes, Finish
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

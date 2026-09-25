"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  ArrowLeft,
  Send,
  Mic,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  HeartHandshake,
  Loader2,
  PlayCircle,
  Sparkles,
  MoreVertical,
  CheckSquare,
  Copy,
  Trash2,
  Check
} from "lucide-react";
import Image from "next/image";

// Avatar URL from PW API response
const AI_AVATAR_URL = "https://www.pw.live/study-v2/static/svg/gyan-guru-widget.49c6a623.svg";

interface OnboardingMessage {
  id: string;
  text: string;
  is_question: boolean;
  display_order: number;
}

interface Message {
  id: string;
  text: string;
  type: "human" | "ai";
  timestamp: string;
  createdAt?: string;
  isOnboarding?: boolean;
  videoMetadata?: {
    name: string;
    image: string;
    embedCode: string;
    duration: string;
    video_title: string;
  };
}

export default function AIGuruPage() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<"Academic" | "AI_MENTOR">("Academic");
  const [cohortData, setCohortData] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [loading, setLoading] = useState(true);
  const [likedMessages, setLikedMessages] = useState<Record<string, "like" | "dislike" | null>>({});

  // Scroll & pagination states
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Selection mode states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Close active menu when clicking anywhere else
  // Current profile name — guest sessions show "PW-MARCO User-XXXX",
  // logged-in users show their real profile name.
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    fetch("/api/AboutMe", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user?.name) setProfileName(String(d.user.name));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".menu-trigger-btn") || target.closest(".menu-dropdown-box")) {
        return;
      }
      setActiveMenuId(null);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  const handleSelectOption = (msgId: string) => {
    setIsSelectionMode(true);
    setSelectedMessageIds(new Set([msgId]));
  };

  const handleCopyOption = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard!");
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleDeleteSelectedMessages = async () => {
    if (selectedMessageIds.size === 0) return;
    
    const idsToDelete = Array.from(selectedMessageIds);
    try {
      setLoading(true);
      const res = await fetch(`/api/nebula/delete-messages?conversationId=${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      const json = await res.json();
      if (json.success) {
        shouldScrollToBottomRef.current = false;
        setMessages((prev) => prev.filter((m) => !selectedMessageIds.has(m.id)));
        toast.success("Selected messages deleted successfully!");
      } else {
        throw new Error(json.message || json.error?.message || JSON.stringify(json));
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete messages");
    } finally {
      setLoading(false);
      setIsSelectionMode(false);
      setSelectedMessageIds(new Set());
    }
  };

  const handleDeleteSingleOption = async (msgId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/nebula/delete-messages?conversationId=${conversationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [msgId] }),
      });
      const json = await res.json();
      if (json.success) {
        shouldScrollToBottomRef.current = false;
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        toast.success("Message deleted successfully!");
      } else {
        throw new Error(json.message || json.error?.message || JSON.stringify(json));
      }
    } catch (err: any) {
      console.error("Delete single error:", err);
      toast.error(err.message || "Failed to delete message");
    } finally {
      setLoading(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToBottomRef = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (shouldScrollToBottomRef.current) {
      scrollToBottom();
    } else {
      shouldScrollToBottomRef.current = true;
    }
  }, [messages, streamingText]);

  // Load cohort and conversation history on mount/tab change
  useEffect(() => {
    async function initNebula() {
      try {
        setLoading(true);
        setPage(1);
        setHasMoreMessages(true);
        setLoadingMore(false);
        // Step 1: Fetch cohort config
        const cohortRes = await fetch("/api/nebula/get-cohort");
        const cohortJson = await cohortRes.json();
        let activeCohort = null;
        if (cohortJson.success) {
          setCohortData(cohortJson.data);
          activeCohort = cohortJson.data;
        }

        // Step 2: Fetch conversation list
        const convRes = await fetch(`/api/nebula/conversation-list?type=${selectedTab === "Academic" ? "ACADEMIC" : "AI_MENTOR"}`);
        const convJson = await convRes.json();
        let convId = "";
        if (convJson.success && convJson.data?.[0]?.conversation_id) {
          convId = convJson.data[0].conversation_id;
          setConversationId(convId);
        } else {
          convId = crypto.randomUUID();
          setConversationId(convId);
        }

        // Step 3: Fetch historical messages if conversation exists
        if (convId && convJson.data?.[0]?.conversation_id) {
          try {
            const msgsRes = await fetch(`/api/nebula/messages?conversationId=${convId}&limit=50`);
            const msgsJson = await msgsRes.json();
            
            let rawMessagesList: any[] = [];
            if (msgsJson) {
              if (Array.isArray(msgsJson.data)) {
                rawMessagesList = msgsJson.data;
              } else if (msgsJson.data && Array.isArray(msgsJson.data.messages)) {
                rawMessagesList = msgsJson.data.messages;
              } else if (msgsJson.data && Array.isArray(msgsJson.data.data)) {
                rawMessagesList = msgsJson.data.data;
              } else if (Array.isArray(msgsJson.messages)) {
                rawMessagesList = msgsJson.messages;
              }
            }

            if (rawMessagesList.length > 0) {
              const historyMsgs: Message[] = rawMessagesList.map((m: any) => {
                const isHuman = m.sender === "STUDENT" || m.sender === "student" || m.sender_type === "HUMAN" || m.sender_type === "human" || m.type === "human" || m.sender === "USER";
                return {
                  id: m._id || m.id || crypto.randomUUID(),
                  text: m.text || m.message || "",
                  type: isHuman ? "human" : "ai",
                  timestamp: new Date(m.created_at || m.createdAt || Date.now()).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  createdAt: m.created_at || m.createdAt || new Date().toISOString(),
                  videoMetadata: m.video_metadata || m.videoMetadata || undefined,
                };
              });

              // Sort chronologically (oldest first)
              historyMsgs.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
              setMessages(historyMsgs);
              return; // Success loading history, bypass onboarding fallback
            } else {
              console.log("No messages list found in raw list / API response:", msgsJson);
            }
          } catch (err) {
            console.error("Failed to load historical messages:", err);
          }
        }

        // Fallback: Initialize with onboarding messages if no history exists
        const cohortToUse = activeCohort || cohortData;
        if (cohortToUse) {
          const currentIntent = cohortToUse.intent_types?.find(
            (intent: any) => intent.type === (selectedTab === "Academic" ? "ACADEMIC" : "AI_MENTOR")
          );

          if (currentIntent && Array.isArray(currentIntent.onboarding_messages)) {
            const initialMsgs: Message[] = currentIntent.onboarding_messages
              .filter((msg: any) => !msg.is_question)
              .sort((a: any, b: any) => a.display_order - b.display_order)
              .map((msg: any) => ({
                id: msg.id,
                text: msg.text,
                type: "ai",
                timestamp: new Date(msg.created_at || Date.now()).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isOnboarding: true,
              }));
            setMessages(initialMsgs);
          }
        }
      } catch (err) {
        console.error("Nebula init error:", err);
      } finally {
        setLoading(false);
      }
    }
    initNebula();
  }, [selectedTab]);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollTop === 0 && !loading && !loadingMore && hasMoreMessages && conversationId) {
      try {
        setLoadingMore(true);
        const oldScrollHeight = container.scrollHeight;
        const nextPage = page + 1;
        const res = await fetch(`/api/nebula/messages?conversationId=${conversationId}&limit=30&page=${nextPage}`);
        const msgsJson = await res.json();
        
        let rawMessagesList: any[] = [];
        if (msgsJson) {
          if (Array.isArray(msgsJson.data)) {
            rawMessagesList = msgsJson.data;
          } else if (msgsJson.data && Array.isArray(msgsJson.data.messages)) {
            rawMessagesList = msgsJson.data.messages;
          } else if (msgsJson.data && Array.isArray(msgsJson.data.data)) {
            rawMessagesList = msgsJson.data.data;
          } else if (Array.isArray(msgsJson.messages)) {
            rawMessagesList = msgsJson.messages;
          }
        }

        if (rawMessagesList.length > 0) {
          const historyMsgs: Message[] = rawMessagesList.map((m: any) => {
            const isHuman = m.sender === "STUDENT" || m.sender === "student" || m.sender_type === "HUMAN" || m.sender_type === "human" || m.type === "human" || m.sender === "USER";
            return {
              id: m._id || m.id || crypto.randomUUID(),
              text: m.text || m.message || "",
              type: isHuman ? "human" : "ai",
              timestamp: new Date(m.created_at || m.createdAt || Date.now()).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              createdAt: m.created_at || m.createdAt || new Date().toISOString(),
              videoMetadata: m.video_metadata || m.videoMetadata || undefined,
            };
          });

          // Sort chronologically (oldest first)
          historyMsgs.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
          
          shouldScrollToBottomRef.current = false;
          setMessages((prev) => [...historyMsgs, ...prev]);
          setPage(nextPage);
          
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight - oldScrollHeight;
          });

          if (rawMessagesList.length < 30) {
            setHasMoreMessages(false);
          }
        } else {
          setHasMoreMessages(false);
        }
      } catch (err) {
        console.error("Failed to load page history:", err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  // Math equations renderer utility
  const formatMessageText = (text: string): string => {
    if (!text) return "";

    const placeholders: string[] = [];
    let tempText = text;

    // Extract display math: \[ ... \]
    tempText = tempText.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
      try {
        const rendered = `<div class="my-3 overflow-x-auto flex justify-center py-2 text-gray-900 dark:text-gray-150">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
        placeholders.push(rendered);
        return `__MATH_PLACEHOLDER_${placeholders.length - 1}__`;
      } catch {
        return match;
      }
    });

    // Extract inline math: \( ... \)
    tempText = tempText.replace(/\\\(([\s\S]*?)\\\)/g, (match, math) => {
      try {
        const rendered = `<span class="inline-math inline-block px-1 align-middle text-gray-900 dark:text-gray-150">${katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        })}</span>`;
        placeholders.push(rendered);
        return `__MATH_PLACEHOLDER_${placeholders.length - 1}__`;
      } catch {
        return match;
      }
    });

    // Bold markdown syntax: **bold**
    tempText = tempText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Replace linebreaks
    tempText = tempText.replace(/\n/g, "<br />");

    // Re-insert math blocks
    for (let i = 0; i < placeholders.length; i++) {
      tempText = tempText.replace(`__MATH_PLACEHOLDER_${i}__`, placeholders[i]);
    }

    return tempText;
  };

  // Video solutions lists extractor utility
  interface InlineVideo {
    id: string;
    title: string;
    embedUrl: string;
  }

  const parseMessageVideosAndCleanText = (text: string): { cleanedText: string; videos: InlineVideo[] } => {
    if (!text) return { cleanedText: "", videos: [] };

    const lines = text.split("\n");
    const videos: InlineVideo[] = [];
    const linesToSkip = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const ytMatch = line.match(/(?:https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+))/);
      
      if (ytMatch) {
        const videoId = ytMatch[1];
        let title = "Video Solution";
        
        if (i > 0) {
          const prevLineIndex = i - 1;
          const prevLine = lines[prevLineIndex].trim();
          if (prevLine && !prevLine.startsWith("http")) {
            title = prevLine.replace(/^\d+\.\s*/, "").replace(/^\d+\)\s*/, "");
            linesToSkip.add(prevLineIndex);
          }
        }
        
        videos.push({
          id: videoId,
          title: title,
          embedUrl: line,
        });
        linesToSkip.add(i);
      }
    }

    const cleanedLines = lines.filter((_, idx) => !linesToSkip.has(idx));
    let cleanedText = cleanedLines.join("\n").trim();
    
    cleanedText = cleanedText
      .replace(/Video Solutions:\s*$/i, "")
      .replace(/---\s*$/i, "")
      .trim();

    return { cleanedText, videos };
  };

  // Extract quick suggestions (questions)
  const getSuggestions = (): OnboardingMessage[] => {
    if (!cohortData) return [];
    const currentIntent = cohortData.intent_types?.find(
      (intent: any) => intent.type === (selectedTab === "Academic" ? "ACADEMIC" : "AI_MENTOR")
    );
    if (currentIntent && Array.isArray(currentIntent.onboarding_messages)) {
      return currentIntent.onboarding_messages
        .filter((msg: any) => msg.is_question)
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((msg: any) => ({
          id: msg.id,
          text: msg.text,
          is_question: true,
          display_order: msg.display_order,
        }));
    }
    return [];
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isStreaming) return;

    const userMessageId = crypto.randomUUID();
    const newUserMsg: Message = {
      id: userMessageId,
      text: textToSend,
      type: "human",
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue("");
    setIsStreaming(true);
    setStreamingText("");

    let currentEvent = "";
    let accumulatedText = "";
    let parsedVideoMetadata: any = null;

    try {
      const response = await fetch("/api/nebula/stream-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_id: cohortData?.cohort_id || "634fb54c0c56610011d10202",
          conversation_id: conversationId || crypto.randomUUID(),
          intent_type: selectedTab === "Academic" ? "ACADEMIC" : "AI_MENTOR",
          student_metadata: {
            classes: "11",
            exam: "IIT-JEE",
            first_name: profileName || "Marco",
            last_name: "",
          },
          text: textToSend,
          isSuggestiveMessage: false,
        }),
      });

      if (!response.ok) throw new Error("Failed to get answer");
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            try {
              const dataObj = JSON.parse(dataStr);
              if (currentEvent === "text_chunk" && dataObj.text) {
                accumulatedText += dataObj.text;
                setStreamingText(accumulatedText);
              } else if (currentEvent === "video_metadata") {
                parsedVideoMetadata = dataObj;
              } else if (currentEvent === "consolidated_output") {
                // Done streaming
              }
            } catch {}
          }
        }
      }

      // Append final response
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: accumulatedText || "No response received.",
          type: "ai",
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          videoMetadata: parsedVideoMetadata || undefined,
        },
      ]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect to AI Guru.");
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  };

  const handleLikeMessage = (msgId: string, status: "like" | "dislike") => {
    setLikedMessages((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === status ? null : status,
    }));
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-full overflow-x-hidden bg-gray-50 dark:bg-gray-950 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2.5 bg-white dark:bg-gray-900 border-b border-gray-150 dark:border-gray-800 shadow-sm shrink-0 w-full min-w-0 h-[52px]">
        {isSelectionMode ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                {selectedMessageIds.size} Selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelSelection}
                className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 active:scale-95 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelectedMessages}
                disabled={selectedMessageIds.size === 0}
                className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white active:scale-95 transition-all disabled:opacity-55 disabled:scale-100 flex items-center gap-1 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
              >
                <ArrowLeft className="w-4.5 h-4.5 text-gray-700 dark:text-gray-300" />
              </button>
              <div className="ml-2 sm:ml-3 flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-violet-50 dark:bg-violet-950/40">
                  <img src={AI_AVATAR_URL} alt="AI Guru" className="w-6.5 h-6.5 object-contain" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h1 className="font-extrabold text-gray-900 dark:text-white text-sm sm:text-base truncate">PW-MARCO AI</h1>
                  <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium truncate">PW-MARCO's AI · Created by Mr. Marco</p>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Main Area: Sidebar + Chat */}
      <div className="flex flex-1 overflow-hidden w-full max-w-full">
        {/* Chat window */}
        <div className="flex-1 flex flex-col h-full relative w-full min-w-0 max-w-full">
          {/* Messages list */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] bg-white dark:bg-gray-900"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                <span className="mt-3 text-xs text-gray-500 font-bold">Initializing AI Guru...</span>
              </div>
            ) : (
              <>
                {loadingMore && (
                  <div className="flex justify-center py-2 animate-fadeIn">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                  </div>
                )}

                {messages.map((msg) => {
                  const { cleanedText, videos: inlineVideos } = parseMessageVideosAndCleanText(msg.text);
                  const formattedHtml = formatMessageText(cleanedText);

                  return (
                    <div
                      key={msg.id}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleMessageSelection(msg.id);
                        }
                      }}
                      className={`flex items-start max-w-[92%] sm:max-w-[85%] ${
                        msg.type === "human" ? "ml-auto flex-row-reverse" : "mr-auto"
                      } gap-2.5 sm:gap-3 min-w-0 w-full group relative ${
                        isSelectionMode ? "cursor-pointer select-none" : ""
                      }`}
                    >
                      {/* Checkbox (visible in Selection Mode) */}
                      {isSelectionMode && (
                        <div className="self-center shrink-0 mr-1.5 ml-0.5 animate-fadeIn">
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            selectedMessageIds.has(msg.id)
                              ? "bg-violet-600 border-violet-600 text-white"
                              : "border-gray-300 dark:border-gray-650 bg-white dark:bg-gray-800"
                          }`}>
                            {selectedMessageIds.has(msg.id) && (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Avatar */}
                      {msg.type === "ai" ? (
                        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-md bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center border border-gray-100 dark:border-gray-800">
                          <img src={AI_AVATAR_URL} alt="AI Guru" className="object-contain w-8 h-8 pointer-events-none" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-extrabold text-base shrink-0 shadow-md">
                          V
                        </div>
                      )}

                      {/* Bubble */}
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div
                          className={`rounded-2xl pl-4 pr-8 py-3 sm:pl-5 sm:pr-8 sm:py-4 text-[14px] sm:text-base md:text-[17px] shadow-sm leading-relaxed border w-full min-w-0 break-words relative group/bubble ${
                            msg.type === "human"
                              ? "bg-violet-100 border-violet-200 dark:bg-violet-950 dark:border-violet-900 text-gray-900 dark:text-gray-100 rounded-tr-none"
                              : "bg-white border-gray-150 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none"
                          }`}
                        >
                          {/* Message content */}
                          <div
                            className="prose prose-sm sm:prose-base md:prose-lg dark:prose-invert max-w-none text-left break-words w-full overflow-hidden"
                            dangerouslySetInnerHTML={{
                              __html: formattedHtml,
                            }}
                          />

                          {/* Video Card Attachment (if any single SSE metadata solution exists) */}
                          {msg.videoMetadata && (
                            <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/60 shadow-sm max-w-xs transition-transform hover:scale-[1.02]">
                              <div className="relative aspect-video">
                                <img
                                  src={msg.videoMetadata.image || "https://i.ytimg.com/vi/iew6xn4tRd4/mqdefault.jpg"}
                                  alt={msg.videoMetadata.video_title}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                  <PlayCircle className="w-12 h-12 text-white/90 drop-shadow-md" />
                                </div>
                                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/75 text-[10px] text-white font-bold rounded">
                                  {msg.videoMetadata.duration}
                                </span>
                              </div>
                              <div className="p-3 text-left">
                                <span className="inline-block px-2 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-[9px] font-bold text-violet-755 dark:text-violet-300 rounded mb-1.5">
                                  Video Solution
                                </span>
                                <h4 className="font-bold text-xs text-gray-800 dark:text-gray-200 line-clamp-2">
                                  {msg.videoMetadata.video_title}
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(msg.videoMetadata?.embedCode, "_blank");
                                  }}
                                  className="mt-2.5 w-full py-2 bg-violet-600 hover:bg-violet-700 active:scale-98 transition-all text-white rounded-lg text-[10px] font-extrabold shadow-sm"
                                >
                                  Play Video
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Extracted Inline Video Solution Cards */}
                          {inlineVideos && inlineVideos.length > 0 && (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-full">
                              {inlineVideos.map((video) => (
                                <div
                                  key={video.id}
                                  className="border border-gray-150 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/60 shadow-sm transition-transform hover:scale-[1.02] flex flex-col justify-between"
                                >
                                  <div className="relative aspect-video shrink-0 bg-gray-200 dark:bg-gray-950">
                                    <img
                                      src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                                      alt={video.title}
                                      className="w-full h-full object-cover animate-fadeIn"
                                    />
                                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                      <PlayCircle className="w-10 h-10 text-white/90 drop-shadow-md cursor-pointer hover:scale-110 transition-transform" />
                                    </div>
                                  </div>
                                  <div className="p-2.5 text-left flex-1 flex flex-col justify-between">
                                    <div>
                                      <span className="inline-block px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-[9px] font-bold text-violet-755 dark:text-violet-300 rounded mb-1">
                                        Video Solution
                                      </span>
                                      <h4 className="font-extrabold text-xs text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
                                        {video.title}
                                      </h4>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(video.embedUrl, "_blank");
                                      }}
                                      className="mt-2.5 w-full py-1.5 bg-violet-600 hover:bg-violet-700 active:scale-98 transition-all text-white rounded-lg text-[10px] font-extrabold shadow-sm flex items-center justify-center gap-1"
                                    >
                                      <PlayCircle className="w-3.5 h-3.5" />
                                      Play Video
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 3-dot Menu (Inside bubble) */}
                          {!isSelectionMode && !msg.isOnboarding && (
                            <div className="absolute top-2 right-2 z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === msg.id ? null : msg.id);
                                }}
                                className="menu-trigger-btn p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 transition-colors opacity-100 md:opacity-0 md:group-hover/bubble:opacity-100 focus:opacity-100 active:opacity-100"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              
                              {/* Dropdown Box */}
                              {activeMenuId === msg.id && (
                                <div className="menu-dropdown-box absolute right-0 mt-1 z-35 w-24 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-xl shadow-xl py-1 text-[11px] font-extrabold text-gray-700 dark:text-gray-200">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectOption(msg.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-1.5"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5 text-violet-500" />
                                    Select
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyOption(msg.text);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-1.5"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-blue-500" />
                                    Copy
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSingleOption(msg.id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-red-500 hover:text-red-650 flex items-center gap-1.5"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Footer: Time & Feedback */}
                        <div
                          className={`flex items-center gap-3 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 px-1 ${
                            msg.type === "human" ? "justify-end" : "justify-between"
                          }`}
                        >
                          <span>{msg.timestamp}</span>

                          {msg.type === "ai" && (
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-gray-400">Was this helpful?</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLikeMessage(msg.id, "like");
                                }}
                                className={`transition-colors ${
                                  likedMessages[msg.id] === "like"
                                    ? "text-green-500"
                                    : "hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLikeMessage(msg.id, "dislike");
                                }}
                                className={`transition-colors ${
                                  likedMessages[msg.id] === "dislike"
                                    ? "text-red-500"
                                    : "hover:text-gray-600 dark:hover:text-gray-300"
                                }`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isStreaming && !streamingText && (
                  <div className="flex items-start max-w-[92%] sm:max-w-[85%] mr-auto gap-2.5 sm:gap-3 min-w-0 w-full animate-fadeIn">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-md bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center border border-gray-100 dark:border-gray-800 animate-pulse">
                      <img src={AI_AVATAR_URL} alt="AI Guru" className="object-contain w-8 h-8" />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <div className="bg-white border border-gray-150 dark:bg-gray-800 dark:border-gray-700 rounded-2xl rounded-tl-none px-6 py-4 shadow-sm flex items-center justify-center gap-1.5 h-12 w-20">
                        <span className="w-2 h-2 bg-violet-600 dark:bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2.5 h-2.5 bg-violet-600 dark:bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-violet-600 dark:bg-violet-400 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Streaming Chunk bubble */}
                {(() => {
                  const { cleanedText: streamingCleanedText, videos: streamingVideos } = parseMessageVideosAndCleanText(streamingText);
                  const streamingHtml = formatMessageText(streamingCleanedText);
                  return (
                    isStreaming && streamingText && (
                      <div className="flex items-start max-w-[92%] sm:max-w-[85%] mr-auto gap-2.5 sm:gap-3 min-w-0 w-full animate-fadeIn">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-md bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center border border-gray-100 dark:border-gray-800">
                          <img src={AI_AVATAR_URL} alt="AI Guru" className="object-contain w-8 h-8" />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                          <div className="bg-white border border-gray-150 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-2xl rounded-tl-none px-4 py-3 sm:px-5 sm:py-4 text-[14px] sm:text-base md:text-[17px] shadow-sm leading-relaxed text-left w-full min-w-0 overflow-hidden break-words">
                            <div
                              className="prose prose-sm sm:prose-base md:prose-lg dark:prose-invert max-w-none break-words w-full overflow-hidden"
                              dangerouslySetInnerHTML={{
                                __html: streamingHtml,
                              }}
                            />
                            
                            {/* Extracted Inline Video Solution Cards for streaming response */}
                            {streamingVideos && streamingVideos.length > 0 && (
                              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-full">
                                {streamingVideos.map((video) => (
                                  <div
                                    key={video.id}
                                    className="border border-gray-150 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900/60 shadow-sm transition-transform hover:scale-[1.02] flex flex-col justify-between"
                                  >
                                    <div className="relative aspect-video shrink-0 bg-gray-200 dark:bg-gray-950">
                                      <img
                                        src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                                        alt={video.title}
                                        className="w-full h-full object-cover animate-fadeIn"
                                      />
                                      <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                        <PlayCircle className="w-10 h-10 text-white/90 drop-shadow-md cursor-pointer hover:scale-110 transition-transform" />
                                      </div>
                                    </div>
                                    <div className="p-2.5 text-left flex-1 flex flex-col justify-between">
                                      <div>
                                        <span className="inline-block px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/40 text-[9px] font-bold text-violet-755 dark:text-violet-300 rounded mb-1">
                                          Video Solution
                                        </span>
                                        <h4 className="font-extrabold text-xs text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
                                          {video.title}
                                        </h4>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(video.embedUrl, "_blank");
                                        }}
                                        className="mt-2.5 w-full py-1.5 bg-violet-600 hover:bg-violet-700 active:scale-98 transition-all text-white rounded-lg text-[10px] font-extrabold shadow-sm flex items-center justify-center gap-1"
                                      >
                                        <PlayCircle className="w-3.5 h-3.5" />
                                        Play Video
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  );
                })()}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 sm:p-4 bg-white dark:bg-gray-900 border-t border-gray-150 dark:border-gray-800 shrink-0">
            {/* Quick Suggestions */}
            {getSuggestions().length > 0 && !isStreaming && (
              <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
                {getSuggestions().map((sug) => (
                  <button
                    key={sug.id}
                    onClick={() => handleSendMessage(sug.text)}
                    className="px-3.5 py-2 text-xs font-bold text-violet-600 border border-violet-100 bg-violet-50 hover:bg-violet-100 dark:text-violet-300 dark:border-violet-900/60 dark:bg-violet-950/40 rounded-full whitespace-nowrap active:scale-95 transition-all duration-200"
                  >
                    {sug.text}
                  </button>
                ))}
              </div>
            )}

            {/* Toggle intent */}
            <div className="flex items-center gap-1.5 mb-3">
              <button
                onClick={() => setSelectedTab("Academic")}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl active:scale-95 transition-all ${
                  selectedTab === "Academic"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/10"
                    : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Academic
              </button>
              <button
                onClick={() => setSelectedTab("AI_MENTOR")}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl active:scale-95 transition-all ${
                  selectedTab === "AI_MENTOR"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/10"
                    : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                <HeartHandshake className="w-3.5 h-3.5" />
                Emotional Support
              </button>
            </div>

            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex items-center gap-2 sm:gap-3 bg-gray-50 border border-gray-200 dark:bg-gray-950 dark:border-gray-800 p-2 sm:p-3 rounded-2xl shadow-inner w-full min-w-0"
            >
              <input
                type="text"
                placeholder={selectedTab === "Academic" ? "Type your doubt here..." : "Type your message here..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isStreaming || loading}
                className="flex-1 min-w-0 w-full bg-transparent text-base md:text-lg focus:outline-none px-2 text-gray-850 dark:text-gray-200 disabled:opacity-50"
              />

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  type="button"
                  className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
                <button
                  type="button"
                  className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <ImageIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isStreaming || loading}
                  className="p-2 sm:p-2.5 bg-violet-600 hover:bg-violet-750 active:scale-95 text-white rounded-xl transition-all disabled:opacity-50 disabled:scale-100 shadow-md shadow-violet-600/10"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

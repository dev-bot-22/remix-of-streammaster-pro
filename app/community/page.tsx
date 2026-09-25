"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Heart, MessageCircle, Share2, Eye, Flame, Smile, Laugh, ThumbsUp,
  ChevronLeft, ChevronRight, RefreshCw, Users, ImageOff, Loader2, X, ChevronDown
} from "lucide-react";
import Image from "next/image";
import { getCommunityChannels, getCommunityPosts, getUserGamificationProfiles } from "@/utils/api";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CommunityChannel {
  _id: string;
  name: string;
  type: "forum" | "feed" | string;
  order: number;
  is_hide: boolean;
}

interface CommunityPost {
  _id: string;
  user_id: string;
  description: string;
  attachmentUrls: Array<{ type: string; url: string; FileSize?: string }>;
  video_link: string;
  total_likes: number;
  total_comments: number;
  reactions: Record<string, number>;
  totalUniqueViews: number;
  views: number[];
  createdAt: string;
  is_comments_allowed: boolean;
  pinned: boolean;
  user: {
    _id: string;
    name: string;
    profileImage: string | null;
    roles: string[];
  };
}

interface CommunityComment {
  _id: string;
  text: string;
  createdAt: string;
  childCommentCount: number;
  upVoteCount: number;
  createdBy: {
    _id: string;
    firstName: string;
    lastName?: string;
    imageId?: {
      baseUrl: string;
      key: string;
    };
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function decodeDescription(desc: string): string {
  try {
    return decodeURIComponent(desc);
  } catch {
    return desc;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getTotalReactions(reactions: Record<string, number>): number {
  return Object.values(reactions).reduce((a, b) => a + b, 0);
}

function getViewCount(views: number[]): number {
  return views.reduce((a, b) => a + b, 0);
}

// ─── Avatar Component ─────────────────────────────────────────────────────────
function Avatar({ user, onClick }: { user: CommunityPost["user"]; onClick?: () => void }) {
  const [imgError, setImgError] = useState(false);
  const initials = user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const element = user.profileImage && !imgError ? (
    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-gray-700 shadow-md">
      <Image
        src={user.profileImage}
        alt={user.name}
        fill
        className="object-cover"
        onError={() => setImgError(true)}
        unoptimized
      />
    </div>
  ) : (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm ${
      ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500"][user._id.charCodeAt(0) % 8]
    } ring-2 ring-white dark:ring-gray-700 shadow-md`}>
      {initials}
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="focus:outline-none transition-transform hover:scale-105 active:scale-95">
        {element}
      </button>
    );
  }

  return element;
}

// ─── Post Image ───────────────────────────────────────────────────────────────
function PostImage({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full h-40 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 gap-2 text-sm">
        <ImageOff className="w-5 h-5" />
        Image unavailable
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}
      <img
        src={url}
        alt="Post image"
        className={`w-full max-h-[400px] object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

// ─── Post Attachments Slider/Carousel ─────────────────────────────────────────
function PostAttachments({ attachments }: { attachments: Array<{ type: string; url: string }> }) {
  const images = attachments.filter(a => a.type === "images");
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) return null;

  if (images.length === 1) {
    return <PostImage url={images[0].url} />;
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 group">
      {/* Active Slide Image */}
      <PostImage url={images[currentIndex].url} />

      {/* Left Slider Navigation Button */}
      <button
        onClick={handlePrev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow-md"
        aria-label="Previous image"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Right Slider Navigation Button */}
      <button
        onClick={handleNext}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow-md"
        aria-label="Next image"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Page Index Badge */}
      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white tracking-wider">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Slide Position Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentIndex(idx);
            }}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
              currentIndex === idx ? "bg-white scale-120" : "bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Comments Drawer ──────────────────────────────────────────────────────────
function CommentAvatar({ createdBy }: { createdBy: CommunityComment["createdBy"] }) {
  const [imgError, setImgError] = useState(false);
  const name = `${createdBy.firstName} ${createdBy.lastName || ""}`.trim();
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const avatarUrl = createdBy.imageId ? `${createdBy.imageId.baseUrl}${createdBy.imageId.key}` : null;
  const colorClass = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-rose-500","bg-amber-500","bg-cyan-500"][createdBy._id.charCodeAt(0) % 6];

  if (avatarUrl && !imgError) {
    return (
      <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
        <Image src={avatarUrl} alt={name} fill className="object-cover" onError={() => setImgError(true)} unoptimized />
      </div>
    );
  }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs ${colorClass}`}>
      {initials}
    </div>
  );
}

function CommentsDrawer({
  post,
  batchId,
  onClose,
}: {
  post: CommunityPost;
  batchId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const LIMIT = 10;
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchComments = useCallback(async (currentSkip: number, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        postId: post._id,
        limit: String(LIMIT),
        skip: String(currentSkip),
      });
      if (batchId) params.set("batchId", batchId);
      const res = await fetch(`/api/community-comments?${params.toString()}`);
      const data = await res.json();
      const newComments: CommunityComment[] = data?.data || [];
      if (reset) {
        setComments(newComments);
      } else {
        setComments(prev => [...prev, ...newComments]);
      }
      setHasMore(newComments.length === LIMIT);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [post._id, batchId]);

  useEffect(() => {
    fetchComments(0, true);
  }, [fetchComments]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const next = skip + LIMIT;
        setSkip(next);
        fetchComments(next);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, skip, fetchComments]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative z-10 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl flex flex-col max-h-[80vh] animate-in slide-in-from-bottom duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-violet-500" />
            <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">
              Comments
              {post.total_comments > 0 && (
                <span className="ml-1.5 text-sm font-normal text-gray-400">({post.total_comments})</span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Initial skeleton */}
          {loading && comments.length === 0 && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                    <div className="w-2/3 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && comments.length === 0 && (
            <div className="text-center py-10">
              <MessageCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">No comments yet</p>
            </div>
          )}

          {/* Comments */}
          {comments.map(comment => {
            const name = `${comment.createdBy.firstName} ${comment.createdBy.lastName || ""}`.trim();
            return (
              <div key={comment._id} className="flex gap-3">
                <CommentAvatar createdBy={comment.createdBy} />
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">{name}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{formatTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                      {comment.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 ml-2">
                    {comment.upVoteCount > 0 && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <ThumbsUp className="w-3 h-3" /> {comment.upVoteCount}
                      </span>
                    )}
                    {comment.childCommentCount > 0 && (
                      <span className="text-[10px] text-blue-500 font-medium">
                        {comment.childCommentCount} repl{comment.childCommentCount !== 1 ? "ies" : "y"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load more sentinel */}
          {hasMore && comments.length > 0 && (
            <div ref={sentinelRef} className="flex justify-center py-3">
              {loading && <Loader2 className="w-5 h-5 animate-spin text-violet-500" />}
            </div>
          )}

          {!hasMore && comments.length > 0 && (
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500 py-2">All comments loaded ✨</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reaction Bar ─────────────────────────────────────────────────────────────
function ReactionBar({ post, onCommentClick }: { post: CommunityPost; onCommentClick: () => void }) {
  const totalReactions = getTotalReactions(post.reactions);
  const viewCount = getViewCount(post.views);

  const reactionIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    heart: { icon: <Heart className="w-3.5 h-3.5" />, color: "text-rose-500" },
    smile: { icon: <Smile className="w-3.5 h-3.5" />, color: "text-yellow-500" },
    laugh: { icon: <Laugh className="w-3.5 h-3.5" />, color: "text-amber-500" },
    like: { icon: <ThumbsUp className="w-3.5 h-3.5" />, color: "text-blue-500" },
    fire: { icon: <Flame className="w-3.5 h-3.5" />, color: "text-orange-500" },
  };

  const topReactions = Object.entries(post.reactions)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
      {/* Reaction summary */}
      {(totalReactions > 0 || post.total_comments > 0 || viewCount > 0) && (
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2.5">
          <div className="flex items-center gap-1.5">
            {topReactions.length > 0 && (
              <div className="flex items-center gap-0.5">
                {topReactions.map(([key]) => (
                  <span key={key} className={reactionIcons[key]?.color || "text-gray-400"}>
                    {reactionIcons[key]?.icon}
                  </span>
                ))}
                {totalReactions > 0 && <span className="ml-1">{totalReactions}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {post.total_comments > 0 && (
              <button
                onClick={onCommentClick}
                className="hover:text-blue-500 transition-colors"
              >
                {post.total_comments} comment{post.total_comments !== 1 ? "s" : ""}
              </button>
            )}
            {viewCount > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {viewCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 dark:hover:text-rose-400 transition-all duration-200">
          <Heart className="w-4 h-4" />
          <span>React</span>
        </button>
        {post.is_comments_allowed && (
          <button
            onClick={onCommentClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 dark:hover:text-blue-400 transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Comment{post.total_comments > 0 ? ` (${post.total_comments})` : ""}</span>
          </button>
        )}
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-500 dark:hover:text-violet-400 transition-all duration-200">
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────
function PostCard({
  post,
  onClickProfile,
  onCommentClick,
  gamification
}: {
  post: CommunityPost;
  onClickProfile?: (userId: string, name: string, avatarUrl?: string) => void;
  onCommentClick?: (post: CommunityPost) => void;
  gamification?: {
    CurrentLevel: number;
    inTopThree: number;
    streak: number;
    totalXp: number;
  };
}) {
  const rawDesc = decodeDescription(post.description);
  const isHtml = rawDesc.includes("<") && rawDesc.includes(">");
  const textContent = isHtml ? stripHtml(rawDesc) : rawDesc;

  const handleProfileClick = () => {
    if (onClickProfile) {
      onClickProfile(post.user._id, post.user.name, post.user.profileImage || undefined);
    }
  };

  const handleCommentClick = () => {
    if (onCommentClick) onCommentClick(post);
  };

  return (
    <article className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-700/50 transition-all duration-300 overflow-hidden">
      {post.pinned && (
        <div className="px-4 pt-3 pb-0">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
            📌 Pinned
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar user={post.user} onClick={handleProfileClick} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  onClick={handleProfileClick}
                  className={`font-semibold text-sm text-gray-900 dark:text-gray-100 truncate ${
                    onClickProfile ? "cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors" : ""
                  }`}
                >
                  {post.user.name}
                </span>

                {/* Gamification Badges next to Name */}
                {gamification && (
                  <div className="flex items-center gap-1">
                    {gamification.streak > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm"
                        title="Active Streak"
                      >
                        🔥 {gamification.streak}
                      </span>
                    )}
                    {gamification.CurrentLevel > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm"
                        title="Level"
                      >
                        🏆 {gamification.CurrentLevel}
                      </span>
                    )}
                  </div>
                )}

                {post.user.roles?.includes("mentor") && (
                  <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-semibold">
                    Mentor
                  </span>
                )}
                {post.user.roles?.includes("educator") && (
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-semibold">
                    Educator
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {formatTime(post.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {textContent && (
          <div className="mb-3">
            {isHtml ? (
              <div
                className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: decodeDescription(post.description) }}
              />
            ) : (
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {textContent}
              </p>
            )}
          </div>
        )}

        {/* Images Carousel/Slider */}
        {post.attachmentUrls.length > 0 && (
          <div className="mb-3">
            <PostAttachments attachments={post.attachmentUrls} />
          </div>
        )}

        <ReactionBar post={post} onCommentClick={handleCommentClick} />
      </div>
    </article>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/50 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="space-y-1.5">
          <div className="w-28 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-16 h-2.5 bg-gray-100 dark:bg-gray-700/50 rounded" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="w-3/4 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
      <div className="border-t border-gray-100 dark:border-gray-700/50 pt-3 flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-8 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Channel Tab Icon ─────────────────────────────────────────────────────────
function ChannelTypeIcon({ type }: { type: string }) {
  if (type === "feed") return <span className="text-base">📢</span>;
  return <span className="text-base">💬</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function CommunityFeed() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlChannelId = searchParams?.get("channelId") || searchParams?.get("channelid") || "";
  const batchId = searchParams?.get("batchId") || searchParams?.get("batchid") || "";
  const batchName = searchParams?.get("batchName") || searchParams?.get("batchname") || "Community";

  // ── Channels state ──────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState(urlChannelId);

  // ── Posts state ─────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = useRef(false);

  // ── Gamification cache & Modal state ─────────────────────────────────────────
  const [gamificationCache, setGamificationCache] = useState<Record<string, {
    userId: string;
    CurrentLevel: number;
    inTopThree: number;
    streak: number;
    totalXp: number;
  }>>({});
  const [selectedUserProfile, setSelectedUserProfile] = useState<{
    name: string;
    avatarUrl?: string;
    userId: string;
  } | null>(null);

  // ── Comments Drawer state ────────────────────────────────────────────────────
  const [commentsPost, setCommentsPost] = useState<CommunityPost | null>(null);

  // ── Fetch gamification profiles for newly loaded posts ───────────────────────
  useEffect(() => {
    if (!batchId || posts.length === 0) return;

    // Collect all unique user IDs that are not in cache
    const uniqueUserIds = Array.from(new Set(posts.map(p => p.user._id)));
    const missingUserIds = uniqueUserIds.filter(id => !gamificationCache[id]);

    if (missingUserIds.length === 0) return;

    getUserGamificationProfiles(missingUserIds, batchId)
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setGamificationCache(prev => {
            const newCache = { ...prev };
            res.data.forEach((profile: any) => {
              if (profile?.userId) {
                newCache[profile.userId] = profile;
              }
            });
            return newCache;
          });
        }
      })
      .catch(e => console.warn("[community] gamification fetch error:", e.message));
  }, [posts, batchId]);

  // ── Fetch channels when batchId is available ────────────────────────────────
  useEffect(() => {
    if (!batchId) return;
    setChannelsLoading(true);
    getCommunityChannels(batchId)
      .then(data => {
        if (data.success && data.data?.length > 0) {
          const visible = (data.data as CommunityChannel[]).filter(c => !c.is_hide);
          setChannels(visible);
          // Auto-select: prefer urlChannelId, else first channel
          if (!activeChannelId || !visible.find(c => c._id === activeChannelId)) {
            setActiveChannelId(visible[0]._id);
          }
        }
      })
      .catch(e => console.error("[community] channels fetch error:", e.message))
      .finally(() => setChannelsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  // ── Fetch posts for the active channel ──────────────────────────────────────
  const fetchPosts = useCallback(async (pageNum: number, reset = false) => {
    if (loadingRef.current) return;
    if (!activeChannelId) {
      setError("No channel selected.");
      setInitialLoading(false);
      return;
    }

    loadingRef.current = true;
    if (pageNum === 1) {
      setInitialLoading(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getCommunityPosts(activeChannelId, pageNum, batchId || undefined);

      if (!data.success) {
        throw new Error(data.message || "Failed to load posts");
      }

      const newPosts: CommunityPost[] = data.data?.posts || [];
      setHasNextPage(data.data?.hasNextPage || false);

      if (reset || pageNum === 1) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setInitialLoading(false);
      setLoading(false);
      loadingRef.current = false;
    }
  }, [activeChannelId, batchId]);

  useEffect(() => {
    if (!activeChannelId) return;
    setPage(1);
    setPosts([]);
    fetchPosts(1, true);
  }, [activeChannelId]);

  const observerTarget = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(() => {
    if (loading || initialLoading || !hasNextPage) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage);
  }, [page, fetchPosts, loading, initialLoading, hasNextPage]);

  useEffect(() => {
    const target = observerTarget.current;
    if (!target || !hasNextPage || loading || initialLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasNextPage, loading, initialLoading, loadMore]);

  const handleRefresh = () => {
    setPage(1);
    setPosts([]);
    fetchPosts(1, true);
  };

  const activeChannel = channels.find(c => c._id === activeChannelId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-700/50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-0">
          {/* Top bar */}
          <div className="flex items-center gap-3 pb-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              id="community-back-btn"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {decodeURIComponent(batchName)}
                  </h1>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {activeChannel ? activeChannel.name : "Community Feed"}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={initialLoading || channelsLoading}
              id="community-refresh-btn"
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${initialLoading || channelsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Channel Tabs */}
          {channels.length > 0 && (
            <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0">
              {channels.map(ch => (
                <button
                  key={ch._id}
                  id={`channel-tab-${ch._id}`}
                  onClick={() => setActiveChannelId(ch._id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-xl whitespace-nowrap transition-all duration-200 border-b-2 ${
                    activeChannelId === ch._id
                      ? "text-violet-600 dark:text-violet-400 border-violet-500 bg-violet-50/60 dark:bg-violet-900/20"
                      : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                  }`}
                >
                  <ChannelTypeIcon type={ch.type} />
                  {ch.name}
                </button>
              ))}
            </div>
          )}
          {channelsLoading && channels.length === 0 && (
            <div className="flex gap-2 pb-1">
              {[1,2].map(i => <div key={i} className="h-8 w-32 bg-gray-100 dark:bg-gray-800 rounded-t-xl animate-pulse" />)}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* No batchId and no channelId */}
        {!batchId && !activeChannelId && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-600 dark:text-gray-400 font-semibold">No batch selected</h3>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Open this page from a batch to see its community.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-2xl p-5 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium text-sm mb-3">{error}</p>
            <button
              onClick={handleRefresh}
              id="community-retry-btn"
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Initial Loading */}
        {initialLoading && !error && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <PostSkeleton key={i} />)}
          </div>
        )}

        {/* Posts */}
        {!initialLoading && posts.length > 0 && (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post._id}
                post={post}
                onClickProfile={(userId, name, avatarUrl) => setSelectedUserProfile({ userId, name, avatarUrl })}
                onCommentClick={(p) => setCommentsPost(p)}
                gamification={gamificationCache[post.user._id]}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!initialLoading && !error && posts.length === 0 && activeChannelId && (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-600 dark:text-gray-400 font-semibold">No posts yet</h3>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Be the first to post in this community!</p>
          </div>
        )}

        {/* Infinite Scroll Sentinel / Loading Spinner */}
        {!initialLoading && hasNextPage && posts.length > 0 && (
          <div
            ref={observerTarget}
            id="community-scroll-sentinel"
            className="w-full py-6 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            <span>Loading more posts...</span>
          </div>
        )}

        {/* End of feed */}
        {!initialLoading && !hasNextPage && posts.length > 0 && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">
            You've reached the end of the feed ✨
          </p>
        )}
      </div>

      {/* Comments Drawer */}
      {commentsPost && (
        <CommentsDrawer
          post={commentsPost}
          batchId={batchId}
          onClose={() => setCommentsPost(null)}
        />
      )}

      {/* User Profile Modal Overlay */}
      {selectedUserProfile && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedUserProfile(null)}
        >
          {/* Card Container */}
          <div
            className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-[28px] overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700/50 select-none animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Banner with Pattern */}
            <div className="relative pt-8 pb-6 text-center bg-gradient-to-b from-indigo-900 via-indigo-950 to-indigo-950 dark:from-slate-900 dark:to-slate-950 border-b border-indigo-900/30">
              {/* Diamond Lattice Pattern Overlay */}
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
              
              {/* Profile Avatar Container */}
              <div className="relative w-24 h-24 mx-auto mb-3 rounded-full border-4 border-white dark:border-gray-800 overflow-hidden shadow-lg">
                {selectedUserProfile.avatarUrl ? (
                  <img
                    src={selectedUserProfile.avatarUrl}
                    alt={selectedUserProfile.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-violet-600 flex items-center justify-center text-white text-3xl font-extrabold">
                    {selectedUserProfile.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Username */}
              <h3 className="text-white text-lg font-bold tracking-wide drop-shadow-sm">
                {selectedUserProfile.name}
              </h3>
            </div>

            {/* Grid Stats Container */}
            <div className="p-5 bg-gray-50/60 dark:bg-gray-900/40">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Card 1: Level */}
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/20 text-violet-500 dark:text-violet-400 flex items-center justify-center flex-shrink-0 text-xl font-bold">
                    🏆
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      Level {gamificationCache[selectedUserProfile.userId]?.CurrentLevel ?? 1}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 mt-0.5">Current Level</p>
                  </div>
                </div>

                {/* Card 2: Top 3 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 flex items-center justify-center flex-shrink-0 text-xl">
                    ⭐
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      {gamificationCache[selectedUserProfile.userId]?.inTopThree ?? 0}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 mt-0.5">Top 3 Finishes</p>
                  </div>
                </div>

                {/* Card 3: Total XP */}
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 flex items-center justify-center flex-shrink-0 text-xs font-black tracking-tighter">
                    XP
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      {(gamificationCache[selectedUserProfile.userId]?.totalXp ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 mt-0.5">Total XP</p>
                  </div>
                </div>

                {/* Card 4: Streak */}
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 text-orange-500 dark:text-orange-400 flex items-center justify-center flex-shrink-0 text-xl">
                    🔥
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      {gamificationCache[selectedUserProfile.userId]?.streak ?? 0} Days
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 mt-0.5">Current Streak</p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Circle Close Button below the card */}
          <button
            onClick={() => setSelectedUserProfile(null)}
            className="mt-4 w-11 h-11 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer border border-gray-100 dark:border-gray-700"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    }>
      <CommunityFeed />
    </Suspense>
  );
}

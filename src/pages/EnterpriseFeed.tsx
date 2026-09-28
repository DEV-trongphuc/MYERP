import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { 
  ThumbsUp, Heart, Laugh, Angry, MessageCircle, Share2, 
  Send, Trash2, Globe, Lock, Users, Link as LinkIcon, Paperclip, X, Camera, 
  MessageSquare, MoreHorizontal, Filter, Search, Tag, Eye, Edit, Smile,
  ArrowUp, Check, Link2
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Avatar } from '../components/ui/Avatar';
import { CustomSelect } from '../components/ui/CustomSelect';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { compressToWebP } from '../utils/imageCompress';
import { CustomModal } from '../components/ui/CustomModal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { MentionInput } from '../components/ui/MentionInput';
import { StickerPickerModal } from '../components/ui/StickerPickerModal';
import { AttachmentLightboxModal, type AttachmentItem } from '../components/ui/AttachmentLightboxModal';
import { useUIStore } from '../store/uiStore';

// High-performance DOMPurify HTML sanitizer cache (avoids repeated synchronous parsing)
const sanitizeCache = new Map<string, string>();
const safeSanitize = (rawHtml: string, config?: any): string => {
  if (!rawHtml) return '';
  const cacheKey = config ? `${rawHtml}_${JSON.stringify(config)}` : rawHtml;
  const cached = sanitizeCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const clean = String(DOMPurify.sanitize(rawHtml, config));
  if (sanitizeCache.size > 800) {
    const firstKey = sanitizeCache.keys().next().value;
    if (firstKey) sanitizeCache.delete(firstKey);
  }
  sanitizeCache.set(cacheKey, clean);
  return clean;
};

// Reaction Types Constants
const REACTION_TYPES = [
  { type: 'like', label: 'Thích', emoji: '👍', color: '#3b82f6' },
  { type: 'love', label: 'Yêu thích', emoji: '❤️', color: '#ef4444' },
  { type: 'haha', label: 'Vui vẻ', emoji: '😂', color: '#f59e0b' },
  { type: 'rocket', label: 'Đẩy tiến độ', emoji: '🚀', color: '#8b5cf6' },
  { type: 'clap', label: 'Tuyệt vời', emoji: '👏', color: '#ec4899' },
  { type: 'flex', label: 'Đồng lòng', emoji: '💪', color: '#10b981' }
];

interface Post {
  id: number;
  user_id: number;
  content: string;
  visibility: string;
  author_name: string;
  author_avatar: string | null;
  created_at: string;
  attachments: string[];
  tags: string[];
  link_metadata: {
    url: string;
    title: string;
    description: string | null;
    image: string | null;
  } | null;
  reactions_summary: Record<string, number>;
  reactions_count: number;
  user_reaction: string | null;
  comments_count: number;
  top_comments: Comment[];
  team_name?: string | null;
  team_id?: number | null;
}

interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  author_name: string;
  author_avatar: string | null;
  created_at: string;
  replies?: Comment[];
}

interface PostCommentBoxProps {
  postId: number;
  replyToId: number | null;
  user: any;
  appendedEmoji?: { emoji: string; id: number } | null;
  onSend: (postId: number, parentId: number | null, text: string) => Promise<boolean>;
  onOpenSticker: (postId: number, parentId: number | null, el: HTMLElement) => void;
  onCancelReply: (postId: number) => void;
  t: (key: string) => string;
}

const PostCommentBox: React.FC<PostCommentBoxProps> = ({
  postId,
  replyToId,
  user,
  appendedEmoji,
  onSend,
  onOpenSticker,
  onCancelReply,
  t
}) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (appendedEmoji?.emoji) {
      setText(prev => prev + appendedEmoji.emoji);
    }
  }, [appendedEmoji]);

  const handleSend = async () => {
    if (submitting) return;
    const hasText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length > 0;
    if (!hasText) return;
    setSubmitting(true);
    try {
      const ok = await onSend(postId, replyToId, text);
      if (ok) {
        setText('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', width: '100%' }}>
      <Avatar 
        src={user?.avatar_url || user?.avatar} 
        name={user?.name || 'User'} 
        size={32} 
        style={{ marginTop: '4px' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
        <MentionInput
          placeholder={
            replyToId 
              ? `${t('Phản hồi bình luận')}... (Enter để gửi)` 
              : `${t('Viết bình luận')}... (Enter để gửi)`
          }
          value={text}
          onChange={val => setText(val.target.value)}
          enterSubmits={true}
          onSubmitShortcut={handleSend}
          style={{
            width: '100%',
            minHeight: '48px',
            fontSize: '0.8rem'
          }}
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button"
            disabled={submitting}
            onClick={handleSend}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            className="btn primary sm"
          >
            <Send size={11} />
            <span>{submitting ? '...' : t('Gửi')}</span>
          </button>
          <button 
            type="button"
            onClick={(e) => onOpenSticker(postId, replyToId, e.currentTarget)}
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
            title={t('Gửi nhãn dán Sticker')}
          >
            <Smile size={13} />
            <span>{t('Nhãn dán')}</span>
          </button>
          {replyToId && (
            <button 
              type="button"
              onClick={() => onCancelReply(postId)}
              style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.72rem'
              }}
              className="btn outline sm"
            >
              {t('Hủy')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Feed Skeleton Loaders ──
const FeedSkeletonItem: React.FC<{ width?: string | number; height?: string | number; borderRadius?: string | number; style?: React.CSSProperties }> = ({
  width = '100%',
  height = '16px',
  borderRadius = '8px',
  style = {}
}) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, rgba(226, 232, 240, 0.6) 25%, rgba(241, 245, 249, 0.95) 37%, rgba(226, 232, 240, 0.6) 63%)',
      backgroundSize: '400% 100%',
      animation: 'feedSkeletonShimmer 1.5s ease-in-out infinite',
      flexShrink: 0,
      ...style
    }}
  />
);

const PostSkeletonCard: React.FC = () => (
  <div
    style={{
      background: 'var(--color-surface)',
      borderRadius: '16px',
      border: '1px solid var(--color-border-light)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      boxShadow: 'var(--shadow-sm)'
    }}
  >
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
      <FeedSkeletonItem width={40} height={40} borderRadius="50%" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <FeedSkeletonItem width="140px" height="14px" />
        <FeedSkeletonItem width="90px" height="11px" />
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <FeedSkeletonItem width="100%" height="13px" />
      <FeedSkeletonItem width="88%" height="13px" />
      <FeedSkeletonItem width="60%" height="13px" />
    </div>
    <FeedSkeletonItem width="100%" height="220px" borderRadius="12px" />
    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-light)', paddingTop: '10px', marginTop: '4px' }}>
      <FeedSkeletonItem width="80px" height="24px" borderRadius="20px" />
      <FeedSkeletonItem width="80px" height="24px" borderRadius="20px" />
      <FeedSkeletonItem width="80px" height="24px" borderRadius="20px" />
    </div>
  </div>
);

const HonorSkeletonCard: React.FC = () => (
  <div
    style={{
      background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.82) 0%, rgba(153, 27, 27, 0.92) 100%)',
      borderRadius: '16px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px',
      boxShadow: 'var(--shadow-md)',
      position: 'relative',
      overflow: 'hidden'
    }}
  >
    <div
      style={{
        width: '130px',
        height: '20px',
        borderRadius: '10px',
        background: 'rgba(255, 255, 255, 0.25)',
        animation: 'feedSkeletonShimmer 1.5s ease-in-out infinite'
      }}
    />
    <div
      style={{
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.3)',
        animation: 'feedSkeletonShimmer 1.5s ease-in-out infinite'
      }}
    />
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
      <div style={{ width: '130px', height: '14px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.25)', animation: 'feedSkeletonShimmer 1.5s ease-in-out infinite' }} />
      <div style={{ width: '90px', height: '11px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.2)', animation: 'feedSkeletonShimmer 1.5s ease-in-out infinite' }} />
    </div>
    <div style={{ width: '100px', height: '28px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.2)', animation: 'feedSkeletonShimmer 1.5s ease-in-out infinite' }} />
  </div>
);

const CommentSkeletonItem: React.FC = () => (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
    <FeedSkeletonItem width={28} height={28} borderRadius="50%" />
    <div style={{ flex: 1, background: 'var(--color-bg)', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <FeedSkeletonItem width="100px" height="11px" />
      <FeedSkeletonItem width="75%" height="12px" />
    </div>
  </div>
);

export const EnterpriseFeed: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showConfirm } = useUIStore();
  const [searchParams] = useSearchParams();

  const targetPostId = searchParams.get('post_id');
  const openCommentId = searchParams.get('open_comment');
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    (posts || []).forEach(post => {
      if (Array.isArray(post.tags)) {
        post.tags.forEach(tag => {
          const t = tag.trim().toLowerCase();
          if (t) {
            counts[t] = (counts[t] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(counts)
      .map(([tag, count]) => ({
        tag,
        label: `#${tag}`,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [posts]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const [selectedVisibility, setSelectedVisibility] = useState<string>('all');

  // Creation State
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('global');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Post State
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editVisibility, setEditVisibility] = useState('global');
  const [editTeamId, setEditTeamId] = useState<number | null>(null);
  const [editAttachments, setEditAttachments] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editUploading, setEditUploading] = useState(false);

  // Active Post Comments Drawers
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [loadingCommentsMap, setLoadingCommentsMap] = useState<Record<number, boolean>>({});
  const [newCommentText, setNewCommentText] = useState<Record<number, string>>({});
  const [appendedEmoji, setAppendedEmoji] = useState<{ postId: number; emoji: string; id: number } | null>(null);
  const [replyToCommentId, setReplyToCommentId] = useState<Record<number, number | null>>({});
  const [commentToDelete, setCommentToDelete] = useState<{ postId: number; commentId: number } | null>(null);

  // Sticker modal state for feed comments
  const [showFeedStickerModal, setShowFeedStickerModal] = useState(false);
  const [feedStickerAnchorEl, setFeedStickerAnchorEl] = useState<HTMLElement | null>(null);
  const [stickerTargetPostId, setStickerTargetPostId] = useState<number | null>(null);
  const [stickerTargetParentId, setStickerTargetParentId] = useState<number | null>(null);

  // Floating reactions active state per post
  const [hoveredPostId, setHoveredPostId] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<Record<number, any>>({});

  // Lightbox modal state for full-screen image inspection
  const [lightboxData, setLightboxData] = useState<{ items: AttachmentItem[]; initialIndex: number } | null>(null);

  // Floating Back-to-Top button state
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Edit comment state
  const [editingComment, setEditingComment] = useState<{ id: number; postId: number; content: string } | null>(null);
  const [isSavingCommentEdit, setIsSavingCommentEdit] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const bottomObserverRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef(false);

  // Teams List for Group Visibility selection
  interface Team {
    id: number;
    name: string;
  }
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const fetchTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data.data || res.data || []);
    } catch (e) {
      console.error('Error fetching teams', e);
    }
  };

  // Honors Widget States
  interface HonorsUser {
    id: number;
    full_name: string;
    avatar_url: string | null;
    role: string;
  }
  interface HonorItem {
    id: number;
    user_id: number;
    title: string;
    badge: string;
    reason: string;
    hearts_count: number;
    full_name: string;
    avatar_url: string | null;
    role: string;
    user_reactions: number;
    created_at: string;
  }
  interface HonorsData {
    honors: HonorItem[];
    candidates: HonorsUser[];
  }
  const [honorsData, setHonorsData] = useState<HonorsData | null>(null);
  const [loadingHonors, setLoadingHonors] = useState(false);
  const [showEditHonors, setShowEditHonors] = useState(false);
  const [selectedHonorId, setSelectedHonorId] = useState<number | null>(null);
  const [editHonorsUserId, setEditHonorsUserId] = useState<number | null>(null);
  const [editHonorsTitle, setEditHonorsTitle] = useState('');
  const [editHonorsBadge, setEditHonorsBadge] = useState('');
  const [editHonorsReason, setEditHonorsReason] = useState('');
  const [savingHonors, setSavingHonors] = useState(false);

  // Reactions List Modal States
  const [reactionsModalPostId, setReactionsModalPostId] = useState<number | null>(null);
  const [reactionsModalList, setReactionsModalList] = useState<any[]>([]);
  const [loadingReactionsModal, setLoadingReactionsModal] = useState(false);

  const handleShowReactionsModal = async (postId: number) => {
    setReactionsModalPostId(postId);
    setLoadingReactionsModal(true);
    try {
      const res = await api.get(`/posts/${postId}/reactions`);
      if (res.data && res.data.success) {
        setReactionsModalList(res.data.data.reactions || []);
      }
    } catch (err) {
      console.error("Error fetching reactions list", err);
    } finally {
      setLoadingReactionsModal(false);
    }
  };

  const fetchHonors = async () => {
    setLoadingHonors(true);
    try {
      const res = await api.get('/posts/honors');
      if (res.data && res.data.success) {
        const data = res.data.data;
        if (data && data.honors) {
          data.honors = [...data.honors].sort((a, b) => {
            if (b.hearts_count !== a.hearts_count) {
              return b.hearts_count - a.hearts_count;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        }
        setHonorsData(data);
      }
    } catch (e) {
      console.error('Error fetching honors', e);
    } finally {
      setLoadingHonors(false);
    }
  };

  const handleSaveHonors = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editHonorsUserId) {
      toast.error(t('Vui lòng chọn nhân viên vinh danh'));
      return;
    }
    if (!editHonorsTitle.trim() || !editHonorsBadge.trim() || !editHonorsReason.trim()) {
      toast.error(t('Vui lòng nhập đầy đủ thông tin'));
      return;
    }
    setSavingHonors(true);
    try {
      const res = await api.post('/posts/honors', {
        id: selectedHonorId,
        honored_user_id: editHonorsUserId,
        title: editHonorsTitle,
        badge: editHonorsBadge,
        reason: editHonorsReason
      });
      if (res.data && res.data.success) {
        toast.success(selectedHonorId ? t('Cập nhật vinh danh thành công!') : t('Thêm vinh danh mới thành công!'));
        setShowEditHonors(false);
        fetchHonors();
      }
    } catch (err) {
      toast.error(t('Lỗi khi cập nhật vinh danh'));
    } finally {
      setSavingHonors(false);
    }
  };

  const handleDeleteHonor = (id: number) => {
    showConfirm({
      title: t('Xóa vinh danh'),
      message: t('Bạn có chắc chắn muốn xóa vinh danh này không? Hành động này không thể hoàn tác.'),
      confirmText: t('Xóa'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.post('/posts/honors', {
            id,
            action: 'delete'
          });
          if (res.data && res.data.success) {
            toast.success(t('Xóa vinh danh thành công!'));
            fetchHonors();
          }
        } catch (e) {
          toast.error(t('Lỗi khi xóa vinh danh'));
        }
      }
    });
  };

  const handleHeartHonor = async (id: number) => {
    const item = honorsData?.honors.find(h => h.id === id);
    if (item && item.user_reactions >= 10) {
      toast.error(t('Bạn đã thả tối đa 10 nhiệt cho thẻ vinh danh này rồi!'));
      return;
    }

    try {
      const res = await api.post(`/posts/honors/${id}`);
      if (res.data && res.data.success) {
        setHonorsData(prev => {
          if (!prev) return null;
          const updatedHonors = prev.honors.map(h => {
            if (h.id === id) {
              return { 
                ...h, 
                hearts_count: res.data.data.hearts_count,
                user_reactions: res.data.data.user_reactions
              };
            }
            return h;
          });
          const sorted = [...updatedHonors].sort((a, b) => {
            if (b.hearts_count !== a.hearts_count) {
              return b.hearts_count - a.hearts_count;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          return {
            ...prev,
            honors: sorted
          };
        });
      }
    } catch (e: any) {
      if (e.response && e.response.data && e.response.data.message) {
        toast.error(e.response.data.message);
      } else {
        console.error('Error hearting honor card', e);
      }
    }
  };

  // Fetch initial posts
  const fetchPosts = async (reset = false) => {
    if (isFetchingRef.current && !reset) return;
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const currentCursor = reset ? '' : (cursor || '');
      let url = `/posts?limit=10&cursor=${currentCursor}`;
      if (activeTag) {
        url += `&tag=${encodeURIComponent(activeTag)}`;
      }
      if (selectedVisibility === 'global') {
        url += '&visibility=global';
      } else if (selectedVisibility && selectedVisibility.startsWith('team_')) {
        const teamId = selectedVisibility.replace('team_', '');
        url += `&team_id=${teamId}`;
      }

      const res = await api.get(url);
      if (res.data && res.data.success) {
        const fetched = res.data.data.posts || [];
        const next = res.data.data.next_cursor;
        const more = res.data.data.has_more;

        setPosts(prev => {
          if (reset) {
            if (targetPostId) {
              const pId = parseInt(targetPostId, 10);
              const deepPost = prev.find(p => p.id === pId);
              if (deepPost && !fetched.some((p: Post) => p.id === pId)) {
                return [deepPost, ...fetched];
              }
            }
            return fetched;
          }
          return [...prev, ...fetched];
        });
        setCursor(next);
        setHasMore(more);
      }
    } catch (e) {
      toast.error(t('Không thể tải bài viết'));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Handle Deep Linking from Notifications (/feed?post_id=X&open_comment=Y)
  useEffect(() => {
    if (!targetPostId) return;
    const postIdNum = parseInt(targetPostId, 10);
    if (isNaN(postIdNum)) return;

    let isMounted = true;

    const handleDeepLink = async () => {
      try {
        // 1. Fetch post directly if not present in current feed list
        try {
          const res = await api.get(`/posts/${postIdNum}`);
          if (isMounted && res.data && res.data.success && res.data.data?.post) {
            const fetchedPost = res.data.data.post;
            setPosts(curr => curr.some(p => p.id === fetchedPost.id) ? curr : [fetchedPost, ...curr]);
          }
        } catch (fetchErr) {
          console.error('Error fetching deep linked post', fetchErr);
        }

        if (!isMounted) return;

        // 2. Open comments drawer and load comments
        setActiveCommentsPostId(postIdNum);
        await loadComments(postIdNum);

        // 3. Highlight and scroll
        if (openCommentId) {
          const commentIdNum = parseInt(openCommentId, 10);
          setHighlightedCommentId(commentIdNum);
          setTimeout(() => {
            const el = document.getElementById(`comment-${commentIdNum}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              const postEl = document.getElementById(`post-${postIdNum}`);
              if (postEl) postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 400);

          setTimeout(() => {
            if (isMounted) setHighlightedCommentId(null);
          }, 4000);
        } else {
          setHighlightedPostId(postIdNum);
          setTimeout(() => {
            const postEl = document.getElementById(`post-${postIdNum}`);
            if (postEl) {
              postEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 400);

          setTimeout(() => {
            if (isMounted) setHighlightedPostId(null);
          }, 4000);
        }
      } catch (e) {
        console.error('Deep link error', e);
      }
    };

    handleDeepLink();

    return () => {
      isMounted = false;
    };
  }, [targetPostId, openCommentId]);

  // Reset and reload when filters change
  useEffect(() => {
    fetchPosts(true);
    fetchHonors();
  }, [activeTag, selectedVisibility]);

  useEffect(() => {
    fetchTeams();
  }, []);

  // Infinite Scroll Observer Setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading && posts.length > 0) {
          fetchPosts();
        }
      },
      { threshold: 0.1 }
    );

    if (bottomObserverRef.current) {
      observer.observe(bottomObserverRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [cursor, hasMore, loading, posts.length]);

  // Handle post submit
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length > 0;
    if (!hasText && attachments.length === 0) return;
    if (visibility === 'team' && !selectedTeamId) {
      toast.error(t('Vui lòng chọn phòng ban đăng bài'));
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await api.post('/posts', {
        content: content.trim(),
        visibility,
        team_id: visibility === 'team' ? selectedTeamId : null,
        attachments
      });

      if (res.data && res.data.success) {
        toast.success(t('Đã đăng bài viết mới!'));
        setContent('');
        setAttachments([]);
        setSelectedTeamId(null);
        fetchPosts(true); // reload list
      }
    } catch (err) {
      toast.error(t('Lỗi khi đăng bài'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle open edit post modal
  const handleOpenEditPost = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content || '');
    setEditVisibility(post.visibility || 'global');
    setEditTeamId(post.team_id || null);
    setEditAttachments(post.attachments || []);
  };

  // Handle save edit post
  const handleSaveEditPost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingPost) return;
    if (!editContent.trim() && editAttachments.length === 0) {
      toast.error(t('Nội dung bài viết không được để trống'));
      return;
    }
    if (editVisibility === 'team' && !editTeamId) {
      toast.error(t('Vui lòng chọn phòng ban'));
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await api.put(`/posts/${editingPost.id}`, {
        content: editContent,
        visibility: editVisibility,
        team_id: editVisibility === 'team' ? editTeamId : null,
        attachments: editAttachments
      });
      if (res.data?.success || res.status === 200) {
        toast.success(t('Đã cập nhật bài viết thành công'));
        const updatedTeam = teams.find(tm => tm.id === editTeamId);
        setPosts(prev => prev.map(p => {
          if (p.id === editingPost.id) {
            return {
              ...p,
              content: editContent,
              visibility: editVisibility,
              team_id: editVisibility === 'team' ? editTeamId : null,
              team_name: editVisibility === 'team' ? (updatedTeam?.name || p.team_name) : null,
              attachments: editAttachments
            };
          }
          return p;
        }));
        setEditingPost(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('Lỗi khi cập nhật bài viết'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle image upload in edit modal
  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setEditUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          fileToUpload = await compressToWebP(file);
        }
        const formData = new FormData();
        formData.append('file', fileToUpload);
        const res = await api.post('/upload', formData);
        const url = res.data?.data?.url || res.data?.url;
        if (url) uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        setEditAttachments(prev => [...prev, ...uploadedUrls]);
        toast.success(t('Đã tải ảnh lên'));
      }
    } catch (err) {
      toast.error(t('Lỗi upload ảnh'));
    } finally {
      setEditUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handle post delete
  const handleDeletePost = (postId: number) => {
    showConfirm({
      title: t('Xóa bài viết'),
      message: t('Bạn có chắc chắn muốn xóa bài viết này không? Toàn bộ bình luận và tương tác liên quan sẽ bị xóa bỏ.'),
      confirmText: t('Xóa'),
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.delete(`/posts/${postId}`);
          if (res.data && res.data.success) {
            toast.success(t('Bài viết đã được xóa'));
            setPosts(prev => prev.filter(p => p.id !== postId));
          }
        } catch (e) {
          toast.error(t('Lỗi khi xóa bài viết'));
        }
      }
    });
  };

  // Handle Reaction Selection
  const handleReact = async (postId: number, reactionType: string) => {
    try {
      const res = await api.post(`/posts/${postId}/react`, {
        reaction_type: reactionType
      });

      if (res.data && res.data.success) {
        const payload = res.data.data;
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              reactions_summary: payload.reactions_summary,
              reactions_count: payload.reactions_count,
              user_reaction: payload.user_reaction
            };
          }
          return p;
        }));
      }
    } catch (e) {
      toast.error(t('Lỗi khi tương tác bài viết'));
    }
  };

  // Load comments for a post
  const loadComments = async (postId: number) => {
    setLoadingCommentsMap(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await api.get(`/posts/${postId}/comments`);
      if (res.data && res.data.success) {
        setCommentsMap(prev => ({
          ...prev,
          [postId]: res.data.data.comments || []
        }));
      }
    } catch (e) {
      toast.error(t('Không thể tải bình luận'));
    } finally {
      setLoadingCommentsMap(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Toggle comments drawer
  const toggleCommentsDrawer = (postId: number) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
    } else {
      setActiveCommentsPostId(postId);
      loadComments(postId);
    }
  };

  // Handle add comment / reply
  const handleAddComment = async (postId: number, parentId: number | null = null, commentText?: string): Promise<boolean> => {
    const rawText = commentText !== undefined ? commentText : (newCommentText[postId] || '');
    const hasText = rawText.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length > 0;
    if (!hasText) return false;

    try {
      const res = await api.post(`/posts/${postId}/comments`, {
        content: rawText.trim(),
        parent_id: parentId
      });

      if (res.data && res.data.success) {
        setNewCommentText(prev => ({ ...prev, [postId]: '' }));
        setReplyToCommentId(prev => ({ ...prev, [postId]: null }));
        loadComments(postId);
        
        // Increment comment count locally
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: p.comments_count + 1 };
          }
          return p;
        }));
        return true;
      }
      return false;
    } catch (e) {
      toast.error(t('Lỗi khi thêm bình luận'));
      return false;
    }
  };

  // Handle send sticker comment directly
  const handleSendStickerComment = async (postId: number, stickerUrl: string, parentId: number | null = null) => {
    try {
      const res = await api.post(`/posts/${postId}/comments`, {
        content: stickerUrl,
        parent_id: parentId
      });

      if (res.data && res.data.success) {
        setReplyToCommentId(prev => ({ ...prev, [postId]: null }));
        loadComments(postId);
        
        // Increment comment count locally
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: p.comments_count + 1 };
          }
          return p;
        }));
        toast.success(t('Đã gửi nhãn dán!'));
      }
    } catch (e) {
      toast.error(t('Lỗi khi gửi nhãn dán'));
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (postId: number, commentId: number) => {
    try {
      const res = await api.delete(`/posts/comments/${commentId}`);
      if (res.data && res.data.success) {
        toast.success(t('Đã xóa bình luận'));
        loadComments(postId);
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: Math.max(0, p.comments_count - 1) };
          }
          return p;
        }));
      }
    } catch (e: any) {
      const errMsg = e?.response?.data?.message || t('Lỗi khi xóa bình luận');
      toast.error(errMsg);
    }
  };

  // Handle save edited comment
  const handleSaveEditComment = async (commentId: number, postId: number, updatedText: string) => {
    if (!updatedText.trim()) return;
    setIsSavingCommentEdit(true);
    try {
      const res = await api.put(`/comments/${commentId}`, { content: updatedText.trim() });
      if (res.data && res.data.success) {
        setCommentsMap(prev => {
          const postComments = prev[postId] || [];
          return {
            ...prev,
            [postId]: postComments.map(c => {
              if (c.id === commentId) {
                return { ...c, content: updatedText.trim() };
              }
              if (c.replies) {
                return {
                  ...c,
                  replies: c.replies.map(r => r.id === commentId ? { ...r, content: updatedText.trim() } : r)
                };
              }
              return c;
            })
          };
        });
        setEditingComment(null);
        toast.success(t('Đã cập nhật bình luận!'));
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('Lỗi khi cập nhật bình luận'));
    } finally {
      setIsSavingCommentEdit(false);
    }
  };

  // Handle copy post direct link
  const handleCopyPostLink = (postId: number) => {
    const url = `${window.location.origin}${window.location.pathname}?post_id=${postId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success(t('Đã sao chép liên kết bài viết!'));
    }).catch(() => {
      toast(url, { icon: '🔗' });
    });
  };

  // Handle pasted image from clipboard into composer
  const handlePastedImage = async (file: File) => {
    setUploading(true);
    const toastId = toast.loading(t('Đang xử lý ảnh từ clipboard...'));
    try {
      let fileToUpload = file;
      try {
        fileToUpload = await compressToWebP(file);
      } catch (err) {}

      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const fileUrl = res.data?.data?.url || res.data?.url || res.data?.file_url;
      if (fileUrl && typeof fileUrl === 'string') {
        setAttachments(prev => [...prev, fileUrl]);
        toast.success(t('Đã dán ảnh từ clipboard!'), { id: toastId });
      } else {
        toast.error(t('Không lấy được URL ảnh'), { id: toastId });
      }
    } catch (e) {
      toast.error(t('Lỗi khi tải ảnh từ clipboard'), { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];
      for (const rawFile of Array.from(files)) {
        let fileToUpload = rawFile;
        if (fileToUpload.type.startsWith('image/')) {
          try {
            fileToUpload = await compressToWebP(fileToUpload);
          } catch (compressErr) {
            console.warn('Image compression failed, using raw file', compressErr);
          }
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);

        const res = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const fileUrl = res.data?.data?.url || res.data?.url || res.data?.file_url;
        if (fileUrl && typeof fileUrl === 'string') {
          uploadedUrls.push(fileUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        setAttachments(prev => [...prev, ...uploadedUrls]);
        toast.success(t(`Đã tải lên ${uploadedUrls.length} tệp tin`));
      }
    } catch (err) {
      toast.error(t('Lỗi tải tệp lên server'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Convert plain text URLs to clickable <a> elements
  const formatText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s<>]+)/gi;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
            {part}
          </a>
        );
      }
      // Also highlight hashtags
      const tagRegex = /(#\w+)/gu;
      const subParts = part.split(tagRegex);
      return subParts.map((subPart, subIdx) => {
        if (subPart.match(tagRegex)) {
          return (
            <span 
              key={`${index}-${subIdx}`} 
              onClick={() => setActiveTag(subPart.replace('#', ''))}
              style={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
            >
              {subPart}
            </span>
          );
        }
        return subPart;
      });
    });
  };

  const renderPostContent = (content: string) => {
    if (!content) return null;
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    if (isHtml) {
      return (
        <div 
          className="rich-text-content"
          dangerouslySetInnerHTML={{ __html: safeSanitize(content) }} 
          style={{ fontSize: '0.9rem', color: 'var(--color-text)', wordBreak: 'break-word' }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'SPAN' && target.textContent?.startsWith('#')) {
               const tag = target.textContent.replace('#', '');
               setActiveTag(tag);
            }
          }}
        />
      );
    }
    return (
      <p style={{
        margin: 0,
        fontSize: '0.9rem',
        lineHeight: '1.5',
        color: 'var(--color-text)',
        whiteSpace: 'pre-wrap'
      }}>
        {formatText(content)}
      </p>
    );
  };

  const isOnlyStickerComment = (rawContent: string) => {
    if (!rawContent) return false;
    const trimmed = rawContent.trim();
    if (/^\/stickers\/[a-zA-Z0-9_\-\/]+\.(png|gif|webp|jpg)$/i.test(trimmed)) return true;
    if (/^<img\s+[^>]*src=["'][^"']*\/stickers\/[^"']*["'][^>]*\/?>(?:&nbsp;|\s)*$/i.test(trimmed)) return true;
    if (/^!\[.*?\]\([^\)]*\/stickers\/[^\)]*\)$/i.test(trimmed)) return true;
    return false;
  };

  const renderCommentContent = (content: string) => {
    if (!content) return null;
    const trimmed = content.trim();

    // Check if content is a direct sticker URL
    if (/^\/stickers\/[a-zA-Z0-9_\-\/]+\.(png|gif|webp|jpg)$/i.test(trimmed)) {
      return (
        <div style={{ marginTop: '4px', marginBottom: '2px' }}>
          <img 
            src={trimmed} 
            alt="sticker" 
            loading="lazy"
            decoding="async"
            className="feed-comment-sticker" 
            style={{ 
              maxWidth: '120px', 
              maxHeight: '120px', 
              width: 'auto', 
              height: 'auto', 
              objectFit: 'contain', 
              display: 'block', 
              borderRadius: '8px' 
            }} 
          />
        </div>
      );
    }

    // Check if content is markdown sticker ![...](/stickers/...)
    const mdStickerMatch = trimmed.match(/^!\[.*?\]\(([^\)]*\/stickers\/[^\)]*)\)$/i);
    if (mdStickerMatch) {
      return (
        <div style={{ marginTop: '4px', marginBottom: '2px' }}>
          <img 
            src={mdStickerMatch[1]} 
            alt="sticker" 
            loading="lazy"
            decoding="async"
            className="feed-comment-sticker" 
            style={{ 
              maxWidth: '120px', 
              maxHeight: '120px', 
              width: 'auto', 
              height: 'auto', 
              objectFit: 'contain', 
              display: 'block', 
              borderRadius: '8px' 
            }} 
          />
        </div>
      );
    }

    const cleanContent = (content || '')
      .replace(/&amp;nbsp;/gi, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ');

    const isHtml = /<[a-z][\s\S]*>/i.test(cleanContent);
    if (isHtml) {
      return (
        <div 
          className="rich-text-content feed-rich-comment" 
          dangerouslySetInnerHTML={{ 
            __html: safeSanitize(cleanContent, { 
              ADD_TAGS: ['img', 'span', 'a'], 
              ADD_ATTR: ['src', 'alt', 'style', 'class', 'href', 'target', 'rel'] 
            }) 
          }} 
          style={{ fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: 1.4, wordBreak: 'break-word' }}
        />
      );
    }
    return (
      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
        {cleanContent}
      </p>
    );
  };

  // Reactions Popover Hover Handlers
  const handleMouseEnterLike = (postId: number) => {
    if (hoverTimeoutRef.current[postId]) clearTimeout(hoverTimeoutRef.current[postId]);
    hoverTimeoutRef.current[postId] = setTimeout(() => {
      setHoveredPostId(postId);
    }, 250);
  };

  const handleMouseLeaveLike = (postId: number) => {
    if (hoverTimeoutRef.current[postId]) clearTimeout(hoverTimeoutRef.current[postId]);
    hoverTimeoutRef.current[postId] = setTimeout(() => {
      setHoveredPostId(null);
    }, 300);
  };

  // Grid layout helper for multi-image attachments
  const renderAttachmentsGrid = (rawUrls: string[]) => {
    const urls = (rawUrls || []).filter(u => Boolean(u && typeof u === 'string'));
    if (urls.length === 0) return null;
    const isImage = (url: string) => {
      if (!url || typeof url !== 'string') return true;
      const cleanUrl = url.split('?')[0].toLowerCase();
      if (/\.(mp4|webm|mov|ogg|m4v)$/i.test(cleanUrl)) return false;
      return true; // Default fallback to image instead of video controls
    };

    const handleOpenLightbox = (index: number) => {
      const items: AttachmentItem[] = urls.map(u => ({
        url: u,
        type: isImage(u) ? 'image' : 'other',
        name: u.split('/').pop() || 'Attachment'
      }));
      setLightboxData({ items, initialIndex: index });
    };

    if (urls.length === 1) {
      const url = urls[0];
      return (
        <div className="feed-attachment-single" style={{ marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border-light)', lineHeight: 0 }}>
          {isImage(url) ? (
            <img 
              src={url} 
              alt="Attachment" 
              loading="lazy" 
              decoding="async" 
              onClick={() => handleOpenLightbox(0)}
              style={{ display: 'block', width: '100%', maxHeight: '450px', objectFit: 'cover', cursor: 'pointer' }} 
              title={t('Click để phóng to ảnh')}
            />
          ) : (
            <video src={url} controls preload="none" style={{ display: 'block', width: '100%', maxHeight: '450px' }} />
          )}
        </div>
      );
    }

    if (urls.length === 2) {
      return (
        <div className="feed-attachment-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden', lineHeight: 0 }}>
          {urls.map((url, i) => (
            <div key={i} className="feed-attachment-cell-2" style={{ height: '220px', background: 'var(--color-bg)', overflow: 'hidden' }}>
              {isImage(url) ? (
                <img 
                  src={url} 
                  alt="Attachment" 
                  loading="lazy" 
                  decoding="async" 
                  onClick={() => handleOpenLightbox(i)}
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                  title={t('Click để phóng to ảnh')}
                />
              ) : (
                <video src={url} controls preload="none" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
          ))}
        </div>
      );
    }

    // 3 or more attachments layout
    return (
      <div className="feed-attachment-grid-3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden', lineHeight: 0 }}>
        <div className="feed-attachment-cell-3-main" style={{ height: '320px', background: 'var(--color-bg)', overflow: 'hidden' }}>
          {isImage(urls[0]) ? (
            <img 
              src={urls[0]} 
              alt="Attachment" 
              loading="lazy" 
              decoding="async" 
              onClick={() => handleOpenLightbox(0)}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
              title={t('Click để phóng to ảnh')}
            />
          ) : (
            <video src={urls[0]} controls preload="none" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div className="feed-attachment-cell-3-sub" style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '8px', height: '320px' }}>
          {urls.slice(1, 3).map((url, i) => (
            <div key={i} style={{ height: '100%', position: 'relative', background: 'var(--color-bg)', overflow: 'hidden' }}>
              {isImage(url) ? (
                <img 
                  src={url} 
                  alt="Attachment" 
                  loading="lazy" 
                  decoding="async" 
                  onClick={() => handleOpenLightbox(i + 1)}
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                  title={t('Click để phóng to ảnh')}
                />
              ) : (
                <video src={url} controls preload="none" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {i === 1 && urls.length > 3 && (
                <div 
                  onClick={() => handleOpenLightbox(2)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title={t('Xem tất cả ảnh')}
                >
                  +{urls.length - 3}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Filtered list (memoized with debounced search)
  const filteredPosts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return posts.filter(p => {
      const matchesSearch = !term || 
                            p.content.toLowerCase().includes(term) || 
                            p.author_name.toLowerCase().includes(term);
      
      let matchesVisibility = true;
      if (selectedVisibility === 'global') {
        matchesVisibility = p.visibility === 'global';
      } else if (selectedVisibility && selectedVisibility.startsWith('team_')) {
        const teamId = parseInt(selectedVisibility.replace('team_', ''));
        matchesVisibility = p.visibility === 'team' && p.team_id === teamId;
      }
      return matchesSearch && matchesVisibility;
    });
  }, [posts, debouncedSearch, selectedVisibility]);

  return (
    <div 
      className="feed-container"
      style={{
        maxWidth: '1380px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}
    >
      <style>{`
        @keyframes feedSkeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .feed-post-card {
          content-visibility: auto;
          contain-intrinsic-size: 0 420px;
        }
        .feed-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 48px;
          align-items: start;
        }
        .icon-only-select [class*="trigger"] {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 4px !important;
          justify-content: center !important;
          gap: 2px !important;
          min-height: 32px !important;
          height: 32px !important;
        }
        .icon-only-select [class*="triggerContent"] span:has(svg) + span {
          display: none !important;
        }
        .icon-only-select [class*="triggerContent"] span:has(svg) {
          margin: 0 !important;
        }
        .icon-only-select [class*="selectedValue"] {
          width: auto !important;
          overflow: visible !important;
        }
        @media (max-width: 992px) {
          .feed-layout {
            grid-template-columns: 1fr;
          }
          .feed-sidebar {
            display: none;
          }
        }
        @media (max-width: 768px) {
          .feed-container {
            padding: 0.75rem 0.5rem calc(var(--mobile-bottom-nav-height, 62px) + env(safe-area-inset-bottom, 0px) + 140px) 0.5rem !important;
          }
          .feed-composer {
            padding: 12px !important;
            border-radius: 14px !important;
            margin-bottom: 12px !important;
          }
          .feed-composer-top {
            gap: 8px !important;
          }
          .composer-actions-bar {
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding-top: 8px !important;
          }
          .composer-left-tools {
            flex: 1 1 auto !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            flex-wrap: wrap !important;
          }
          .composer-submit-btn {
            white-space: nowrap !important;
            padding: 6px 16px !important;
            min-width: 84px !important;
            height: 34px !important;
            flex-shrink: 0 !important;
            font-size: 0.78rem !important;
          }
          .feed-post-card {
            padding: 12px 14px !important;
            border-radius: 14px !important;
            margin-bottom: 12px !important;
          }
          .feed-attachment-single img, .feed-attachment-single video {
            max-height: 320px !important;
          }
          .feed-attachment-grid-2 {
            gap: 4px !important;
          }
          .feed-attachment-cell-2 {
            height: 160px !important;
          }
          .feed-attachment-grid-3 {
            gap: 4px !important;
          }
          .feed-attachment-cell-3-main {
            height: 220px !important;
          }
          .feed-attachment-cell-3-sub {
            gap: 4px !important;
            height: 220px !important;
          }
          .post-action-btn {
            font-size: 0.75rem !important;
            height: 34px !important;
          }
          .post-action-btn span {
            font-size: 0.75rem !important;
          }
        }
      `}</style>

      <div className="feed-layout">
        {/* Left Side: Timeline Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header with quick dashboard filters */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={24} style={{ color: 'var(--color-primary)' }} />
              {t('Bảng tin doanh nghiệp')}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('Chia sẻ tin tức, gắn kết đội ngũ')}</span>
          </div>
          {activeTag && (
            <button 
              onClick={() => setActiveTag(null)}
              style={{
                background: 'var(--color-success-light)',
                color: 'var(--color-success)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Tag size={12} />
              #{activeTag} &times;
            </button>
          )}
        </div>

        {/* Filters and search bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--color-surface)',
          padding: '8px 12px',
          borderRadius: '12px',
          border: '1px solid var(--color-border-light)'
        }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
            <input 
              type="text" 
              placeholder={t('Tìm bài viết, tác giả...')} 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                padding: '0 32px 0 10px',
                fontSize: '0.85rem',
                height: '32px',
                outline: 'none',
                color: 'var(--color-text)'
              }}
            />
            <Search size={14} style={{ position: 'absolute', right: '10px', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          </div>
          <div className="icon-only-select">
            <CustomSelect
              value={selectedVisibility}
              onChange={val => setSelectedVisibility(val)}
              options={[
                { value: 'all', label: t('Tất cả chế độ'), icon: <Filter size={15} /> },
                { value: 'global', label: t('Công khai'), icon: <Globe size={15} /> },
                ...teams.map(tObj => ({
                  value: `team_${tObj.id}`,
                  label: `${t('Phòng ban')}: ${tObj.name}`,
                  icon: <Users size={15} />
                }))
              ]}
              width="54px"
              align="right"
            />
          </div>
        </div>
      </div>

      {/* Post Creator Box */}
      <form onSubmit={handlePostSubmit} className="feed-composer" style={{
        background: 'var(--color-surface)',
        borderRadius: '16px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--color-border-light)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div className="feed-composer-top" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Avatar 
            src={user?.avatar_url || user?.avatar} 
            name={user?.name || 'User'} 
            size={38} 
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <MentionInput
              placeholder={`${t('Bạn đang nghĩ gì thế')}, ${user?.name || ''}?`}
              value={content}
              onChange={e => setContent(e.target.value)}
              onImagePaste={handlePastedImage}
              style={{
                width: '100%',
                minHeight: '80px',
                border: 'none',
                boxShadow: 'none',
                background: 'transparent',
                fontSize: '0.9rem',
                color: 'var(--color-text)'
              }}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
            {attachments.map((url, i) => (
              <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border-light)' }}>
                <img src={url} alt="Uploaded" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  type="button" 
                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="composer-actions-bar" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--color-border-light)',
          paddingTop: '10px'
        }}>
          <div className="composer-left-tools" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--color-bg)',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap'
            }} className="hover-lift">
              <Camera size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap' }}>{t('Ảnh / Video')}</span>
              <input 
                type="file" 
                accept="image/*,video/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>

            <CustomSelect
              value={visibility}
              onChange={val => {
                setVisibility(val);
                if (val !== 'team') {
                  setSelectedTeamId(null);
                }
              }}
              options={[
                { value: 'global', label: t('Công khai'), icon: <Globe size={12} /> },
                { value: 'team', label: t('Phòng ban'), icon: <Users size={12} /> }
              ]}
              width="130px"
              size="sm"
            />

            {visibility === 'team' && (
              <CustomSelect
                value={selectedTeamId || ''}
                onChange={val => setSelectedTeamId(val ? parseInt(val) : null)}
                options={[
                  { value: '', label: t('Chọn phòng ban') },
                  ...teams.map(tObj => ({
                    value: tObj.id,
                    label: tObj.name
                  }))
                ]}
                width="160px"
                size="sm"
              />
            )}
          </div>

          <button 
            type="submit" 
            className="composer-submit-btn"
            disabled={isSubmitting || uploading || (!content.trim() && attachments.length === 0)}
            style={{
              background: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Send size={12} style={{ flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap' }}>{isSubmitting ? t('Đang đăng...') : t('Đăng tin')}</span>
          </button>
        </div>
      </form>

      {/* Feed List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading && posts.length === 0 ? (
          <>
            <PostSkeletonCard />
            <PostSkeletonCard />
            <PostSkeletonCard />
          </>
        ) : filteredPosts.length === 0 && !loading ? (
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: '16px',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            border: '1px solid var(--color-border-light)',
            color: 'var(--color-text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <MessageSquare size={48} style={{ opacity: 0.3 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>{t('Chưa có bài viết nào ở đây')}</p>
            <span style={{ fontSize: '0.8rem' }}>{t('Hãy chia sẻ điều gì đó hữu ích hoặc tìm kiếm nội dung khác')}</span>
          </div>
        ) : (
          filteredPosts.map(post => {
            const hasReacted = post.user_reaction !== null;
            const currentReactionObj = REACTION_TYPES.find(r => r.type === post.user_reaction);

            return (
              <div 
                key={post.id} 
                id={`post-${post.id}`}
                className="feed-post-card"
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: highlightedPostId === post.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                  boxShadow: highlightedPostId === post.id ? '0 0 0 4px rgba(59, 130, 246, 0.15), var(--shadow-md)' : 'var(--shadow-sm)',
                  transition: 'all 0.3s ease',
                  overflow: 'visible',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                {/* Post Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Avatar 
                      src={post.author_avatar} 
                      name={post.author_name} 
                      size={38} 
                    />
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {post.author_name}
                      </h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span>{new Date(post.created_at).toLocaleString('vi-VN')}</span>
                        <span>•</span>
                        {post.visibility === 'global' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Globe size={10} /> {t('Công khai')}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--color-primary)' }} title={t('Bài viết giới hạn phòng ban')}>
                            <Users size={10} /> {post.team_name || t('Phòng ban')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button 
                      type="button"
                      onClick={() => handleCopyPostLink(post.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '8px'
                      }}
                      className="hover-bg"
                      title={t('Sao chép liên kết bài viết')}
                    >
                      <Share2 size={14} />
                    </button>

                    {(user?.id === post.user_id || ['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '')) && (
                      <>
                        <button 
                          onClick={() => handleOpenEditPost(post)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '8px'
                          }}
                          className="hover-bg"
                          title={t('Chỉnh sửa bài viết')}
                        >
                          <Edit size={14} style={{ color: 'var(--color-primary)' }} />
                        </button>
                        <button 
                          onClick={() => handleDeletePost(post.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '8px'
                          }}
                          className="hover-bg"
                          title={t('Xóa bài viết')}
                        >
                          <Trash2 size={14} style={{ color: 'var(--color-danger)' }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                {renderPostContent(post.content)}

                {/* Scraped Link Preview */}
                {post.link_metadata && (
                  <a 
                    href={post.link_metadata.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: post.link_metadata.image ? '120px 1fr' : '1fr',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: 'var(--color-bg)',
                      marginTop: '4px'
                    }}
                    className="hover-lift"
                  >
                    {post.link_metadata.image && (
                      <div style={{ height: '100%', minHeight: '90px', background: '#e2e8f0' }}>
                        <img 
                          src={post.link_metadata.image} 
                          alt="Preview" 
                          loading="lazy"
                          decoding="async"
                          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                    )}
                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                        {parse_url_host(post.link_metadata.url)}
                      </span>
                      <h5 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700 }}>
                        {post.link_metadata.title}
                      </h5>
                      {post.link_metadata.description && (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                          {post.link_metadata.description}
                        </p>
                      )}
                    </div>
                  </a>
                )}

                {/* Attachments rendering */}
                {renderAttachmentsGrid(post.attachments)}

                {/* Metrics Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                  borderBottom: '1px solid var(--color-border-light)',
                  paddingBottom: '8px',
                  marginTop: '4px'
                }}>
                  <div 
                    onClick={() => post.reactions_count > 0 && handleShowReactionsModal(post.id)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      cursor: post.reactions_count > 0 ? 'pointer' : 'default',
                      userSelect: 'none'
                    }}
                  >
                    {post.reactions_count > 0 && (
                      <>
                        <span style={{ display: 'flex', gap: '2px' }}>
                          {Object.keys(post.reactions_summary).slice(0, 3).map(type => (
                            <span key={type}>
                              {REACTION_TYPES.find(r => r.type === type)?.emoji}
                            </span>
                          ))}
                        </span>
                        <span style={{ textDecoration: 'underline' }}>
                          {post.reactions_count} {t('Lượt thích')}
                        </span>
                      </>
                    )}
                  </div>
                  <div>
                    <span>{post.comments_count} {t('Bình luận')}</span>
                  </div>
                </div>

                {/* Post Action Buttons & Floating Reactions Hover */}
                <div style={{
                  display: 'flex',
                  position: 'relative',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  {/* Floating Emojis bar */}
                  <AnimatePresence>
                    {hoveredPostId === post.id && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: -45, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        onMouseEnter={() => handleMouseEnterLike(post.id)}
                        onMouseLeave={() => handleMouseLeaveLike(post.id)}
                        style={{
                          position: 'absolute',
                          left: '0px',
                          display: 'flex',
                          gap: '6px',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          padding: '6px 12px',
                          borderRadius: '30px',
                          boxShadow: 'var(--shadow-lg)',
                          zIndex: 10
                        }}
                      >
                        {REACTION_TYPES.map(react => (
                          <motion.button 
                            key={react.type}
                            whileHover={{ scale: 1.35 }}
                            onClick={() => {
                              handleReact(post.id, react.type);
                              setHoveredPostId(null);
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              fontSize: '1.25rem',
                              cursor: 'pointer',
                              padding: '2px',
                              lineHeight: 1
                            }}
                            title={react.label}
                          >
                            {react.emoji}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button 
                    onClick={() => handleReact(post.id, 'like')}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      height: '36px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      color: hasReacted ? (currentReactionObj?.color || '#3b82f6') : 'var(--color-text-muted)',
                      padding: 0
                    }}
                    className="hover-bg post-action-btn"
                  >
                    <div
                      onMouseEnter={() => handleMouseEnterLike(post.id)}
                      onMouseLeave={() => handleMouseLeaveLike(post.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        width: '100%',
                        height: '100%',
                        padding: '0 8px'
                      }}
                    >
                      {hasReacted ? (
                        <span style={{ fontSize: '1rem', lineHeight: 1 }}>{currentReactionObj?.emoji}</span>
                      ) : (
                        <ThumbsUp size={16} />
                      )}
                      <span>{hasReacted ? currentReactionObj?.label : t('Yêu thích')}</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => toggleCommentsDrawer(post.id)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'transparent',
                      border: 'none',
                      height: '36px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '8px',
                      color: activeCommentsPostId === post.id ? 'var(--color-primary)' : 'var(--color-text-muted)'
                    }}
                    className="hover-bg post-action-btn"
                  >
                    <MessageCircle size={16} />
                    <span>{t('Bình luận')} ({post.comments_count})</span>
                  </button>
                </div>

                {/* Comments Section Drawer (Accordian list) */}
                {activeCommentsPostId === post.id && (
                  <div style={{
                    borderTop: '1px solid var(--color-border-light)',
                    paddingTop: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {/* Add Comment Input (Isolated component to eliminate root feed re-renders) */}
                    <PostCommentBox
                      postId={post.id}
                      replyToId={replyToCommentId[post.id] || null}
                      user={user}
                      appendedEmoji={appendedEmoji?.postId === post.id ? appendedEmoji : null}
                      onSend={handleAddComment}
                      onOpenSticker={(postId, parentId, anchorEl) => {
                        setStickerTargetPostId(postId);
                        setStickerTargetParentId(parentId);
                        setFeedStickerAnchorEl(anchorEl);
                        setShowFeedStickerModal(true);
                      }}
                      onCancelReply={(postId) => {
                        setReplyToCommentId(prev => ({ ...prev, [postId]: null }));
                      }}
                      t={t}
                    />

                    {/* Comments List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                      {loadingCommentsMap[post.id] ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0' }}>
                          <CommentSkeletonItem />
                          <CommentSkeletonItem />
                        </div>
                      ) : (commentsMap[post.id] || []).length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px 0' }}>
                          {t('Chưa có bình luận nào. Hãy trở thành người đầu tiên!')}
                        </span>
                      ) : (
                        commentsMap[post.id]
                          .filter(c => !c.parent_id || Number(c.parent_id) === 0)
                          .map(comment => (
                          <div 
                            key={comment.id} 
                            id={`comment-${comment.id}`}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '6px',
                              borderRadius: '12px',
                              padding: highlightedCommentId === comment.id ? '6px' : '0px',
                              backgroundColor: highlightedCommentId === comment.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                              boxShadow: highlightedCommentId === comment.id ? '0 0 0 2px var(--color-primary)' : 'none',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {/* Parent Comment */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <Avatar 
                                src={comment.author_avatar} 
                                name={comment.author_name} 
                                size={28} 
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {(() => {
                                  const isSticker = isOnlyStickerComment(comment.content);
                                  return (
                                    <>
                                      <div style={{
                                        background: isSticker ? 'transparent' : 'var(--color-bg)',
                                        padding: isSticker ? '2px 0' : '8px 12px',
                                        borderRadius: '12px',
                                        border: isSticker ? 'none' : '1px solid var(--color-border-light)'
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isSticker ? '2px' : '0' }}>
                                          <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{comment.author_name}</span>
                                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                            {new Date(comment.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        {editingComment?.id === comment.id ? (
                                          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <MentionInput
                                              placeholder={t('Chỉnh sửa bình luận...')}
                                              value={editingComment.content}
                                              onChange={e => setEditingComment(prev => prev ? { ...prev, content: e.target.value } : null)}
                                              enterSubmits={true}
                                              onSubmitShortcut={() => handleSaveEditComment(comment.id, post.id, editingComment.content)}
                                              style={{
                                                width: '100%',
                                                minHeight: '44px',
                                                padding: '6px 10px',
                                                fontSize: '0.8rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--color-primary)',
                                                background: 'var(--color-bg-secondary)'
                                              }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                                              <button 
                                                type="button"
                                                onClick={() => setEditingComment(null)}
                                                disabled={isSavingCommentEdit}
                                                style={{
                                                  padding: '3px 8px',
                                                  fontSize: '0.7rem',
                                                  borderRadius: '6px',
                                                  border: '1px solid var(--color-border)',
                                                  background: 'transparent',
                                                  color: 'var(--color-text-muted)',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                {t('Hủy')}
                                              </button>
                                              <button 
                                                type="button"
                                                onClick={() => handleSaveEditComment(comment.id, post.id, editingComment.content)}
                                                disabled={isSavingCommentEdit || !editingComment.content.trim()}
                                                style={{
                                                  padding: '3px 10px',
                                                  fontSize: '0.7rem',
                                                  borderRadius: '6px',
                                                  border: 'none',
                                                  background: 'var(--color-primary)',
                                                  color: '#ffffff',
                                                  fontWeight: 600,
                                                  cursor: 'pointer',
                                                  opacity: isSavingCommentEdit ? 0.6 : 1
                                                }}
                                              >
                                                {isSavingCommentEdit ? t('Đang lưu...') : t('Lưu')}
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          renderCommentContent(comment.content)
                                        )}
                                      </div>
                                      
                                      {/* Comment Actions - Aligned Right */}
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '3px 4px 0 4px' }}>
                                        <button 
                                          onClick={() => setReplyToCommentId(prev => ({ ...prev, [post.id]: comment.id }))}
                                          style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                        >
                                          {t('Phản hồi')}
                                        </button>
                                        {(user?.id === comment.user_id || ['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '')) && !isSticker && (
                                          <button 
                                            onClick={() => setEditingComment({ id: comment.id, postId: post.id, content: comment.content })}
                                            style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                          >
                                            {t('Sửa')}
                                          </button>
                                        )}
                                        {(user?.id === comment.user_id || ['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '')) && (
                                          <button 
                                            onClick={() => setCommentToDelete({ postId: post.id, commentId: comment.id })}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                            title={t('Xóa')}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Nested Replies */}
                            {comment.replies && comment.replies.map(reply => {
                              const isReplySticker = isOnlyStickerComment(reply.content);
                              return (
                                <div 
                                  key={reply.id} 
                                  id={`comment-${reply.id}`}
                                  style={{ 
                                    display: 'flex', 
                                    gap: '8px', 
                                    alignItems: 'flex-start', 
                                    marginLeft: '36px',
                                    borderRadius: '12px',
                                    padding: highlightedCommentId === reply.id ? '6px' : '0px',
                                    backgroundColor: highlightedCommentId === reply.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                                    boxShadow: highlightedCommentId === reply.id ? '0 0 0 2px var(--color-primary)' : 'none',
                                    transition: 'all 0.3s ease'
                                  }}
                                >
                                  <Avatar 
                                    src={reply.author_avatar} 
                                    name={reply.author_name} 
                                    size={24} 
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      background: isReplySticker ? 'transparent' : 'var(--color-bg)',
                                      padding: isReplySticker ? '2px 0' : '6px 10px',
                                      borderRadius: '12px',
                                      border: isReplySticker ? 'none' : '1px solid var(--color-border-light)'
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isReplySticker ? '2px' : '0' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{reply.author_name}</span>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                          {new Date(reply.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      {editingComment?.id === reply.id ? (
                                        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                          <MentionInput
                                            placeholder={t('Chỉnh sửa phản hồi...')}
                                            value={editingComment.content}
                                            onChange={e => setEditingComment(prev => prev ? { ...prev, content: e.target.value } : null)}
                                            enterSubmits={true}
                                            onSubmitShortcut={() => handleSaveEditComment(reply.id, post.id, editingComment.content)}
                                            style={{
                                              width: '100%',
                                              minHeight: '40px',
                                              padding: '5px 8px',
                                              fontSize: '0.75rem',
                                              borderRadius: '8px',
                                              border: '1px solid var(--color-primary)',
                                              background: 'var(--color-bg-secondary)'
                                            }}
                                          />
                                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                                            <button 
                                              type="button"
                                              onClick={() => setEditingComment(null)}
                                              disabled={isSavingCommentEdit}
                                              style={{
                                                padding: '2px 8px',
                                                fontSize: '0.7rem',
                                                borderRadius: '6px',
                                                border: '1px solid var(--color-border)',
                                                background: 'transparent',
                                                color: 'var(--color-text-muted)',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              {t('Hủy')}
                                            </button>
                                            <button 
                                              type="button"
                                              onClick={() => handleSaveEditComment(reply.id, post.id, editingComment.content)}
                                              disabled={isSavingCommentEdit || !editingComment.content.trim()}
                                              style={{
                                                padding: '2px 10px',
                                                fontSize: '0.7rem',
                                                borderRadius: '6px',
                                                border: 'none',
                                                background: 'var(--color-primary)',
                                                color: '#ffffff',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                opacity: isSavingCommentEdit ? 0.6 : 1
                                              }}
                                            >
                                              {isSavingCommentEdit ? t('Đang lưu...') : t('Lưu')}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        renderCommentContent(reply.content)
                                      )}
                                    </div>
                                    {/* Reply Actions - Aligned Right */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '3px 4px 0 4px' }}>
                                      <button 
                                        onClick={() => setReplyToCommentId(prev => ({ ...prev, [post.id]: comment.id }))}
                                        style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                      >
                                        {t('Phản hồi')}
                                      </button>
                                      {(user?.id === reply.user_id || ['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '')) && !isReplySticker && (
                                        <button 
                                          onClick={() => setEditingComment({ id: reply.id, postId: post.id, content: reply.content })}
                                          style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                        >
                                          {t('Sửa')}
                                        </button>
                                      )}
                                      {(user?.id === reply.user_id || ['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '')) && (
                                        <button 
                                          onClick={() => setCommentToDelete({ postId: post.id, commentId: reply.id })}
                                          style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                          title={t('Xóa')}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Infinite Scroll trigger area */}
      <div 
        ref={bottomObserverRef} 
        style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: '0.8rem',
          marginTop: '1rem'
        }}
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        ) : (hasMore && posts.length > 0) ? (
          t('Cuộn xuống để xem thêm...')
        ) : (
          posts.length > 0 && t('Bạn đã xem hết toàn bộ bài viết')
        )}
      </div>
    </div>

    {/* Right Side: Widgets Panel */}
    <div className="feed-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'sticky', top: '24px' }}>
      {/* Winner Honor Card */}
      {/* Winner Honor Cards List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏆 {t('Vinh danh xuất sắc')}
          </h3>
          {['admin', 'superadmin', 'super_admin'].includes(user?.role || '') && (
            <button
              onClick={() => {
                setSelectedHonorId(null);
                setEditHonorsUserId(honorsData?.candidates?.[0]?.id ?? null);
                setEditHonorsTitle('');
                setEditHonorsBadge('');
                setEditHonorsReason('');
                setShowEditHonors(true);
              }}
              style={{
                background: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              className="hover-scale"
            >
              + {t('Thêm')}
            </button>
          )}
        </div>

        {loadingHonors || !honorsData ? (
          <HonorSkeletonCard />
        ) : honorsData?.honors && honorsData.honors.length > 0 ? (
          honorsData.honors.map((hObj) => (
            <div 
              key={hObj.id}
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                color: '#ffffff',
                borderRadius: '16px',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-md)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '10px'
              }}
            >
              {/* Sparkle background effects */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                fontSize: '4rem',
                opacity: 0.3,
                pointerEvents: 'none'
              }}>👑</div>

              {/* Admin Action Buttons (Edit & Delete) */}
              {['admin', 'superadmin', 'super_admin'].includes(user?.role || '') && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px', zIndex: 10 }}>
                  <button
                    onClick={() => {
                      setSelectedHonorId(hObj.id);
                      setEditHonorsUserId(hObj.user_id);
                      setEditHonorsTitle(hObj.title);
                      setEditHonorsBadge(hObj.badge);
                      setEditHonorsReason(hObj.reason);
                      setShowEditHonors(true);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#ffffff'
                    }}
                    title={t('Chỉnh sửa')}
                    className="hover-scale"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteHonor(hObj.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#ffffff'
                    }}
                    title={t('Xóa')}
                    className="hover-scale"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.65rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                🏆 {hObj.badge}
              </div>

              <Avatar 
                src={hObj.avatar_url || undefined} 
                name={hObj.full_name || 'User'} 
                size={64} 
                style={{ border: '3px solid #ffffff', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}
              />

              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>
                  {hObj.full_name}
                </h4>
                <span style={{ fontSize: '0.7rem', opacity: 0.9, fontWeight: 600 }}>
                  {hObj.title}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.4', opacity: 0.95 }}>
                "{hObj.reason}"
              </p>

              {/* Heart clap reaction button ("thả tym đẩy nhiệt") */}
              <button
                onClick={() => handleHeartHonor(hObj.id)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '4px',
                  transition: 'background 0.2s, transform 0.1s'
                }}
                className="hover-scale active-shrink"
              >
                <span>🔥</span> {t('Đẩy nhiệt')} ({hObj.hearts_count || 0})
              </button>
            </div>
          ))
        ) : (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            padding: '1.5rem',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)'
          }}>
            {t('Chưa có nhân viên vinh danh')}
          </div>
        )}
      </div>

      {/* Trending hashtags */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: '16px',
        border: '1px solid var(--color-border-light)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
          <Tag size={14} style={{ color: 'var(--color-primary)' }} />
          {t('Xu hướng nội bộ')}
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {trendingTags.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px 0', fontStyle: 'italic' }}>
              {t('Chưa có xu hướng nào')}
            </div>
          ) : (
            trendingTags.map(tObj => (
              <div 
                key={tObj.tag}
                onClick={() => setActiveTag(tObj.tag)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: activeTag === tObj.tag ? 'var(--color-success-light)' : 'var(--color-bg)',
                  transition: 'all 0.2s'
                }}
                className="hover-bg"
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: activeTag === tObj.tag ? 'var(--color-success)' : 'var(--color-text)' }}>
                  {tObj.label}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '2px 6px', borderRadius: '10px' }}>
                  {tObj.count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </div>

  {/* Edit Honors Modal */}
  <CustomModal
    isOpen={showEditHonors}
    onClose={() => setShowEditHonors(false)}
    title={`🏆 ${t('Thiết lập vinh danh')}`}
    width="500px"
    zIndex={2000000}
  >
    <form onSubmit={handleSaveHonors} style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Employee Selection */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {t('Chọn nhân viên')} <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <CustomSelect
          value={editHonorsUserId || ''}
          onChange={val => {
            const numVal = val ? parseInt(val) : null;
            setEditHonorsUserId(numVal);
            if (numVal && honorsData?.candidates) {
              const cand = honorsData.candidates.find(c => c.id === numVal);
              if (cand) {
                const roleMap: Record<string, string> = {
                  'admin': 'Quản trị viên',
                  'superadmin': 'Quản trị viên cấp cao',
                  'sales': 'Nhân viên kinh doanh (Sales)',
                  'sale': 'Nhân viên kinh doanh (Sales)',
                  'manager': 'Quản lý dự án (Manager)',
                  'hr': 'Nhân viên nhân sự (HR)',
                  'accountant': 'Kế toán viên'
                };
                setEditHonorsTitle(roleMap[cand.role] || cand.role || '');
              }
            }
          }}
          options={[
            { value: '', label: t('Chọn nhân viên') },
            ...(honorsData?.candidates?.map(c => ({
              value: c.id,
              label: c.full_name,
              avatar: c.avatar_url || undefined,
              sublabel: c.role
            })) || [])
          ]}
          showAvatars={true}
          searchable={true}
          width="100%"
          size="sm"
        />
      </div>

      {/* Title Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {t('Chức danh vinh danh')} <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          type="text"
          value={editHonorsTitle}
          onChange={(e) => setEditHonorsTitle(e.target.value)}
          placeholder={t('Ví dụ: Trưởng phòng Kinh doanh (Sale Manager)')}
          className="form-input"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '0.85rem'
          }}
        />
      </div>

      {/* Badge/Award Title Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {t('Danh hiệu / Giải thưởng')} <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          type="text"
          value={editHonorsBadge}
          onChange={(e) => setEditHonorsBadge(e.target.value)}
          placeholder={t('Ví dụ: Nhân viên xuất sắc của tháng')}
          className="form-input"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '0.85rem'
          }}
        />
      </div>

      {/* Reason Textarea */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {t('Lời chúc / Ghi chú vinh danh')} <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          value={editHonorsReason}
          onChange={(e) => setEditHonorsReason(e.target.value)}
          rows={4}
          placeholder={t('Nhập mô tả thành tích vinh danh...')}
          className="form-textarea"
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '0.85rem',
            resize: 'none'
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => setShowEditHonors(false)}
          className="btn secondary"
          style={{
            padding: '8px 16px',
            fontSize: '0.85rem'
          }}
        >
          {t('Hủy')}
        </button>
        <button
          type="submit"
          disabled={savingHonors}
          className="btn primary"
          style={{
            padding: '8px 20px',
            fontSize: '0.85rem'
          }}
        >
          {savingHonors ? t('Đang lưu...') : t('Lưu thay đổi')}
        </button>
      </div>
    </form>
  </CustomModal>

      {/* Reactions Detail Modal */}
      <CustomModal
        isOpen={reactionsModalPostId !== null}
        onClose={() => setReactionsModalPostId(null)}
        title={t('Tương tác với bài viết')}
        width="450px"
      >
        <div style={{ padding: '4px' }}>
          {loadingReactionsModal ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '3px solid var(--color-border-light)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          ) : reactionsModalList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              {t('Chưa có lượt tương tác nào.')}
            </div>
          ) : (
            <div 
              className="custom-scrollbar"
              style={{ 
                maxHeight: '350px', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '12px',
                paddingRight: '6px'
              }}
            >
              {reactionsModalList.map((react, index) => {
                const reactionObj = REACTION_TYPES.find(r => r.type === react.reaction_type);
                return (
                  <div 
                    key={index} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: 'var(--color-bg-light)',
                      border: '1px solid var(--color-border-light)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ position: 'relative' }}>
                        <Avatar 
                          src={react.avatar_url} 
                          name={react.full_name} 
                          size="sm" 
                        />
                        <span style={{ 
                          position: 'absolute', 
                          bottom: '-4px', 
                          right: '-4px', 
                          fontSize: '1rem',
                          background: 'var(--color-surface)',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: 'var(--shadow-sm)'
                        }}>
                          {reactionObj?.emoji || '👍'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          {react.full_name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {t(react.role || 'Nhân viên')}
                        </span>
                      </div>
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 600, 
                      color: reactionObj?.color || 'var(--color-text-muted)' 
                    }}>
                      {t(reactionObj?.label || 'Thích')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CustomModal>

      {commentToDelete !== null && (
        <ConfirmModal
          isOpen={commentToDelete !== null}
          onClose={() => setCommentToDelete(null)}
          onConfirm={async () => {
            if (commentToDelete) {
              await handleDeleteComment(commentToDelete.postId, commentToDelete.commentId);
              setCommentToDelete(null);
            }
          }}
          title={t('Xác nhận xóa bình luận')}
          message={t('Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.')}
          confirmText={t('Xóa')}
          cancelText={t('Hủy')}
          confirmType="danger"
        />
      )}

      <StickerPickerModal
        isOpen={showFeedStickerModal}
        onClose={() => {
          setShowFeedStickerModal(false);
          setStickerTargetPostId(null);
          setStickerTargetParentId(null);
          setFeedStickerAnchorEl(null);
        }}
        anchorEl={feedStickerAnchorEl}
        onSelectSticker={(url) => {
          if (stickerTargetPostId) {
            handleSendStickerComment(stickerTargetPostId, url, stickerTargetParentId);
          }
        }}
        onSelectEmoji={(emoji) => {
          if (stickerTargetPostId) {
            setAppendedEmoji({
              postId: stickerTargetPostId,
              emoji,
              id: Date.now()
            });
            setNewCommentText(prev => ({
              ...prev,
              [stickerTargetPostId]: (prev[stickerTargetPostId] || '') + emoji
            }));
          }
        }}
      />

      {/* Edit Post Modal */}
      <CustomModal
        isOpen={Boolean(editingPost)}
        onClose={() => setEditingPost(null)}
        title={`✏️ ${t('Chỉnh sửa bài viết')}`}
        width="600px"
        zIndex={2000000}
      >
        {editingPost && (
          <form onSubmit={handleSaveEditPost} style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Visibility Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CustomSelect
                value={editVisibility}
                onChange={val => setEditVisibility(val)}
                options={[
                  { value: 'global', label: t('Công khai'), icon: <Globe size={12} /> },
                  { value: 'team', label: t('Phòng ban'), icon: <Users size={12} /> }
                ]}
                width="160px"
                size="sm"
              />

              {editVisibility === 'team' && (
                <CustomSelect
                  value={editTeamId ? String(editTeamId) : ''}
                  onChange={val => setEditTeamId(val ? Number(val) : null)}
                  options={[
                    { value: '', label: t('Chọn phòng ban') },
                    ...teams.map(tObj => ({
                      value: String(tObj.id),
                      label: tObj.name
                    }))
                  ]}
                  width="180px"
                  size="sm"
                />
              )}
            </div>

            {/* Content text area */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '12px', padding: '10px', background: 'var(--color-bg)' }}>
              <MentionInput
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder={t('Bạn đang nghĩ gì?')}
                style={{
                  width: '100%',
                  minHeight: '110px',
                  border: 'none',
                  boxShadow: 'none',
                  background: 'transparent',
                  fontSize: '0.9rem',
                  color: 'var(--color-text)'
                }}
                disabled={isSavingEdit}
              />
            </div>

            {/* Attachments preview & removal */}
            {editAttachments.length > 0 && (
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', display: 'block' }}>
                  {t('Ảnh đính kèm')} ({editAttachments.length})
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {editAttachments.map((url, i) => (
                    <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border-light)' }}>
                      <img src={url} alt="Attachment" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button 
                        type="button" 
                        onClick={() => setEditAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          background: 'rgba(15, 23, 42, 0.75)',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title={t('Xóa ảnh')}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add more attachments button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-card)',
                  cursor: editUploading ? 'wait' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--color-text)'
                }}
              >
                <Camera size={14} style={{ color: 'var(--color-primary)' }} />
                <span>{editUploading ? t('Đang tải ảnh...') : t('Thêm ảnh')}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={handleEditImageUpload}
                  disabled={editUploading || isSavingEdit}
                />
              </label>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                {t('Hủy')}
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || editUploading || (!editContent.trim() && editAttachments.length === 0)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  opacity: (isSavingEdit || editUploading || (!editContent.trim() && editAttachments.length === 0)) ? 0.6 : 1
                }}
              >
                {isSavingEdit ? t('Đang lưu...') : t('Lưu thay đổi')}
              </button>
            </div>
          </form>
        )}
      </CustomModal>

      {/* Lightbox Modal for Fullscreen Image Viewing */}
      <AttachmentLightboxModal
        isOpen={Boolean(lightboxData)}
        onClose={() => setLightboxData(null)}
        items={lightboxData?.items || []}
        initialIndex={lightboxData?.initialIndex || 0}
      />

      {/* Floating Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 99
            }}
            title={t('Cuộn lên đầu trang')}
          >
            <ArrowUp size={20} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

// Simple helper to parse and clean hostname from url
function parse_url_host(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace('www.', '');
  } catch (e) {
    return 'link';
  }
}

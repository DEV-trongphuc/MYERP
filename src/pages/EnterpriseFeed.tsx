import React, { useState, useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { 
  ThumbsUp, Heart, Laugh, Angry, MessageCircle, Share2, 
  Send, Trash2, Globe, Lock, Users, Link as LinkIcon, Paperclip, X, Camera, 
  MessageSquare, MoreHorizontal, Filter, Search, Tag, Eye, Edit
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

export const EnterpriseFeed: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

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
  const [selectedVisibility, setSelectedVisibility] = useState<string>('all');

  // Creation State
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState('global');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active Post Comments Drawers
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<number | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<number, Comment[]>>({});
  const [newCommentText, setNewCommentText] = useState<Record<number, string>>({});
  const [replyToCommentId, setReplyToCommentId] = useState<Record<number, number | null>>({});
  const [commentToDelete, setCommentToDelete] = useState<{ postId: number; commentId: number } | null>(null);

  // Floating reactions active state per post
  const [hoveredPostId, setHoveredPostId] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<Record<number, any>>({});

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

  const handleDeleteHonor = async (id: number) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn xóa vinh danh này?'))) return;
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

        setPosts(prev => reset ? fetched : [...prev, ...fetched]);
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

  // Handle post delete
  const handleDeletePost = async (postId: number) => {
    if (!window.confirm(t('Bạn có chắc chắn muốn xóa bài viết này không?'))) return;

    try {
      const res = await api.delete(`/posts/${postId}`);
      if (res.data && res.data.success) {
        toast.success(t('Bài viết đã được xóa'));
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (e) {
      toast.error(t('Lỗi khi xóa bài viết'));
    }
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
  const handleAddComment = async (postId: number, parentId: number | null = null) => {
    const rawText = newCommentText[postId] || '';
    const hasText = rawText.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim().length > 0;
    if (!hasText) return;

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
      }
    } catch (e) {
      toast.error(t('Lỗi khi thêm bình luận'));
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (postId: number, commentId: number) => {
    if (!window.confirm(t('Xóa bình luận này?'))) return;

    try {
      const res = await api.delete(`/posts/comments/${commentId}`);
      if (res.data && res.data.success) {
        loadComments(postId);
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: Math.max(0, p.comments_count - 1) };
          }
          return p;
        }));
      }
    } catch (e) {
      toast.error(t('Lỗi khi xóa bình luận'));
    }
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      let fileToUpload = files[0];
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

      if (res.data && res.data.success) {
        setAttachments(prev => [...prev, res.data.file_url]);
        toast.success(t('Đã tải lên tệp tin'));
      }
    } catch (err) {
      toast.error(t('Lỗi tải tệp lên server'));
    } finally {
      setUploading(false);
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
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} 
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

  const renderCommentContent = (content: string) => {
    if (!content) return null;
    const isHtml = /<[a-z][\s\S]*>/i.test(content);
    if (isHtml) {
      return (
        <div 
          className="rich-text-content" 
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} 
          style={{ fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: 1.4, wordBreak: 'break-word' }}
        />
      );
    }
    return (
      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
        {content}
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
  const renderAttachmentsGrid = (urls: string[]) => {
    if (urls.length === 0) return null;
    const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(url);

    if (urls.length === 1) {
      const url = urls[0];
      return (
        <div style={{ marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border-light)' }}>
          {isImage(url) ? (
            <img src={url} alt="Attachment" style={{ width: '100%', maxHeight: '450px', objectFit: 'cover' }} />
          ) : (
            <video src={url} controls style={{ width: '100%', maxHeight: '450px' }} />
          )}
        </div>
      );
    }

    if (urls.length === 2) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden' }}>
          {urls.map((url, i) => (
            <div key={i} style={{ height: '220px', background: 'var(--color-bg)' }}>
              {isImage(url) ? (
                <img src={url} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video src={url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
          ))}
        </div>
      );
    }

    // 3 or more attachments layout
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginTop: '0.75rem', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ height: '320px', background: 'var(--color-bg)' }}>
          {isImage(urls[0]) ? (
            <img src={urls[0]} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <video src={urls[0]} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '8px', height: '320px' }}>
          {urls.slice(1, 3).map((url, i) => (
            <div key={i} style={{ height: '100%', position: 'relative', background: 'var(--color-bg)' }}>
              {isImage(url) ? (
                <img src={url} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video src={url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {i === 1 && urls.length > 3 && (
                <div style={{
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
                  fontWeight: 800
                }}>
                  +{urls.length - 3}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Filtered list
  const filteredPosts = posts.filter(p => {
    const matchesSearch = p.content.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.author_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesVisibility = true;
    if (selectedVisibility === 'global') {
      matchesVisibility = p.visibility === 'global';
    } else if (selectedVisibility && selectedVisibility.startsWith('team_')) {
      const teamId = parseInt(selectedVisibility.replace('team_', ''));
      matchesVisibility = p.visibility === 'team' && p.team_id === teamId;
    }
    return matchesSearch && matchesVisibility;
  });

  return (
    <div style={{
      maxWidth: '1380px',
      margin: '0 auto',
      padding: '2rem 1.5rem',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <style>{`
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
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--color-text-muted)' }} />
            <input 
              type="text" 
              placeholder={t('Tìm bài viết, tác giả...')} 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                paddingLeft: '32px',
                fontSize: '0.8rem',
                height: '32px',
                outline: 'none'
              }}
            />
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
      <form onSubmit={handlePostSubmit} style={{
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <Avatar 
            src={user?.avatar_url || user?.avatar} 
            name={user?.name || 'User'} 
            size={40} 
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <MentionInput
              placeholder={`${t('Bạn đang nghĩ gì thế')}, ${user?.name || ''}?`}
              value={content}
              onChange={e => setContent(e.target.value)}
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
                <img src={url} alt="Uploaded" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--color-border-light)',
          paddingTop: '10px'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
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
                width="180px"
                size="sm"
              />
            )}
          </div>

          <button 
            type="submit" 
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
              gap: '6px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Send size={12} />
            {isSubmitting ? t('Đang đăng...') : t('Đăng tin')}
          </button>
        </div>
      </form>

      {/* Feed List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filteredPosts.length === 0 && !loading ? (
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
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  boxShadow: 'var(--shadow-sm)',
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

                  {(user?.id === post.user_id || ['admin', 'superadmin', 'super_admin'].includes(user?.role || '')) && (
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
                  )}
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
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
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
                    className="hover-bg"
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
                    className="hover-bg"
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
                    {/* Add Comment Input */}
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
                            replyToCommentId[post.id] 
                              ? `${t('Phản hồi bình luận')}...` 
                              : `${t('Viết bình luận')}...`
                          }
                          value={newCommentText[post.id] || ''}
                          onChange={val => {
                            setNewCommentText(prev => ({ ...prev, [post.id]: val.target.value }));
                          }}
                          style={{
                            width: '100%',
                            minHeight: '48px',
                            fontSize: '0.8rem'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            onClick={() => handleAddComment(post.id, replyToCommentId[post.id])}
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
                            <span>{t('Gửi')}</span>
                          </button>
                          {replyToCommentId[post.id] && (
                            <button 
                              onClick={() => setReplyToCommentId(prev => ({ ...prev, [post.id]: null }))}
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

                    {/* Comments List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                      {(commentsMap[post.id] || []).length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px 0' }}>
                          {t('Chưa có bình luận nào. Hãy trở thành người đầu tiên!')}
                        </span>
                      ) : (
                        commentsMap[post.id]
                          .filter(c => !c.parent_id || Number(c.parent_id) === 0)
                          .map(comment => (
                          <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {/* Parent Comment */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <Avatar 
                                src={comment.author_avatar} 
                                name={comment.author_name} 
                                size={28} 
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{
                                  background: 'var(--color-bg)',
                                  padding: '8px 12px',
                                  borderRadius: '12px',
                                  border: '1px solid var(--color-border-light)'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{comment.author_name}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                      {new Date(comment.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {renderCommentContent(comment.content)}
                                </div>
                                
                                {/* Comment Actions */}
                                <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '4px 8px 0 8px' }}>
                                  <button 
                                    onClick={() => setReplyToCommentId(prev => ({ ...prev, [post.id]: comment.id }))}
                                    style={{ background: 'transparent', border: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                  >
                                    {t('Phản hồi')}
                                  </button>
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
                              </div>
                            </div>

                            {/* Nested Replies */}
                            {comment.replies && comment.replies.map(reply => (
                              <div key={reply.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginLeft: '36px' }}>
                                <Avatar 
                                  src={reply.author_avatar} 
                                  name={reply.author_name} 
                                  size={24} 
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{
                                    background: 'var(--color-bg)',
                                    padding: '6px 10px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--color-border-light)'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{reply.author_name}</span>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
                                        {new Date(reply.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    {renderCommentContent(reply.content)}
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: 'var(--color-text-muted)', padding: '2px 8px 0 8px' }}>
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
                            ))}
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

        {honorsData?.honors && honorsData.honors.length > 0 ? (
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

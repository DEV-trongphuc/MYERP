import React, { useEffect, useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchAPI } from '../utils/api';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { useUIStore } from '../store/uiStore';
import { Building2, Users, FileText, Plus, Trash2, Edit, X, Upload, Download, Check, AlertCircle, Layers, FileSpreadsheet, Link2, Globe, Search, Folder, ExternalLink, MessageSquare, Paperclip, RefreshCw, Calendar, CheckSquare, HardDrive, Info, MapPin, Briefcase, AlignLeft, Filter, History, Megaphone, Eye, Settings, ShieldAlert, Zap, Send, GraduationCap, BookOpen, PenTool, Award } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyCard } from '../components/ui/EmptyCard';
import { compressToWebP } from '../utils/imageCompress';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { AddressSelect } from '../components/ui/AddressSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { Pagination } from '../components/ui/Pagination';
import { Skeleton } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { Mail, Phone, Copy, ChevronLeft, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MentionInput } from '../components/ui/MentionInput';
const WorkspaceTaskDrawer = lazy(() => import('./WorkspaceTaskDrawer').then(module => ({ default: module.WorkspaceTaskDrawer })));
const CustomerProfileDrawer = lazy(() => import('./CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
import { CompanyDrawer } from './CompanyDrawer';
import { FilesPage } from './FilesPage';
import { useUploadProgress } from '../contexts/UploadProgressContext';
import { ProjectGanttTab } from '../components/ProjectGanttTab';

const parseSeminarTimeSlot = (timeSlot: string) => {
  const result = {
    sessions_count: 1,
    session1_start: '08:30',
    session1_end: '11:30',
    session2_start: '13:30',
    session2_end: '16:30'
  };

  if (!timeSlot) return result;

  const parts = timeSlot.split('&').map(p => p.trim());
  if (parts.length >= 2) {
    result.sessions_count = 2;
    const p1 = parts[0].split(/[-–]/).map(t => t.trim());
    if (p1[0]) result.session1_start = p1[0];
    if (p1[1]) result.session1_end = p1[1];

    const p2 = parts[1].split(/[-–]/).map(t => t.trim());
    if (p2[0]) result.session2_start = p2[0];
    if (p2[1]) result.session2_end = p2[1];
  } else {
    result.sessions_count = 1;
    const p1 = parts[0].split(/[-–]/).map(t => t.trim());
    if (p1[0]) result.session1_start = p1[0];
    if (p1[1]) result.session1_end = p1[1];
  }

  return result;
};

const formatSeminarTimeSlot = (sCount: number, s1s: string, s1e: string, s2s: string, s2e: string) => {
  if (Number(sCount) === 2) {
    return `${s1s || '08:30'} - ${s1e || '11:30'} & ${s2s || '13:30'} - ${s2e || '16:30'}`;
  } else {
    return `${s1s || '08:30'} - ${s1e || '11:30'}`;
  }
};

interface Project {
  id: number;
  name: string;
  code: string;
  description: string;
  status: string;
  developer?: string;
  location?: string;
  created_at: string;
  updated_at?: string;
  roster_count?: number;
  doc_count?: number;
  document_ids?: string;
  campaign_ids?: string;
  campaign_ids_array?: number[];
  progress_percent?: number;
  construction_status?: string;
  legal_status?: string;
  scale_block_count?: number;
  scale_unit_count?: number;
  handover_year?: number;
  folder_path?: string;
  manager_ids?: string;
  created_by?: number;
  reference_url?: string;
  campaign_sharing_mode?: string;
}

interface RosterMember {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_assigned: number;
  avatar_url?: string;
  team_id?: number;
}

interface ProjectDoc {
  id: number;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by_name: string;
  created_at: string;
  isLinkedOnly?: boolean;
}

interface ReferenceLink {
  title: string;
  url: string;
}

interface FolderPathObj {
  type: 'link' | 'select';
  path: string;
}

const parseReferenceLinks = (urlStr: string | undefined): ReferenceLink[] => {
  if (!urlStr) return [];
  try {
    const parsed = JSON.parse(urlStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        title: String(item.title || 'Website / Link tham khảo'),
        url: String(item.url || '')
      }));
    }
  } catch (e) {
    // Legacy single URL string
  }
  return [{ title: 'Website / Link tham khảo', url: urlStr }];
};

const parseFolderPaths = (pathStr: string | undefined): FolderPathObj[] => {
  if (!pathStr) return [];
  try {
    const parsed = JSON.parse(pathStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => ({
        type: item.type === 'link' || item.type === 'select' ? item.type : 'link',
        path: String(item.path || '')
      }));
    }
  } catch (e) {
    // Legacy single path
  }
  const isUrl = pathStr.startsWith('http://') || pathStr.startsWith('https://');
  return [{ type: isUrl ? 'link' : 'select', path: pathStr }];
};

const ProjectCardSkeleton = () => (
  <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--color-border-light)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Skeleton width="70%" height={20} />
      <Skeleton width={60} height={20} borderRadius={10} />
    </div>
    <Skeleton width={120} height={12} style={{ marginTop: '4px' }} />
    <Skeleton width="100%" height={14} style={{ marginTop: '4px' }} />
    <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '4px 0' }} />
    <div style={{ display: 'flex', gap: '8px' }}>
      <Skeleton width="45%" height={24} borderRadius={4} />
      <Skeleton width="45%" height={24} borderRadius={4} />
    </div>
    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
      <Skeleton width={80} height={12} />
      <Skeleton width={80} height={12} />
    </div>
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <Skeleton width="50%" height={32} borderRadius={16} />
      <Skeleton width="50%" height={32} borderRadius={16} />
    </div>
  </div>
);

const CampaignCardSkeleton = () => (
  <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', border: '1px solid var(--color-border-light)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Skeleton width="60%" height={18} />
      <Skeleton width={80} height={22} borderRadius={20} />
    </div>
    <Skeleton width="100%" height={14} style={{ marginTop: '4px' }} />
    <div style={{ display: 'flex', gap: '12px' }}>
      <Skeleton width={70} height={12} />
      <Skeleton width={70} height={12} />
    </div>
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      <Skeleton width={32} height={32} borderRadius="50%" />
      <Skeleton width={32} height={32} borderRadius="50%" />
      <Skeleton width={32} height={32} borderRadius="50%" />
    </div>
    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
      <Skeleton width="50%" height={32} borderRadius={6} />
      <Skeleton width="50%" height={32} borderRadius={6} />
    </div>
  </div>
);

export default function ProjectsPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 991);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 991);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user } = useAuth();
  const { startUpload, updateProgress, finishUpload } = useUploadProgress();
  const { addToast, showConfirm } = useUIStore();
  const { t } = useLanguage();
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalPath, setFolderModalPath] = useState('');
  const [folderModalProjectId, setFolderModalProjectId] = useState<number | null>(null);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [folderFilesLoading, setFolderFilesLoading] = useState(false);

  const loadFolderFiles = async (projectId: number) => {
    setFolderFilesLoading(true);
    try {
      const res = await fetchAPI(`cloud-files?project_id=${projectId}&limit=100`);
      if (res.success) {
        const data = res.data?.items || res.data || [];
        setFolderFiles(data);
      }
    } catch (e) {
      console.error('Failed to load folder files', e);
    } finally {
      setFolderFilesLoading(false);
    }
  };

  const handleOpenFolderModal = (path: string, projectId: number) => {
    console.log('handleOpenFolderModal called: path=', path, 'projectId:', projectId);
    setFolderModalPath(path);
    setFolderModalProjectId(projectId);
    setFolderFiles([]);
    setShowFolderModal(true);
    loadFolderFiles(projectId);
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });
  const navigate = useNavigate();
  const [screenWidth, setScreenWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileCategories, setFileCategories] = useState<{ id: number; label: string }[]>([]);
  const [folderLinkType, setFolderLinkType] = useState<'link' | 'select'>('link');
  const [campaignFolderLinkType, setCampaignFolderLinkType] = useState<'link' | 'select'>('link');
  const isLegacyLayoutEnabled = false;

  useEffect(() => {
    api.get('/file-categories')
      .then(res => {
        if (res.data && Array.isArray(res.data.data)) {
          setFileCategories(res.data.data);
        }
      })
      .catch(err => console.error('Failed to fetch file categories', err));
  }, []);
  const [developers, setDevelopers] = useState<any[]>([]);
  const [allFiles, setAllFiles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [allRounds, setAllRounds] = useState<any[]>([]);
  const [selectedRoundForModal, setSelectedRoundForModal] = useState<any | null>(null);
  const [isRoundDetailModalOpen, setIsRoundDetailModalOpen] = useState(false);

  useEffect(() => {
    fetchAPI('get_rounds')
      .then(res => {
        if (res && res.success && Array.isArray(res.data)) {
          setAllRounds(res.data);
        }
      })
      .catch(err => console.error('Failed to fetch distribution rounds', err));
  }, []);

  const [quickUserCard, setQuickUserCard] = useState<{ id: number; name: string; role: string; email?: string; phone?: string; vacationMode?: number; avatarUrl?: string; visible: boolean; x: number; y: number } | null>(null);
  const [projectModalMode, setProjectModalMode] = useState<'view' | 'edit' | 'create'>('view');
  const [campaignModalMode, setCampaignModalMode] = useState<'view' | 'edit' | 'create'>('view');

  const formatFileName = (name: string, maxLen: number = 30) => {
    if (!name || name.length <= maxLen) return name;
    const extIndex = name.lastIndexOf('.');
    const ext = extIndex !== -1 ? name.substring(extIndex) : '';
    const baseName = extIndex !== -1 ? name.substring(0, extIndex) : name;
    const cutLen = maxLen - ext.length - 3;
    if (cutLen <= 0) return name.substring(0, maxLen) + '...';
    return baseName.substring(0, cutLen) + '...' + ext;
  };
  const [activeSubTab, setActiveSubTab] = useState<'projects' | 'campaigns'>('projects');
  const [projectTasksPage, setProjectTasksPage] = useState(1);
  const [campaignTasksPage, setCampaignTasksPage] = useState(1);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignProjectFilter, setCampaignProjectFilter] = useState<string>('');
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [rosterSearch, setRosterSearch] = useState('');

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [autoCode, setAutoCode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTaskForDrawer, setSelectedTaskForDrawer] = useState<any>(null);
  const [selectedContactForDrawer, setSelectedContactForDrawer] = useState<any>(null);
  const [isLecturerDrawerOpen, setIsLecturerDrawerOpen] = useState(false);
  const [selectedLecturerEntity, setSelectedLecturerEntity] = useState<any>(null);

  // Copy subject modal state
  const [isCopySubjectModalOpen, setIsCopySubjectModalOpen] = useState(false);
  const [subjectToCopy, setSubjectToCopy] = useState<any>(null);
  const [copyTargetCampaignId, setCopyTargetCampaignId] = useState<string>('');
  const [copyConflictMode, setCopyConflictMode] = useState<'add' | 'replace'>('replace');
  const [isCopyingSubject, setIsCopyingSubject] = useState(false);

  // Quick campaigns modal state
  const [quickCampaignsModalOpen, setQuickCampaignsModalOpen] = useState(false);
  const [quickCampaignsProject, setQuickCampaignsProject] = useState<any | null>(null);
  const [quickCampaignsList, setQuickCampaignsList] = useState<any[]>([]);

  const handleOpenQuickCampaigns = (proj: any, linkedCamps: any[]) => {
    setQuickCampaignsProject(proj);
    setQuickCampaignsList(linkedCamps);
    setQuickCampaignsModalOpen(true);
  };

  const isTimeOverlapping = (time1: string, time2: string) => {
    if (!time1 || !time2) return true;
    const parseTime = (tStr: string) => {
      const match = tStr.match(/(\d{1,2}):(\d{2})/);
      if (!match) return 0;
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    };
    const getRanges = (rangeStr: string) => {
      const parts = rangeStr.split(/[-–]/).map(p => p.trim());
      return {
        start: parseTime(parts[0]),
        end: parseTime(parts[1] || parts[0])
      };
    };
    const r1 = getRanges(time1);
    const r2 = getRanges(time2);
    return (r1.start < r2.end && r2.start < r1.end);
  };

  const checkLecturerConflict = (lecturerId: string, date: string, timeRange: string, currentSubjectId: string, currentSessionId: string) => {
    if (!lecturerId || !date) return null;
    for (const camp of campaigns) {
      if (camp.status !== 'active') continue;
      const isCurrentCamp = editingCampaign && String(camp.id) === String(editingCampaign.id);
      const campSubs = camp.subjects_json ? (typeof camp.subjects_json === 'string' ? JSON.parse(camp.subjects_json) : camp.subjects_json) : [];
      for (const s of campSubs) {
        if (isCurrentCamp && String(s.id) === String(currentSubjectId)) {
          continue;
        }
        if (Array.isArray(s.host_sessions)) {
          for (const hs of s.host_sessions) {
            if (hs.date === date && String(hs.lecturer_name) === String(lecturerId)) {
              const hsTime = `${hs.time_start || '20:00'} - ${hs.time_end || '22:00'}`;
              if (isTimeOverlapping(hsTime, timeRange) && (s.id !== currentSubjectId || hs.id !== currentSessionId)) {
                return { course: camp.name, subject: s.name, type: 'Lớp trường', time: hsTime };
              }
            }
          }
        }
        if (Array.isArray(s.seminars)) {
          for (const sem of s.seminars) {
            if (sem.date === date && String(sem.lecturer_id) === String(lecturerId)) {
              const semTime = sem.time_slot || (sem.time_start && sem.time_end ? `${sem.time_start} - ${sem.time_end}` : '08:30 - 11:30');
              if (isTimeOverlapping(semTime, timeRange) && (s.id !== currentSubjectId || sem.id !== currentSessionId)) {
                return { course: camp.name, subject: s.name, type: 'Chuyên đề', time: semTime };
              }
            }
          }
        }
      }
    }
    return null;
  };

  const renderQuickCampaignsDrawer = () => {
    return renderDrawer(
      quickCampaignsModalOpen,
      () => setQuickCampaignsModalOpen(false),
      `Khóa học liên kết - ${quickCampaignsProject?.name || ''}`,
      (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>
          {quickCampaignsList.length === 0 ? (
            <EmptyCard
              icon={<BookOpen size={48} />}
              title="Chưa có khóa học liên kết"
              description="Không tìm thấy khóa học nào liên kết với chương trình này."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {quickCampaignsList.map(camp => {
                const docCount = parseIds(camp.document_ids).length;
                const staffCount = parseIds(camp.user_ids).length;
                return (
                  <div
                    key={camp.id}
                    className="hover-lift"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 20px -5px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', overflow: 'hidden' }}>
                          <div style={{
                            padding: '6px',
                            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08), rgba(225, 29, 72, 0.08))',
                            borderRadius: '8px',
                            color: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <BookOpen size={14} />
                          </div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }} className="line-clamp-1">
                            {camp.name}
                          </h4>
                        </div>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          padding: '2px 8px', 
                          borderRadius: '100px', 
                          fontWeight: 750,
                          background: camp.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          color: camp.status === 'active' ? '#10b981' : '#ef4444',
                          border: camp.status === 'active' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {camp.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>
                      {camp.description ? (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.45 }} className="line-clamp-2">
                          {camp.description}
                        </p>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic', marginBottom: '1rem' }}>
                          Không có mô tả chi tiết
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                          <Folder size={11} style={{ color: 'var(--color-text-light)' }} />
                          {docCount} Tài liệu
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                          <Users size={11} style={{ color: 'var(--color-text-light)' }} />
                          {staffCount} Nhân sự
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setQuickCampaignsModalOpen(false);
                          handleOpenCampaignView(camp);
                        }}
                        className="btn secondary sm"
                        style={{ 
                          fontSize: '0.72rem', 
                          padding: '0 10px', 
                          height: '28px', 
                          borderRadius: '6px', 
                          fontWeight: 700,
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border-light)',
                          color: 'var(--color-text)'
                        }}
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
      '650px'
    );
  };

  const handleOpenTask = (taskId: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('task_id', String(taskId));
    navigate(`${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskId = params.get('task_id');
    if (taskId) {
      const tid = Number(taskId);
      if (tid) {
        api.get(`/activities/${tid}`).then(res => {
          if (res.data && res.data.success && res.data.data) {
            setSelectedTaskForDrawer(res.data.data);
          }
        }).catch(err => {
          console.error("Error loading task from URL:", err);
        });
      }
    }
  }, [window.location.search]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCampaigns = params.get('tab') === 'campaigns' || params.get('sub') === 'campaigns';
    if (isCampaigns) {
      setActiveSubTab('campaigns');
    } else {
      setActiveSubTab('projects');
    }

    const targetId = params.get('id') || params.get('project_id');
    if (targetId) {
      if (isCampaigns) {
        if (campaigns.length > 0) {
          const matched = campaigns.find(c => String(c.id) === targetId);
          if (matched) {
            setEditingCampaign(matched);
            setCampaignModalMode('view');
            setIsCampaignModalOpen(true);

            // clean url parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('project_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }
      } else {
        if (projects.length > 0) {
          const matched = projects.find(p => String(p.id) === targetId);
          if (matched) {
            setEditingProject(matched);
            setProjectModalMode('view');
            setIsEditModalOpen(true);

            // clean url parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('project_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }
      }
    }
  }, [window.location.search, projects, campaigns]);

  const [projectPage, setProjectPage] = useState(1);
  const [projectPageSize, setProjectPageSize] = useState(12);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignPageSize, setCampaignPageSize] = useState(12);

  const filteredCampaigns = React.useMemo(() => {
    if (!campaignProjectFilter) return campaigns;
    return campaigns.filter(c => String(c.project_id) === String(campaignProjectFilter));
  }, [campaigns, campaignProjectFilter]);

  const paginatedCampaigns = React.useMemo(() => {
    const start = (campaignPage - 1) * campaignPageSize;
    return filteredCampaigns.slice(start, start + campaignPageSize);
  }, [filteredCampaigns, campaignPage, campaignPageSize]);

  const quickUploadInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingProject) {
      const isUrl = editingProject.folder_path?.startsWith('http') || false;
      setFolderLinkType(isUrl ? 'link' : 'select');
    }
  }, [editingProject?.id]);

  useEffect(() => {
    if (editingCampaign) {
      const isUrl = editingCampaign.folder_path?.startsWith('http') || false;
      setCampaignFolderLinkType(isUrl ? 'link' : 'select');
    }
  }, [editingCampaign?.id]);

  const generateCodeFromName = (name: string) => {
    if (!name) return '';
    const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const words = cleanName.trim().split(/\s+/);
    const initials = words
      .map(w => w.charAt(0))
      .filter(char => /[a-zA-Z0-9]/.test(char))
      .join('')
      .toUpperCase();
    return initials;
  };

  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  const [projectRoster, setProjectRoster] = useState<any[]>([]);
  const [projectRosterLoading, setProjectRosterLoading] = useState(false);
  const [projectDrawerTab, setProjectDrawerTab] = useState<'details' | 'gantt' | 'hierarchy' | 'changelog'>('details');
  const [campaignDrawerTab, setCampaignDrawerTab] = useState<'details' | 'subjects' | 'lecturers' | 'thesis' | 'reminders' | 'changelog'>('details');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [remindersConfig, setRemindersConfig] = useState<{
    school_reminder_enabled: boolean;
    school_reminder_hours: number;
    ideas_reminder_enabled: boolean;
    ideas_reminder_hours: number;
    assignment_reminder_enabled: boolean;
    assignment_reminder_hours: number;
    lecturer_reminder_enabled: boolean;
    lecturer_reminder_hours: number;
    thesis_reminder_enabled: boolean;
    thesis_reminder_hours: number;
    upcoming_session_reminder_enabled?: boolean;
    upcoming_session_reminder_minutes?: number;
  }>({
    school_reminder_enabled: true,
    school_reminder_hours: 12,
    ideas_reminder_enabled: true,
    ideas_reminder_hours: 168,
    assignment_reminder_enabled: true,
    assignment_reminder_hours: 12,
    lecturer_reminder_enabled: true,
    lecturer_reminder_hours: 12,
    thesis_reminder_enabled: true,
    thesis_reminder_hours: 12,
    upcoming_session_reminder_enabled: true,
    upcoming_session_reminder_minutes: 5,
  });
  const [copiedSubject, setCopiedSubject] = useState<any>(() => {
    try {
      const saved = sessionStorage.getItem('ideas_copied_subject');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [thesisMilestones, setThesisMilestones] = useState<any[]>([]);
  const [configuringSubjectId, setConfiguringSubjectId] = useState<string | null>(null);
  const [syncSubjectToOtherCourses, setSyncSubjectToOtherCourses] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<'school' | 'seminar' | 'zoom' | 'quiz'>('school');
  const [consultants, setConsultants] = useState<any[]>([]);
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [showScheduleExportModal, setShowScheduleExportModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifText, setNotifText] = useState('');
  const [projectStats, setProjectStats] = useState<any>(null);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (configuringSubjectId) {
      setSyncSubjectToOtherCourses(false);
    }
  }, [configuringSubjectId]);

  const loadProjectStats = async (id: number) => {
    setStatsLoading(true);
    try {
      const res = await fetchAPI(`projects/${id}/stats`);
      if (res && res.success) {
        setProjectStats(res.data);
      } else {
        setProjectStats(null);
      }
    } catch (e) {
      console.error(e);
      setProjectStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadCampaignStats = async (id: number) => {
    setStatsLoading(true);
    try {
      const res = await fetchAPI(`campaigns/${id}/stats`);
      if (res && res.success) {
        setCampaignStats(res.data);
      } else {
        setCampaignStats(null);
      }
    } catch (e) {
      console.error(e);
      setCampaignStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadProjectRoster = async (projectId: number) => {
    setProjectRosterLoading(true);
    try {
      const res = await fetchAPI(`projects/${projectId}/roster`);
      if (Array.isArray(res)) {
        setProjectRoster(res.filter((m: any) => m.is_assigned === 1));
      } else if (res.success && Array.isArray(res.data)) {
        setProjectRoster(res.data.filter((m: any) => m.is_assigned === 1));
      } else {
        setProjectRoster([]);
      }
    } catch (e) {
      console.error(e);
      setProjectRoster([]);
    } finally {
      setProjectRosterLoading(false);
    }
  };

  // Comments state for Project or Campaign Detail Modals
  const [detailComments, setDetailComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: number; userName: string } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentAttachments, setCommentAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Linked Tasks state for Project or Campaign Detail Modals
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [loadingLinkedTasks, setLoadingLinkedTasks] = useState(false);

  const loadDetailComments = async (entityType: 'project' | 'campaign', entityId: number) => {
    setLoadingComments(true);
    try {
      const res = await fetchAPI(`${entityType}s/${entityId}/comments`);
      if (Array.isArray(res)) {
        setDetailComments(res);
      } else if (res.success && Array.isArray(res.data)) {
        setDetailComments(res.data);
      } else {
        setDetailComments([]);
      }
    } catch (e) {
      console.error(e);
      setDetailComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const addLocalFileAttachment = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      addToast('Dung lượng tệp đính kèm không được vượt quá 10MB', 'error');
      return;
    }
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    setCommentAttachments(prev => [...prev, { file, name: file.name, previewUrl }]);
    addToast('Đã thêm tệp đính kèm!', 'info');
  };

  const handleCommentAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addLocalFileAttachment(file);
    e.target.value = '';
  };

  const removeCommentAttachment = (index: number) => {
    setCommentAttachments(prev => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePostDetailComment = async (entityType: 'project' | 'campaign', entityId: number) => {
    if ((!newCommentText.trim() && commentAttachments.length === 0) || isSubmittingComment) return;
    setIsSubmittingComment(true);
    setUploadingAttachment(true);

    try {
      const uploadedUrls: string[] = [];
      for (const att of commentAttachments) {
        if (att.url) {
          uploadedUrls.push(att.url);
        } else if (att.file) {
          const sizeStr = (att.file.size / (1024 * 1024)).toFixed(1) + ' MB';
          const taskId = startUpload(att.name, sizeStr);
          const fd = new FormData();
          fd.append('file', att.file);

          updateProgress(taskId, 20, 'uploading');
          const res = await api.post('/upload', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                updateProgress(taskId, percent, percent === 100 ? 'processing' : 'uploading');
              }
            }
          });
          const fileUrl = res.data?.data?.url || res.data?.url;
          if (fileUrl) {
            finishUpload(taskId, true);
            uploadedUrls.push(fileUrl);
            if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
          } else {
            finishUpload(taskId, false, res.data?.message || 'Lỗi tải tệp lên');
            throw new Error(res.data?.message || 'Lỗi tải tệp đính kèm');
          }
        }
      }

      const commentText = newCommentText.trim();
      setNewCommentText('');
      setCommentAttachments([]);
      setReplyTo(null);

      const res = await fetchAPI(`${entityType}s/${entityId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          body: commentText,
          attachments: uploadedUrls,
          parent_id: replyTo ? replyTo.id : null
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.success || res.id) {
        loadDetailComments(entityType, entityId);
        addToast('Đã đăng bình luận!', 'success');
      } else {
        addToast(res.message || 'Lỗi khi gửi bình luận', 'error');
      }
    } catch (e: any) {
      console.error(e);
      addToast('Không thể gửi bình luận: ' + (e.message || ''), 'error');
    } finally {
      setIsSubmittingComment(false);
      setUploadingAttachment(false);
    }
  };

  const handleDeleteDetailComment = (entityType: 'project' | 'campaign', entityId: number, commentId: number) => {
    showConfirm({
      title: 'Xóa bình luận',
      message: 'Bạn có chắc chắn muốn xóa bình luận này không?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`${entityType}s/${entityId}/comments/${commentId}`, {
            method: 'DELETE'
          });
          if (res.success) {
            addToast('Đã xóa bình luận thành công!', 'success');
            loadDetailComments(entityType, entityId);
          } else {
            addToast(res.message || 'Lỗi khi xóa bình luận', 'error');
          }
        } catch (e: any) {
          addToast('Lỗi khi xóa bình luận: ' + e.message, 'error');
        }
      }
    });
  };

  const renderEntityComments = (entityType: 'project' | 'campaign', entityId: number) => {
    const rootComments = detailComments.filter((c: any) => !c.parent_id);
    const getReplies = (parentId: number) => {
      return detailComments
        .filter((c: any) => Number(c.parent_id) === Number(parentId))
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    };

    const renderSingleCommentNode = (comment: any, isReply: boolean = false) => {
      const userRole = String(user?.role || '').toLowerCase();
      const isAdmin = ['admin', 'superadmin', 'super_admin', 'director'].includes(userRole);
      const isOwner = Number(comment.user_id) === Number(user?.id);
      const canDelete = isAdmin || isOwner;

      let commentParsedAtts: any[] = [];
      if (comment.attachments) {
        try {
          commentParsedAtts = typeof comment.attachments === 'string' ? JSON.parse(comment.attachments) : comment.attachments;
        } catch (e) {
          console.error(e);
        }
      }
      if (!Array.isArray(commentParsedAtts)) commentParsedAtts = [];

      return (
        <div key={comment.id} id={`entity-comment-${comment.id}`} style={{ display: 'flex', gap: '8px', fontSize: '0.8125rem', paddingLeft: isReply ? '12px' : '0', borderLeft: isReply ? '2px solid var(--color-border-light)' : undefined, marginTop: isReply ? '6px' : '0' }}>
          <Avatar name={comment.user_name || 'User'} src={comment.avatar_url || undefined} size={isReply ? 20 : 24} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: isReply ? 'transparent' : 'var(--color-bg-light)', border: isReply ? 'none' : '1px solid var(--color-border-light)', padding: isReply ? '2px 0' : '8px 12px', borderRadius: isReply ? '0' : '12px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{comment.user_name || 'Thành viên'}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>{comment.created_at ? new Date(comment.created_at).toLocaleString('vi-VN') : ''}</span>
            </div>
            {comment.body ? (
              /<[a-z][\s\S]*>/i.test(comment.body) ? (
                <div
                  className="rich-text-editor-content"
                  dangerouslySetInnerHTML={{ __html: comment.body }}
                  style={{ margin: 0, color: 'var(--color-text-light)', lineHeight: '1.4' }}
                />
              ) : (
                <div style={{ margin: 0, color: 'var(--color-text-light)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                  {renderFormattedText(comment.body)}
                </div>
              )
            ) : null}

            {/* Attachments rendering */}
            {commentParsedAtts.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {commentParsedAtts.map((attUrl: any, aIdx: number) => {
                  const rawHref = typeof attUrl === 'string' ? attUrl : (attUrl.url || '#');
                  const filename = typeof attUrl === 'string' ? rawHref.substring(rawHref.lastIndexOf('/') + 1) : (attUrl.name || 'Tệp đính kèm');

                  const apiBase = import.meta.env.VITE_API_URL || '/backend';
                  let href = rawHref;
                  if (rawHref && rawHref.startsWith('uploads/')) {
                    href = `${apiBase}/${rawHref}`;
                  } else if (rawHref && rawHref.startsWith('storage/uploads/')) {
                    href = `${apiBase}/${rawHref.replace('storage/uploads/', 'uploads/')}`;
                  }

                  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)/i.test(href);

                  if (isImage) {
                    return (
                      <div key={aIdx} style={{ marginTop: '2px', display: 'inline-block' }}>
                        <a href={href} target="_blank" rel="noreferrer">
                          <img
                            src={href}
                            alt={filename}
                            style={{
                              maxWidth: '220px',
                              maxHeight: '140px',
                              borderRadius: '8px',
                              border: '1px solid var(--color-border-light)',
                              objectFit: 'cover',
                              cursor: 'zoom-in',
                              boxShadow: 'var(--shadow-sm)'
                            }}
                          />
                        </a>
                      </div>
                    );
                  }

                  return (
                    <a key={aIdx} href={href} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '3px 8px', borderRadius: '6px', textDecoration: 'none', color: 'var(--color-primary)', fontSize: '0.72rem', fontWeight: 600 }}>
                      <Paperclip size={11} />
                      <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Actions Row */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px', alignItems: 'center' }}>
              {!isReply && (
                <button
                  onClick={() => setReplyTo({ id: comment.id, userName: comment.user_name || 'Thành viên' })}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', fontSize: '0.7rem', padding: 0, cursor: 'pointer', fontWeight: 700 }}
                  className="hover-lift"
                >
                  Phản hồi
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => handleDeleteDetailComment(entityType, entityId, comment.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center' }}
                  className="hover-lift"
                  title={t('Xóa')}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>
          Thảo luận & Trao đổi ({detailComments.length})
        </span>

        <div style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(163, 20, 34, 0.08)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', color: '#a31422', fontWeight: 700, marginBottom: '6px' }}>
              <span>Đang trả lời {replyTo.userName}</span>
              <button onClick={() => setReplyTo(null)} style={{ border: 'none', background: 'transparent', color: '#a31422', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem', padding: '0 4px' }}>×</button>
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <MentionInput
              value={newCommentText}
              onChange={e => setNewCommentText(e.target.value)}
              onImagePaste={addLocalFileAttachment}
              onFilePaste={addLocalFileAttachment}
              placeholder="Viết bình luận... (Dán ảnh trực tiếp Ctrl+V)"
              style={{ minHeight: '65px', fontSize: '0.85rem', paddingRight: '40px' }}
              disabled={isSubmittingComment || uploadingAttachment}
            />
            <label style={{ position: 'absolute', right: '10px', bottom: '10px', cursor: (uploadingAttachment || isSubmittingComment) ? 'not-allowed' : 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Đính kèm tệp">
              <input type="file" onChange={handleCommentAttachmentUpload} style={{ display: 'none' }} disabled={uploadingAttachment || isSubmittingComment} />
              {uploadingAttachment ? <RefreshCw className="spin" size={18} /> : <Paperclip size={18} />}
            </label>
          </div>

          {/* Attachment Chips List */}
          {commentAttachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
              {commentAttachments.map((att: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', color: 'var(--color-text)' }}>
                  {att.previewUrl ? (
                    <img src={att.previewUrl} alt="preview" style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' }} />
                  ) : (
                    <Paperclip size={11} color="var(--color-primary)" />
                  )}
                  <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{att.name}</span>
                  <button onClick={() => removeCommentAttachment(idx)} style={{ border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '4px' }}>
            <button
              onClick={() => handlePostDetailComment(entityType, entityId)}
              disabled={isSubmittingComment || uploadingAttachment || (!newCommentText.trim() && commentAttachments.length === 0)}
              className="btn primary sm"
              style={{ padding: '6px 18px', fontSize: '0.78rem', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', background: '#db2777', borderColor: '#db2777', color: '#fff' }}
            >
              {isSubmittingComment ? <RefreshCw className="spin" size={13} /> : <Send size={13} />}
              <span>Gửi</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
          {loadingComments ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
              <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
            </div>
          ) : detailComments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
              Chưa có thảo luận nào.
            </div>
          ) : (
            rootComments.map((rootComment: any) => {
              const replies = getReplies(rootComment.id);
              return (
                <div key={rootComment.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {renderSingleCommentNode(rootComment, false)}
                  {replies.length > 0 && (
                    <div style={{ marginLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                      {replies.map((reply: any) => renderSingleCommentNode(reply, true))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const loadLinkedTasks = async (entityType: 'project' | 'campaign', entityId: number) => {
    setLoadingLinkedTasks(true);
    try {
      const res = await fetchAPI(`activities?related_type=${entityType}&related_id=${entityId}&limit=100`);
      let directItems = [];
      if (res && res.items) {
        directItems = res.items;
      } else if (res.success && res.data && Array.isArray(res.data.items)) {
        directItems = res.data.items;
      } else if (res.data && Array.isArray(res.data)) {
        directItems = res.data;
      }

      if (entityType === 'campaign') {
        const parentProjId = editingCampaign?.project_id;
        if (parentProjId) {
          const projRes = await fetchAPI(`activities?related_type=project&related_id=${parentProjId}&limit=1000`);
          let projItems = [];
          if (projRes && projRes.items) {
            projItems = projRes.items;
          } else if (projRes.success && projRes.data && Array.isArray(projRes.data.items)) {
            projItems = projRes.data.items;
          } else if (projRes.data && Array.isArray(projRes.data)) {
            projItems = projRes.data;
          }

          const matchedProjItems = projItems.filter((task: any) => {
            if (task.body) {
              try {
                const parsed = JSON.parse(task.body);
                return Number(parsed?.erp_task?.campaign_id) === Number(entityId);
              } catch {
                return false;
              }
            }
            return false;
          });

          const allItems = [...directItems];
          matchedProjItems.forEach((task: any) => {
            if (!allItems.some(t => t.id === task.id)) {
              allItems.push(task);
            }
          });
          setLinkedTasks(allItems);
        } else {
          setLinkedTasks(directItems);
        }
      } else {
        setLinkedTasks(directItems);
      }
    } catch (e) {
      console.error(e);
      setLinkedTasks([]);
    } finally {
      setLoadingLinkedTasks(false);
    }
  };

  useEffect(() => {
    if (editingProject && editingProject.id) {
      loadProjectRoster(editingProject.id);
      loadDetailComments('project', editingProject.id);
      loadLinkedTasks('project', editingProject.id);
      loadProjectStats(editingProject.id);
      setProjectTasksPage(1);
    } else {
      setProjectRoster([]);
      setDetailComments([]);
      setLinkedTasks([]);
      setProjectStats(null);
    }
  }, [editingProject?.id]);

  useEffect(() => {
    if (editingCampaign && editingCampaign.id) {
      loadDetailComments('campaign', editingCampaign.id);
      loadLinkedTasks('campaign', editingCampaign.id);
      loadCampaignStats(editingCampaign.id);
      setCampaignTasksPage(1);

      // Parse subjects list
      try {
        const subs = editingCampaign.subjects_json
          ? (typeof editingCampaign.subjects_json === 'string'
            ? JSON.parse(editingCampaign.subjects_json)
            : editingCampaign.subjects_json)
          : [];
        setSubjects(Array.isArray(subs) ? subs : []);
      } catch (e) {
        console.error('Error parsing subjects_json', e);
        setSubjects([]);
      }

      // Parse milestones list
      try {
        const miles = editingCampaign.thesis_milestones_json
          ? (typeof editingCampaign.thesis_milestones_json === 'string'
            ? JSON.parse(editingCampaign.thesis_milestones_json)
            : editingCampaign.thesis_milestones_json)
          : [];
        setThesisMilestones(Array.isArray(miles) ? miles : []);
      } catch (e) {
        console.error('Error parsing thesis_milestones_json', e);
        setThesisMilestones([]);
      }

      // Parse reminders config
      try {
        const rems = editingCampaign.reminders_json
          ? (typeof editingCampaign.reminders_json === 'string'
            ? JSON.parse(editingCampaign.reminders_json)
            : editingCampaign.reminders_json)
          : null;
        setRemindersConfig({
          school_reminder_enabled: true,
          school_reminder_hours: 12,
          ideas_reminder_enabled: true,
          ideas_reminder_hours: 168,
          assignment_reminder_enabled: true,
          assignment_reminder_hours: 12,
          lecturer_reminder_enabled: true,
          lecturer_reminder_hours: 12,
          thesis_reminder_enabled: true,
          thesis_reminder_hours: 12,
          upcoming_session_reminder_enabled: true,
          upcoming_session_reminder_minutes: 5,
          ...(rems || {})
        });
      } catch (e) {
        console.error('Error parsing reminders_json', e);
        setRemindersConfig({
          school_reminder_enabled: true,
          school_reminder_hours: 12,
          ideas_reminder_enabled: true,
          ideas_reminder_hours: 168,
          assignment_reminder_enabled: true,
          assignment_reminder_hours: 12,
          lecturer_reminder_enabled: true,
          lecturer_reminder_hours: 12,
          thesis_reminder_enabled: true,
          thesis_reminder_hours: 12,
          upcoming_session_reminder_enabled: true,
          upcoming_session_reminder_minutes: 5
        });
      }
    } else {
      setCampaignStats(null);
      setSubjects([]);
      setThesisMilestones([]);
      setRemindersConfig({
        school_reminder_enabled: true,
        school_reminder_hours: 12,
        ideas_reminder_enabled: true,
        ideas_reminder_hours: 168,
        assignment_reminder_enabled: true,
        assignment_reminder_hours: 12,
        lecturer_reminder_enabled: true,
        lecturer_reminder_hours: 12,
        thesis_reminder_enabled: true,
        thesis_reminder_hours: 12,
      });
      if (!editingProject) {
        setDetailComments([]);
        setLinkedTasks([]);
      }
    }
  }, [editingCampaign?.id]);

  useEffect(() => {
    const handleTaskUpdated = () => {
      if (editingProject && editingProject.id) {
        loadLinkedTasks('project', editingProject.id);
      }
      if (editingCampaign && editingCampaign.id) {
        loadLinkedTasks('campaign', editingCampaign.id);
      }
    };
    const handleContactUpdated = () => {
      if (editingProject && editingProject.id) {
        loadProjectRoster(editingProject.id);
      }
      loadProjects();
    };
    window.addEventListener('task-updated', handleTaskUpdated);
    window.addEventListener('contact-updated', handleContactUpdated);
    return () => {
      window.removeEventListener('task-updated', handleTaskUpdated);
      window.removeEventListener('contact-updated', handleContactUpdated);
    };
  }, [editingProject?.id, editingCampaign?.id]);

  useEffect(() => {
    if (detailComments.length > 0 && (isEditModalOpen || isCampaignModalOpen)) {
      const params = new URLSearchParams(window.location.search);
      const highlightCommentId = params.get('highlight_comment_id');
      if (highlightCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`project-comment-${highlightCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash highlight comment bubble
            const bubble = element.querySelector('div') as HTMLElement;
            if (bubble) {
              const originalBg = bubble.style.background;
              bubble.style.backgroundColor = '#fef08a'; // yellow-200
              bubble.style.transition = 'all 0.5s ease';
              setTimeout(() => {
                bubble.style.background = originalBg;
              }, 2500);
            }

            // Clean URL parameters
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('highlight_comment_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        }, 400);
      }
    }
  }, [detailComments, isEditModalOpen, isCampaignModalOpen]);

  const renderDrawer = (
    isOpen: boolean,
    onClose: () => void,
    title: string,
    content: React.ReactNode,
    width: string = '850px',
    headerActions?: React.ReactNode,
    isCampaign?: boolean,
    showBackButton?: boolean
  ) => {
    return createPortal(
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="drawer-backdrop"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                zIndex: 10000,
                backdropFilter: 'blur(4px)',
                cursor: 'pointer'
              }}
            />
            <motion.div
              className="drawer-sheet"
              initial={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
              animate={{ y: 0, x: 0, opacity: 1 }}
              exit={isMobile ? { y: '100%' } : { opacity: 0, x: '250px' }}
              transition={{ type: 'spring', damping: 30, stiffness: 250, mass: 0.8 }}
              style={{
                left: window.innerWidth <= 768 ? 0 : 'var(--sidebar-width, 220px)',
                right: 0,
                maxWidth: '100vw',
                zIndex: 10600,
                background: 'linear-gradient(180deg, var(--color-bg) 0%, var(--color-border-light) 100%)',
                display: 'flex',
                flexDirection: 'column',
                position: 'fixed',
                top: 0,
                bottom: 0,
                boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
                willChange: 'transform'
              }}
            >
              {/* Drawer Header */}
              <div style={{
                padding: isMobile ? '0.75rem 1rem' : '1.25rem 1.5rem',
                borderBottom: '1px solid var(--color-border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--color-surface)',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  {(showBackButton || (isCampaign && isMobile)) && (
                    <button
                      onClick={onClose}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px 4px 0' }}
                    >
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  <h3 style={{ margin: 0, fontSize: (showBackButton || (isCampaign && isMobile)) ? '0.925rem' : '1.125rem', fontWeight: 800, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {headerActions}
                  {(!isCampaign || !isMobile) && !showBackButton && (
                    <button
                      onClick={onClose}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '50%' }}
                      className="hover-lift"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              </div>
              {/* Drawer Content */}
              <div style={{ padding: isMobile ? '0.5rem 0.5rem 100px 0.5rem' : '1.5rem', overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                {content}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    );
  };

  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [projectDocs, setProjectDocs] = useState<ProjectDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [editingDocKey, setEditingDocKey] = useState<string | null>(null);
  const [editDocNameVal, setEditDocNameVal] = useState<string>('');
  const [docFilterCategory, setDocFilterCategory] = useState<string>('all');

  const [campaignRosters, setCampaignRosters] = useState<Record<number, any[]>>({});
  const [campaignRostersLoading, setCampaignRostersLoading] = useState(false);

  const fetchCampaignRosters = async (camp: any) => {
    setCampaignRostersLoading(true);
    const pObjs = projects.filter(p => {
      if (camp?.project_id && Number(p.id) === Number(camp.project_id)) {
        return true;
      }
      const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
      return campIds.includes(camp?.name);
    });
    const rosters: Record<number, any[]> = {};
    for (const p of pObjs) {
      try {
        const res = await fetchAPI(`projects/${p.id}/roster`);
        if (res && Array.isArray(res)) {
          rosters[p.id] = res.filter((m: any) => m.is_assigned === 1);
        }
      } catch (e) {
        console.error(e);
      }
    }
    setCampaignRosters(rosters);
    setCampaignRostersLoading(false);
  };

  const handleConfirmCopySubject = async () => {
    if (!subjectToCopy || !copyTargetCampaignId) {
      addToast('Vui lòng chọn khóa học đích!', 'error');
      return;
    }

    setIsCopyingSubject(true);
    try {
      const resCamp = await fetchAPI(`campaigns/${copyTargetCampaignId}`);
      if (!resCamp.success) {
        addToast(resCamp.message || 'Lỗi tải thông tin khóa học đích', 'error');
        return;
      }

      const targetCamp = resCamp.data;
      const targetSubjects = targetCamp.subjects_json
        ? (typeof targetCamp.subjects_json === 'string'
          ? JSON.parse(targetCamp.subjects_json)
          : targetCamp.subjects_json)
        : [];

      // Clone subject with unique IDs for safety
      const clonedSub = {
        ...subjectToCopy,
        id: 'sub_' + Date.now(),
        host_sessions: subjectToCopy.host_sessions ? subjectToCopy.host_sessions.map((hs: any, idx: number) => ({ ...hs, id: `hs_${Date.now()}_${idx}` })) : [],
        seminars: subjectToCopy.seminars ? subjectToCopy.seminars.map((sem: any, idx: number) => ({ ...sem, id: `sem_${Date.now()}_${idx}` })) : [],
        assignments: subjectToCopy.assignments ? subjectToCopy.assignments.map((asn: any, idx: number) => ({ ...asn, id: `asn_${Date.now()}_${idx}` })) : []
      };

      let updatedSubjects = [...targetSubjects];
      const hasConflict = targetSubjects.some((s: any) => String(s.code).trim().toLowerCase() === String(subjectToCopy.code).trim().toLowerCase());

      if (hasConflict) {
        if (copyConflictMode === 'replace') {
          updatedSubjects = updatedSubjects.filter((s: any) => String(s.code).trim().toLowerCase() !== String(subjectToCopy.code).trim().toLowerCase());
          updatedSubjects.push(clonedSub);
        } else {
          updatedSubjects.push(clonedSub);
        }
      } else {
        updatedSubjects.push(clonedSub);
      }

      const resUpdate = await fetchAPI(`campaigns/${copyTargetCampaignId}`, {
        method: 'POST',
        body: JSON.stringify({
          subjects_json: JSON.stringify(updatedSubjects)
        })
      });

      if (resUpdate.success) {
        addToast(`Sao chép môn học sang khóa "${targetCamp.name}" thành công!`, 'success');
        setIsCopySubjectModalOpen(false);
        setSubjectToCopy(null);
        setCopyTargetCampaignId('');
        
        loadCampaigns();

        if (editingCampaign && String(editingCampaign.id) === String(copyTargetCampaignId)) {
          setSubjects(updatedSubjects);
        }
      } else {
        addToast(resUpdate.message || 'Lỗi cập nhật khóa học đích', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối hệ thống', 'error');
    } finally {
      setIsCopyingSubject(false);
    }
  };

  const handleOpenCampaignView = (camp: any) => {
    setEditingCampaign(camp);
    setCampaignModalMode('view');
    setIsCampaignModalOpen(true);
    fetchCampaignRosters(camp);
  };

  const isAdmin = user && ['admin', 'superadmin', 'super_admin', 'director', 'assistant'].includes(user.role);
  const isSystemAdmin = user && ['admin', 'superadmin', 'super_admin'].includes(user.role);
  const canEditRoster = React.useMemo(() => {
    if (!user) return false;
    if (['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;

    const isManagerOrLeader = user.role === 'manager' || teams.some(t => Number(t.leader_id) === Number(user.id));
    if (isManagerOrLeader) {
      if (isRosterModalOpen && rosterMembers.length > 0) {
        return rosterMembers.some(m => Number(m.id) === Number(user.id) && m.is_assigned === 1);
      }
      return projectRoster.some((m: any) => Number(m.id) === Number(user.id));
    }
    return false;
  }, [user, teams, rosterMembers, projectRoster, isRosterModalOpen]);
  const isManagerOrLeader = React.useMemo(() => {
    if (!user) return false;
    return ['admin', 'superadmin', 'super_admin', 'director', 'manager'].includes(user.role) ||
      teams.some(t => Number(t.leader_id) === Number(user.id));
  }, [user, teams]);

  const canEditCurrentProject = React.useMemo(() => {
    if (!user) return false;
    if (['admin', 'superadmin', 'super_admin', 'director', 'marketing'].includes(user.role)) return true;
    if (!editingProject) return false;

    if (editingProject.created_by && Number(editingProject.created_by) === Number(user.id)) return true;
    if (editingProject.manager_ids) {
      const mIds = editingProject.manager_ids.split(',').map(s => Number(s.trim())).filter(Boolean);
      if (mIds.includes(Number(user.id))) return true;
    }

    const isManagerOrLeader = user.role === 'manager' || teams.some(t => Number(t.leader_id) === Number(user.id));
    if (isManagerOrLeader) {
      return projectRoster.some((m: any) => Number(m.id) === Number(user.id));
    }
    return false;
  }, [user, editingProject, projectRoster, teams]);

  const formatLastUpdated = (updatedAtStr: string | undefined, createdAtStr: string | undefined) => {
    const targetStr = updatedAtStr || createdAtStr;
    if (!targetStr) return '';
    try {
      const t = targetStr.replace(' ', 'T');
      const date = new Date(t);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `Cập nhật: ${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return '';
    }
  };

  const getSubjectStatus = (sub: any, fallbackStart?: string, fallbackEnd?: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates: Date[] = [];
    
    if (sub && Array.isArray(sub.host_sessions)) {
      sub.host_sessions.forEach((s: any) => {
        if (s.date) {
          const d = new Date(s.date);
          if (!isNaN(d.getTime())) dates.push(d);
        }
      });
    }
    
    if (sub && Array.isArray(sub.seminars)) {
      sub.seminars.forEach((s: any) => {
        if (s.date) {
          const d = new Date(s.date);
          if (!isNaN(d.getTime())) dates.push(d);
        }
      });
    }
    
    if (sub && Array.isArray(sub.assignments)) {
      sub.assignments.forEach((a: any) => {
        if (a.due_date) {
          const d = new Date(a.due_date);
          if (!isNaN(d.getTime())) dates.push(d);
        }
      });
    }
    
    if (dates.length === 0) {
      if (fallbackStart || fallbackEnd) {
        const start = fallbackStart ? new Date(fallbackStart) : null;
        const end = fallbackEnd ? new Date(fallbackEnd) : null;
        const minTime = start && !isNaN(start.getTime()) ? start.getTime() : null;
        const maxTime = end && !isNaN(end.getTime()) ? end.getTime() : null;
        const todayTime = today.getTime();
        
        if (minTime !== null && todayTime < minTime) {
          return {
            code: 'chua_mo',
            label: 'Chưa mở',
            color: '#3b82f6',
            bg: 'rgba(59, 130, 246, 0.08)'
          };
        }
        if (maxTime !== null && todayTime > maxTime) {
          return {
            code: 'da_ket_thuc',
            label: 'Đã kết thúc',
            color: '#ef4444',
            bg: 'rgba(239, 68, 68, 0.08)'
          };
        }
        if (minTime !== null || maxTime !== null) {
          return {
            code: 'dang_hoc',
            label: 'Đang học',
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.08)'
          };
        }
      }
      return {
        code: 'chua_mo',
        label: 'Chưa mở',
        color: '#6b7280',
        bg: 'rgba(107, 114, 128, 0.08)'
      };
    }
    
    const sortedTimes = dates.map(d => d.getTime()).sort((a, b) => a - b);
    const minTime = sortedTimes[0];
    const maxTime = sortedTimes[sortedTimes.length - 1];
    const todayTime = today.getTime();
    
    if (todayTime < minTime) {
      return {
        code: 'chua_mo',
        label: 'Chưa mở',
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.08)'
      };
    } else if (todayTime > maxTime) {
      return {
        code: 'da_ket_thuc',
        label: 'Đã kết thúc',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.08)'
      };
    } else {
      return {
        code: 'dang_hoc',
        label: 'Đang học',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.08)'
      };
    }
  };

  const subjectStatsSummary = React.useMemo(() => {
    let active = 0;
    let ended = 0;
    let notStarted = 0;
    const statusMap: Record<string, { code: string; label: string; color: string; bg: string }> = {};

    subjects.forEach(s => {
      const statusObj = getSubjectStatus(s, editingCampaign?.start_date, editingCampaign?.end_date);
      statusMap[s.id] = statusObj;
      if (statusObj.code === 'dang_hoc') active++;
      else if (statusObj.code === 'da_ket_thuc') ended++;
      else notStarted++;
    });

    return {
      active,
      ended,
      notStarted,
      statusMap
    };
  }, [subjects, editingCampaign?.start_date, editingCampaign?.end_date]);

  const lecturerStatsSummary = React.useMemo(() => {
    const statsMap: Record<string, {
      id: string;
      name: string;
      email?: string;
      phone?: string;
      avatar?: string;
      subjectIds: Set<string>;
      subjectsCount: number;
      sessionsCount: number;
      seminarsCount: number;
      totalClassesCount: number;
      type: 'internal' | 'external' | 'unknown';
    }> = {};

    const getOrInitLecturer = (lecturerId: string) => {
      if (!lecturerId) return null;
      const cleanId = String(lecturerId).trim();
      if (!cleanId) return null;

      if (!statsMap[cleanId]) {
        const cons = consultants.find(c => String(c.id) === cleanId);
        if (cons) {
          statsMap[cleanId] = {
            id: cleanId,
            name: cons.name || cons.full_name || cons.username,
            email: cons.email,
            phone: cons.phone,
            avatar: cons.avatar_url || cons.avatar,
            subjectIds: new Set(),
            subjectsCount: 0,
            sessionsCount: 0,
            seminarsCount: 0,
            totalClassesCount: 0,
            type: 'internal'
          };
        } else {
          const comp = companiesList.find(c => String(c.id) === cleanId);
          if (comp) {
            statsMap[cleanId] = {
              id: cleanId,
              name: comp.name,
              email: comp.email,
              phone: comp.phone,
              avatar: comp.logo || comp.avatar_url,
              subjectIds: new Set(),
              subjectsCount: 0,
              sessionsCount: 0,
              seminarsCount: 0,
              totalClassesCount: 0,
              type: 'external'
            };
          } else {
            statsMap[cleanId] = {
              id: cleanId,
              name: `GV ID: ${cleanId}`,
              subjectIds: new Set(),
              subjectsCount: 0,
              sessionsCount: 0,
              seminarsCount: 0,
              totalClassesCount: 0,
              type: 'unknown'
            };
          }
        }
      }
      return statsMap[cleanId];
    };

    let totalSessions = 0;
    let totalSeminars = 0;

    subjects.forEach(sub => {
      const mainLecturerId = sub.lecturer_id ? String(sub.lecturer_id).trim() : '';
      
      if (mainLecturerId) {
        const lect = getOrInitLecturer(mainLecturerId);
        if (lect) {
          lect.subjectIds.add(sub.id);
        }
      }

      if (Array.isArray(sub.host_sessions)) {
        totalSessions += sub.host_sessions.length;
        sub.host_sessions.forEach((hs: any) => {
          const sessionLecturerId = hs.lecturer_name ? String(hs.lecturer_name).trim() : mainLecturerId;
          if (sessionLecturerId) {
            const lect = getOrInitLecturer(sessionLecturerId);
            if (lect) {
              lect.sessionsCount += 1;
              lect.totalClassesCount += 1;
              lect.subjectIds.add(sub.id);
            }
          }
        });
      }

      if (Array.isArray(sub.seminars)) {
        sub.seminars.forEach((sem: any) => {
          const semWeight = Number(sem.sessions_count) === 2 ? 2 : 1;
          totalSeminars += semWeight;
          const semLecturerId = sem.lecturer_id ? String(sem.lecturer_id).trim() : mainLecturerId;
          if (semLecturerId) {
            const lect = getOrInitLecturer(semLecturerId);
            if (lect) {
              lect.seminarsCount += semWeight;
              lect.totalClassesCount += semWeight;
              lect.subjectIds.add(sub.id);
            }
          }
        });
      }
    });

    Object.values(statsMap).forEach(lect => {
      lect.subjectsCount = lect.subjectIds.size;
    });

    const lecturerStats = Object.values(statsMap);
    const assignedSubjects = subjects.filter(s => s.lecturer_id).length;
    const assignmentRate = subjects.length > 0 ? Math.round((assignedSubjects / subjects.length) * 100) : 0;
    const topLecturer = lecturerStats.length > 0 ? [...lecturerStats].sort((a, b) => b.totalClassesCount - a.totalClassesCount)[0] : null;

    return {
      lecturerStats,
      assignedSubjects,
      assignmentRate,
      totalSessions,
      totalSeminars,
      topLecturer
    };
  }, [subjects, consultants, companiesList]);

  const canEditProject = (proj: Project) => {
    if (!user) return false;
    if (isSystemAdmin || ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;
    const isManagerOrLeaderUser = user.role === 'manager' || teams.some(t => Number(t.leader_id) === Number(user.id));
    if (isManagerOrLeaderUser) return true;
    return String(proj.created_by) === String(user.id);
  };

  const canDeleteProject = (proj: Project) => {
    if (!user) return false;
    if (isSystemAdmin || user.role === 'director') return true;
    return String(proj.created_by) === String(user.id);
  };

  const canEditCampaign = (camp: any) => {
    if (!user) return false;
    if (isSystemAdmin || ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;

    // Bypass if user is the project manager or creator of the parent project
    if (camp.project_id) {
      const parentProj = projects.find(p => String(p.id) === String(camp.project_id));
      if (parentProj) {
        const isProjCreator = String(parentProj.created_by) === String(user.id);
        const isProjMgr = parentProj.manager_ids && parentProj.manager_ids.split(',').map(s => s.trim()).includes(String(user.id));
        if (isProjCreator || isProjMgr) return true;
      }
    }

    const isManagerOrLeaderUser = user.role === 'manager' || teams.some(t => Number(t.leader_id) === Number(user.id));
    if (isManagerOrLeaderUser) return true;
    const isCreator = String(camp.created_by) === String(user.id);
    const inManagerIds = camp.manager_ids && camp.manager_ids.split(',').map(String).includes(String(user.id));
    const inUserIds = camp.user_ids && camp.user_ids.split(',').map(String).includes(String(user.id));
    return isCreator || inManagerIds || inUserIds;
  };

  const canDeleteCampaign = (camp: any) => {
    if (!user) return false;
    if (isSystemAdmin || ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role)) return true;

    // Bypass if user is the project manager or creator of the parent project
    if (camp.project_id) {
      const parentProj = projects.find(p => String(p.id) === String(camp.project_id));
      if (parentProj) {
        const isProjCreator = String(parentProj.created_by) === String(user.id);
        const isProjMgr = parentProj.manager_ids && parentProj.manager_ids.split(',').map(s => s.trim()).includes(String(user.id));
        if (isProjCreator || isProjMgr) return true;
      }
    }

    return String(camp.created_by) === String(user.id);
  };

  const resolveAttachmentUrl = (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    let cleanPath = url.replace(/^\/+/, '');
    if (cleanPath.includes('storage/uploads/')) {
      cleanPath = cleanPath.replace('storage/uploads/', 'uploads/');
    }
    if (cleanPath.startsWith('backend/')) {
      cleanPath = cleanPath.substring('backend/'.length);
    }
    if (cleanPath.startsWith('deposits/')) {
      cleanPath = 'uploads/' + cleanPath;
    }
    const apiBase = import.meta.env.VITE_API_URL || '/backend';
    let baseUrl = apiBase;
    if (baseUrl.includes('api.php')) {
      baseUrl = baseUrl.split('api.php')[0];
    }
    baseUrl = baseUrl.replace(/\/+$/, '');
    return `${baseUrl}/${cleanPath}`;
  };

  const showUserCard = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase().replace(/_\([^)]+\)/g, '').replace(/\([^)]+\)/g, '');
    const searchVal = cleanName(name);
    const matchedUser = users.find((u: any) => {
      const uName = cleanName(u.full_name || u.name || u.username || '');
      return uName === searchVal || uName.includes(searchVal) || searchVal.includes(uName);
    });

    setQuickUserCard({
      id: matchedUser?.id || 0,
      name: matchedUser?.full_name || name,
      role: matchedUser?.role || 'sales',
      email: matchedUser?.email,
      phone: matchedUser?.phone || matchedUser?.phone_number || '',
      vacationMode: matchedUser?.vacation_mode,
      avatarUrl: (matchedUser?.avatar_url || matchedUser?.avatar) ? resolveAttachmentUrl(matchedUser.avatar_url || matchedUser.avatar || '') : '',
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`Đã sao chép ${label} vào bộ nhớ tạm!`, 'success');
  };

  const renderFormattedText = (text: string) => {
    if (!text) return '';
    const regex = /(https?:\/\/[^\s]+|@[\p{L}\p{N}_()]+)/gu;
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
          >
            {part}
          </a>
        );
      } else if (part.startsWith('@')) {
        const cleanName = (n: string) => (n || '').trim().replace(/\s+/g, '_').toLowerCase().replace(/_\([^)]+\)/g, '').replace(/\([^)]+\)/g, '');
        const cleanMentionVal = cleanName(part.substring(1));
        const taggedUser = users.find((u: any) => {
          const normalizedUser = cleanName(u.full_name || u.name || u.fullname || u.username);
          return normalizedUser === cleanMentionVal;
        });

        if (!taggedUser) {
          return part;
        }

        const displayName = taggedUser?.full_name || taggedUser?.name || taggedUser?.fullname || taggedUser?.username || part.substring(1).replace(/_/g, ' ');
        const avatarUrl = taggedUser?.avatar_url || taggedUser?.avatar;

        return (
          <span
            key={index}
            onClick={(e) => showUserCard(e, displayName)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: '#dc2626',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '2px 8px',
              borderRadius: '9999px',
              margin: '0 2px',
              fontWeight: 600,
              fontSize: '0.85em',
              verticalAlign: 'middle',
              cursor: 'pointer'
            }}
          >
            <Avatar name={displayName} src={avatarUrl} size={16} />
            @{displayName}
          </span>
        );
      }
      return part;
    });
  };

  const parseIds = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') {
      if (val.startsWith('[')) {
        try {
          return JSON.parse(val).map(String);
        } catch (e) { }
      }
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const renderFolderPathLink = (path: string | undefined, projectId?: number) => {
    if (!path) return <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic', fontSize: '0.85rem' }}>Không có folder liên kết</span>;
    const isUrl = path.startsWith('http://') || path.startsWith('https://');
    if (isUrl) {
      const isDriveUrl = path.toLowerCase().includes('drive');
      return (
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#64748b',
            textDecoration: 'none',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(100, 116, 139, 0.05)',
            border: '1px solid rgba(100, 116, 139, 0.12)',
            padding: '0 12px',
            borderRadius: '10px',
            fontSize: '0.825rem',
            transition: 'all 0.2s ease',
            height: '32px',
            boxSizing: 'border-box',
            fontFamily: 'inherit'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.12)';
          }}
        >
          {isDriveUrl ? (
            <>
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/1280px-Google_Drive_icon_%282020%29.svg.png"
                alt="Google Drive"
                style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }}
              />
              <span>Mở Google Drive</span>
            </>
          ) : (
            <>
              <ExternalLink size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
              <span>Mở liên kết</span>
            </>
          )}
        </a>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (projectId) {
            handleOpenFolderModal(path, projectId);
          } else {
            addToast('Không tìm thấy chương trình liên kết', 'error');
          }
        }}
        style={{
          color: '#64748b',
          border: '1px solid rgba(100, 116, 139, 0.12)',
          background: 'rgba(100, 116, 139, 0.05)',
          cursor: 'pointer',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 12px',
          borderRadius: '10px',
          fontSize: '0.825rem',
          transition: 'all 0.2s ease',
          outline: 'none',
          height: '32px',
          boxSizing: 'border-box',
          fontFamily: 'inherit'
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.08)';
          e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(100, 116, 139, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.12)';
        }}
      >
        <Folder size={14} color="#f59e0b" fill="#f59e0b" style={{ flexShrink: 0 }} />
        <span>{path}</span>
      </button>
    );
  };

  const renderProjectHierarchy = () => {
    const linkedCamps = campaigns.filter(c => 
      String(c.project_id) === String(editingProject?.id) ||
      (editingProject?.campaign_ids && editingProject.campaign_ids.split(',').map((s: string) => s.trim()).includes(c.name))
    );
    const canEdit = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'academic'].includes(user.role);

    return (
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxHeight: '75vh',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--color-primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sơ đồ phân cấp Chương trình &amp; Khóa học</h4>
          </div>
          {canEdit && (
            <button
              type="button"
              className="btn primary sm"
              onClick={() => {
                setEditingCampaign({
                  project_id: editingProject?.id,
                  status: 'active',
                  start_date: new Date().toISOString().split('T')[0]
                });
                setCampaignModalMode('create');
                setIsCampaignModalOpen(true);
              }}
              style={{ borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}
            >
              <Plus size={14} /> Thêm khóa học mới
            </button>
          )}
        </div>

        {linkedCamps.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Chưa có khóa học nào liên kết với chương trình này.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingLeft: '8px' }}>
            {linkedCamps.map((camp) => {
              const subs = camp.subjects_json ? (typeof camp.subjects_json === 'string' ? JSON.parse(camp.subjects_json) : camp.subjects_json) : [];
              return (
                <div key={camp.id} style={{ borderLeft: '2px solid rgba(163, 20, 34, 0.15)', paddingLeft: '16px', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '-6px',
                    top: '6px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    border: '2px solid #ffffff',
                    boxShadow: '0 0 0 1px var(--color-primary)'
                  }} />
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>Khóa học: {camp.name}</span>
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: camp.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)', color: camp.status === 'active' ? '#10b981' : '#64748b', fontWeight: 700 }}>
                        {camp.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn outline sm"
                      onClick={() => handleOpenCampaignView(camp)}
                      style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '6px', height: '28px' }}
                    >
                      Xem chi tiết khóa
                    </button>
                  </div>

                  {subs.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', paddingLeft: '12px', fontStyle: 'italic' }}>
                      Chưa cấu hình môn học
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '12px', marginTop: '6px' }}>
                      {subs.map((s: any) => {
                        const lecturerId = s.lecturer_id;
                        const foundComp = companiesList.find(c => String(c.id) === String(lecturerId));
                        const lecturerName = foundComp ? foundComp.name : (lecturerId ? `GV ID: ${lecturerId}` : 'Chưa phân công');
                        const avatarUrl = foundComp ? (foundComp.logo || foundComp.avatar_url) : '';
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', borderRadius: '8px', padding: '8px 12px', flexWrap: 'wrap' }}>
                            <BookOpen size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: '150px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                {s.code || 'MÔN'}: {s.name}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-light)' }}>
                                Lớp: {s.host_sessions?.length || 0} buổi trường • {s.seminars?.length || 0} chuyên đề
                              </span>
                            </div>
                            <div 
                              onClick={() => {
                                if (foundComp) {
                                  setSelectedLecturerEntity(foundComp);
                                  setIsLecturerDrawerOpen(true);
                                }
                              }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                background: '#ffffff', 
                                padding: '3px 10px', 
                                borderRadius: '20px', 
                                border: '1px solid var(--color-border-light)',
                                cursor: foundComp ? 'pointer' : 'default'
                              }}
                              className={foundComp ? 'hover-lift' : ''}
                            >
                              <Avatar name={lecturerName} src={avatarUrl || undefined} size={14} />
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text)' }}>{lecturerName}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderProjectViewDrawer = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {/* Unified Tab Selectors */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border-light)',
          background: 'transparent',
          padding: '0 8px',
          gap: '1.5rem',
          marginBottom: '0.25rem'
        }}>
          {[
            { id: 'details', label: 'Thông tin chung', icon: <Info size={14} /> },
            { id: 'gantt', label: 'Sơ đồ Gantt', icon: <Calendar size={14} /> },
            { id: 'hierarchy', label: 'Sơ đồ phân cấp', icon: <Layers size={14} /> },
            { id: 'changelog', label: 'Lịch sử hoạt động', icon: <History size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setProjectDrawerTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '0 4px',
                height: '40px',
                border: 'none',
                background: 'transparent',
                fontSize: '0.85rem',
                fontWeight: 750,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: projectDrawerTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: projectDrawerTab === tab.id ? '2.5px solid var(--color-primary)' : '2.5px solid transparent'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {projectDrawerTab === 'details' && (
          <>
            {/* KPI Summary Cards */}
            {projectStats && (
              <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.5rem' }}>
                {/* 1. Tổng Học Viên */}
                <div
                  className="stat-card hover-lift"
                  onClick={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? () => {
                    if (editingProject?.id) {
                      navigate(`/contacts?project_id=${editingProject.id}`);
                    }
                  } : undefined}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.75rem 1rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    cursor: user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div className="decor-svg" style={{ color: '#ef4444' }}>
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                      <path d="M50 45 C 58 45, 65 38, 65 30 C 65 22, 58 15, 50 15 C 42 15, 35 22, 35 30 C 35 38, 42 45, 50 45 Z" stroke="currentColor" strokeWidth="2" />
                      <path d="M20 80 C 20 65, 33 55, 50 55 C 67 55, 80 65, 80 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Học Viên</span>
                    <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {projectStats.won_deals}
                    </div>
                    <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Trong tổng số {projectStats.total_leads} hồ sơ</div>
                  </div>
                </div>

                {/* 2. Cơ Hội Tuyển Sinh */}
                <div
                  className="stat-card hover-lift"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.75rem 1rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div className="decor-svg" style={{ color: '#3b82f6' }}>
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                      <path d="M50 20 L 80 35 L 50 50 L 20 35 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M20 50 L 50 65 L 80 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 65 L 50 80 L 80 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cơ Hội Tuyển Sinh</span>
                    <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {projectStats.total_deals}
                    </div>
                    <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Hồ sơ đang tư vấn & xử lý</div>
                  </div>
                </div>

                {/* 3. Học Phí Thực Thu */}
                <div
                  className="stat-card hover-lift"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.75rem 1rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div className="decor-svg" style={{ color: '#10b981' }}>
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                      <rect x="25" y="20" width="50" height="60" rx="4" stroke="currentColor" strokeWidth="2" />
                      <path d="M35 35 H 45 M 55 35 H 65 M 35 50 H 45 M 55 50 H 65 M 35 65 H 45 M 55 65 H 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Học Phí Thực Thu</span>
                    <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={projectStats.actual_revenue.toLocaleString('vi-VN') + ' VND'}>
                      {projectStats.actual_revenue >= 1000000000
                        ? `${(projectStats.actual_revenue / 1000000000).toFixed(2)} tỷ`
                        : `${(projectStats.actual_revenue / 1000000).toFixed(0)} triệu`}
                    </div>
                    <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Từ hóa đơn đã thanh toán</div>
                  </div>
                </div>

                {/* 4. Tỷ Lệ Nhập Học */}
                <div
                  className="stat-card hover-lift"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.75rem 1rem',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div className="decor-svg" style={{ color: '#f59e0b' }}>
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                      <rect x="25" y="25" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="2" />
                      <path d="M40 50 L 47 57 L 62 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ Lệ Nhập Học</span>
                    <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckSquare size={14} /></div>
                  </div>
                  <div>
                    <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                      {projectStats.win_rate}%
                    </div>
                    <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Tỷ lệ chuyển đổi học viên</div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.25rem', alignItems: 'start' }}>
              {/* Left Column (3/5) */}
              <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Section 1: Thông tin cơ bản */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Building2 size={16} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Tên chương trình</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{editingProject?.name}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Mã chương trình</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block', fontFamily: 'monospace' }}>{editingProject?.code}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Cấp bằng</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.95rem', fontWeight: 700, display: 'block' }}>{editingProject?.developer || 'Chưa cập nhật'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                      <span
                        className={`badge ${editingProject?.status === 'active' ? 'success' : 'secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '6px 12px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                      >
                        {editingProject?.status === 'active' ? 'Đang hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>
                    {editingProject?.location && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Địa điểm học / Cơ sở</span>
                        <span style={{ color: 'var(--color-text)', fontSize: '0.85rem', fontWeight: 700, display: 'block', lineHeight: 1.4 }}>{editingProject.location}</span>
                      </div>
                    )}
                    {editingProject?.reference_url && parseReferenceLinks(editingProject.reference_url).length > 0 && (
                      <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Website &amp; Tài liệu tham khảo</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {parseReferenceLinks(editingProject.reference_url).map((link, idx) => {
                            if (!link.url) return null;
                            const isGoogleSheets = link.url.includes('docs.google.com/spreadsheets') || link.url.includes('google.com/sheets');
                            return (
                              <a
                                key={idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  background: isGoogleSheets ? 'rgba(16, 185, 129, 0.05)' : 'rgba(100, 116, 139, 0.05)',
                                  border: isGoogleSheets ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid rgba(100, 116, 139, 0.12)',
                                  padding: '8px 14px',
                                  borderRadius: '12px',
                                  color: isGoogleSheets ? '#10b981' : '#64748b',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.825rem',
                                  transition: 'all 0.2s ease',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = isGoogleSheets ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.08)';
                                  e.currentTarget.style.borderColor = isGoogleSheets ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = isGoogleSheets ? 'rgba(16, 185, 129, 0.05)' : 'rgba(100, 116, 139, 0.05)';
                                  e.currentTarget.style.borderColor = isGoogleSheets ? '1px solid rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.12)';
                                }}
                              >
                                {isGoogleSheets ? (
                                  <FileSpreadsheet size={14} color="#10b981" />
                                ) : (
                                  <Globe size={14} />
                                )}
                                <span>{link.title}</span>
                                <ExternalLink size={12} style={{ opacity: 0.6 }} />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Mô tả chi tiết */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <AlignLeft size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mô tả chi tiết</span>
                  </div>
                  <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.875rem' }}>
                    {editingProject?.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

                {/* Discussions/Comments */}
                {editingProject && renderEntityComments('project', editingProject.id)}

              </div>

              {/* Right Column (2/5) */}
              <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>



                {/* Section: Chiến dịch liên kết */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Megaphone size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chiến dịch liên kết</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(() => {
                      const linkedCamps = campaigns.filter(c =>
                        String(c.project_id) === String(editingProject?.id) ||
                        (editingProject?.campaign_ids && editingProject.campaign_ids.split(',').map((s: string) => s.trim()).includes(c.name))
                      );

                      if (linkedCamps.length === 0) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                            <Info size={12} style={{ opacity: 0.6 }} />
                            <span>Chưa liên kết chiến dịch</span>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {linkedCamps.map(camp => (
                            <span
                              key={camp.id}
                              onClick={() => handleOpenCampaignView(camp)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.825rem',
                                fontWeight: 700,
                                background: 'rgba(100, 116, 139, 0.05)',
                                padding: '6px 12px',
                                borderRadius: '10px',
                                border: '1px solid rgba(100, 116, 139, 0.12)',
                                color: '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                                e.currentTarget.style.background = 'rgba(100, 116, 139, 0.08)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.12)';
                                e.currentTarget.style.background = 'rgba(100, 116, 139, 0.05)';
                              }}
                            >
                              <Megaphone size={14} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                              {camp.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>


                {/* Section: Đường dẫn Folder liên kết */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Folder size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Đường dẫn Folder liên kết</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseFolderPaths(editingProject?.folder_path).length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                        <Info size={12} style={{ opacity: 0.6 }} />
                        <span>Chưa cấu hình folder liên kết</span>
                      </div>
                    ) : (
                      parseFolderPaths(editingProject?.folder_path).map((f, idx) => (
                        <div key={idx}>
                          {renderFolderPathLink(f.path, editingProject?.id)}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section: Tài liệu liên kết */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileText size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tài liệu liên kết</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {parseIds(editingProject?.document_ids).length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                        <Info size={12} style={{ opacity: 0.6 }} />
                        <span>Chưa liên kết tài liệu</span>
                      </div>
                    ) : (
                      parseIds(editingProject?.document_ids).map(docId => {
                        const fileObj = allFiles.find(f => String(f.id) === String(docId));
                        if (!fileObj) return null;
                        return (
                          <a
                            key={docId}
                            href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${fileObj.file_path}`}
                            download={fileObj.name}
                            title={fileObj.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#64748b',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: 'var(--color-bg-light)',
                              padding: '8px 12px',
                              borderRadius: '10px',
                              border: '1px solid var(--color-border-light)',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
                              e.currentTarget.style.background = '#ffffff';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--color-border-light)';
                              e.currentTarget.style.background = 'var(--color-bg-light)';
                            }}
                          >
                            <FileText size={14} color="#3b82f6" style={{ flexShrink: 0 }} /> {formatFileName(fileObj.name, 40)}
                          </a>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Linked Tasks */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      padding: '8px',
                      background: 'rgba(100, 116, 139, 0.08)',
                      borderRadius: '10px',
                      color: 'var(--color-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckSquare size={16} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                    </span>
                  </div>
                  {loadingLinkedTasks ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                    </div>
                  ) : linkedTasks.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                      <Info size={12} style={{ opacity: 0.6 }} />
                      <span>Chưa có công việc nào liên kết với chương trình này.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(() => {
                        const priorityWeight: Record<string, number> = {
                          high: 3,
                          medium: 2,
                          low: 1
                        };
                        const getPriorityWeight = (p: string) => priorityWeight[p] || 2;

                        const sortedTasks = [...linkedTasks].sort((a, b) => {
                          const weightA = getPriorityWeight(a.priority);
                          const weightB = getPriorityWeight(b.priority);
                          if (weightB !== weightA) {
                            return weightB - weightA;
                          }
                          if (a.due_date && b.due_date) {
                            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                          }
                          if (a.due_date) return -1;
                          if (b.due_date) return 1;
                          return 0;
                        });

                        const totalPages = Math.ceil(sortedTasks.length / 10);
                        const startIndex = (projectTasksPage - 1) * 10;
                        const paginatedTasks = sortedTasks.slice(startIndex, startIndex + 10);

                        return (
                          <>
                            {paginatedTasks.map(task => {
                              const statusColors: any = {
                                planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                                done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                                cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                              };
                              const sc = statusColors[task.status] || statusColors.planned;
                              const performer = users.find(u => Number(u.id) === Number(task.user_id));
                              return (
                                <div
                                  key={task.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'var(--color-bg-light)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                    e.currentTarget.style.background = 'var(--color-bg-light)';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                                  }}
                                  onClick={() => handleOpenTask(task.id)}
                                  title={t('Click để xem chi tiết nhiệm vụ')}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ marginTop: '3px' }}>
                                      <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Avatar
                                          src={performer?.avatar_url || performer?.avatar}
                                          name={performer?.full_name || performer?.name || 'Hệ thống'}
                                          size={18}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    background: sc.bg,
                                    color: sc.text,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                                  </span>
                                </div>
                              );
                            })}

                            {totalPages > 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                                <button
                                  disabled={projectTasksPage === 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectTasksPage(p => Math.max(1, p - 1));
                                  }}
                                  style={{
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: projectTasksPage === 1 ? 'not-allowed' : 'pointer',
                                    opacity: projectTasksPage === 1 ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Trước
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                  Trang {projectTasksPage} / {totalPages}
                                </span>
                                <button
                                  disabled={projectTasksPage === totalPages}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectTasksPage(p => Math.min(totalPages, p + 1));
                                  }}
                                  style={{
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: projectTasksPage === totalPages ? 'not-allowed' : 'pointer',
                                    opacity: projectTasksPage === totalPages ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Sau
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </>
        )}

        {projectDrawerTab === 'hierarchy' && renderProjectHierarchy()}

        {projectDrawerTab === 'gantt' && editingProject?.id && (
          <ProjectGanttTab projectId={editingProject.id} />
        )}

        {projectDrawerTab === 'changelog' && (
          /* Changelog Tab View */
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            padding: '1.5rem',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch sử hoạt động của Chương trình</h4>
            </div>

            {statsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <RefreshCw className="spin" size={24} color="var(--color-text-muted)" />
              </div>
            ) : !projectStats?.logs || projectStats.logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                Chưa có nhật ký hoạt động nào cho chương trình này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingLeft: '8px' }}>
                {projectStats.logs.map((log: any, idx: number) => (
                  <div key={log.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                    {idx !== projectStats.logs.length - 1 && (
                      <div style={{ position: 'absolute', top: '16px', left: '7px', bottom: '-24px', width: '2px', background: 'var(--color-border-light)' }} />
                    )}
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--color-primary)', border: '4px solid #ffffff', boxShadow: '0 0 0 1px var(--color-border-light)', flexShrink: 0, marginTop: '2px' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{log.user_name || 'Hệ thống'}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 600 }}>
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        {log.new_data || log.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLinkedRoundsSection = (targetType: 'project' | 'campaign', targetId: number) => {
    const canEditRound = ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(String(user?.role || '').toLowerCase());

    const matchedRounds = allRounds.filter((r: any) => {
      if (targetType === 'project') {
        if (Number(r.project_id) === Number(targetId)) return true;
        if (r.campaign_id && campaigns.length > 0) {
          const camp = campaigns.find(c => Number(c.id) === Number(r.campaign_id));
          if (camp && Number(camp.project_id) === Number(targetId)) return true;
        }
        return false;
      } else {
        if (Number(r.campaign_id) === Number(targetId)) return true;
        return false;
      }
    });

    return (
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '16px',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              padding: '8px',
              background: 'rgba(189, 29, 45, 0.08)',
              borderRadius: '10px',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={16} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Vòng phân bổ (Fair-Share Round)
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Định tuyến &amp; chia số tự động theo Round-Robin
              </span>
            </div>
          </div>

          {canEditRound && (
            <button
              type="button"
              onClick={() => navigate('/rounds')}
              className="btn outline sm"
              style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
            >
              <Settings size={12} /> Quản lý Vòng
            </button>
          )}
        </div>

        {matchedRounds.length === 0 ? (
          <div style={{
            padding: '0.75rem 1rem',
            background: 'var(--color-bg-light)',
            border: '1px dashed var(--color-border-light)',
            borderRadius: '12px',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Info size={14} style={{ opacity: 0.6 }} />
            <span>Chưa có Vòng phân bổ nào liên kết trực tiếp với {targetType === 'campaign' ? 'chiến dịch' : 'chương trình'} này.</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.875rem' }}>
            {matchedRounds.map((round: any) => {
              const consultantsList = round.consultants ? round.consultants.split(',').filter(Boolean) : [];
              const isActive = Boolean(round.is_active);

              return (
                <div
                  key={round.id}
                  style={{
                    background: 'var(--color-bg-light)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                      {round.round_name}
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '100px',
                      background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                      color: isActive ? '#10b981' : '#64748b'
                    }}>
                      {isActive ? 'Đang chạy' : 'Tạm dừng'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} />
                      <span><strong>{consultantsList.length}</strong> Sales</span>
                    </div>
                    {round.is_fallback ? (
                      <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', fontWeight: 700 }}>
                        Fallback
                      </span>
                    ) : null}
                  </div>

                  {/* Lượt vừa chia & Lượt sắp tới */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '0.72rem',
                    padding: '6px 10px',
                    background: 'var(--color-surface)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border-light)',
                    margin: '2px 0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Lượt vừa chia:</span>
                      <strong style={{ color: 'var(--color-text)', fontWeight: 700 }}>
                        {round.last_assigned_name || 'Chưa phát sinh'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Lượt sắp tới:</span>
                      <strong style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                        {round.next_assigned_name || 'Chưa xác định'}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '8px', borderTop: '1px dotted var(--color-border-light)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoundForModal(round);
                        setIsRoundDetailModalOpen(true);
                      }}
                      className="btn secondary sm"
                      style={{ fontSize: '0.72rem', height: '28px', padding: '0 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                    >
                      <Eye size={12} /> Xem chi tiết
                    </button>

                    {canEditRound ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/rounds?id=${round.id}`)}
                        className="btn primary sm"
                        style={{ fontSize: '0.72rem', height: '28px', padding: '0 10px', borderRadius: '6px', background: 'var(--color-primary)', borderColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
                      >
                        <Edit size={12} /> Chỉnh sửa
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        Chỉ đọc
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderLecturersTab = () => {
    const {
      lecturerStats,
      assignedSubjects,
      assignmentRate,
      totalSessions,
      totalSeminars,
      topLecturer
    } = lecturerStatsSummary;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {/* Banner thống kê giảng viên */}
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {/* Card 1: Tổng Giảng Viên */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Giảng Viên</span>
              <Users size={14} style={{ color: 'var(--color-primary)' }} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{lecturerStats.length}</span>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Đội ngũ giảng viên khóa học</div>
          </div>
          {/* Card 2: Tỷ Lệ Phân Công */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ Lệ Phân Công</span>
              <CheckSquare size={14} style={{ color: '#3b82f6' }} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{assignedSubjects} / {subjects.length} môn</span>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Đã phân công {assignmentRate}% môn học</div>
          </div>
          {/* Card 3: Buổi Trường & Chuyên Đề */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Buổi học &amp; Chuyên đề</span>
              <BookOpen size={14} style={{ color: '#10b981' }} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{totalSessions} / {totalSeminars}</span>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Tổng số buổi trường / chuyên đề</div>
          </div>
          {/* Card 4: GV Tích Cực Nhất */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GV Giảng Dạy Nhiều Nhất</span>
              <Award size={14} style={{ color: '#f59e0b' }} />
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={topLecturer ? topLecturer.name : 'Chưa có'}>
              {topLecturer ? topLecturer.name : 'Chưa có'}
            </span>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>
              {topLecturer ? `Phụ trách ${topLecturer.totalClassesCount} buổi giảng` : 'Chưa có lịch dạy'}
            </div>
          </div>
        </div>

        {/* Bảng Giảng viên */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', overflow: 'hidden' }}>
          {lecturerStats.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <Users size={36} style={{ color: 'var(--color-text-light)', marginBottom: '0.5rem', opacity: 0.5 }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Chưa phân công giảng viên nào cho các môn học/chuyên đề</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border-light)' }}>
                    <th style={{ padding: '10px 16px', fontWeight: 750, color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Giảng viên</th>
                    <th style={{ padding: '10px 16px', fontWeight: 750, color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'center' }}>Số môn phụ trách</th>
                    <th style={{ padding: '10px 16px', fontWeight: 750, color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'center' }}>Số buổi trường</th>
                    <th style={{ padding: '10px 16px', fontWeight: 750, color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'center' }}>Số chuyên đề</th>
                    <th style={{ padding: '10px 16px', fontWeight: 750, color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', textAlign: 'center' }}>Tổng buổi dạy</th>
                  </tr>
                </thead>
                <tbody>
                  {lecturerStats.map((lect, idx) => {
                    const foundComp = companiesList.find(c => String(c.id) === String(lect.id));
                    return (
                      <tr
                        key={lect.id}
                        onClick={() => {
                          if (foundComp) {
                            setSelectedLecturerEntity(foundComp);
                            setIsLecturerDrawerOpen(true);
                          }
                        }}
                        style={{
                          borderBottom: idx < lecturerStats.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                          transition: 'background 0.2s ease',
                          cursor: foundComp ? 'pointer' : 'default'
                        }}
                        onMouseEnter={e => { if (foundComp) e.currentTarget.style.background = 'rgba(100, 116, 139, 0.04)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Tên & Avatar & Loại GV */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar name={lect.name} src={lect.avatar} size={32} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '0.825rem' }}>{lect.name}</span>
                                {lect.type === 'internal' ? (
                                  <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: '100px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.06)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.12)' }}>
                                    Cơ hữu
                                  </span>
                                ) : lect.type === 'external' ? (
                                  <span style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: '100px', fontWeight: 700, background: 'rgba(59, 130, 246, 0.06)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.12)' }}>
                                    Thỉnh giảng
                                  </span>
                                ) : null}
                              </div>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                                {lect.email || 'Không có email'} {lect.phone && `• ${lect.phone}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Số môn phụ trách */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text)' }}>
                          <span style={{ background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontSize: '0.72rem' }}>
                            {lect.subjectsCount} môn
                          </span>
                        </td>

                        {/* Số buổi trường */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text)' }}>
                          <span style={{ background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontSize: '0.72rem' }}>
                            {lect.sessionsCount} buổi
                          </span>
                        </td>

                        {/* Số chuyên đề */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--color-text)' }}>
                          <span style={{ background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontSize: '0.72rem' }}>
                            {lect.seminarsCount} chuyên đề
                          </span>
                        </td>

                        {/* Tổng buổi dạy */}
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 750, color: 'var(--color-primary)' }}>
                          <span style={{ background: 'rgba(225, 29, 72, 0.05)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(225, 29, 72, 0.15)', fontSize: '0.75rem' }}>
                            {lect.totalClassesCount} buổi
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSubjectsTab = () => {
    const canEdit = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'academic'].includes(user.role);

    const handleAddSubject = () => {
      const newSub = {
        id: 'sub_' + Date.now(),
        code: '',
        name: '',
        duration_weeks: 5,
        lecturer_id: '',
        host_sessions: [],
        seminars: [],
        assignments: [],
        zoom_link: '',
        zoom_id: '',
        zoom_pass: ''
      };
      setSubjects([...subjects, newSub]);
    };

    const handleRemoveSubject = (id: string) => {
      setSubjects(subjects.filter(s => s.id !== id));
    };

    const getLecturerName = (lecturerId: any) => {
      const found = consultants.find(c => String(c.id) === String(lecturerId));
      if (found) return found.name;
      const foundComp = companiesList.find(c => String(c.id) === String(lecturerId));
      if (foundComp) return foundComp.name;
      return 'Chưa phân công';
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cấu hình Môn học &amp; Lịch giảng dạy</h4>
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {copiedSubject && (
                <button
                  type="button"
                  className="btn outline sm"
                  style={{ borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: '#ffffff', border: '1px solid var(--color-primary)' }}
                  onClick={() => {
                    const newSub = {
                      ...copiedSubject,
                      id: 'sub_' + Date.now(),
                      host_sessions: (copiedSubject.host_sessions || []).map((s: any, idx: number) => ({ ...s, id: 'session_' + Date.now() + '_' + idx })),
                      seminars: (copiedSubject.seminars || []).map((s: any, idx: number) => ({ ...s, id: 'sem_' + Date.now() + '_' + idx })),
                      assignments: (copiedSubject.assignments || []).map((a: any, idx: number) => ({ ...a, id: 'asm_' + Date.now() + '_' + idx }))
                    };
                    setSubjects([...subjects, newSub]);
                    addToast('Đã dán cấu hình môn học thành công!', 'success');
                  }}
                >
                  <Plus size={14} /> Dán môn học
                </button>
              )}
              <button
                type="button"
                className="btn outline sm"
                style={{ borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: '#ffffff', border: '1px solid var(--color-primary)' }}
                onClick={handleAddSubject}
              >
                <Plus size={14} /> Thêm môn học
              </button>
              <button
                type="button"
                className="btn primary sm"
                disabled={isSaving}
                onClick={async () => {
                  try {
                    setIsSaving(true);
                    const res = await fetchAPI(`campaigns/${editingCampaign.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        ...editingCampaign,
                        subjects_json: JSON.stringify(subjects)
                      })
                    });
                    if (res.success) {
                      addToast('Cập nhật cấu hình môn học thành công!', 'success');
                      setEditingCampaign({
                        ...editingCampaign,
                        subjects_json: JSON.stringify(subjects)
                      });
                      loadCampaigns();
                    } else {
                      addToast(res.message || 'Lỗi lưu thông tin', 'error');
                    }
                  } catch (e: any) {
                    addToast(e.message || 'Lỗi kết nối', 'error');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
              >
                <Save size={14} /> {isSaving ? 'Đang lưu...' : 'Lưu cấu hình môn học'}
              </button>
            </div>
          )}
        </div>

        {subjects.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '16px' }}>
            <BookOpen size={40} style={{ color: 'var(--color-text-light)', marginBottom: '12px' }} />
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Chưa có môn học nào được cấu hình cho khóa này.</div>
            {canEdit && (
              <button type="button" className="btn secondary sm" style={{ marginTop: '14px', borderRadius: '100px' }} onClick={handleAddSubject}>
                + Bắt đầu cấu hình
              </button>
            )}
          </div>
        ) : (
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
            width: '100%'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-light)', borderBottom: '1px solid var(--color-border-light)' }}>
                  <th style={{ padding: 0, width: '30%' }}>
                    <div style={{ padding: '6px 16px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Môn học</div>
                  </th>
                  <th style={{ padding: 0, width: '18%' }}>
                    <div style={{ padding: '6px 16px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Giảng viên chính</div>
                  </th>
                  <th style={{ padding: 0, width: '22%' }}>
                    <div style={{ padding: '6px 16px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thời lượng / Bài tập</div>
                  </th>
                  <th style={{ padding: 0, width: '15%' }}>
                    <div style={{ padding: '6px 16px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trạng thái</div>
                  </th>
                  <th style={{ padding: 0, width: '15%', textAlign: 'right' }}>
                    <div style={{ padding: '6px 16px', fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Hành động</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((sub) => {
                  const sessionCount = sub.host_sessions?.length || 0;
                  const seminarCount = sub.seminars?.length || 0;
                  const assignmentCount = sub.assignments?.length || 0;

                  const lecturerId = sub.lecturer_id;
                  const foundComp = companiesList.find(c => String(c.id) === String(lecturerId));
                  const foundCons = consultants.find(c => String(c.id) === String(lecturerId));
                  const lecturerName = foundComp ? foundComp.name : (foundCons ? foundCons.name : (lecturerId || 'Chưa phân công'));
                  const avatarUrl = foundComp ? (foundComp.logo || foundComp.avatar_url) : (foundCons ? foundCons.avatar_url : '');

                  const statusObj = subjectStatsSummary.statusMap[sub.id] || getSubjectStatus(sub, editingCampaign?.start_date, editingCampaign?.end_date);

                  return (
                    <tr 
                      key={sub.id} 
                      style={{ 
                        borderBottom: '1px solid var(--color-border-light)',
                        transition: 'background 0.2s ease',
                        cursor: 'pointer'
                      }}
                      className="hover-bg-light"
                      onClick={() => setConfiguringSubjectId(sub.id)}
                    >
                      {/* Cột 1: Mã môn học & Tên môn học */}
                      <td style={{ padding: 0, verticalAlign: 'middle' }}>
                        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: '100px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                            {sub.code || 'MÃ MÔN'}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--color-text)' }}>
                            {sub.name || 'Tên môn học chưa đặt'}
                          </span>
                        </div>
                      </td>

                      {/* Cột 2: Giảng viên phụ trách */}
                      <td style={{ padding: 0, verticalAlign: 'middle' }}>
                        <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
                          {!lecturerId ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Users size={12} /> Chưa phân công
                            </span>
                          ) : (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (foundComp) {
                                  setSelectedLecturerEntity(foundComp);
                                  setIsLecturerDrawerOpen(true);
                                }
                              }}
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                cursor: foundComp ? 'pointer' : 'default',
                                padding: '3px 8px',
                                background: foundComp ? 'var(--color-bg-light)' : 'transparent',
                                borderRadius: '12px',
                                border: foundComp ? '1px solid var(--color-border-light)' : 'none',
                                maxWidth: '180px'
                              }}
                              className={foundComp ? 'hover-lift' : ''}
                            >
                              <Avatar name={lecturerName} src={avatarUrl || undefined} size={18} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>{lecturerName}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Cột 3: Thống kê buổi học */}
                      <td style={{ padding: 0, verticalAlign: 'middle' }}>
                        <div style={{ padding: '8px 16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'var(--color-bg-light)', padding: '3px 8px', borderRadius: '6px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            <Calendar size={11} /> {sessionCount} buổi
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'var(--color-bg-light)', padding: '3px 8px', borderRadius: '6px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            <Layers size={11} /> {seminarCount} đề
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', background: 'var(--color-bg-light)', padding: '3px 8px', borderRadius: '6px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                            <CheckSquare size={11} /> {assignmentCount} bài
                          </span>
                        </div>
                      </td>

                      {/* Cột 3.5: Trạng thái môn học */}
                      <td style={{ padding: 0, verticalAlign: 'middle' }}>
                        <div style={{ padding: '8px 16px' }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 750, 
                            color: statusObj.color, 
                            background: statusObj.bg, 
                            padding: '4px 10px', 
                            borderRadius: '100px', 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.03em', 
                            display: 'inline-block',
                            border: `1px solid ${statusObj.color}22`
                          }}>
                            {statusObj.label}
                          </span>
                        </div>
                      </td>

                      {/* Cột 4: Nút hành động */}
                      <td style={{ padding: 0, verticalAlign: 'middle', textAlign: 'right' }}>
                        <div 
                          style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn primary sm"
                            style={{ borderRadius: '8px', height: '30px', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px' }}
                            onClick={() => setConfiguringSubjectId(sub.id)}
                          >
                            <Settings size={12} /> Cài đặt
                          </button>
                          <button
                            type="button"
                            className="btn outline sm"
                            style={{ borderRadius: '8px', height: '30px', width: '30px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', border: '1px solid var(--color-border)' }}
                            onClick={() => {
                              setSubjectToCopy(sub);
                              setCopyTargetCampaignId('');
                              setCopyConflictMode('replace');
                              setIsCopySubjectModalOpen(true);
                            }}
                            title="Sao chép môn học sang khóa khác..."
                          >
                            <Copy size={12} />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSubject(sub.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Xóa môn học"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}


      </div>
    );
  };

  const renderThesisTab = () => {
    const canEdit = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'academic'].includes(user.role);

    const handleAddMilestone = () => {
      const newMs = {
        id: 'ms_' + Date.now(),
        milestone: '',
        due_date: ''
      };
      setThesisMilestones([...thesisMilestones, newMs]);
    };

    const handleUpdateMilestone = (id: string, fields: any) => {
      setThesisMilestones(thesisMilestones.map(m => m.id === id ? { ...m, ...fields } : m));
    };

    const handleRemoveMilestone = (id: string) => {
      setThesisMilestones(thesisMilestones.filter(m => m.id !== id));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cột mốc luận văn (Thesis Milestones)</h4>
          </div>
          {canEdit && (
            <button type="button" className="btn primary sm" style={{ borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }} onClick={handleAddMilestone}>
              <Plus size={14} /> Thêm cột mốc
            </button>
          )}
        </div>

        {thesisMilestones.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--color-surface)', border: '1px dashed var(--color-border)', borderRadius: '16px' }}>
            <FileText size={32} style={{ color: 'var(--color-text-light)', marginBottom: '8px' }} />
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Chưa cấu hình cột mốc luận văn nào cho khóa này.</div>
            {canEdit && (
              <button type="button" className="btn secondary sm" style={{ marginTop: '10px', borderRadius: '100px' }} onClick={handleAddMilestone}>
                + Bắt đầu cấu hình
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', borderRadius: '16px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
            {thesisMilestones.map((ms, idx) => (
              <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: idx < thesisMilestones.length - 1 ? '1px solid var(--color-border-light)' : 'none', paddingBottom: idx < thesisMilestones.length - 1 ? '0.75rem' : '0' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', width: '24px' }}>#{idx + 1}</span>
                <input
                  type="text"
                  placeholder="Tên cột mốc (ví dụ: Nộp đề cương chi tiết...)"
                  className="form-input"
                  disabled={!canEdit}
                  value={ms.milestone || ''}
                  onChange={e => handleUpdateMilestone(ms.id, { milestone: e.target.value })}
                  style={{ flex: 2, height: '36px', fontSize: '0.85rem' }}
                />
                <input
                  type="date"
                  className="form-input"
                  disabled={!canEdit}
                  value={ms.due_date || ''}
                  onChange={e => handleUpdateMilestone(ms.id, { due_date: e.target.value })}
                  style={{ flex: 1, height: '36px', fontSize: '0.85rem' }}
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMilestone(ms.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '6px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && thesisMilestones.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn primary sm"
              disabled={isSaving}
              onClick={async () => {
                try {
                  setIsSaving(true);
                  const res = await fetchAPI(`campaigns/${editingCampaign.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                      ...editingCampaign,
                      thesis_milestones_json: JSON.stringify(thesisMilestones)
                    })
                  });
                  if (res.success) {
                    addToast('Cập nhật cột mốc luận văn thành công!', 'success');
                    setEditingCampaign({
                      ...editingCampaign,
                      thesis_milestones_json: JSON.stringify(thesisMilestones)
                    });
                    loadCampaigns();
                  } else {
                    addToast(res.message || 'Lỗi lưu thông tin', 'error');
                  }
                } catch (e: any) {
                  addToast(e.message || 'Lỗi kết nối', 'error');
                } finally {
                  setIsSaving(false);
                }
              }}
              style={{ borderRadius: '100px', fontWeight: 700 }}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu cột mốc luận văn'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderRemindersTab = () => {
    const canEdit = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'academic'].includes(user.role);

    const handleSaveReminders = async () => {
      if (!editingCampaign?.id) return;
      try {
        setIsSaving(true);
        const res = await fetchAPI(`campaigns/${editingCampaign.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...editingCampaign,
            reminders_json: JSON.stringify(remindersConfig)
          })
        });
        if (res.success) {
          addToast('Cập nhật cài đặt nhắc nhở thành công!', 'success');
          setEditingCampaign({
            ...editingCampaign,
            reminders_json: JSON.stringify(remindersConfig)
          });
          loadCampaigns();
        } else {
          addToast(res.message || 'Lỗi lưu cấu hình', 'error');
        }
      } catch (e: any) {
        addToast(e.message || 'Lỗi kết nối', 'error');
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          <div>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--color-text)' }}>Cài đặt nhắc nhở lịch học & bài tập</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0 }}>Cấu hình thời gian gửi thông báo nhắc nhở lịch học và bài tập tự động cho học viên.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* School Reminder Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              background: 'rgba(100, 116, 139, 0.02)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhắc nhở lịch học với trường</span>
                  <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>Trường học</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gửi thông báo nhắc nhở trước khi buổi học chính thức tại trường diễn ra.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nhắc trước:</span>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="form-input"
                    disabled={!canEdit || !remindersConfig.school_reminder_enabled}
                    value={remindersConfig.school_reminder_hours}
                    onChange={e => setRemindersConfig({ ...remindersConfig, school_reminder_hours: Math.max(1, parseInt(e.target.value) || 0) })}
                    style={{ width: '70px', height: '36px', textAlign: 'center', padding: '0 4px', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>giờ</span>
                </div>
                <label className="switch" style={{ display: 'inline-block', width: '40px', height: '22px', position: 'relative' }}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={remindersConfig.school_reminder_enabled}
                    onChange={e => setRemindersConfig({ ...remindersConfig, school_reminder_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className="slider round" style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: remindersConfig.school_reminder_enabled ? 'var(--color-primary)' : '#ccc',
                    transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: remindersConfig.school_reminder_enabled ? '20px' : '4px', bottom: '3px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {/* IDEAS Reminder Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              background: 'rgba(100, 116, 139, 0.02)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhắc nhở lịch học với IDEAS</span>
                  <span style={{ fontSize: '0.72rem', background: '#fef2f2', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>IDEAS</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gửi thông báo nhắc nhở trước khi các buổi học/thảo luận chuyên đề tại IDEAS bắt đầu.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nhắc trước:</span>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="form-input"
                    disabled={!canEdit || !remindersConfig.ideas_reminder_enabled}
                    value={remindersConfig.ideas_reminder_hours}
                    onChange={e => setRemindersConfig({ ...remindersConfig, ideas_reminder_hours: Math.max(1, parseInt(e.target.value) || 0) })}
                    style={{ width: '70px', height: '36px', textAlign: 'center', padding: '0 4px', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>giờ</span>
                </div>
                <label className="switch" style={{ display: 'inline-block', width: '40px', height: '22px', position: 'relative' }}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={remindersConfig.ideas_reminder_enabled}
                    onChange={e => setRemindersConfig({ ...remindersConfig, ideas_reminder_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className="slider round" style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: remindersConfig.ideas_reminder_enabled ? 'var(--color-primary)' : '#ccc',
                    transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: remindersConfig.ideas_reminder_enabled ? '20px' : '4px', bottom: '3px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {/* Assignments Reminder Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              background: 'rgba(100, 116, 139, 0.02)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhắc nhở nộp bài tập / Quiz</span>
                  <span style={{ fontSize: '0.72rem', background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>Bài tập</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gửi thông báo nhắc nhở trước khi đến hạn chót (Deadline) nộp bài tập, bài luận hoặc quiz.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nhắc trước:</span>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="form-input"
                    disabled={!canEdit || !remindersConfig.assignment_reminder_enabled}
                    value={remindersConfig.assignment_reminder_hours}
                    onChange={e => setRemindersConfig({ ...remindersConfig, assignment_reminder_hours: Math.max(1, parseInt(e.target.value) || 0) })}
                    style={{ width: '70px', height: '36px', textAlign: 'center', padding: '0 4px', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>giờ</span>
                </div>
                <label className="switch" style={{ display: 'inline-block', width: '40px', height: '22px', position: 'relative' }}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={remindersConfig.assignment_reminder_enabled}
                    onChange={e => setRemindersConfig({ ...remindersConfig, assignment_reminder_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className="slider round" style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: remindersConfig.assignment_reminder_enabled ? 'var(--color-primary)' : '#ccc',
                    transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: remindersConfig.assignment_reminder_enabled ? '20px' : '4px', bottom: '3px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {/* Lecturer Reminder Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              background: 'rgba(100, 116, 139, 0.02)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhắc nhở giảng viên lớp chuyên đề</span>
                  <span style={{ fontSize: '0.72rem', background: '#faf5ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>Giảng viên</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gửi thông báo nhắc nhở trước khi đến lịch giảng dạy lớp chuyên đề cho giảng viên.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nhắc trước:</span>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="form-input"
                    disabled={!canEdit || !remindersConfig.lecturer_reminder_enabled}
                    value={remindersConfig.lecturer_reminder_hours}
                    onChange={e => setRemindersConfig({ ...remindersConfig, lecturer_reminder_hours: Math.max(1, parseInt(e.target.value) || 0) })}
                    style={{ width: '70px', height: '36px', textAlign: 'center', padding: '0 4px', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>giờ</span>
                </div>
                <label className="switch" style={{ display: 'inline-block', width: '40px', height: '22px', position: 'relative' }}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={remindersConfig.lecturer_reminder_enabled}
                    onChange={e => setRemindersConfig({ ...remindersConfig, lecturer_reminder_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className="slider round" style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: remindersConfig.lecturer_reminder_enabled ? 'var(--color-primary)' : '#ccc',
                    transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: remindersConfig.lecturer_reminder_enabled ? '20px' : '4px', bottom: '3px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {/* Thesis Reminder Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              background: 'rgba(100, 116, 139, 0.02)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhắc nhở nộp luận văn</span>
                  <span style={{ fontSize: '0.72rem', background: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>Luận văn</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gửi thông báo nhắc nhở trước khi đến hạn chót (Deadline) nộp các cột mốc luận văn.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nhắc trước:</span>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="form-input"
                    disabled={!canEdit || !remindersConfig.thesis_reminder_enabled}
                    value={remindersConfig.thesis_reminder_hours}
                    onChange={e => setRemindersConfig({ ...remindersConfig, thesis_reminder_hours: Math.max(1, parseInt(e.target.value) || 0) })}
                    style={{ width: '70px', height: '36px', textAlign: 'center', padding: '0 4px', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>giờ</span>
                </div>
                <label className="switch" style={{ display: 'inline-block', width: '40px', height: '22px', position: 'relative' }}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={remindersConfig.thesis_reminder_enabled}
                    onChange={e => setRemindersConfig({ ...remindersConfig, thesis_reminder_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className="slider round" style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: remindersConfig.thesis_reminder_enabled ? 'var(--color-primary)' : '#ccc',
                    transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: remindersConfig.thesis_reminder_enabled ? '20px' : '4px', bottom: '3px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>
            </div>

            {/* Upcoming Session Reminder Card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
              background: 'rgba(100, 116, 139, 0.02)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              gap: '1.5rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)' }}>Nhắc nhở lịch học sắp bắt đầu</span>
                  <span style={{ fontSize: '0.72rem', background: '#f5f5f5', color: '#404040', padding: '2px 8px', borderRadius: '100px', fontWeight: 600 }}>Sắp diễn ra</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gửi thông báo nhắc nhở trước khi buổi học bắt đầu vài phút (chỉ nhắc buổi đầu tiên trong ngày nếu có nhiều buổi).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nhắc trước:</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    className="form-input"
                    disabled={!canEdit || !(remindersConfig.upcoming_session_reminder_enabled ?? true)}
                    value={remindersConfig.upcoming_session_reminder_minutes ?? 5}
                    onChange={e => setRemindersConfig({ ...remindersConfig, upcoming_session_reminder_minutes: Math.max(1, parseInt(e.target.value) || 0) })}
                    style={{ width: '70px', height: '36px', textAlign: 'center', padding: '0 4px', fontSize: '0.85rem' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>phút</span>
                </div>
                <label className="switch" style={{ display: 'inline-block', width: '40px', height: '22px', position: 'relative' }}>
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={remindersConfig.upcoming_session_reminder_enabled ?? true}
                    onChange={e => setRemindersConfig({ ...remindersConfig, upcoming_session_reminder_enabled: e.target.checked })}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className="slider round" style={{
                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: (remindersConfig.upcoming_session_reminder_enabled ?? true) ? 'var(--color-primary)' : '#ccc',
                    transition: '0.4s', borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute', content: '""', height: '16px', width: '16px', left: (remindersConfig.upcoming_session_reminder_enabled ?? true) ? '20px' : '4px', bottom: '3px',
                      backgroundColor: 'white', transition: '0.4s', borderRadius: '50%'
                    }} />
                  </span>
                </label>
              </div>
            </div>
          </div>

          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn primary sm"
                disabled={isSaving}
                onClick={handleSaveReminders}
                style={{ borderRadius: '100px', fontWeight: 700 }}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu cấu hình nhắc nhở'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCampaignViewDrawer = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
        {/* Unified Tab Selectors */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border-light)',
          background: 'transparent',
          padding: '0 8px',
          gap: '1.5rem',
          marginBottom: '0.25rem'
        }}>
          {[
            { id: 'details', label: 'Thông tin chung', icon: <Info size={14} /> },
            { id: 'subjects', label: 'Môn học & Lịch học', icon: <BookOpen size={14} /> },
            { id: 'lecturers', label: 'Đội ngũ giảng viên', icon: <Users size={14} /> },
            { id: 'thesis', label: 'Cột mốc luận văn', icon: <FileText size={14} /> },
            { id: 'reminders', label: 'Cài đặt nhắc nhở', icon: <Settings size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCampaignDrawerTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '0 4px',
                height: '40px',
                border: 'none',
                background: 'transparent',
                fontSize: '0.85rem',
                fontWeight: 750,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: campaignDrawerTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: campaignDrawerTab === tab.id ? '2.5px solid var(--color-primary)' : '2.5px solid transparent'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {campaignDrawerTab === 'details' && (
          <>
            {/* KPI Summary Cards */}
            {campaignStats && (() => {
              const activeSubjectsCount = subjectStatsSummary.active;
              const endedSubjectsCount = subjectStatsSummary.ended;
              const notStartedSubjectsCount = subjectStatsSummary.notStarted;
              const { totalSessions, totalSeminars } = lecturerStatsSummary;

              return (
                <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {/* 1. Tổng Học Viên */}
                  <div
                    className="stat-card hover-lift"
                    onClick={user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? () => {
                      if (editingCampaign?.id) {
                        navigate(`/contacts?campaign_id=${editingCampaign.id}`);
                      }
                    } : undefined}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '0.75rem 1rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      cursor: user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role) ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="decor-svg" style={{ color: '#ef4444' }}>
                      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <path d="M50 45 C 58 45, 65 38, 65 30 C 65 22, 58 15, 50 15 C 42 15, 35 22, 35 30 C 35 38, 42 45, 50 45 Z" stroke="currentColor" strokeWidth="2" />
                        <path d="M20 80 C 20 65, 33 55, 50 55 C 67 55, 80 65, 80 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Học Viên</span>
                      <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={14} /></div>
                    </div>
                    <div>
                      <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                        {campaignStats.won_deals}
                      </div>
                      <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>
                        {campaignStats.converted_leads} liên hệ / {campaignStats.total_leads} tiềm năng
                      </div>
                    </div>
                  </div>

                  {/* 2. Tổng Môn Học */}
                  <div
                    className="stat-card hover-lift"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '0.75rem 1rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="decor-svg" style={{ color: '#3b82f6' }}>
                      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <path d="M20 35 L 50 20 L 80 35 L 50 50 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <path d="M20 50 L 50 65 L 80 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20 65 L 50 80 L 80 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tổng Môn Học</span>
                      <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={14} /></div>
                    </div>
                    <div>
                      <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                        {subjects.length}
                      </div>
                      <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>
                        {totalSessions} buổi trường / {totalSeminars} chuyên đề
                      </div>
                    </div>
                  </div>

                  {/* 3. Tiến Độ Môn Học */}
                  <div
                    className="stat-card hover-lift"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '0.75rem 1rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="decor-svg" style={{ color: '#10b981' }}>
                      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <rect x="25" y="20" width="50" height="60" rx="4" stroke="currentColor" strokeWidth="2" />
                        <path d="M35 35 H 45 M 55 35 H 65 M 35 50 H 45 M 55 50 H 65 M 35 65 H 45 M 55 65 H 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiến Độ Môn Học</span>
                      <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Calendar size={14} /></div>
                    </div>
                    <div>
                      <div className="stat-value" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
                        {activeSubjectsCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>/ {subjects.length} đang học</span>
                      </div>
                      <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>
                        {endedSubjectsCount} đã kết thúc, {notStartedSubjectsCount} chưa mở
                      </div>
                    </div>
                  </div>

                  {/* 4. Học Phí Thực Thu */}
                  <div
                    className="stat-card hover-lift"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '0.75rem 1rem',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="decor-svg" style={{ color: '#f59e0b' }}>
                      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <rect x="25" y="25" width="50" height="50" rx="6" stroke="currentColor" strokeWidth="2" />
                        <path d="M40 50 L 47 57 L 62 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Học Phí Thực Thu</span>
                      <div className="stat-icon" style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={14} /></div>
                    </div>
                    <div>
                      <div className="stat-value" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={campaignStats.actual_revenue.toLocaleString('vi-VN') + ' VND'}>
                        {campaignStats.actual_revenue >= 1000000000
                          ? `${(campaignStats.actual_revenue / 1000000000).toFixed(2)} tỷ`
                          : `${(campaignStats.actual_revenue / 1000000).toFixed(0)} triệu`}
                      </div>
                      <div className="stat-desc" style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: '4px', fontWeight: 550 }}>Từ hóa đơn đã thanh toán</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'start' }}>
              {/* Left Column (3/5) */}
              <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Section 1: Thông tin cơ bản */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-text-muted)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Tên chiến dịch</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingCampaign?.name}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                      <span
                        className={`badge ${editingCampaign?.status === 'active' ? 'success' : 'secondary'}`}
                        style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                      >
                        {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày bắt đầu</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.start_date || 'Chưa thiết lập'}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày kết thúc</span>
                      <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.end_date || 'Chưa thiết lập'}</span>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                      <div style={{ marginTop: '4px' }}>
                        {renderFolderPathLink(editingCampaign?.folder_path, editingCampaign?.project_id)}
                      </div>
                    </div>
                    {editingCampaign?.reference_url && (
                      <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Website / Link tham khảo</span>
                        <a
                          href={editingCampaign.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--color-primary)',
                            textDecoration: 'none',
                            fontWeight: 700,
                            fontSize: '0.875rem'
                          }}
                        >
                          {editingCampaign.reference_url.includes('docs.google.com/spreadsheets') || editingCampaign.reference_url.includes('google.com/sheets') ? (
                            <>
                              <FileSpreadsheet size={16} color="#10b981" />
                              <span style={{ color: '#10b981' }}>Bảng tính Google Sheets</span>
                            </>
                          ) : (
                            <>
                              <Link2 size={16} />
                              <span>Mở liên kết tham khảo</span>
                            </>
                          )}
                        </a>
                      </div>
                    )}
                  </div>
                </div>



                {/* Section 3: Mô tả chiến dịch */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>Mô tả chiến dịch</span>
                  <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                    {editingCampaign?.description || 'Không có mô tả chi tiết'}
                  </p>
                </div>

              </div>

              {/* Right Column (2/5) */}
              <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Cột mốc & Tiến độ Khóa học (Right panel) */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiến độ & Cột mốc</h4>
                  </div>

                  {/* Time Progress Bar */}
                  {(() => {
                    const today = new Date();
                    const startStr = editingCampaign?.start_date;
                    const endStr = editingCampaign?.end_date;
                    if (!startStr && !endStr) {
                      return (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                          Chưa thiết lập thời gian bắt đầu & kết thúc.
                        </div>
                      );
                    }

                    const start = startStr ? new Date(startStr) : null;
                    const end = endStr ? new Date(endStr) : null;
                    
                    let percent = 0;
                    if (start && end) {
                      const totalTime = end.getTime() - start.getTime();
                      if (totalTime > 0) {
                        const elapsed = today.getTime() - start.getTime();
                        percent = Math.max(0, Math.min(100, Math.round((elapsed / totalTime) * 100)));
                      }
                    } else if (start && today >= start) {
                      percent = 50;
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                            Tiến độ thời gian: <strong style={{ color: 'var(--color-primary)' }}>{percent}%</strong>
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                            {percent === 100 ? 'Đã hoàn thành' : 'Đang diễn ra'}
                          </span>
                        </div>
                        <div style={{
                          width: '100%',
                          height: '6px',
                          borderRadius: '3px',
                          background: 'var(--color-border-light)',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: percent === 100 ? 'var(--color-success)' : 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-success) 100%)',
                            borderRadius: '3px',
                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: '2px', fontWeight: 600 }}>
                          <span>Bắt đầu: {start ? start.toLocaleDateString('vi-VN') : 'N/A'}</span>
                          <span>Kết thúc: {end ? end.toLocaleDateString('vi-VN') : 'N/A'}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Thesis Milestones List */}
                  <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Các cột mốc học vụ
                    </span>
                    {(() => {
                      const miles = editingCampaign?.thesis_milestones_json
                        ? (typeof editingCampaign.thesis_milestones_json === 'string'
                          ? JSON.parse(editingCampaign.thesis_milestones_json)
                          : editingCampaign.thesis_milestones_json)
                        : [];
                      
                      if (!Array.isArray(miles) || miles.length === 0) {
                        return (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic', padding: '6px 8px' }}>
                            Chưa có cột mốc học vụ/luận văn nào được thiết lập.
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {miles.map((m: any, mIdx: number) => {
                            const today = new Date().toISOString().split('T')[0];
                            const isOverdue = m.due_date && m.due_date < today;
                            return (
                              <div key={m.id || mIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--color-bg-light)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                                <div style={{ 
                                  width: '8px', 
                                  height: '8px', 
                                  borderRadius: '50%', 
                                  background: isOverdue ? 'var(--color-danger)' : 'var(--color-success)', 
                                  marginTop: '5px',
                                  flexShrink: 0 
                                }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>{m.milestone}</span>
                                  <span style={{ fontSize: '0.72rem', color: isOverdue ? 'var(--color-danger)' : 'var(--color-text-light)', fontWeight: 650 }}>
                                    Hạn nộp: {m.due_date ? m.due_date.split('-').reverse().join('/') : 'Chưa đặt'} {isOverdue && '(Quá hạn)'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Section 2: Chương trình & Nhân sự phụ trách */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '3px', height: '14px', background: 'var(--color-text-muted)', borderRadius: '1.5px', flexShrink: 0 }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chương trình liên kết</h4>
                  </div>

                  {(() => {
                    const associatedProjs = editingCampaign?.project_id
                      ? projects.filter(p => p.id === editingCampaign.project_id)
                      : projects.filter(p => {
                        const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                        return campIds.includes(editingCampaign?.name);
                      });

                    if (associatedProjs.length === 0) {
                      return (
                        <div style={{ padding: '1rem', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          Chưa liên kết chương trình nào
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {associatedProjs.map(proj => {
                          return (
                            <div key={proj.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '1rem', background: 'var(--color-bg-light)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span
                                  onClick={() => {
                                    setEditingProject(proj);
                                    setProjectModalMode('view');
                                    setIsCampaignModalOpen(false);
                                    setIsEditModalOpen(true);
                                  }}
                                  style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Building2 size={14} /> {proj.name}
                                </span>
                                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{proj.code}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>


                {/* Linked Tasks */}
                <div style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>
                    Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                  </span>
                  {loadingLinkedTasks ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                    </div>
                  ) : linkedTasks.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                      Chưa có công việc nào liên kết với chiến dịch này.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(() => {
                        const priorityWeight: Record<string, number> = {
                          high: 3,
                          medium: 2,
                          low: 1
                        };
                        const getPriorityWeight = (p: string) => priorityWeight[p] || 2;

                        const sortedTasks = [...linkedTasks].sort((a, b) => {
                          const weightA = getPriorityWeight(a.priority);
                          const weightB = getPriorityWeight(b.priority);
                          if (weightB !== weightA) {
                            return weightB - weightA;
                          }
                          if (a.due_date && b.due_date) {
                            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                          }
                          if (a.due_date) return -1;
                          if (b.due_date) return 1;
                          return 0;
                        });

                        const totalPages = Math.ceil(sortedTasks.length / 10);
                        const startIndex = (campaignTasksPage - 1) * 10;
                        const paginatedTasks = sortedTasks.slice(startIndex, startIndex + 10);

                        return (
                          <>
                            {paginatedTasks.map(task => {
                              const statusColors: any = {
                                planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                                done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                                cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                              };
                              const sc = statusColors[task.status] || statusColors.planned;
                              const performer = users.find(u => Number(u.id) === Number(task.user_id));
                              return (
                                <div
                                  key={task.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'var(--color-bg-light)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                    e.currentTarget.style.background = 'var(--color-bg-light)';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                                  }}
                                  onClick={() => handleOpenTask(task.id)}
                                  title={t('Click để xem chi tiết nhiệm vụ')}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ marginTop: '3px' }}>
                                      <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Avatar
                                          src={performer?.avatar_url || performer?.avatar}
                                          name={performer?.full_name || performer?.name || 'Hệ thống'}
                                          size={18}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    background: sc.bg,
                                    color: sc.text,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                                  </span>
                                </div>
                              );
                            })}

                            {totalPages > 1 && (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '1rem' }}>
                                <button
                                  disabled={campaignTasksPage === 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCampaignTasksPage(p => Math.max(1, p - 1));
                                  }}
                                  style={{
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: campaignTasksPage === 1 ? 'not-allowed' : 'pointer',
                                    opacity: campaignTasksPage === 1 ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Trước
                                </button>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                  Trang {campaignTasksPage} / {totalPages}
                                </span>
                                <button
                                  disabled={campaignTasksPage === totalPages}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCampaignTasksPage(p => Math.min(totalPages, p + 1));
                                  }}
                                  style={{
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: campaignTasksPage === totalPages ? 'not-allowed' : 'pointer',
                                    opacity: campaignTasksPage === totalPages ? 0.5 : 1,
                                    color: 'var(--color-text)'
                                  }}
                                >
                                  Sau
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Discussions/Comments at the very bottom */}
            {editingCampaign && (
              <div style={{ marginTop: '1.25rem' }}>
                {renderEntityComments('campaign', editingCampaign.id)}
              </div>
            )}
          </>
        )}

        {campaignDrawerTab === 'subjects' && renderSubjectsTab()}

        {campaignDrawerTab === 'lecturers' && renderLecturersTab()}

        {campaignDrawerTab === 'thesis' && renderThesisTab()}

        {campaignDrawerTab === 'reminders' && renderRemindersTab()}

        {campaignDrawerTab === 'changelog' && (
          /* Changelog Tab View */
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--color-border-light)',
            borderRadius: '16px',
            padding: '1.5rem',
            minHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px', flexShrink: 0 }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch sử hoạt động của Chiến dịch</h4>
            </div>

            {statsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <RefreshCw className="spin" size={24} color="var(--color-text-muted)" />
              </div>
            ) : !campaignStats?.logs || campaignStats.logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                Chưa có nhật ký hoạt động nào cho chiến dịch này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingLeft: '8px' }}>
                {campaignStats.logs.map((log: any, idx: number) => (
                  <div key={log.id} style={{ display: 'flex', gap: '14px', position: 'relative', alignItems: 'flex-start' }}>
                    {idx !== campaignStats.logs.length - 1 && (
                      <div style={{ position: 'absolute', top: '28px', left: '14px', bottom: '-20px', width: '2px', background: 'var(--color-border-light)' }} />
                    )}
                    <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
                      <Avatar 
                        name={log.user_name || 'Hệ thống'} 
                        src={log.avatar_url ? resolveAttachmentUrl(log.avatar_url) : undefined} 
                        size={28} 
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{log.user_name || 'Hệ thống'}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                          {new Date(log.created_at.replace(' ', 'T')).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', lineHeight: 1.4, fontWeight: 550 }}>
                        {log.new_data || log.action}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetchAPI(`projects?page=${projectPage}&limit=${projectPageSize}`);
      console.log('Projects API Response:', res);
      if (res.success) {
        if (res.data && typeof res.data === 'object' && 'data' in res.data) {
          const list = res.data.data || [];
          setProjects(list);
          const totalVal = Number(res.data.total);
          setTotalProjects(isNaN(totalVal) ? list.length : totalVal);
        } else {
          const arr = Array.isArray(res.data) ? res.data : [];
          setProjects(arr);
          setTotalProjects(arr.length);
        }
      } else {
        addToast(res.message || 'Lỗi tải danh sách chương trình', 'error');
      }
    } catch (e: any) {
      console.error('loadProjects error:', e);
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDevelopers = async () => {
    try {
      const res = await fetchAPI('suppliers?limit=100');
      if (res.success) {
        setDevelopers(res.data?.items || res.data || []);
      }
    } catch (e) {
      console.error('Failed to load developers', e);
    }
  };

  const loadAllFiles = async () => {
    try {
      const res = await fetchAPI('cloud-files?limit=100');
      if (res.success) {
        setAllFiles(res.data?.items || res.data || []);
      }
    } catch (e) {
      console.error('Failed to load all files', e);
    }
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>, projectId?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name.split('.')[0]);
    fd.append('category', 'general');
    fd.append('visibility', 'shared');
    if (projectId) {
      fd.append('project_id', String(projectId));
    }
    try {
      const res = await fetchAPI('cloud-files', {
        method: 'POST',
        body: fd
      });
      if (res.success || res.id) {
        addToast('Đã tải tài liệu lên thành công!', 'success');
        loadAllFiles();
        if (projectId) {
          loadFolderFiles(projectId);
        }
        const newFileId = String(res.data?.id || res.id);
        if (newFileId) {
          if (editingProject) {
            const currentIds = parseIds(editingProject.document_ids);
            if (!currentIds.includes(newFileId)) {
              const updatedIds = [...currentIds, newFileId].join(',');
              setEditingProject({ ...editingProject, document_ids: updatedIds });
            }
          } else if (editingCampaign) {
            const currentIds = parseIds(editingCampaign.document_ids);
            if (!currentIds.includes(newFileId)) {
              const updatedIds = [...currentIds, newFileId].join(',');
              setEditingCampaign({ ...editingCampaign, document_ids: updatedIds });
            }
          }
        }
      } else {
        addToast(res.message || 'Lỗi khi tải tài liệu lên', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi tải tệp tin', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const url = 'campaigns?limit=1000';
      const res = await fetchAPI(url);
      if (res.success) {
        if (res.data && typeof res.data === 'object' && 'data' in res.data) {
          setCampaigns(res.data.data || []);
          setTotalCampaigns(Number(res.data.total || 0));
        } else {
          const arr = Array.isArray(res.data) ? res.data : [];
          setCampaigns(arr);
          setTotalCampaigns(arr.length);
        }
      }
    } catch (e) {
      console.error('Failed to load campaigns', e);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign?.name) {
      addToast('Tên chiến dịch là bắt buộc', 'error');
      return;
    }
    if (isSaving) return;

    try {
      setIsSaving(true);
      const isNew = !editingCampaign.id;
      const action = isNew ? 'campaigns' : `campaigns/${editingCampaign.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetchAPI(action, {
        method,
        body: JSON.stringify(editingCampaign)
      });

      if (res.success) {
        addToast(isNew ? 'Tạo chiến dịch thành công!' : 'Cập nhật chiến dịch thành công!', 'success');
        setIsCampaignModalOpen(false);
        loadCampaigns();
      } else {
        addToast(res.message || 'Lỗi lưu thông tin chiến dịch', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCampaign = (id: number) => {
    showConfirm({
      title: 'Xóa chiến dịch',
      message: 'Bạn có chắc chắn muốn xóa chiến dịch này không? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`campaigns/${id}`, { method: 'DELETE' });
          if (res.success) {
            addToast('Xóa chiến dịch thành công!', 'success');
            loadCampaigns();
          } else {
            addToast(res.message || 'Lỗi khi xóa chiến dịch', 'error');
          }
        } catch (err: any) {
          addToast(err.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const loadUsers = async () => {
    try {
      const res = await fetchAPI('users?all=1');
      if (res.success) {
        setUsers(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  const loadConsultants = async () => {
    try {
      const res = await fetchAPI('consultants?limit=1000');
      if (res && res.success) {
        setConsultants(res.data?.items || res.data || []);
      }
    } catch (e) {
      console.error('Failed to load consultants', e);
    }
  };

  const loadCompanies = async () => {
    try {
      const res = await fetchAPI('companies?limit=2000');
      if (res && res.success) {
        setCompaniesList(res.data?.items || res.data || []);
      }
    } catch (e) {
      console.error('Failed to load companies', e);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [projectPage, projectPageSize]);

  useEffect(() => {
    loadDevelopers();
    loadAllFiles();
    loadUsers();
    loadConsultants();
    loadCompanies();
    loadCampaigns();
  }, []);

  const formatDateVN = (dateStr: string | null | undefined, separator = '/') => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}${separator}${parts[1]}${separator}${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}${separator}${pad(d.getMonth() + 1)}${separator}${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

  const getDayOfWeekAbbr = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return '';
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      return days[d.getDay()];
    } catch (e) {
      return '';
    }
  };

  const getDayOfWeekFullName = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return '';
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      return days[d.getDay()];
    } catch (e) {
      return '';
    }
  };

  const handleGenerateAnnouncement = (sub: any) => {
    const getLecturerName = (lecturerId: any) => {
      const found = consultants.find(c => String(c.id) === String(lecturerId));
      if (found) return found.name;
      const foundComp = companiesList.find(c => String(c.id) === String(lecturerId));
      if (foundComp) return foundComp.name;
      return '';
    };

    let text = `IDEAS xin thông báo lịch học môn ${sub.code || ''} – ${sub.name || ''} của trường Swiss UMEF như sau: \n\n`;

    // 1. UMEF
    text += `1.Lịch học với trường UMEF – Swiss Time.\n\n`;
    const mainLect = getLecturerName(sub.lecturer_id);
    if (mainLect) {
      text += `Prof. ${mainLect}\n\n`;
    }
    if (Array.isArray(sub.host_sessions) && sub.host_sessions.length > 0) {
      sub.host_sessions.forEach((s: any) => {
        const day = getDayOfWeekAbbr(s.date);
        const dayPrefix = day ? `${day}, ` : '';
        const formattedDate = formatDateVN(s.date, '/');
        const lecturerOverride = s.lecturer_name ? (getLecturerName(s.lecturer_name) || s.lecturer_name) : '';
        const lecturerSuffix = lecturerOverride ? ` (Giảng viên: ${lecturerOverride})` : '';
        text += `·         ${s.name || 'Session'}: ${dayPrefix}${formattedDate}, ${s.time_start || '20:00'} – ${s.time_end || '22:00'}${lecturerSuffix}\n\n`;
      });
    } else {
      text += `(Chưa thiết lập lịch học chính thức)\n\n`;
    }

    text += `*Lưu ý: Đối với lịch với trường Swiss UMEF giảng viên phụ trách chính trên Moodle và lớp Zoom Meeting sẽ là 2 giảng viên khác nhau. Tùy một số môn sẽ có trường hợp chỉ 1 giảng viên phụ trách cho cả Moodle và lớp Zoom Meeting.\n\n`;

    // 2. IDEAS
    text += `2.Lịch học với IDEAS – VN Time\n`;
    if (Array.isArray(sub.seminars) && sub.seminars.length > 0) {
      sub.seminars.forEach((sem: any) => {
        const day = getDayOfWeekFullName(sem.date);
        const formattedDate = formatDateVN(sem.date, '.');
        text += `Lớp chuyên đề IDEAS\n`;
        text += `Thời gian: ${day || 'Chủ Nhật'}, Ngày ${formattedDate || ''} | ${sem.time_slot || '8:30 – 11:30 & 13:30 – 16:30'}\n`;
        text += `Nội dung: Hướng dẫn IDEAS: ${sem.topic || sub.name || ''}\n`;
        const semLecturer = sem.lecturer_id ? getLecturerName(sem.lecturer_id) : '';
        if (semLecturer) {
          text += `Giảng viên: ${semLecturer}\n`;
        }
        if (sem.location) {
          text += `Địa điểm: ${sem.location}\n`;
        }
        text += `\n`;
      });
    } else {
      text += `Lớp chuyên đề IDEAS\n(Chưa thiết lập lịch chuyên đề)\n\n`;
    }

    text += `Lớp chuyên đề của IDEAS tập trung vào môn ${sub.name || ''}, nhằm hướng dẫn và bổ sung kiến thức cho học viên ngoài các buổi học chính thức với trường UMEF.\n\n`;

    // 3. Zoom
    if (sub.zoom_shared !== false) {
      text += `3. Thông Tin Zoom Meeting (Dùng chung cho cả UMEF & IDEAS):\n`;
      text += `·         Link: ${sub.zoom_link || 'Chưa thiết lập'}\n`;
      text += `·         Meeting ID: ${sub.zoom_id || 'Chưa thiết lập'}\n`;
      text += `·         Passcode: ${sub.zoom_pass || 'Chưa thiết lập'}\n`;
    } else {
      text += `3. Thông Tin Zoom Meeting:\n`;
      text += `· Lớp học với trường (Swiss UMEF):\n`;
      text += `   - Link: ${sub.school_zoom_link || 'Chưa thiết lập'}\n`;
      text += `   - Meeting ID: ${sub.school_zoom_id || 'Chưa thiết lập'}\n`;
      text += `   - Passcode: ${sub.school_zoom_pass || 'Chưa thiết lập'}\n`;
      text += `· Lớp chuyên đề (IDEAS):\n`;
      text += `   - Link: ${sub.seminar_zoom_link || 'Chưa thiết lập'}\n`;
      text += `   - Meeting ID: ${sub.seminar_zoom_id || 'Chưa thiết lập'}\n`;
      text += `   - Passcode: ${sub.seminar_zoom_pass || 'Chưa thiết lập'}\n`;
    }

    // 4. Assignments
    if (Array.isArray(sub.assignments) && sub.assignments.length > 0) {
      text += `\n4. Hạn nộp bài tập / Quiz:\n`;
      sub.assignments.forEach((asm: any) => {
        const dueParts = (asm.due_date || '').split('T');
        const dueFormatted = formatDateVN(dueParts[0], '/') + (dueParts[1] ? ` lúc ${dueParts[1]}` : '');
        text += `·         ${asm.name}: Hạn nộp ${dueFormatted || 'Chưa thiết lập'}\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      addToast('Đã sao chép mẫu thông báo học vụ vào bộ nhớ tạm!', 'success');
    }).catch((err) => {
      console.error('Failed to copy to clipboard', err);
    });

    setNotifText(text);
    setShowNotifModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject?.name) {
      addToast('Tên chương trình là bắt buộc', 'error');
      return;
    }
    if (!autoCode && !editingProject?.code) {
      addToast('Mã chương trình là bắt buộc khi tắt tự động sinh mã', 'error');
      return;
    }
    if (isSaving) return;

    try {
      setIsSaving(true);
      const isNew = !editingProject.id;
      const action = isNew ? 'projects' : `projects/${editingProject.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetchAPI(action, {
        method,
        body: JSON.stringify(editingProject)
      });

      if (res.success) {
        addToast(isNew ? 'Tạo chương trình thành công!' : 'Cập nhật chương trình thành công!', 'success');
        setIsEditModalOpen(false);
        loadProjects();
      } else {
        addToast(res.message || 'Lỗi lưu thông tin', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = (id: number) => {
    showConfirm({
      title: 'Xóa chương trình',
      message: 'Bạn có chắc chắn muốn xóa chương trình này không? Toàn bộ tài liệu, chiến dịch và roster liên quan sẽ bị ảnh hưởng.',
      confirmText: 'Xóa chương trình',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`projects/${id}`, { method: 'DELETE' });
          if (res.success) {
            addToast('Xóa chương trình thành công!', 'success');
            loadProjects();
          } else {
            addToast(res.message || 'Lỗi xóa chương trình', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  // Roster logic
  const fetchTeams = async () => {
    try {
      const res = await fetchAPI('teams');
      if (Array.isArray(res)) {
        setTeams(res);
      } else if (res && res.success && Array.isArray(res.data)) {
        setTeams(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch teams:', e);
    }
  };

  const handleOpenRoster = async (projectId: number) => {
    setSelectedProjectId(projectId);
    setRosterSearch('');
    setIsRosterModalOpen(true);
    fetchTeams();
    try {
      const res = await fetchAPI(`projects/${projectId}/roster`);
      if (res.success) {
        setRosterMembers(res.data || []);
      } else {
        addToast(res.message || 'Lỗi tải roster', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleToggleRoster = (uid: number) => {
    setRosterMembers(prev =>
      prev.map(m => (m.id === uid ? { ...m, is_assigned: m.is_assigned ? 0 : 1 } : m))
    );
  };

  const handleSaveRoster = async () => {
    if (!selectedProjectId) return;

    const assignedIds = rosterMembers.filter(m => m.is_assigned === 1).map(m => m.id);
    try {
      const res = await fetchAPI(`projects/${selectedProjectId}/roster`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: assignedIds })
      });

      if (res.success) {
        addToast('Cập nhật roster chương trình thành công!', 'success');
        setIsRosterModalOpen(false);
        loadProjects();
        if (editingProject && editingProject.id === selectedProjectId) {
          loadProjectRoster(editingProject.id);
        }
      } else {
        addToast(res.message || 'Lỗi lưu roster', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  // Documents logic
  const handleOpenDocs = async (projectId: number) => {
    setSelectedProjectId(projectId);
    setIsDocsModalOpen(true);
    loadDocuments(projectId);
  };

  const loadDocuments = async (projectId: number) => {
    try {
      const res = await fetchAPI(`projects/${projectId}/documents`);
      if (res.success) {
        setProjectDocs(res.data || []);
      } else {
        addToast(res.message || 'Lỗi tải tài liệu', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedProjectId) return;
    const file = e.target.files[0];

    setUploadingDoc(true);
    try {
      const compressedFile = await compressToWebP(file);
      const formData = new FormData();
      formData.append('file', compressedFile);
      const token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token') || '';
      const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=projects/${selectedProjectId}/documents&token=${token}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Auth-Token': token
        },
        body: formData
      });

      const res = await response.json();
      if (res.success) {
        addToast('Tải tài liệu lên thành công!', 'success');
        loadDocuments(selectedProjectId);
        loadProjects();
      } else {
        addToast(res.message || 'Lỗi tải tài liệu lên', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi tải file', 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = (docId: number) => {
    if (!selectedProjectId) return;
    showConfirm({
      title: 'Xóa tài liệu',
      message: 'Bạn có chắc chắn muốn xóa tài liệu này không?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await fetchAPI(`projects/${selectedProjectId}/documents/${docId}`, { method: 'DELETE' });
          if (res.success) {
            addToast('Xóa tài liệu thành công!', 'success');
            loadDocuments(selectedProjectId);
            loadProjects();
          } else {
            addToast(res.message || 'Lỗi xóa tài liệu', 'error');
          }
        } catch (e: any) {
          addToast(e.message || 'Lỗi kết nối', 'error');
        }
      }
    });
  };

  const handleRenameDoc = (doc: any) => {
    setEditingDocKey(`${doc.isLinkedOnly ? 'link' : 'direct'}-${doc.id}`);
    setEditDocNameVal(doc.name);
  };

  const handleSaveRenameDoc = async (doc: any) => {
    if (!editDocNameVal || editDocNameVal.trim() === '' || editDocNameVal === doc.name) {
      setEditingDocKey(null);
      return;
    }

    try {
      let res;
      if (doc.isLinkedOnly) {
        res = await fetchAPI(`cloud-files/${doc.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: editDocNameVal.trim() })
        });
      } else {
        res = await fetchAPI(`projects/${selectedProjectId}/documents/${doc.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: editDocNameVal.trim() })
        });
      }

      if (res.success) {
        addToast('Đổi tên tài liệu thành công!', 'success');
        setEditingDocKey(null);
        if (selectedProjectId) {
          loadDocuments(selectedProjectId);
        }
        loadAllFiles();
        loadProjects();
      } else {
        addToast(res.message || 'Lỗi đổi tên tài liệu', 'error');
      }
    } catch (e: any) {
      addToast(e.message || 'Lỗi kết nối', 'error');
    }
  };

  const handleDownloadDoc = (docId: number) => {
    if (!selectedProjectId) return;
    const token = localStorage.getItem('access_token') || localStorage.getItem('Ideas_token') || '';
    const url = `${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=projects/${selectedProjectId}/documents/${docId}/download&token=${token}`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-container anim-fade-up" style={{ color: 'var(--color-text)', height: 'auto', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {quickUserCard && quickUserCard.visible && createPortal(
        <AnimatePresence>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 19999 }}
            onClick={() => setQuickUserCard(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{
              position: 'fixed',
              top: quickUserCard.y > window.innerHeight / 2 ? Math.max(10, quickUserCard.y - 370) : quickUserCard.y + 15,
              left: Math.min(quickUserCard.x - 130, window.innerWidth - 290),
              zIndex: 20000,
              width: 270,
              background: 'var(--color-surface)',
              borderRadius: '20px',
              boxShadow: '0 20px 48px -10px rgba(163, 20, 34, 0.18), 0 8px 24px -6px rgba(0,0,0,0.06)',
              border: '1px solid rgba(163, 20, 34, 0.12)',
              overflow: 'hidden'
            }}
          >
            <div style={{ height: 75, background: 'linear-gradient(135deg, var(--color-primary) 0%, #8a0f1b 100%)' }} />
            <div style={{ padding: '0 1.25rem 1.25rem', textAlign: 'center', marginTop: -32 }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--color-surface)',
                margin: '0 auto 0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                border: '4px solid var(--color-surface)',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--color-primary)',
                overflow: 'hidden'
              }}>
                {quickUserCard.avatarUrl ? (
                  <img
                    src={quickUserCard.avatarUrl}
                    alt={quickUserCard.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  quickUserCard.name.charAt(0).toUpperCase()
                )}
              </div>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '2px' }}>
                {quickUserCard.name}
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                RL-{String(quickUserCard.id).padStart(4, '0')}
              </span>

              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {[`admin`, `superadmin`, `super_admin`].includes(quickUserCard.role.toLowerCase())
                  ? 'Quản trị viên'
                  : [`manager`, `director`].includes(quickUserCard.role.toLowerCase())
                    ? 'Trưởng nhóm kinh doanh'
                    : 'Nhân viên kinh doanh'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <span style={{
                  fontSize: '0.65rem',
                  padding: '3px 8px',
                  borderRadius: '100px',
                  background: quickUserCard.vacationMode === 1 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  color: quickUserCard.vacationMode === 1 ? '#d97706' : '#059669',
                  border: quickUserCard.vacationMode === 1 ? '1px solid rgba(245, 158, 11, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: quickUserCard.vacationMode === 1 ? '#d97706' : '#059669'
                  }} />
                  {quickUserCard.vacationMode === 1 ? 'Nghỉ phép (Tạm ngưng nhận lead)' : 'Đang hoạt động (Sẵn sàng nhận lead)'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {quickUserCard.email && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quickUserCard.email}>
                      <Mail size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quickUserCard.email}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-icon xs"
                      onClick={() => copyToClipboard(quickUserCard.email || '', 'email')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-muted)', display: 'inline-flex', borderRadius: '4px' }}
                      title="Sao chép email"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                )}
                {quickUserCard.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={quickUserCard.phone}>
                      <Phone size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)' }}>{quickUserCard.phone}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-icon xs"
                      onClick={() => copyToClipboard(quickUserCard.phone || '', 'số điện thoại')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-muted)', display: 'inline-flex', borderRadius: '4px' }}
                      title="Sao chép số điện thoại"
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', width: '100%' }}>
                {quickUserCard.email && (
                  <a
                    href={`mailto:${quickUserCard.email}`}
                    className="btn primary sm"
                    style={{ flex: 1, height: '32px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Mail size={12} />
                    Email
                  </a>
                )}
                {quickUserCard.phone && (
                  <a
                    href={`tel:${quickUserCard.phone}`}
                    className="btn outline sm"
                    style={{ flex: 1, height: '32px', fontSize: '0.75rem', fontWeight: 700, borderRadius: '8px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Phone size={12} />
                    Gọi điện
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            {activeSubTab === 'campaigns' ? t('Quản Lý Khóa Học') : t('Quản Lý Dự Án')}
            <button
              onClick={() => setShowInfoModal(true)}
              style={{
                background: 'var(--color-bg-light)',
                border: '1px solid var(--color-border-light)',
                padding: '3px 10px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                transition: 'all 0.2s',
                height: '24px'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--color-primary)';
                e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                e.currentTarget.style.background = 'rgba(163, 20, 34, 0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-border-light)';
                e.currentTarget.style.background = 'var(--color-bg-light)';
              }}
              title={t("Xem hướng dẫn thiết lập chương trình, khóa học và roster")}
            >
              <Info size={12} style={{ marginTop: 1 }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{t("Giải thích cơ chế")}</span>
            </button>
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.825rem', color: 'var(--color-text-muted)' }}>
            {activeSubTab === 'campaigns' ? t('Cấu hình khóa học, thời gian giảng dạy và quản lý môn học') : t('Đăng ký chương trình, roster đội ngũ phân phối và quản lý tài liệu')}
          </p>
        </div>
        {(isAdmin || user?.role === 'manager' || (activeSubTab === 'campaigns' && projects.some(p => String(p.created_by) === String(user?.id) || (p.manager_ids && p.manager_ids.split(',').map(s => s.trim()).includes(String(user?.id)))))) && (
          <div>
            {activeSubTab === 'projects' ? (
              (isAdmin || user?.role === 'manager') && (
                <button
                  onClick={() => {
                    setEditingProject({ status: 'active', campaign_sharing_mode: 'independent' });
                    setAutoCode(true);
                    setProjectModalMode('create');
                    setIsEditModalOpen(true);
                  }}
                  className="btn primary"
                  style={{ height: '36px', borderRadius: '8px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <Plus size={16} />
                  Thêm chương trình mới
                </button>
              )
            ) : (
              <button
                onClick={() => {
                  setEditingCampaign({ name: '', description: '', status: 'active', start_date: '', end_date: '', project_id: null, project_ids: '', user_ids: '', manager_ids: '', document_ids: '', folder_path: '' });
                  setCampaignModalMode('create');
                  setIsCampaignModalOpen(true);
                }}
                className="btn primary"
                style={{ height: '36px', borderRadius: '8px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <Plus size={16} />
                Thêm khóa học mới
              </button>
            )}
          </div>
        )}
      </div>

      {/* Control row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: isMobile ? 'transparent' : '#ffffff',
        border: isMobile ? 'none' : '1px solid var(--color-border-light)',
        borderRadius: '12px',
        padding: isMobile ? '0' : '0.625rem 1.25rem',
        marginBottom: '1.25rem',
        boxShadow: isMobile ? 'none' : 'var(--shadow-sm)',
        width: '100%'
      }}>
        {/* Left: Tab selector (Underline style) */}
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          {[
            { id: 'projects', label: 'Chương trình', count: totalProjects, icon: <GraduationCap size={15} /> },
            { id: 'campaigns', label: 'Khóa học', count: totalCampaigns, icon: <BookOpen size={15} /> }
          ].map(tab => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                style={{
                  height: '38px',
                  border: 'none',
                  borderBottom: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '0 4px',
                  outline: 'none',
                  boxShadow: 'none',
                  transition: 'all 0.2s ease',
                  marginTop: '2px'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(163, 20, 34, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  fontWeight: 800,
                  transition: 'background 0.2s ease, color 0.2s ease'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Middle/Right: Filter & Stats consolidated */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          {activeSubTab === 'campaigns' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              width: isMobile ? '100%' : 'auto'
            }}>
              {!isMobile && <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Chương trình:</span>}
              <div style={{ width: isMobile ? '100%' : '180px' }}>
                <CustomSelect
                  options={[
                    { value: '', label: 'Tất cả chương trình' },
                    ...projects.map(p => ({ value: String(p.id), label: p.name }))
                  ]}
                  value={campaignProjectFilter}
                  onChange={val => {
                    setCampaignProjectFilter(String(val));
                    setCampaignPage(1);
                  }}
                  placeholder="Chọn chương trình..."
                />
              </div>
            </div>
          )}

          <div style={{
            display: isMobile ? 'none' : 'flex',
            fontSize: '0.8rem',
            color: 'var(--color-text-muted)',
            fontWeight: 700,
            background: 'var(--color-bg-light)',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border-light)',
            height: '38px',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}>
            {activeSubTab === 'projects'
              ? `Hiển thị ${projects.length} / ${totalProjects} chương trình`
              : `Hiển thị ${paginatedCampaigns.length} / ${filteredCampaigns.length} khóa học`
            }
          </div>
        </div>
      </div>

      {/* Tab Panels with Enter Animation */}
      <div key={activeSubTab} className="subtab-enter-active" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Projects List */}
        {activeSubTab === 'projects' && (
          loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: screenWidth <= 640 ? '1fr' : (screenWidth <= 1024 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'), gap: screenWidth <= 640 ? '1rem' : '1.5rem' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyCard
              icon={<Building2 size={48} />}
              title="Chưa có chương trình nào"
              description="Bắt đầu đăng ký các chương trình bất động sản để phân phối và quản lý tài liệu."
              actionText={isAdmin ? "Thêm ngay" : undefined}
              onAction={isAdmin ? () => {
                setEditingProject({ status: 'active', campaign_sharing_mode: 'independent' });
                setAutoCode(true);
                setIsEditModalOpen(true);
              } : undefined}
            />
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: screenWidth <= 640 ? '1fr' : (screenWidth <= 1024 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'), gap: screenWidth <= 640 ? '1rem' : '1.5rem' }}>
                {projects.map(proj => (
                  <div
                    key={proj.id}
                    className="card flex flex-col justify-between transition-all duration-300"
                    style={{
                      cursor: 'pointer',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '24px',
                      padding: screenWidth <= 640 ? '1.15rem' : '1.5rem',
                      boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                      e.currentTarget.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.borderColor = 'var(--color-border-light)';
                      e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(0,0,0,0.06)';
                    }}
                    onClick={() => {
                      setEditingProject(proj);
                      setProjectModalMode('view');
                      setIsEditModalOpen(true);
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <div style={{
                            padding: '12px',
                            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(225, 29, 72, 0.1))',
                            borderRadius: '16px',
                            color: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'inset 0 0 0 1px rgba(225, 29, 72, 0.15)'
                          }}>
                            <GraduationCap size={22} style={{ color: 'var(--color-primary)' }} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.35, letterSpacing: '-0.01em' }}>{proj.name}</h3>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontWeight: 600, display: 'inline-block', marginTop: '2px' }}>
                              Mã: {proj.code}
                            </span>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 10px',
                            borderRadius: '100px',
                            fontWeight: 700,
                            background: proj.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            color: proj.status === 'active' ? '#10b981' : '#ef4444',
                            border: proj.status === 'active' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}
                        >
                          {proj.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>

                      {/* Developer and Location with Icons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {proj.developer && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Briefcase size={13} /></span>
                            <span>Cấp bằng: <strong style={{ color: 'var(--color-text)' }}>{proj.developer}</strong></span>
                          </div>
                        )}
                        {proj.location && (
                          <div style={{ display: 'flex', alignItems: 'start', gap: '6px' }}>
                            <span style={{ color: 'var(--color-text-light)', display: 'inline-flex', marginTop: '2px' }}><MapPin size={13} /></span>
                            <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                              {proj.location}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Roster, Docs, Campaigns Info Badges */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: '8px',
                          fontSize: screenWidth <= 640 ? '0.68rem' : '0.72rem',
                          color: 'var(--color-text-muted)'
                        }}
                      >
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDocs(proj.id);
                          }}
                          style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '4px', background: 'rgba(100, 116, 139, 0.06)', border: '1px solid rgba(100, 116, 139, 0.12)', padding: screenWidth <= 640 ? '4px 8px' : '6px 10px', borderRadius: '100px', fontWeight: 700, color: '#64748b', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0, whiteSpace: 'nowrap' }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.12)';
                            e.currentTarget.style.transform = 'scale(1.03)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(100, 116, 139, 0.06)';
                            e.currentTarget.style.transform = 'none';
                          }}
                        >
                          <FileText size={12} /> {(proj.doc_count || 0) + parseIds(proj.document_ids).length} tài liệu
                        </span>
                        {(() => {
                          const linkedCamps = campaigns.filter(c => c.project_id === proj.id || (proj.campaign_ids && proj.campaign_ids.split(',').map((name: string) => name.trim()).includes(c.name)));
                          return (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenQuickCampaigns(proj, linkedCamps);
                              }}
                              style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: '4px', background: 'rgba(100, 116, 139, 0.06)', border: '1px solid rgba(100, 116, 139, 0.12)', padding: screenWidth <= 640 ? '4px 8px' : '6px 10px', borderRadius: '100px', fontWeight: 700, color: '#64748b', cursor: 'pointer', transition: 'all 0.2s ease', flexShrink: 0, whiteSpace: 'nowrap' }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(100, 116, 139, 0.12)';
                                e.currentTarget.style.transform = 'scale(1.03)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(100, 116, 139, 0.06)';
                                e.currentTarget.style.transform = 'none';
                              }}
                            >
                              <Layers size={12} /> {linkedCamps.length} khóa học
                            </span>
                          );
                        })()}
                      </div>
                      {/* Project Managers Row with Overlapping Avatars and Text */}
                      {(() => {
                        const projManagers = parseIds(proj.manager_ids).map(id => users.find(u => Number(u.id) === Number(id))).filter(Boolean);
                        if (projManagers.length === 0) return null;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', padding: '6px 12px', background: 'rgba(100, 116, 139, 0.05)', border: '1px solid rgba(100, 116, 139, 0.12)', borderRadius: '100px', width: 'fit-content' }}>
                            <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Users size={12} /></span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Quản lý:</span>
                            <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {projManagers.map((m: any, idx) => (
                                <div
                                  key={m.id}
                                  style={{
                                    marginLeft: idx > 0 ? '-6px' : '0',
                                    zIndex: 10 - idx,
                                    position: 'relative'
                                  }}
                                >
                                  <Avatar src={m.avatar_url || m.avatar} name={m.full_name || m.username} size={18} />
                                </div>
                              ))}
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text)' }}>
                              {projManagers.length === 1 ? (
                                projManagers[0].full_name || projManagers[0].username
                              ) : (
                                `${projManagers[0].full_name || projManagers[0].username} và +${projManagers.length - 1} người khác`
                              )}
                            </span>
                          </div>
                        );
                      })()}
                      {/* Last updated timestamp */}
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ display: 'inline-flex', opacity: 0.6 }}><RefreshCw size={10} /></span>
                        <span>{formatLastUpdated(proj.updated_at, proj.created_at)}</span>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--color-border-light)',
                      marginTop: '1.25rem',
                      paddingTop: '0.75rem'
                    }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDocs(proj.id);
                        }}
                        className="btn secondary sm"
                        style={{
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          height: '32px',
                          padding: '0 12px',
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border-light)',
                          color: 'var(--color-text)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--color-border-light)';
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--color-bg)';
                          e.currentTarget.style.borderColor = 'var(--color-border-light)';
                        }}
                      >
                        <FileText size={13} />
                        Tài liệu
                      </button>
                      {isManagerOrLeader && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {canEditProject(proj) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProject(proj);
                                setAutoCode(false);
                                setProjectModalMode('edit');
                                setIsEditModalOpen(true);
                              }}
                              className="btn secondary sm"
                              style={{
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border-light)',
                                color: 'var(--color-text)',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--color-border-light)';
                                e.currentTarget.style.borderColor = 'var(--color-border)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'var(--color-bg)';
                                e.currentTarget.style.borderColor = 'var(--color-border-light)';
                              }}
                              title="Sửa"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                          {canDeleteProject(proj) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(proj.id);
                              }}
                              className="btn secondary sm"
                              style={{
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#fee2e2',
                                border: '1px solid #fca5a5',
                                color: '#ef4444',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#fca5a5';
                                e.currentTarget.style.borderColor = '#ef4444';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#fee2e2';
                                e.currentTarget.style.borderColor = '#fca5a5';
                              }}
                              title="Xóa"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', paddingBottom: '2.5rem' }}>
                <Pagination
                  total={totalProjects}
                  page={projectPage}
                  pageSize={projectPageSize}
                  onChange={setProjectPage}
                  showSizeChanger={true}
                  onPageSizeChange={setProjectPageSize}
                />
              </div>
            </>
          )
        )}

        {/* Campaigns List Tab */}
        {activeSubTab === 'campaigns' && (
          <>


            {campaignsLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: screenWidth <= 640 ? '1fr' : (screenWidth <= 1024 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'), gap: screenWidth <= 640 ? '1rem' : '1.5rem' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <CampaignCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <EmptyCard
                icon={<Layers size={48} />}
                title="Chưa có khóa học nào"
                description="Bắt đầu tạo khóa học mới để quản lý."
              />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: screenWidth <= 640 ? '1fr' : (screenWidth <= 1024 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'), gap: screenWidth <= 640 ? '1rem' : '1.5rem' }}>
                  {paginatedCampaigns.map(camp => {
                    const associatedProj = camp.project_id
                      ? projects.find(p => p.id === camp.project_id)
                      : projects.find(p => {
                        const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                        return campIds.includes(camp.name);
                      });
                    const docCount = parseIds(camp.document_ids).length;
                    const staffCount = parseIds(camp.user_ids).length;

                    const subs = camp.subjects_json
                      ? (typeof camp.subjects_json === 'string'
                        ? JSON.parse(camp.subjects_json)
                        : camp.subjects_json)
                      : [];
                    const totalSubjects = subs.length;
                    const totalSeminars = subs.reduce((acc: number, s: any) => acc + (s.seminars?.length || 0), 0);
                    const totalAssignments = subs.reduce((acc: number, s: any) => acc + (s.assignments?.length || 0), 0);

                    const thesisMs = camp.thesis_milestones_json
                      ? (typeof camp.thesis_milestones_json === 'string'
                        ? JSON.parse(camp.thesis_milestones_json)
                        : camp.thesis_milestones_json)
                      : [];
                    const totalThesis = thesisMs.length;

                    return (
                      <div
                        key={camp.id}
                        onClick={() => handleOpenCampaignView(camp)}
                        className="card flex flex-col justify-between transition-all duration-300"
                        style={{
                          cursor: 'pointer',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: '24px',
                          padding: screenWidth <= 640 ? '1.15rem' : '1.5rem',
                          boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                          e.currentTarget.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.borderColor = 'var(--color-border-light)';
                          e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(0,0,0,0.06)';
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {/* Header Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                              <div style={{
                                padding: '12px',
                                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.1), rgba(225, 29, 72, 0.1))',
                                borderRadius: '16px',
                                color: 'var(--color-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: 'inset 0 0 0 1px rgba(225, 29, 72, 0.15)'
                              }}>
                                <BookOpen size={22} style={{ color: 'var(--color-primary)' }} />
                              </div>
                              <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1.35, letterSpacing: '-0.01em' }} className="line-clamp-1">{camp.name}</h3>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'monospace', fontWeight: 600, display: 'inline-block', marginTop: '2px' }}>
                                  ID: {camp.id}
                                </span>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '4px 10px',
                                borderRadius: '100px',
                                fontWeight: 700,
                                background: camp.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                color: camp.status === 'active' ? '#10b981' : '#ef4444',
                                border: camp.status === 'active' ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(239, 68, 68, 0.15)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              {camp.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                            </span>
                          </div>



                          {/* Rich Campaign Info List (Dates, Project, Managers) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--color-text-muted)', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Building2 size={13} /></span>
                              <span>Chương trình liên kết: <strong style={{ color: 'var(--color-primary)' }}>{associatedProj ? associatedProj.name : 'Chưa liên kết'}</strong></span>
                            </div>

                            {(camp.start_date || camp.end_date) && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ color: 'var(--color-text-light)', display: 'inline-flex' }}><Calendar size={13} /></span>
                                  <span>Thời gian: <strong>{camp.start_date || '...'}</strong> đến <strong>{camp.end_date || '...'}</strong></span>
                                </div>
                                {(() => {
                                  const getTimelineProgress = (start: string, end: string) => {
                                    if (!start || !end) return 0;
                                    const startDate = new Date(start);
                                    const endDate = new Date(end);
                                    const today = new Date();
                                    if (today < startDate) return 0;
                                    if (today > endDate) return 100;
                                    const total = endDate.getTime() - startDate.getTime();
                                    const current = today.getTime() - startDate.getTime();
                                    return total > 0 ? Math.round((current / total) * 100) : 0;
                                  };
                                  const progressVal = getTimelineProgress(camp.start_date, camp.end_date);
                                  if (progressVal > 0 && progressVal < 100) {
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                                        <div style={{ width: '100%', height: '4px', background: 'var(--color-bg-light)', borderRadius: '2px', overflow: 'hidden' }}>
                                          <div style={{ width: `${progressVal}%`, height: '100%', background: '#10b981', borderRadius: '2px' }} />
                                        </div>
                                        <span style={{ fontSize: '0.62rem', color: 'var(--color-text-light)', fontStyle: 'italic', textAlign: 'right' }}>Tiến độ: {progressVal}% thời gian</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            )}



                          {/* Last updated timestamp */}
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ display: 'inline-flex', opacity: 0.6 }}><RefreshCw size={10} /></span>
                            <span>{formatLastUpdated(camp.updated_at, camp.created_at)}</span>
                          </div>
                        </div>
                        </div>

                        {/* Footer Stats Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                              <Folder size={12} style={{ color: 'var(--color-text-light)' }} />
                              {docCount} Tài liệu
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                              <BookOpen size={12} style={{ color: 'var(--color-text-light)' }} />
                              {totalSubjects} Môn học
                            </span>
                            {totalSeminars > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                                <Layers size={12} style={{ color: 'var(--color-text-light)' }} />
                                {totalSeminars} Chuyên đề
                              </span>
                            )}
                            {totalAssignments > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--color-bg-light)', padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--color-border-light)', fontWeight: 600 }}>
                                <CheckSquare size={12} style={{ color: 'var(--color-text-light)' }} />
                                {totalAssignments} Bài tập
                              </span>
                            )}
                            {totalThesis > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.06)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.15)', fontWeight: 600, color: '#10b981' }}>
                                <Award size={12} />
                                {totalThesis} Khóa luận
                              </span>
                            )}
                          </div>
                          {(isManagerOrLeader || canEditCampaign(camp)) && (
                            <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                              {canEditCampaign(camp) && (
                                <button
                                  onClick={() => {
                                    setEditingCampaign(camp);
                                    setCampaignModalMode('edit');
                                    setIsCampaignModalOpen(true);
                                  }}
                                  className="btn outline icon-only sm"
                                  style={{ width: '28px', height: '28px', borderRadius: '8px', padding: 0 }}
                                  title="Sửa"
                                >
                                  <Edit size={12} />
                                </button>
                              )}
                              {canDeleteCampaign(camp) && (
                                <button
                                  onClick={() => handleDeleteCampaign(camp.id)}
                                  className="btn outline icon-only sm"
                                  style={{ width: '28px', height: '28px', borderRadius: '8px', padding: 0, color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                  title="Xóa"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', paddingBottom: '2.5rem' }}>
                  <Pagination
                    total={filteredCampaigns.length}
                    page={campaignPage}
                    pageSize={campaignPageSize}
                    onChange={setCampaignPage}
                    showSizeChanger={true}
                    onPageSizeChange={setCampaignPageSize}
                  />
                </div>
              </>
                )
            }
              </>
            )}
          </div>

        {/* Edit Modal (converted to Drawer) */}
        {renderDrawer(
          isEditModalOpen,
          () => {
            setIsEditModalOpen(false);
            setEditingProject(null);
          },
          projectModalMode === 'view'
            ? `Chi tiết Chương trình: ${editingProject?.name}`
            : editingProject?.id ? 'Chỉnh sửa chương trình' : 'Thêm chương trình mới',
          <>
            {projectModalMode === 'view' ? (
              <>
                {renderProjectViewDrawer()}
                {isLegacyLayoutEnabled && (
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>

                    {/* Left Column (3/5) */}
                    <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                      {/* Section 1: Thông tin cơ bản */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Tên chương trình</span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingProject?.name}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Mã chương trình</span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block', fontFamily: 'monospace' }}>{editingProject?.code}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Cấp bằng</span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingProject?.developer || 'Chưa cập nhật'}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                            <span
                              className={`badge ${editingProject?.status === 'active' ? 'success' : 'secondary'}`}
                              style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                            >
                              {editingProject?.status === 'active' ? 'Đang hoạt động' : 'Tạm dừng'}
                            </span>
                          </div>
                          {editingProject?.location && (
                            <div style={{ gridColumn: 'span 2' }}>
                              <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Địa điểm học / Cơ sở</span>
                              <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingProject.location}</span>
                            </div>
                          )}
                          {editingProject?.reference_url && (
                            <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                              <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Website / Link tham khảo</span>
                              <a
                                href={editingProject.reference_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  color: 'var(--color-primary)',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.875rem'
                                }}
                              >
                                {editingProject.reference_url.includes('docs.google.com/spreadsheets') || editingProject.reference_url.includes('google.com/sheets') ? (
                                  <>
                                    <FileSpreadsheet size={16} color="#10b981" />
                                    <span style={{ color: '#10b981' }}>Bảng tính Google Sheets</span>
                                  </>
                                ) : (
                                  <>
                                    <Link2 size={16} />
                                    <span>Mở liên kết tham khảo</span>
                                  </>
                                )}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 4: Mô tả chi tiết */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>Mô tả chi tiết</span>
                        <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                          {editingProject?.description || 'Không có mô tả chi tiết'}
                        </p>
                      </div>

                      {/* Discussions/Comments */}
                      {editingProject && renderEntityComments('project', editingProject.id)}

                    </div>

                    {/* Right Column (2/5) */}
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                      {/* Section 3: Nhân sự & Tài liệu */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quản lý &amp; Tài liệu</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Manager phụ trách chính</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {parseIds(editingProject?.manager_ids).length === 0 ? (
                                <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công manager phụ trách</span>
                              ) : (
                                parseIds(editingProject?.manager_ids).map(id => {
                                  const u = users.find(usr => String(usr.id) === String(id));
                                  if (!u) return null;
                                  return (
                                    <span key={id} style={{ background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', padding: '4px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                      <Avatar src={u.avatar_url || u.avatar} name={u.full_name || u.fullname || u.username} size={18} />
                                      {u.full_name || u.fullname || u.username}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </div>
                          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Đội ngũ nhân sự phụ trách</span>
                            {projectRosterLoading ? (
                              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Đang tải danh sách nhân sự...</span>
                            ) : projectRoster.length === 0 ? (
                              <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa phân công nhân sự</span>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  {projectRoster.slice(0, 5).map((member: any, idx: number) => (
                                    <div
                                      key={member.id}
                                      style={{
                                        marginLeft: idx === 0 ? 0 : -8,
                                        border: '2px solid var(--color-surface)',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                        zIndex: 10 - idx
                                      }}
                                      title={`${member.full_name || member.name} (${member.role || 'sales'})`}
                                    >
                                      <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.name} size={28} />
                                    </div>
                                  ))}
                                  {projectRoster.length > 5 && (
                                    <div
                                      style={{
                                        marginLeft: -8,
                                        width: 28,
                                        height: 28,
                                        borderRadius: '50%',
                                        background: 'var(--color-border-light)',
                                        color: 'var(--color-text)',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid var(--color-surface)',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                        zIndex: 5
                                      }}
                                    >
                                      +{projectRoster.length - 5}
                                    </div>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', marginLeft: '8px' }}>
                                  ({projectRoster.length} nhân sự)
                                </span>
                              </div>
                            )}
                          </div>
                          <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '6px' }}>Tài liệu liên kết</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {parseIds(editingProject?.document_ids).length === 0 ? (
                                <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Chưa liên kết tài liệu</span>
                              ) : (
                                parseIds(editingProject?.document_ids).map(docId => {
                                  const fileObj = allFiles.find(f => String(f.id) === String(docId));
                                  if (!fileObj) return null;
                                  return (
                                    <a
                                      key={docId}
                                      href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${fileObj.file_path}`}
                                      download={fileObj.name}
                                      title={fileObj.name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}
                                    >
                                      <FileText size={14} style={{ flexShrink: 0 }} /> {formatFileName(fileObj.name, 75)}
                                    </a>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Linked Tasks */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>
                          Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                        </span>
                        {loadingLinkedTasks ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                            <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                          </div>
                        ) : linkedTasks.length === 0 ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                            Chưa có công việc nào liên kết với chương trình này.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {linkedTasks.map(task => {
                              const statusColors: any = {
                                planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                                done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                                cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                              };
                              const sc = statusColors[task.status] || statusColors.planned;
                              const performer = users.find(u => Number(u.id) === Number(task.user_id));
                              return (
                                <div
                                  key={task.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'var(--color-bg-light)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                    e.currentTarget.style.background = 'var(--color-bg-light)';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                                  }}
                                  onClick={() => handleOpenTask(task.id)}
                                  title={t('Click để xem chi tiết nhiệm vụ')}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ marginTop: '3px' }}>
                                      <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Avatar
                                          src={performer?.avatar_url || performer?.avatar}
                                          name={performer?.full_name || performer?.name || 'Hệ thống'}
                                          size={18}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    background: sc.bg,
                                    color: sc.text,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </>
            ) : (
              <form id="project-form" onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'start' }}>
                <input
                  type="file"
                  ref={quickUploadInputRef}
                  style={{ display: 'none' }}
                  onChange={e => handleQuickUpload(e, editingProject?.id)}
                />
                {/* Left Column (3/5) */}
                <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* Card 1: Thông tin cơ bản */}
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div>
                        <label className="form-label">Tên chương trình</label>
                        <input
                          type="text"
                          required
                          value={editingProject?.name || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setEditingProject(prev => {
                              const next = { ...prev, name: val };
                              if (autoCode && !prev?.id) {
                                next.code = generateCodeFromName(val);
                              }
                              return next;
                            });
                          }}
                          className="form-input"
                          placeholder="Nhập tên chương trình..."
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>Mã chương trình</label>
                          {!editingProject?.id && (
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={autoCode}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setAutoCode(checked);
                                  if (checked && editingProject?.name) {
                                    setEditingProject(prev => ({ ...prev, code: generateCodeFromName(prev?.name || '') }));
                                  }
                                }}
                                style={{ accentColor: 'var(--color-primary)' }}
                              />
                              Tự động tạo mã
                            </label>
                          )}
                        </div>
                        <input
                          type="text"
                          required
                          disabled={autoCode && !editingProject?.id}
                          value={editingProject?.code || ''}
                          onChange={e => {
                            setAutoCode(false);
                            setEditingProject(prev => ({ ...prev, code: e.target.value.toUpperCase() }));
                          }}
                          className="form-input"
                          placeholder={autoCode && !editingProject?.id ? 'Hệ thống tự động sinh' : 'Ví dụ: VGP'}
                        />
                      </div>

                      <div>
                        <label className="form-label">Cấp bằng</label>
                        {developers.length === 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', fontWeight: 600 }}>
                              Chưa có đơn vị cấp bằng nào!
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditModalOpen(false);
                                navigate('/suppliers');
                              }}
                              className="btn primary sm"
                              style={{ width: '100%', height: '38px', fontSize: '0.75rem' }}
                            >
                              Thêm đơn vị cấp bằng trước
                            </button>
                          </div>
                        ) : (
                          <CustomSelect
                            searchable={true}
                            options={developers.map(d => ({ value: d.name, label: d.name }))}
                            value={editingProject?.developer || ''}
                            onChange={val => setEditingProject(prev => ({ ...prev, developer: String(val) }))}
                            placeholder="Chọn đơn vị cấp bằng..."
                          />
                        )}
                      </div>

                      <div>
                        <label className="form-label" style={{ fontWeight: 600 }}>Trạng thái hoạt động</label>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 12px',
                          background: 'var(--color-bg-light)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border-light)',
                          height: '42px'
                        }}>
                          <div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>Cho phép hoạt động</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: editingProject?.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                              {editingProject?.status === 'active' ? 'Đang hoạt động' : 'Tạm dừng'}
                            </span>
                            <ToggleSwitch
                              checked={editingProject?.status === 'active'}
                              onChange={checked => setEditingProject(prev => ({ ...prev, status: checked ? 'active' : 'inactive' }))}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ gridColumn: 'span 2' }}>
                        <AddressSelect
                          label="Địa điểm học / Cơ sở"
                          value={editingProject?.location || ''}
                          onChange={val => setEditingProject(prev => ({ ...prev, location: val }))}
                          placeholder="Nhấp để chọn tỉnh/thành phố, xã/phường..."
                        />
                      </div>

                      <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--color-border-light)', paddingTop: '16px', marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>Website &amp; Tài liệu tham khảo liên kết</label>
                          <button
                            type="button"
                            onClick={() => {
                              const currentLinks = parseReferenceLinks(editingProject?.reference_url);
                              const nextLinks = [...currentLinks, { title: 'Tài liệu tham khảo', url: '' }];
                              setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(nextLinks) }));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0
                            }}
                          >
                            <Plus size={12} />
                            <span>Thêm Link mới</span>
                          </button>
                        </div>

                        {(() => {
                          const currentLinks = parseReferenceLinks(editingProject?.reference_url);
                          if (currentLinks.length === 0) {
                            return (
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                                Chưa có đường dẫn tham khảo nào. Bấm "Thêm Link mới" để cấu hình.
                              </div>
                            );
                          }
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {currentLinks.map((link, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    value={link.title}
                                    onChange={e => {
                                      const updated = [...currentLinks];
                                      updated[idx].title = e.target.value;
                                      setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(updated) }));
                                    }}
                                    className="form-input"
                                    placeholder="Tên liên kết (Ví dụ: GG Sheets Phí)"
                                    style={{ flex: 1 }}
                                  />
                                  <input
                                    type="text"
                                    value={link.url}
                                    onChange={e => {
                                      const updated = [...currentLinks];
                                      updated[idx].url = e.target.value;
                                      setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(updated) }));
                                    }}
                                    className="form-input"
                                    placeholder="https://..."
                                    style={{ flex: 2 }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = currentLinks.filter((_, i) => i !== idx);
                                      setEditingProject(prev => ({ ...prev, reference_url: JSON.stringify(updated) }));
                                    }}
                                    className="btn secondary sm"
                                    style={{ color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>



                  {/* Card 3: Mô tả */}
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <label className="form-label">Mô tả chi tiết</label>
                    <textarea
                      value={editingProject?.description || ''}
                      onChange={e => setEditingProject(prev => ({ ...prev, description: e.target.value }))}
                      className="form-textarea"
                      style={{ minHeight: '100px' }}
                      placeholder="Nhập mô tả thông tin chương trình..."
                    />
                  </div>

                </div>

                {/* Right Column (2/5) */}
                <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>



                  {/* Card 2: Tài liệu & Liên kết */}
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thư mục & Tài liệu</h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>Đường dẫn Folder liên kết</label>
                          <button
                            type="button"
                            onClick={() => {
                              const currentFolders = parseFolderPaths(editingProject?.folder_path);
                              const nextFolders = [...currentFolders, { type: 'link' as const, path: '' }];
                              setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(nextFolders) }));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0
                            }}
                          >
                            <Plus size={12} />
                            <span>Thêm Thư mục</span>
                          </button>
                        </div>

                        {(() => {
                          const currentFolders = parseFolderPaths(editingProject?.folder_path);
                          if (currentFolders.length === 0) {
                            return (
                              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 12px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                                Chưa liên kết thư mục nào. Bấm "Thêm Thư mục" để cấu hình.
                              </div>
                            );
                          }
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {currentFolders.map((f, idx) => (
                                <div key={idx} style={{ background: 'var(--color-bg-light)', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border-light)' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...currentFolders];
                                          updated[idx].type = 'link';
                                          setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          background: f.type === 'link' ? 'var(--color-primary)' : 'transparent',
                                          color: f.type === 'link' ? 'white' : 'var(--color-text-muted)',
                                          fontSize: '0.7rem',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Dán Link (Drive)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...currentFolders];
                                          updated[idx].type = 'select';
                                          setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          border: 'none',
                                          background: f.type === 'select' ? 'var(--color-primary)' : 'transparent',
                                          color: f.type === 'select' ? 'white' : 'var(--color-text-muted)',
                                          fontSize: '0.7rem',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Chọn thư mục
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = currentFolders.filter((_, i) => i !== idx);
                                        setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-danger)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px'
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  {f.type === 'link' ? (
                                    <input
                                      type="text"
                                      value={f.path}
                                      onChange={e => {
                                        const updated = [...currentFolders];
                                        updated[idx].path = e.target.value;
                                        setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                      }}
                                      className="form-input"
                                      placeholder="Dán link thư mục Google Drive..."
                                    />
                                  ) : (
                                    <CustomSelect
                                      options={fileCategories.map(cat => ({ value: cat.label, label: cat.label }))}
                                      value={f.path}
                                      onChange={val => {
                                        const updated = [...currentFolders];
                                        updated[idx].path = String(val);
                                        setEditingProject(prev => ({ ...prev, folder_path: JSON.stringify(updated) }));
                                      }}
                                      placeholder="Chọn thư mục từ /files..."
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>Tài liệu đính kèm</label>
                          <button
                            type="button"
                            onClick={() => quickUploadInputRef.current?.click()}
                            disabled={uploadingDoc}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0
                            }}
                          >
                            {uploadingDoc ? (
                              <RefreshCw className="spin" size={12} />
                            ) : (
                              <Plus size={12} />
                            )}
                            <span>Tải tệp mới</span>
                          </button>
                        </div>
                        <CustomSelect
                          multiple
                          searchable={true}
                          options={allFiles.map(f => ({ value: String(f.id), label: f.name }))}
                          value={parseIds(editingProject?.document_ids)}
                          onChange={val => setEditingProject(prev => ({ ...prev, document_ids: Array.isArray(val) ? val.join(',') : String(val) }))}
                          placeholder="Chọn tài liệu..."
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontWeight: 600 }}>Chiến dịch liên kết</label>
                        <CustomSelect
                          multiple
                          searchable={true}
                          options={campaigns.map(c => ({ value: String(c.id), label: c.name, faded: c.status !== 'active' }))}
                          value={
                            editingProject?.campaign_ids_array !== undefined
                              ? editingProject.campaign_ids_array.map(String)
                              : campaigns.filter(c => c.project_id === editingProject?.id).map(c => String(c.id))
                          }
                          onChange={val => {
                            const selectedIds = Array.isArray(val) ? val.map(Number) : [];
                            const selectedNames = campaigns.filter(c => selectedIds.includes(c.id)).map(c => c.name);
                            setEditingProject(prev => ({
                              ...prev,
                              campaign_ids: selectedNames.join(','),
                              campaign_ids_array: selectedIds
                            }));
                          }}
                          placeholder="Chọn chiến dịch..."
                        />
                      </div>


                    </div>
                  </div>

                </div>
              </form>
            )}
          </>,
          '960px',
          projectModalMode === 'view' ? (
            canEditCurrentProject && (
              <button
                onClick={() => setProjectModalMode('edit')}
                className="btn primary sm"
                style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', border: 'none' }}
              >
                Chỉnh sửa
              </button>
            )
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="submit"
                form="project-form"
                className="btn primary sm"
                disabled={isSaving}
                style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', border: 'none', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu chương trình'}
              </button>
            </div>
          )
        )}

        {/* Roster Drawer */}
        {renderDrawer(
          isRosterModalOpen,
          () => setIsRosterModalOpen(false),
          "Cấu hình Roster Nhân Sự Phân Phối",
          (() => {
            const filtered = rosterMembers.filter(m =>
              (m.full_name || '').toLowerCase().includes(rosterSearch.toLowerCase()) ||
              (m.email || '').toLowerCase().includes(rosterSearch.toLowerCase())
            );

            const sorted = [...filtered].sort((a, b) => {
              const aAssigned = a.is_assigned === 1 ? 1 : 0;
              const bAssigned = b.is_assigned === 1 ? 1 : 0;
              return bAssigned - aAssigned;
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Roster Search Box */}
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="text"
                    placeholder="Tìm kiếm nhân sự theo tên hoặc email..."
                    value={rosterSearch}
                    onChange={e => setRosterSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.875rem',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Add Team Dropdown / Buttons */}
                {canEditRoster && teams.length > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(0, 0, 0, 0.015)',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Thêm nhanh theo Phòng ban:
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ width: '280px' }}>
                        <CustomSelect
                          multiple={true}
                          searchable={true}
                          placeholder="Chọn Phòng ban..."
                          options={teams
                            .map(team => {
                              const teamMembers = rosterMembers.filter(m => Number(m.team_id) === Number(team.id) || Number(m.id) === Number(team.leader_id));
                              const assignedInTeam = teamMembers.filter(m => m.is_assigned === 1);
                              if (teamMembers.length === 0) return null;
                              return {
                                value: String(team.id),
                                label: team.name,
                                sublabel: `${assignedInTeam.length}/${teamMembers.length} thành viên`
                              };
                            })
                            .filter(Boolean) as any[]
                          }
                          value={teams
                            .filter(team => {
                              const teamMembers = rosterMembers.filter(m => Number(m.team_id) === Number(team.id) || Number(m.id) === Number(team.leader_id));
                              return teamMembers.length > 0 && teamMembers.every(m => m.is_assigned === 1);
                            })
                            .map(team => String(team.id))
                          }
                          onChange={(newVal: string[]) => {
                            const currentSelected = teams
                              .filter(team => {
                                const teamMembers = rosterMembers.filter(m => Number(m.team_id) === Number(team.id) || Number(m.id) === Number(team.leader_id));
                                return teamMembers.length > 0 && teamMembers.every(m => m.is_assigned === 1);
                              })
                              .map(team => String(team.id));

                            const addedIds = newVal.filter(id => !currentSelected.includes(id)).map(Number);
                            const removedIds = currentSelected.filter(id => !newVal.includes(id)).map(Number);

                            const addedLeaders = teams.filter(t => addedIds.includes(t.id)).map(t => Number(t.leader_id));
                            const removedLeaders = teams.filter(t => removedIds.includes(t.id)).map(t => Number(t.leader_id));

                            setRosterMembers(prev =>
                              prev.map(m => {
                                if (addedIds.includes(Number(m.team_id)) || addedLeaders.includes(Number(m.id))) {
                                  return { ...m, is_assigned: 1 };
                                }
                                if (removedIds.includes(Number(m.team_id)) || removedLeaders.includes(Number(m.id))) {
                                  return { ...m, is_assigned: 0 };
                                }
                                return m;
                              })
                            );
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn sm outline"
                        onClick={() => {
                          setRosterMembers(prev => prev.map(m => ({ ...m, is_assigned: 0 })));
                        }}
                        style={{
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          height: '38px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        Bỏ chọn tất cả
                      </button>
                    </div>
                  </div>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.75rem',
                  overflowY: 'auto',
                  paddingRight: '4px',
                  maxHeight: '450px'
                }}>
                  {sorted.length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.875rem' }}>
                      Không tìm thấy nhân sự phù hợp
                    </div>
                  ) : (
                    sorted.map(member => {
                      return (
                        <div
                          key={member.id}
                          onClick={() => canEditRoster && handleToggleRoster(member.id)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-lg)',
                            border: member.is_assigned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                            background: member.is_assigned ? 'var(--color-primary-light)' : 'var(--color-surface)',
                            cursor: canEditRoster ? 'pointer' : 'default',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar src={member.avatar_url} name={member.full_name} size={36} />
                            <div>
                              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                {member.full_name}
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '4px' }}>
                                  ({member.role === 'sales' || member.role === 'sale' ? 'Sale' : member.role === 'manager' ? 'Manager' : member.role === 'director' ? 'Director' : member.role})
                                </span>
                              </h4>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{member.email}</p>
                            </div>
                          </div>
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              border: member.is_assigned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                              backgroundColor: member.is_assigned ? 'var(--color-primary)' : 'transparent',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {member.is_assigned === 1 && <Check size={14} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })(),
          '650px',
          (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {canEditRoster ? (
                <>
                  <button
                    type="button"
                    className="btn secondary sm"
                    style={{ borderRadius: '100px', fontWeight: 700 }}
                    onClick={() => setIsRosterModalOpen(false)}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="btn primary sm"
                    style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', border: 'none' }}
                    onClick={handleSaveRoster}
                  >
                    Lưu thay đổi
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn secondary sm"
                  style={{ borderRadius: '100px', fontWeight: 700 }}
                  onClick={() => setIsRosterModalOpen(false)}
                >
                  Đóng
                </button>
              )}
            </div>
          )
        )}

        {renderQuickCampaignsDrawer()}

        {/* Project Docs Drawer */}
        {renderDrawer(
          isDocsModalOpen,
          () => setIsDocsModalOpen(false),
          "Kho Tài Liệu Dự Án",
          (() => {
            const selectedProj = projects.find(p => p.id === selectedProjectId);
            const linkedDocIds = selectedProj?.document_ids ? parseIds(selectedProj.document_ids) : [];

            const formattedLinkedDocs = allFiles
              .filter(f => linkedDocIds.includes(String(f.id)))
              .map(f => ({
                id: f.id,
                name: f.name,
                file_path: f.file_path,
                file_size: Number(f.file_size || 0),
                mime_type: f.mime_type || '',
                uploaded_by_name: f.uploaded_by_name || 'Hệ thống',
                created_at: f.created_at || new Date().toISOString(),
                isLinkedOnly: true
              }));

            const combinedDocs = [...projectDocs, ...formattedLinkedDocs];

            return (
              <div className="project-docs-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '12px' }}>
                <style>{`
                .project-docs-container {
                  background: #fff;
                  padding: 1.25rem;
                  gap: 1rem;
                }
                .project-docs-layout {
                  display: flex;
                  flex-direction: column;
                  gap: 1.25rem;
                }
                .project-docs-top-card {
                  background: var(--color-surface);
                  border: 1px solid var(--color-border-light);
                  border-radius: 12px;
                  padding: 1rem 1.25rem;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: 1.5rem;
                  flex-wrap: wrap;
                }
                .explorer-layout {
                  display: grid;
                  grid-template-columns: 190px 1fr;
                  gap: 1.25rem;
                }
                .category-sidebar {
                  display: flex;
                  flex-direction: column;
                  gap: 0.375rem;
                }
                .category-btn {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: 0.625rem 0.875rem;
                  border-radius: 8px;
                  border: 1px solid transparent;
                  background: transparent;
                  color: var(--color-text-muted);
                  font-size: 0.8125rem;
                  font-weight: 600;
                  cursor: pointer;
                  text-align: left;
                  transition: all 0.15s ease;
                }
                .category-btn:hover {
                  background: var(--color-bg-secondary);
                  color: var(--color-text);
                }
                .category-btn.active {
                  background: var(--color-bg-secondary);
                  border-color: var(--color-border-light);
                  color: var(--color-primary);
                }
                .category-btn.active.gdrive {
                  color: #1a73e8;
                }
                .category-btn.active.pdf {
                  color: #d93025;
                }
                .category-btn.active.excel {
                  color: #137333;
                }
                .category-btn.active.image {
                  color: #ec4899;
                }
                .category-badge {
                  font-size: 0.72rem;
                  opacity: 0.8;
                }
                .table-container {
                  background: var(--color-surface);
                  border: 1px solid var(--color-border-light);
                  border-radius: 12px;
                  overflow-x: auto;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                }
                .doc-table {
                  width: 100%;
                  border-collapse: collapse;
                  text-align: left;
                  font-size: 0.8125rem;
                }
                .doc-table th {
                  padding: 0.875rem 1rem;
                  font-weight: 700;
                  color: var(--color-text-muted);
                  background: var(--color-bg-secondary);
                  border-bottom: 1px solid var(--color-border-light);
                }
                .doc-table td {
                  padding: 0.75rem 1rem;
                  border-bottom: 1px solid var(--color-border-light);
                  vertical-align: middle;
                }
                .doc-table tr:last-child td {
                  border-bottom: none;
                }
                .doc-row:hover {
                  background-color: var(--color-bg-secondary);
                }
                @media (max-width: 768px) {
                  .project-docs-container {
                    padding: 0.5rem !important;
                    gap: 0.75rem;
                  }
                  .project-docs-top-card {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 1rem;
                    padding: 0.75rem;
                  }
                  .explorer-layout {
                    grid-template-columns: 1fr;
                    gap: 0.75rem;
                  }
                  .category-sidebar {
                    flex-direction: row;
                    overflow-x: auto;
                    padding-bottom: 8px;
                    gap: 0.5rem;
                    border-bottom: 1px solid var(--color-border-light);
                    -webkit-overflow-scrolling: touch;
                  }
                  .category-btn {
                    padding: 0.5rem 0.875rem !important;
                    border-radius: 100px !important;
                    background: var(--color-bg-secondary) !important;
                    border: 1px solid var(--color-border-light) !important;
                    font-size: 0.75rem !important;
                    flex-shrink: 0;
                    display: inline-flex !important;
                    align-items: center;
                    gap: 6px;
                    justify-content: center !important;
                  }
                  .category-btn.active {
                    background: var(--color-primary) !important;
                    color: #fff !important;
                    border-color: var(--color-primary) !important;
                  }
                  .category-btn.active .category-badge {
                    background: rgba(255, 255, 255, 0.2) !important;
                    color: #fff !important;
                  }
                  .category-btn .category-badge {
                    background: var(--color-border-light);
                    color: var(--color-text-muted);
                    padding: 1px 6px;
                    border-radius: 100px;
                    font-size: 0.68rem;
                    margin-left: 2px;
                    opacity: 1 !important;
                  }
                  .doc-table th:nth-child(3),
                  .doc-table td:nth-child(3),
                  .doc-table th:nth-child(4),
                  .doc-table td:nth-child(4) {
                    display: none;
                  }
                  .doc-table th {
                    padding: 0.625rem 0.5rem !important;
                  }
                  .doc-table td {
                    padding: 0.5rem 0.5rem !important;
                  }
                }
              `}</style>

                <div className="project-docs-layout">
                  {/* Top Horizontal Card: Project Info & Folder Links */}
                  <div className="project-docs-top-card">
                    {/* Left part: Project details */}
                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Building2 size={15} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dự Án Đang Xem</span>
                        <span style={{ background: 'var(--color-bg-secondary)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text)', border: '1px solid var(--color-border-light)', marginLeft: '8px' }}>
                          {selectedProj?.code || 'N/A'}
                        </span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>
                        {selectedProj?.name || 'Thông tin chương trình'}
                      </h3>
                      {selectedProj?.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          <MapPin size={12} style={{ color: 'var(--color-text-muted)' }} />
                          <span>{selectedProj.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Right part: Folders & Links rendered horizontally */}
                    {selectedProj?.folder_path && parseFolderPaths(selectedProj.folder_path).length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {parseFolderPaths(selectedProj.folder_path).map((f, idx) => {
                          const isGdrive = f.type === 'link';
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                if (!isGdrive && selectedProjectId) {
                                  handleOpenFolderModal(f.path, selectedProjectId);
                                } else if (isGdrive) {
                                  window.open(f.path, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              style={{
                                padding: '0.5rem 0.875rem',
                                border: '1px solid var(--color-border-light)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                background: 'var(--color-bg-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                height: '38px'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = isGdrive ? '#1a73e8' : 'var(--color-primary)';
                                e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                              }}
                            >
                              <div style={{
                                width: 24,
                                height: 24,
                                borderRadius: '4px',
                                background: isGdrive ? '#e8f0fe' : '#e6f4ea',
                                color: isGdrive ? '#1a73e8' : '#137333',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {isGdrive ? <HardDrive size={13} /> : <Folder size={13} />}
                              </div>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                {isGdrive ? 'Google Drive' : 'Thư mục tài liệu'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
                                Mở <ExternalLink size={9} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Main Content Area: Documents Explorer (horizontal grid replaced by standard full-width layout) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Danh sách tài liệu ({combinedDocs.length})
                      </span>
                      {isAdmin && (
                        <label style={{ cursor: 'pointer', margin: 0 }}>
                          <div className="btn primary sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '30px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '0 12px', background: 'var(--color-primary)', color: '#fff', border: 'none' }}>
                            <Upload size={14} />
                            <span>{uploadingDoc ? 'Đang tải...' : 'Tải tài liệu'}</span>
                          </div>
                          <input type="file" disabled={uploadingDoc} onChange={handleUploadFile} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>

                    {(() => {
                      const getCount = (cat: string) => {
                        return combinedDocs.filter(doc => {
                          if (cat === 'all') return true;
                          const ext = doc.name.split('.').pop()?.toLowerCase();
                          if (cat === 'gdrive') return doc.isLinkedOnly;
                          if (cat === 'pdf') return ext === 'pdf';
                          if (cat === 'excel') return ['xls', 'xlsx', 'csv'].includes(ext || '');
                          if (cat === 'image') return ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext || '');
                          if (cat === 'other') {
                            return !doc.isLinkedOnly && ext !== 'pdf' && !['xls', 'xlsx', 'csv'].includes(ext || '') && !['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext || '');
                          }
                          return true;
                        }).length;
                      };

                      const filteredDocs = combinedDocs.filter(doc => {
                        if (docFilterCategory === 'all') return true;
                        const ext = doc.name.split('.').pop()?.toLowerCase();
                        if (docFilterCategory === 'gdrive') return doc.isLinkedOnly;
                        if (docFilterCategory === 'pdf') return ext === 'pdf';
                        if (docFilterCategory === 'excel') return ['xls', 'xlsx', 'csv'].includes(ext || '');
                        if (docFilterCategory === 'image') return ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext || '');
                        if (docFilterCategory === 'other') {
                          return !doc.isLinkedOnly && ext !== 'pdf' && !['xls', 'xlsx', 'csv'].includes(ext || '') && !['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext || '');
                        }
                        return true;
                      });

                      return (
                        <div className="explorer-layout">
                          {/* Categories Sidebar */}
                          <div className="category-sidebar">
                            {(getCount('all') > 0 || combinedDocs.length === 0) && (
                              <button
                                type="button"
                                onClick={() => setDocFilterCategory('all')}
                                className={`category-btn ${docFilterCategory === 'all' ? 'active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Layers size={14} />
                                  <span>Tất cả tài liệu</span>
                                </div>
                                <span className="category-badge">({getCount('all')})</span>
                              </button>
                            )}

                            {getCount('gdrive') > 0 && (
                              <button
                                type="button"
                                onClick={() => setDocFilterCategory('gdrive')}
                                className={`category-btn gdrive ${docFilterCategory === 'gdrive' ? 'active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <HardDrive size={14} />
                                  <span>Google Drive</span>
                                </div>
                                <span className="category-badge">({getCount('gdrive')})</span>
                              </button>
                            )}

                            {getCount('pdf') > 0 && (
                              <button
                                type="button"
                                onClick={() => setDocFilterCategory('pdf')}
                                className={`category-btn pdf ${docFilterCategory === 'pdf' ? 'active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={14} />
                                  <span>Tài liệu PDF</span>
                                </div>
                                <span className="category-badge">({getCount('pdf')})</span>
                              </button>
                            )}

                            {getCount('excel') > 0 && (
                              <button
                                type="button"
                                onClick={() => setDocFilterCategory('excel')}
                                className={`category-btn excel ${docFilterCategory === 'excel' ? 'active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileSpreadsheet size={14} />
                                  <span>Bảng tính Excel</span>
                                </div>
                                <span className="category-badge">({getCount('excel')})</span>
                              </button>
                            )}

                            {getCount('image') > 0 && (
                              <button
                                type="button"
                                onClick={() => setDocFilterCategory('image')}
                                className={`category-btn image ${docFilterCategory === 'image' ? 'active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Paperclip size={14} />
                                  <span>Hình ảnh</span>
                                </div>
                                <span className="category-badge">({getCount('image')})</span>
                              </button>
                            )}

                            {getCount('other') > 0 && (
                              <button
                                type="button"
                                onClick={() => setDocFilterCategory('other')}
                                className={`category-btn ${docFilterCategory === 'other' ? 'active' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Info size={14} />
                                  <span>Tài liệu khác</span>
                                </div>
                                <span className="category-badge">({getCount('other')})</span>
                              </button>
                            )}
                          </div>

                          {/* List/Table view */}
                          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filteredDocs.length === 0 ? (
                              <div style={{
                                textAlign: 'center',
                                padding: '4rem 0',
                                color: 'var(--color-text-muted)',
                                background: 'var(--color-bg-secondary)',
                                borderRadius: '12px',
                                border: '2px dashed var(--color-border-light)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.75rem'
                              }}>
                                <div style={{
                                  width: 48,
                                  height: 48,
                                  borderRadius: '50%',
                                  background: 'var(--color-surface)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--color-text-muted)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                                }}>
                                  <FileText size={20} style={{ opacity: 0.5 }} />
                                </div>
                                <div>
                                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>Không có tài liệu</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '0.725rem', color: 'var(--color-text-muted)' }}>Danh mục này hiện chưa có dữ liệu</p>
                                </div>
                              </div>
                            ) : (
                              <div className="table-container no-scrollbar">
                                <table className="doc-table">
                                  <thead>
                                    <tr>
                                      <th style={{ width: '45%' }}>Tên tài liệu</th>
                                      <th>Nguồn</th>
                                      <th>Dung lượng</th>
                                      <th>Người tải</th>
                                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredDocs.map(doc => {
                                      const isLink = doc.isLinkedOnly;
                                      const docKey = `${isLink ? 'link' : 'direct'}-${doc.id}`;
                                      const isEditing = editingDocKey === docKey;
                                      const ext = doc.name.split('.').pop()?.toLowerCase();

                                      let icon = <FileText size={16} />;
                                      let iconColor = '#10b981';
                                      let iconBg = '#e6f4ea';

                                      if (isLink) {
                                        icon = <ExternalLink size={16} />;
                                        iconColor = '#1a73e8';
                                        iconBg = '#e8f0fe';
                                      } else if (ext === 'pdf') {
                                        icon = <FileText size={16} />;
                                        iconColor = '#d93025';
                                        iconBg = '#fce8e6';
                                      } else if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
                                        icon = <FileSpreadsheet size={16} />;
                                        iconColor = '#137333';
                                        iconBg = '#e6f4ea';
                                      } else if (['doc', 'docx'].includes(ext || '')) {
                                        icon = <FileText size={16} />;
                                        iconColor = '#1a73e8';
                                        iconBg = '#e8f0fe';
                                      } else if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext || '')) {
                                        icon = <Paperclip size={16} />;
                                        iconColor = '#ec4899';
                                        iconBg = '#fde8f3';
                                      }

                                      return (
                                        <tr key={docKey} className="doc-row">
                                          <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <div style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '6px',
                                                background: iconBg,
                                                color: iconColor,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                              }}>
                                                {icon}
                                              </div>
                                              <div style={{ minWidth: 0, flex: 1 }}>
                                                {isEditing ? (
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                                    <input
                                                      type="text"
                                                      className="form-input"
                                                      value={editDocNameVal}
                                                      onChange={e => setEditDocNameVal(e.target.value)}
                                                      style={{
                                                        fontSize: '0.8125rem',
                                                        padding: '4px 8px',
                                                        height: '28px',
                                                        borderRadius: '6px',
                                                        flex: 1
                                                      }}
                                                      autoFocus
                                                      onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSaveRenameDoc(doc);
                                                        if (e.key === 'Escape') setEditingDocKey(null);
                                                      }}
                                                    />
                                                    <button
                                                      onClick={() => handleSaveRenameDoc(doc)}
                                                      className="btn success sm"
                                                      style={{ minWidth: 'auto', padding: '4px 8px', height: '28px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px' }}
                                                    >
                                                      <Check size={12} />
                                                    </button>
                                                    <button
                                                      onClick={() => setEditingDocKey(null)}
                                                      className="btn secondary sm"
                                                      style={{ minWidth: 'auto', padding: '4px 8px', height: '28px', borderRadius: '6px' }}
                                                    >
                                                      <X size={12} />
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <span
                                                    style={{ fontWeight: 600, color: 'var(--color-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={doc.name}
                                                  >
                                                    {doc.name}
                                                  </span>
                                                )}
                                                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>
                                                  Ngày tạo: {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <span style={{
                                              fontSize: '0.68rem',
                                              padding: '2px 8px',
                                              borderRadius: '4px',
                                              background: isLink ? '#e8f0fe' : '#e6f4ea',
                                              color: isLink ? '#1a73e8' : '#137333',
                                              fontWeight: 700,
                                              display: 'inline-block'
                                            }}>
                                              {isLink ? 'Google Drive' : 'Đính kèm'}
                                            </span>
                                          </td>
                                          <td style={{ color: 'var(--color-text-muted)' }}>
                                            {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                                          </td>
                                          <td style={{ color: 'var(--color-text)', fontWeight: 500 }}>
                                            {doc.uploaded_by_name}
                                          </td>
                                          <td style={{ textAlign: 'right' }}>
                                            {!isEditing && (
                                              <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                                                <button
                                                  onClick={() => handleRenameDoc(doc)}
                                                  className="btn secondary sm"
                                                  style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)' }}
                                                  title="Đổi tên"
                                                >
                                                  <Edit size={12} />
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    if (doc.isLinkedOnly) {
                                                      const url = `${import.meta.env.VITE_API_URL || '/backend'}/${doc.file_path}`;
                                                      window.open(url, '_blank');
                                                    } else {
                                                      handleDownloadDoc(doc.id);
                                                    }
                                                  }}
                                                  className="btn secondary sm"
                                                  style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', color: 'var(--color-primary)' }}
                                                  title="Tải về"
                                                >
                                                  <Download size={12} />
                                                </button>
                                                {isAdmin && !doc.isLinkedOnly && (
                                                  <button
                                                    onClick={() => handleDeleteDoc(doc.id)}
                                                    className="btn danger sm"
                                                    style={{ height: '28px', width: '28px', padding: 0, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', border: 'none', backgroundColor: '#fce8e6', color: '#d93025' }}
                                                    title="Xóa"
                                                  >
                                                    <Trash2 size={12} />
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid var(--color-border-light)', marginTop: '0.5rem', paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn secondary sm" style={{ borderRadius: '100px', fontWeight: 700 }} onClick={() => setIsDocsModalOpen(false)}>Đóng</button>
                </div>
              </div>
            );
          })(),
          '1000px'
        )}

        {/* Campaign Create/Edit Modal (converted to Drawer) */}
        {renderDrawer(
          isCampaignModalOpen,
          () => {
            setIsCampaignModalOpen(false);
            setEditingCampaign(null);
          },
          campaignModalMode === 'view'
            ? `Chi tiết Khóa học: ${editingCampaign?.name}`
            : editingCampaign?.id ? 'Chỉnh sửa Khóa học' : 'Thêm Khóa học mới',
          <>
            {campaignModalMode === 'view' ? (
              <>
                {renderCampaignViewDrawer()}
                {isLegacyLayoutEnabled && (
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'start' }}>

                    {/* Left Column (3/5) */}
                    <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                      {/* Section 1: Thông tin cơ bản */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Tên chiến dịch</span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.925rem', fontWeight: 700, display: 'block' }}>{editingCampaign?.name}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Trạng thái hoạt động</span>
                            <span
                              className={`badge ${editingCampaign?.status === 'active' ? 'success' : 'secondary'}`}
                              style={{ fontSize: '0.75rem', padding: '5px 10px', borderRadius: '100px', fontWeight: 700, display: 'inline-block', marginTop: '2px' }}
                            >
                              {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày bắt đầu</span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.start_date || 'Chưa thiết lập'}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Ngày kết thúc</span>
                            <span style={{ color: 'var(--color-text)', fontSize: '0.875rem', fontWeight: 600, display: 'block' }}>{editingCampaign?.end_date || 'Chưa thiết lập'}</span>
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Đường dẫn Folder</span>
                            <div style={{ marginTop: '4px' }}>
                              {renderFolderPathLink(editingCampaign?.folder_path, editingCampaign?.project_id)}
                            </div>
                          </div>
                          {editingCampaign?.reference_url && (
                            <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px' }}>
                              <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block', marginBottom: '4px' }}>Website / Link tham khảo</span>
                              <a
                                href={editingCampaign.reference_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  color: 'var(--color-primary)',
                                  textDecoration: 'none',
                                  fontWeight: 700,
                                  fontSize: '0.875rem'
                                }}
                              >
                                {editingCampaign.reference_url.includes('docs.google.com/spreadsheets') || editingCampaign.reference_url.includes('google.com/sheets') ? (
                                  <>
                                    <FileSpreadsheet size={16} color="#10b981" />
                                    <span style={{ color: '#10b981' }}>Bảng tính Google Sheets</span>
                                  </>
                                ) : (
                                  <>
                                    <Link2 size={16} />
                                    <span>Mở liên kết tham khảo</span>
                                  </>
                                )}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section 3: Mô tả chiến dịch */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>Mô tả chiến dịch</span>
                        <p style={{ color: 'var(--color-text)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '0.875rem' }}>
                          {editingCampaign?.description || 'Không có mô tả chi tiết'}
                        </p>
                      </div>

                      {/* Thảo luận & Trao đổi */}
                      {editingCampaign && renderEntityComments('campaign', editingCampaign.id)}

                    </div>

                    {/* Right Column (2/5) */}
                    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                      {/* Section 2: Chương trình liên kết */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chương trình liên kết</h4>

                        {(() => {
                          const associatedProjs = projects.filter(p => {
                            const campIds = p.campaign_ids ? p.campaign_ids.split(',').map((id: string) => id.trim()) : [];
                            return campIds.includes(editingCampaign?.name);
                          });

                          if (associatedProjs.length === 0) {
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f3f4f6', border: '1px solid var(--color-border-light)', borderRadius: '12px', color: '#6b7280', fontSize: '0.8rem', fontWeight: 550, cursor: 'not-allowed' }}>
                                <Info size={12} style={{ opacity: 0.6 }} />
                                <span>Chưa liên kết chương trình nào</span>
                              </div>
                            );
                          }

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {associatedProjs.map(proj => {
                                const docIds = proj.document_ids ? proj.document_ids.split(',').map((id: string) => id.trim()) : [];
                                const projDocs = allFiles.filter(f => docIds.includes(String(f.id)));

                                return (
                                  <div key={proj.id} style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', padding: '1rem', background: 'var(--color-bg-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px dotted var(--color-border-light)', paddingBottom: '0.5rem' }}>
                                      <span
                                        onClick={() => {
                                          setEditingProject(proj);
                                          setProjectModalMode('view');
                                          setIsCampaignModalOpen(false);
                                          setIsEditModalOpen(true);
                                        }}
                                        style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      >
                                        <Building2 size={14} /> {proj.name}
                                      </span>
                                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{proj.code}</span>
                                    </div>

                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                      <span>Thư mục:</span>
                                      {parseFolderPaths(proj.folder_path).map((f, idx) => (
                                        <span key={idx}>{renderFolderPathLink(f.path, proj.id)}</span>
                                      ))}
                                    </div>

                                    <div style={{ marginBottom: '8px' }}>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Tài liệu:</span>
                                      {projDocs.length === 0 ? (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Không có tài liệu</span>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          {projDocs.map(doc => (
                                            <a
                                              key={doc.id}
                                              href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${doc.file_path}`}
                                              download={doc.name}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{ color: 'var(--color-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                                            >
                                              <FileText size={12} style={{ flexShrink: 0 }} /> {doc.name}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Linked Tasks */}
                      <div style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: '16px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        <span style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', fontWeight: 750, display: 'block' }}>
                          Nhiệm vụ & Công việc liên kết ({linkedTasks.length})
                        </span>
                        {loadingLinkedTasks ? (
                          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                            <RefreshCw className="spin" size={16} color="var(--color-text-muted)" />
                          </div>
                        ) : linkedTasks.length === 0 ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--color-bg-light)', border: '1px dashed var(--color-border)', borderRadius: '10px' }}>
                            Chưa có công việc nào liên kết với chiến dịch này.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {linkedTasks.map(task => {
                              const statusColors: any = {
                                planned: { bg: 'rgba(245, 158, 11, 0.08)', text: 'var(--color-warning)' },
                                done: { bg: 'rgba(16, 185, 129, 0.08)', text: 'var(--color-success)' },
                                cancelled: { bg: 'rgba(239, 68, 68, 0.08)', text: 'var(--color-danger)' }
                              };
                              const sc = statusColors[task.status] || statusColors.planned;
                              const performer = users.find(u => Number(u.id) === Number(task.user_id));
                              return (
                                <div
                                  key={task.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'var(--color-bg-light)',
                                    border: '1px solid var(--color-border-light)',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.01)'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(163, 20, 34, 0.06)';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                                    e.currentTarget.style.background = 'var(--color-bg-light)';
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.01)';
                                  }}
                                  onClick={() => handleOpenTask(task.id)}
                                  title={t('Click để xem chi tiết nhiệm vụ')}
                                >
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ marginTop: '3px' }}>
                                      <CheckSquare size={18} color={task.status === 'done' ? 'var(--color-success)' : 'var(--color-text-muted)'} style={{ opacity: 0.85 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.9rem', lineHeight: '1.2' }}>{task.subject}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Avatar
                                          src={performer?.avatar_url || performer?.avatar}
                                          name={performer?.full_name || performer?.name || 'Hệ thống'}
                                          size={18}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                                          {performer?.full_name || 'Hệ thống'} {performer?.role ? `(${performer.role})` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '100px',
                                    background: sc.bg,
                                    color: sc.text,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.03em'
                                  }}>
                                    {task.status === 'done' ? 'Đã xong' : 'Chưa xong'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </>
            ) : (
              <form id="campaign-form" onSubmit={handleSaveCampaign} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'start' }}>
                <input
                  type="file"
                  ref={quickUploadInputRef}
                  style={{ display: 'none' }}
                  onChange={e => handleQuickUpload(e)}
                />
                {/* Left Column (3/5) */}
                <div style={{ flex: 3, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* Card 1: Thông tin cơ bản */}
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thông tin cơ bản</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Tên Chiến dịch <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ví dụ: Facebook Lead Ads - HCMC"
                          value={editingCampaign?.name || ''}
                          onChange={e => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                          required
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Ngày bắt đầu</label>
                          <input
                            type="date"
                            className="form-input"
                            value={editingCampaign?.start_date || ''}
                            onChange={e => setEditingCampaign({ ...editingCampaign, start_date: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 600 }}>Ngày kết thúc</label>
                          <input
                            type="date"
                            className="form-input"
                            value={editingCampaign?.end_date || ''}
                            onChange={e => setEditingCampaign({ ...editingCampaign, end_date: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Website hoặc Link tham khảo (GG Sheets, tài liệu...)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Dán đường dẫn link website hoặc Google Sheets tham khảo..."
                          value={editingCampaign?.reference_url || ''}
                          onChange={e => setEditingCampaign({ ...editingCampaign, reference_url: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontWeight: 600 }}>Trạng thái chiến dịch</label>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', background: 'var(--color-bg-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', height: '44px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: editingCampaign?.status === 'active' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                            {editingCampaign?.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                          </span>
                          <ToggleSwitch
                            checked={editingCampaign?.status === 'active'}
                            onChange={checked => setEditingCampaign({ ...editingCampaign, status: checked ? 'active' : 'inactive' })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Mô tả */}
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Mô tả chiến dịch</label>
                    <textarea
                      className="form-input"
                      placeholder="Mô tả mục tiêu, nguồn lead, ngân sách..."
                      rows={3}
                      value={editingCampaign?.description || ''}
                      onChange={e => setEditingCampaign({ ...editingCampaign, description: e.target.value })}
                      style={{ minHeight: '80px', padding: '10px 14px' }}
                    />
                  </div>

                </div>

                {/* Right Column (2/5) */}
                <div style={{ flex: 2, width: isMobile ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* Card 1: Nhân sự & Chương trình liên kết */}
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nhân sự &amp; Chương trình</h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Chương trình liên kết</label>
                        <CustomSelect
                          searchable={true}
                          options={projects.map(p => ({ value: String(p.id), label: `${p.name} (${p.code})` }))}
                          value={editingCampaign?.project_id ? String(editingCampaign.project_id) : ''}
                          onChange={val => setEditingCampaign({
                            ...editingCampaign,
                            project_id: val ? Number(val) : null,
                            project_ids: val ? (projects.find(p => String(p.id) === String(val))?.name || '') : ''
                          })}
                          placeholder="Chọn chương trình..."
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Manager phụ trách chính</label>
                        <CustomSelect
                          multiple
                          searchable={true}
                          showAvatars={true}
                          options={users
                            .filter(u => ['manager', 'director', 'admin', 'superadmin', 'super_admin'].includes(u.role))
                            .map(u => ({ value: String(u.id), label: `${u.full_name || u.fullname || u.username} (${u.role})`, avatar: u.avatar_url || u.avatar }))
                          }
                          value={parseIds(editingCampaign?.manager_ids)}
                          onChange={val => setEditingCampaign({ ...editingCampaign, manager_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                          placeholder="Chọn manager..."
                        />
                      </div>


                    </div>
                  </div>

                  {/* Card 2: Tài liệu & Thư mục */}
                  <div style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thư mục & Tài liệu</h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontWeight: 600 }}>Đường dẫn Folder liên kết</label>
                        <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: '10px', marginBottom: '12px', border: '1px solid var(--color-border-light)' }}>
                          <button
                            type="button"
                            onClick={() => setCampaignFolderLinkType('link')}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: 'none',
                              background: campaignFolderLinkType === 'link' ? 'var(--color-primary)' : 'transparent',
                              color: campaignFolderLinkType === 'link' ? 'white' : 'var(--color-text-muted)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: campaignFolderLinkType === 'link' ? '0 2px 4px rgba(163, 20, 34, 0.2)' : 'none'
                            }}
                          >
                            Dán Link (Drive...)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCampaignFolderLinkType('select')}
                            style={{
                              flex: 1,
                              padding: '8px 12px',
                              borderRadius: '8px',
                              border: 'none',
                              background: campaignFolderLinkType === 'select' ? 'var(--color-primary)' : 'transparent',
                              color: campaignFolderLinkType === 'select' ? 'white' : 'var(--color-text-muted)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: campaignFolderLinkType === 'select' ? '0 2px 4px rgba(163, 20, 34, 0.2)' : 'none'
                            }}
                          >
                            Chọn thư mục có sẵn
                          </button>
                        </div>

                        {campaignFolderLinkType === 'link' ? (
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Dán link thư mục Google Drive..."
                            value={editingCampaign?.folder_path || ''}
                            onChange={e => setEditingCampaign({ ...editingCampaign, folder_path: e.target.value })}
                          />
                        ) : (
                          <CustomSelect
                            options={fileCategories.map(cat => ({ value: cat.label, label: cat.label }))}
                            value={editingCampaign?.folder_path || ''}
                            onChange={val => setEditingCampaign({ ...editingCampaign, folder_path: val as string })}
                            placeholder="Chọn thư mục từ /files..."
                          />
                        )}
                      </div>

                      <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>Tài liệu đính kèm</label>
                          <button
                            type="button"
                            onClick={() => quickUploadInputRef.current?.click()}
                            disabled={uploadingDoc}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-primary)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0
                            }}
                          >
                            {uploadingDoc ? (
                              <RefreshCw className="spin" size={12} />
                            ) : (
                              <Plus size={12} />
                            )}
                            <span>Tải tệp mới</span>
                          </button>
                        </div>
                        <CustomSelect
                          multiple
                          searchable={true}
                          options={allFiles.map(f => ({ value: String(f.id), label: f.name }))}
                          value={parseIds(editingCampaign?.document_ids)}
                          onChange={val => setEditingCampaign({ ...editingCampaign, document_ids: Array.isArray(val) ? val.join(',') : String(val) })}
                          placeholder="Chọn tài liệu..."
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </form>
            )}
          </>,
          '850px',
          campaignModalMode === 'view' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {editingCampaign?.id && (
                <button
                  type="button"
                  className="btn outline sm hover-lift"
                  style={{
                    borderColor: '#b91c1c',
                    color: '#b91c1c',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    border: '1px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 750,
                    height: '38px',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    const publicLink = `/public-schedule/course/${editingCampaign.id}`;
                    window.open(publicLink, '_blank');
                  }}
                >
                  <Calendar size={16} />
                  <span>Xem lịch khóa học (Public)</span>
                </button>
              )}
              <button
                onClick={() => setCampaignDrawerTab(campaignDrawerTab === 'details' ? 'changelog' : 'details')}
                style={{
                  border: 'none',
                  background: campaignDrawerTab === 'changelog' ? 'rgba(100, 116, 139, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  color: campaignDrawerTab === 'changelog' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  height: '38px',
                  width: '38px'
                }}
                title={campaignDrawerTab === 'details' ? 'Xem lịch sử thay đổi' : 'Xem thông tin chi tiết'}
                className="hover-lift"
              >
                <History size={20} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="submit"
                form="campaign-form"
                className="btn primary sm"
                disabled={isSaving}
                style={{ borderRadius: '100px', fontWeight: 700, background: 'var(--color-primary)', border: 'none', opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu chiến dịch'}
              </button>
            </div>
          ),
          true
        )}
        {/* Explanation of Projects & Campaigns Modal */}
        <CustomModal
          isOpen={showInfoModal}
          onClose={() => setShowInfoModal(false)}
          title={t("Hướng dẫn Thiết lập Chương trình & Chiến dịch & Roster")}
          width="760px"
        >
          <div style={{ padding: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '0.875rem 1rem',
              background: 'var(--color-primary-light)',
              border: '1px solid rgba(163, 20, 34, 0.15)',
              borderRadius: 12
            }}>
              <Info size={24} color="var(--color-primary)" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: 0 }}>
                {t("Chương trình và Chiến dịch marketing là nguồn phát sinh dữ liệu khách hàng (lead). Việc cấu hình đúng đắn quyết định đường đi của lead và đội ngũ tiếp nhận chăm sóc:")}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Chương trình */}
              <div style={{
                display: 'flex',
                gap: 12,
                padding: '1rem',
                background: theme === 'dark' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(59, 130, 246, 0.02)',
                borderLeft: '4px solid #3b82f6',
                borderTop: '1px solid var(--color-border-light)',
                borderRight: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
                borderRadius: '0 8px 8px 0'
              }}>
                <Building2 size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                    {t("1. Quản lý Chương trình & Tài liệu (Projects & Drive)")}
                  </h5>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    • <strong>Chương trình (Project)</strong>: Sản phẩm căn hộ, đất nền hoặc chương trình phân phối. Mã chương trình (Code) là duy nhất dùng để so khớp UTM parameter khi lead đổ về.<br />
                    • <strong>Tài liệu chương trình</strong>: Lưu trữ tài liệu (Flyer, bảng giá, pháp lý) để TVV truy cập nhanh từ Workspace.
                  </p>
                </div>
              </div>

              {/* Chiến dịch */}
              <div style={{
                display: 'flex',
                gap: 12,
                padding: '1rem',
                background: theme === 'dark' ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.02)',
                borderLeft: '4px solid #10b981',
                borderTop: '1px solid var(--color-border-light)',
                borderRight: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
                borderRadius: '0 8px 8px 0'
              }}>
                <Layers size={20} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                    {t("2. Chiến dịch tiếp thị (Marketing Campaigns)")}
                  </h5>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    • <strong>Chiến dịch (Campaign)</strong>: Đại diện cho các chiến dịch quảng cáo chạy cho chương trình (vd: FB Ads, Google Search). Mỗi chiến dịch kết nối với các thẻ UTM tương ứng để phân loại nguồn gốc khách hàng và tính toán chi phí vận hành (CPL/CPA).
                  </p>
                </div>
              </div>

              {/* Roster */}
              <div style={{
                display: 'flex',
                gap: 12,
                padding: '1rem',
                background: theme === 'dark' ? 'rgba(245, 158, 11, 0.04)' : 'rgba(245, 158, 11, 0.02)',
                borderLeft: '4px solid #f59e0b',
                borderTop: '1px solid var(--color-border-light)',
                borderRight: '1px solid var(--color-border-light)',
                borderBottom: '1px solid var(--color-border-light)',
                borderRadius: '0 8px 8px 0'
              }}>
                <Users size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h5 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 4px 0', color: 'var(--color-text)' }}>
                    {t("3. Đội ngũ tiếp nhận & Roster (Project/Campaign Roster)")}
                  </h5>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    • <strong>Roster</strong>: Danh sách nhân viên kinh doanh được kích hoạt tham gia bán chương trình/chiến dịch này. <strong>Hệ thống chỉ chia lead cho TVV có tên trong Roster của Chương trình/Chiến dịch đó</strong>. Điều này giúp đảm bảo lead được giao đúng người có chuyên môn và chứng chỉ phù hợp.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
            <button className="btn primary" onClick={() => setShowInfoModal(false)} style={{ minWidth: 100 }}>{t("Đồng ý")}</button>
          </div>
        </CustomModal>

        {/* Roster List Modal */}
        <CustomModal
          isOpen={showRosterModal}
          onClose={() => setShowRosterModal(false)}
          title={`Đội ngũ nhân sự phụ trách - ${editingProject?.name}`}
          width="540px"
        >
          <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Danh sách nhân sự thuộc roster phân phối của chương trình này ({projectRoster.length} người):
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {projectRoster.map((member: any) => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--color-bg-light)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Avatar src={member.avatar_url || member.avatar} name={member.full_name || member.name} size={36} />
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'block', fontSize: '0.9rem' }}>
                        {member.full_name || member.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {member.email}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`badge ${member.role === 'manager' ? 'primary' : 'secondary'}`}
                    style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '100px', fontWeight: 700, textTransform: 'uppercase' }}
                  >
                    {member.role || 'sales'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CustomModal>

        {/* Folder Contents Modal */}
        <CustomModal
          isOpen={showFolderModal}
          onClose={() => setShowFolderModal(false)}
          title={`Thư mục: ${folderModalPath}`}
          width="800px"
        >
          <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                Danh sách tài liệu thuộc thư mục chương trình này ({folderFiles.length} tệp tin):
              </span>
              {folderModalProjectId && (
                <div>
                  <input
                    type="file"
                    id="folder-modal-upload"
                    style={{ display: 'none' }}
                    onChange={(e) => folderModalProjectId && handleQuickUpload(e, folderModalProjectId)}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('folder-modal-upload')?.click()}
                    className="btn primary sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', padding: '6px 12px' }}
                  >
                    <Upload size={14} />
                    Tải tệp lên
                  </button>
                </div>
              )}
            </div>

            {folderFilesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                <RefreshCw className="spin" size={24} color="var(--color-text-muted)" />
              </div>
            ) : folderFiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border-light)', borderRadius: '12px', background: 'var(--color-bg-light)' }}>
                <Folder size={32} style={{ color: 'var(--color-text-light)', marginBottom: '8px' }} />
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Thư mục trống</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-light)' }}>Chưa có tài liệu nào được tải lên cho chương trình này.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                {folderFiles.map((fileObj: any) => (
                  <div
                    key={fileObj.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--color-bg-light)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: '12px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <span style={{ fontWeight: 650, color: 'var(--color-text)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fileObj.name}>
                        {fileObj.name}
                      </span>
                    </div>
                    <a
                      href={`${import.meta.env.VITE_API_URL ?? '/backend'}/${fileObj.file_path}`}
                      download={fileObj.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn outline sm"
                      style={{ fontSize: '0.75rem', height: '28px', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700, borderRadius: '6px' }}
                    >
                      <Download size={12} />
                      Tải về
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CustomModal>

        {/* Round Detail View Modal (Matches Rounds.tsx layout) */}
        <CustomModal
          isOpen={isRoundDetailModalOpen}
          onClose={() => {
            setIsRoundDetailModalOpen(false);
            setSelectedRoundForModal(null);
          }}
          title={`Cấu hình Vòng Phân Bổ: ${selectedRoundForModal?.round_name || ''}`}
          width="850px"
        >
          {selectedRoundForModal && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxHeight: '75vh', overflowY: 'auto' }}>
              {(() => {
                const canEditRound = ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(String(user?.role || '').toLowerCase());
                const consultantsList = selectedRoundForModal.consultants ? selectedRoundForModal.consultants.split(',').filter(Boolean) : [];

                return (
                  <>
                    {/* Top Subtabs & Permission Bar */}
                    <div style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '12px',
                      background: canEditRound ? 'rgba(16, 185, 129, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                      border: canEditRound ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: canEditRound ? '#10b981' : '#3b82f6'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldAlert size={15} />
                        <span>{canEditRound ? 'Quyền hạn: Quản trị (Có quyền chỉnh sửa Vòng)' : 'Quyền hạn: Chỉ đọc (Xem chi tiết Vòng)'}</span>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '100px',
                        background: selectedRoundForModal.is_active ? 'var(--color-success)' : 'var(--color-text-muted)',
                        color: '#fff',
                        fontSize: '0.7rem'
                      }}>
                        {selectedRoundForModal.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
                      </span>
                    </div>

                    {/* 2-Column Grid matching Rounds.tsx */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
                      {/* LEFT COLUMN: General Settings */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tên Vòng</label>
                          <input
                            className="form-input"
                            value={selectedRoundForModal.round_name || ''}
                            readOnly
                            style={{ background: 'var(--color-bg)', fontWeight: 700, color: 'var(--color-text)' }}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phạm vi áp dụng (Chương trình / Chiến dịch)</label>
                          <input
                            className="form-input"
                            value={selectedRoundForModal.project_name || selectedRoundForModal.campaign_name || 'Độc lập (Tất cả data)'}
                            readOnly
                            style={{ background: 'var(--color-bg)', fontWeight: 600, color: 'var(--color-text)' }}
                          />
                        </div>

                        {/* Lượt vừa chia & Lượt sắp tới Highlights */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '1rem', background: 'var(--color-bg-light)', border: '1px solid var(--color-border-light)', borderRadius: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lượt vừa chia:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar name={selectedRoundForModal.last_assigned_name || 'N/A'} size={18} />
                              <strong style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                                {selectedRoundForModal.last_assigned_name || 'Chưa phát sinh'}
                              </strong>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px dotted var(--color-border-light)', paddingTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Lượt sắp tới (Kế tiếp):</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: 'rgba(189, 29, 45, 0.08)', borderRadius: '100px', border: '1px solid rgba(189, 29, 45, 0.15)' }}>
                              <Zap size={13} color="var(--color-primary)" />
                              <Avatar name={selectedRoundForModal.next_assigned_name || 'N/A'} size={18} />
                              <strong style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                {selectedRoundForModal.next_assigned_name || 'Chưa xác định'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Vòng mặc định (Fallback)
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`badge ${selectedRoundForModal.is_fallback ? 'warning' : 'secondary'}`} style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '100px', fontWeight: 700 }}>
                              {selectedRoundForModal.is_fallback ? 'Có (Vòng Fallback)' : 'Không'}
                            </span>
                          </div>
                        </div>

                        {selectedRoundForModal.cc_emails && (
                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CC Email Admin</label>
                            <input
                              className="form-input"
                              value={selectedRoundForModal.cc_emails}
                              readOnly
                              style={{ background: 'var(--color-bg)', fontSize: '0.8rem' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* RIGHT COLUMN: Sales in Round */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="form-label" style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                            Danh sách Sales trong Vòng ({consultantsList.length})
                          </label>
                        </div>

                        {consultantsList.length === 0 ? (
                          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem', background: 'var(--color-bg-light)', borderRadius: '12px', border: '1px dashed var(--color-border)' }}>
                            Chưa có tư vấn viên nào được gán vào vòng phân bổ này.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                            {consultantsList.map((name: string, index: number) => {
                              const isNext = selectedRoundForModal.next_assigned_name === name;
                              const isLast = selectedRoundForModal.last_assigned_name === name;

                              return (
                                <div
                                  key={index}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    background: isNext ? 'rgba(189, 29, 45, 0.05)' : 'var(--color-surface)',
                                    border: isNext ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Avatar name={name} size={28} />
                                    <div>
                                      <span style={{ fontWeight: isNext ? 800 : 700, fontSize: '0.875rem', color: isNext ? 'var(--color-primary)' : 'var(--color-text)', display: 'block' }}>
                                        {name}
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                        Tư vấn viên #{index + 1}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {isNext && (
                                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '100px', background: 'var(--color-primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <Zap size={10} /> Lượt tới
                                      </span>
                                    )}
                                    {isLast && !isNext && (
                                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '100px', background: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }}>
                                        Vừa chia
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Modal Actions Footer */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '1rem', borderTop: '1px solid var(--color-border-light)', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRoundDetailModalOpen(false);
                          setSelectedRoundForModal(null);
                        }}
                        className="btn secondary sm"
                        style={{ borderRadius: '8px', fontWeight: 700, padding: '6px 16px' }}
                      >
                        Đóng
                      </button>
                      {canEditRound && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsRoundDetailModalOpen(false);
                            navigate(`/rounds?id=${selectedRoundForModal.id}`);
                          }}
                          className="btn primary sm"
                          style={{ borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', borderColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px' }}
                        >
                          <Edit size={14} /> Chỉnh sửa Vòng phân bổ
                        </button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </CustomModal>

        {selectedTaskForDrawer && (
          <Suspense fallback={null}>
            <WorkspaceTaskDrawer
              isOpen={!!selectedTaskForDrawer}
              onClose={() => {
                setSelectedTaskForDrawer(null);
                const params = new URLSearchParams(window.location.search);
                params.delete('task_id');
                navigate(`${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`, { replace: true });
              }}
              task={selectedTaskForDrawer}
              onUpdate={() => {
                window.dispatchEvent(new CustomEvent('task-updated'));
              }}
              users={users}
              onOpenContact={(contactId) => {
                setSelectedContactForDrawer({ id: contactId });
              }}
            />
          </Suspense>
        )}

        {selectedContactForDrawer && (
          <Suspense fallback={null}>
            <CustomerProfileDrawer
              isOpen={!!selectedContactForDrawer}
              onClose={() => setSelectedContactForDrawer(null)}
              contact={selectedContactForDrawer}
              onUpdate={() => {
                window.dispatchEvent(new CustomEvent('contact-updated'));
              }}
              zIndex={selectedTaskForDrawer ? 1000300 : undefined}
            />
          </Suspense>
        )}

        {/* Dedicated Subject Configuration Modal */}
        {(() => {
          if (!configuringSubjectId) return null;
          const sub = subjects.find(s => s.id === configuringSubjectId);
          if (!sub) return null;

          const canEdit = user && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'academic'].includes(user.role);

          const handleUpdateSubjectInModal = (fields: any) => {
            setSubjects(subjects.map(s => s.id === sub.id ? { ...s, ...fields } : s));
          };

          const handleAddHostSession = () => {
            const sessions = sub.host_sessions || [];
            const nextSessionNum = sessions.length + 1;
            const newSession = {
              id: 'session_' + Date.now() + '_' + nextSessionNum,
              name: `Session ${nextSessionNum}`,
              date: '',
              time_start: '20:00',
              time_end: '22:00',
              lecturer_name: ''
            };
            handleUpdateSubjectInModal({ host_sessions: [...sessions, newSession] });
          };

          const handleAddSeminar = () => {
            const seminars = sub.seminars || [];
            const newSem = {
              id: 'sem_' + Date.now(),
              topic: '',
              date: '',
              time_slot: '8:30 – 11:30 & 13:30 – 16:30',
              lecturer_id: sub.lecturer_id || '',
              location: 'Trực tuyến qua Zoom'
            };
            handleUpdateSubjectInModal({ seminars: [...seminars, newSem] });
          };

          const handleAddAssignment = () => {
            const assignments = sub.assignments || [];
            const newAsm = {
              id: 'asm_' + Date.now(),
              name: '',
              due_date: ''
            };
            handleUpdateSubjectInModal({ assignments: [...assignments, newAsm] });
          };

          const handleSaveConfig = async () => {
            try {
              setIsSaving(true);
              const res = await fetchAPI(`campaigns/${editingCampaign.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                  ...editingCampaign,
                  subjects_json: JSON.stringify(subjects)
                })
              });
              if (res.success) {
                addToast('Lưu cấu hình môn học thành công!', 'success');
                setEditingCampaign({
                  ...editingCampaign,
                  subjects_json: JSON.stringify(subjects)
                });
                loadCampaigns();
                setConfiguringSubjectId(null);
              } else {
                addToast(res.message || 'Lỗi lưu thông tin', 'error');
              }
            } catch (e: any) {
              addToast(e.message || 'Lỗi kết nối', 'error');
            } finally {
              setIsSaving(false);
            }
          };

          const saveButton = (
            <button
              type="button"
              className="btn primary sm"
              style={{ borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', border: 'none', height: '34px', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 16px' }}
              disabled={isSaving}
              onClick={handleSaveConfig}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          );

          return renderDrawer(
            !!configuringSubjectId,
            () => setConfiguringSubjectId(null),
            `Cấu hình Lịch học: Môn ${sub.code || ''} - ${sub.name || 'Chưa đặt tên'}`,
            (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.25rem 0' }}>

                {/* Modal Basic Info Inputs */}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'var(--color-bg-light)', padding: '16px 20px', borderRadius: '14px', border: '1px solid var(--color-border-light)' }}>
                  <div style={{ flex: '1 1 150px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Mã môn học</label>
                    <input
                      type="text"
                      placeholder="E0729"
                      disabled={!canEdit}
                      value={sub.code || ''}
                      onChange={e => handleUpdateSubjectInModal({ code: e.target.value })}
                      style={{ width: '100%', padding: '8px 14px', fontSize: '0.88rem', borderRadius: '10px', border: '1px solid var(--color-border-light)', height: '42px' }}
                    />
                  </div>
                  <div style={{ flex: '2 1 280px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Tên môn học</label>
                    <input
                      type="text"
                      placeholder="Leadership Development"
                      disabled={!canEdit}
                      value={sub.name || ''}
                      onChange={e => handleUpdateSubjectInModal({ name: e.target.value })}
                      style={{ width: '100%', padding: '8px 14px', fontSize: '0.88rem', borderRadius: '10px', border: '1px solid var(--color-border-light)', height: '42px' }}
                    />
                  </div>
                  <div style={{ flex: '1.5 1 220px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Giảng viên chuyên đề</label>
                    <CustomSelect
                      disabled={!canEdit}
                      options={[
                        { value: '', label: '-- Chọn giảng viên --' },
                        ...companiesList.map(c => ({
                          value: String(c.id),
                          label: c.name,
                          avatar: c.logo || c.avatar_url || '',
                          sublabel: [c.company_code, c.phone].filter(Boolean).join(' - ')
                        }))
                      ]}
                      value={sub.lecturer_id ? String(sub.lecturer_id) : ''}
                      onChange={val => handleUpdateSubjectInModal({ lecturer_id: val })}
                      placeholder="Chọn giảng viên..."
                      searchable
                      showAvatars
                    />
                  </div>
                </div>

                {/* Modal Inner Tab Buttons */}
                <div style={{ 
                  display: 'flex', 
                  borderBottom: '1px solid var(--color-border-light)', 
                  gap: '1.5rem', 
                  paddingBottom: 0,
                  marginBottom: '1.25rem'
                }}>
                  {[
                    { id: 'school', label: '1. Lịch học với trường', count: sub.host_sessions?.length || 0 },
                    { id: 'seminar', label: '2. Lớp chuyên đề (IDEAS)', count: sub.seminars?.length || 0 },
                    { id: 'zoom', label: '3. Zoom Meeting', count: (sub.zoom_link || sub.zoom_id || sub.zoom_pass) ? 1 : 0 },
                    { id: 'quiz', label: '4. Bài tập / Quiz / Bài thi', count: sub.assignments?.length || 0 }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveConfigTab(t.id as any)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '0 4px 10px 4px',
                        border: 'none',
                        background: 'transparent',
                        fontSize: '0.85rem',
                        fontWeight: 750,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        color: activeConfigTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        borderBottom: activeConfigTab === t.id ? '2.5px solid var(--color-primary)' : '2.5px solid transparent'
                      }}
                    >
                      <span>{t.label}</span>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '2px 6px', 
                        background: activeConfigTab === t.id ? 'var(--color-primary)' : 'var(--color-bg-light)', 
                        color: activeConfigTab === t.id ? '#ffffff' : 'var(--color-text-muted)', 
                        borderRadius: '100px', 
                        marginLeft: '4px',
                        fontWeight: 700 
                      }}>
                        {t.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Sub-tab Content Area */}
                <div style={{ minHeight: '480px', maxHeight: '650px', overflowY: 'auto', paddingRight: '4px' }}>

                  {/* Tab 1: School Sessions */}
                  {activeConfigTab === 'school' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Danh sách các buổi học UMEF (Swiss Time)</span>
                        {canEdit && (
                          <button type="button" className="btn secondary" style={{ height: '36px', padding: '0 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleAddHostSession}>
                            <Plus size={14} /> Thêm buổi học
                          </button>
                        )}
                      </div>

                      {(!sub.host_sessions || sub.host_sessions.length === 0) ? (
                        <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--color-bg-light)', borderRadius: '12px', border: '1px dashed var(--color-border-light)' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa thiết lập buổi học nào. Hãy bấm "+ Thêm buổi học" để cấu hình.</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sub.host_sessions.map((hs: any, hsIdx: number) => {
                            const hsTime = `${hs.time_start || '20:00'} - ${hs.time_end || '22:00'}`;
                            const conflict = checkLecturerConflict(hs.lecturer_name || sub.lecturer_id, hs.date, hsTime, sub.id, hs.id || `hs_${hsIdx}`);
                            return (
                              <div key={hs.id || hsIdx} style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
                                  <input
                                    type="text"
                                    placeholder="Session..."
                                    disabled={!canEdit}
                                    value={hs.name || ''}
                                    onChange={e => {
                                      const newSessions = [...sub.host_sessions];
                                      newSessions[hsIdx].name = e.target.value;
                                      handleUpdateSubjectInModal({ host_sessions: newSessions });
                                    }}
                                    style={{ width: '90px', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                  />

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 140px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>Ngày:</span>
                                    <input
                                      type="date"
                                      disabled={!canEdit}
                                      value={hs.date || ''}
                                      onChange={e => {
                                        const newSessions = [...sub.host_sessions];
                                        newSessions[hsIdx].date = e.target.value;
                                        handleUpdateSubjectInModal({ host_sessions: newSessions });
                                      }}
                                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                    />
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input
                                      type="text"
                                      disabled={!canEdit}
                                      value={hs.time_start || '20:00'}
                                      onChange={e => {
                                        const newSessions = [...sub.host_sessions];
                                        newSessions[hsIdx].time_start = e.target.value;
                                        handleUpdateSubjectInModal({ host_sessions: newSessions });
                                      }}
                                      style={{ width: '55px', padding: '6px 4px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px', textAlign: 'center' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>-</span>
                                    <input
                                      type="text"
                                      disabled={!canEdit}
                                      value={hs.time_end || '22:00'}
                                      onChange={e => {
                                        const newSessions = [...sub.host_sessions];
                                        newSessions[hsIdx].time_end = e.target.value;
                                        handleUpdateSubjectInModal({ host_sessions: newSessions });
                                      }}
                                      style={{ width: '55px', padding: '6px 4px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px', textAlign: 'center' }}
                                    />
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1.2 1 180px' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>Giảng viên Zoom:</span>
                                    <input
                                      type="text"
                                      placeholder="Nhập tên giảng viên..."
                                      disabled={!canEdit}
                                      value={hs.lecturer_name || ''}
                                      onChange={e => {
                                        const newSessions = [...sub.host_sessions];
                                        newSessions[hsIdx].lecturer_name = e.target.value;
                                        handleUpdateSubjectInModal({ host_sessions: newSessions });
                                      }}
                                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                    />
                                  </div>

                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateSubjectInModal({ host_sessions: sub.host_sessions.filter((_: any, idx: number) => idx !== hsIdx) });
                                      }}
                                      style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '6px' }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                                {conflict && (
                                  <div style={{ color: 'var(--color-danger)', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.05)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                    <AlertCircle size={12} style={{ flexShrink: 0 }} />
                                    <span>Cảnh báo trùng lịch: Giảng viên này đã có lịch dạy lớp {conflict.type} ở khóa {conflict.course} ({conflict.subject}) vào lúc {conflict.time} cùng ngày!</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 2: Vietnam Seminars */}
                  {activeConfigTab === 'seminar' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Danh sách lớp chuyên đề IDEAS (VN Time)</span>
                        {canEdit && (
                          <button type="button" className="btn secondary" style={{ height: '36px', padding: '0 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleAddSeminar}>
                            <Plus size={14} /> Thêm chuyên đề
                          </button>
                        )}
                      </div>

                      {(!sub.seminars || sub.seminars.length === 0) ? (
                        <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--color-bg-light)', borderRadius: '12px', border: '1px dashed var(--color-border-light)' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa thiết lập lớp chuyên đề.</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {sub.seminars.map((sem: any, sIdx: number) => (
                            <div key={sem.id || sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <div style={{ flex: '2 1 200px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '3px' }}>Nội dung chuyên đề</label>
                                  <input
                                    type="text"
                                    placeholder="Hướng dẫn MBA..."
                                    disabled={!canEdit}
                                    value={sem.topic || ''}
                                    onChange={e => {
                                      const newSeminars = [...sub.seminars];
                                      newSeminars[sIdx].topic = e.target.value;
                                      handleUpdateSubjectInModal({ seminars: newSeminars });
                                    }}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                  />
                                </div>
                                <div style={{ flex: '1 1 120px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '3px' }}>Ngày học</label>
                                  <input
                                    type="date"
                                    disabled={!canEdit}
                                    value={sem.date || ''}
                                    onChange={e => {
                                      const newSeminars = [...sub.seminars];
                                      newSeminars[sIdx].date = e.target.value;
                                      handleUpdateSubjectInModal({ seminars: newSeminars });
                                    }}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                  />
                                </div>
                                {(() => {
                                  const parsedTime = { ...parseSeminarTimeSlot(sem.time_slot), ...sem };

                                  const updateTimeSlotFields = (updates: any) => {
                                    const nextMerged = { ...parsedTime, ...updates };
                                    const newSeminars = [...sub.seminars];
                                    newSeminars[sIdx] = {
                                      ...newSeminars[sIdx],
                                      ...updates,
                                      time_slot: formatSeminarTimeSlot(
                                        nextMerged.sessions_count,
                                        nextMerged.session1_start,
                                        nextMerged.session1_end,
                                        nextMerged.session2_start,
                                        nextMerged.session2_end
                                      )
                                    };
                                    handleUpdateSubjectInModal({ seminars: newSeminars });
                                  };

                                  return (
                                    <>
                                      <div style={{ flex: '1 1 110px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '3px' }}>Số buổi</label>
                                        <CustomSelect
                                          disabled={!canEdit}
                                          options={[
                                            { value: '1', label: '1 buổi' },
                                            { value: '2', label: '2 buổi' }
                                          ]}
                                          value={String(parsedTime.sessions_count)}
                                          onChange={val => updateTimeSlotFields({ sessions_count: Number(val) })}
                                        />
                                      </div>
                                      <div style={{ flex: '2 1 200px' }}>
                                        <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '3px' }}>Giờ học thực tế</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', width: '38px' }}>Buổi 1:</span>
                                            <input
                                              type="time"
                                              disabled={!canEdit}
                                              value={parsedTime.session1_start}
                                              onChange={e => updateTimeSlotFields({ session1_start: e.target.value })}
                                              style={{ width: '80px', padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border-light)', height: '26px' }}
                                            />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>-</span>
                                            <input
                                              type="time"
                                              disabled={!canEdit}
                                              value={parsedTime.session1_end}
                                              onChange={e => updateTimeSlotFields({ session1_end: e.target.value })}
                                              style={{ width: '80px', padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border-light)', height: '26px' }}
                                            />
                                          </div>
                                          {Number(parsedTime.sessions_count) === 2 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', width: '38px' }}>Buổi 2:</span>
                                              <input
                                                type="time"
                                                disabled={!canEdit}
                                                value={parsedTime.session2_start}
                                                onChange={e => updateTimeSlotFields({ session2_start: e.target.value })}
                                                style={{ width: '80px', padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border-light)', height: '26px' }}
                                              />
                                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>-</span>
                                              <input
                                                type="time"
                                                disabled={!canEdit}
                                                value={parsedTime.session2_end}
                                                onChange={e => updateTimeSlotFields({ session2_end: e.target.value })}
                                                style={{ width: '80px', padding: '4px 6px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--color-border-light)', height: '26px' }}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>

                              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: '1 1 180px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '3px' }}>Giảng viên</label>
                                  <CustomSelect
                                    disabled={!canEdit}
                                    options={[
                                      { value: '', label: '-- Chọn giảng viên --' },
                                      ...companiesList.map(c => ({
                                        value: String(c.id),
                                        label: c.name,
                                        avatar: c.logo || c.avatar_url || '',
                                        sublabel: [c.company_code, c.phone].filter(Boolean).join(' - ')
                                      }))
                                    ]}
                                    value={sem.lecturer_id ? String(sem.lecturer_id) : ''}
                                    onChange={val => {
                                      const newSeminars = [...sub.seminars];
                                      newSeminars[sIdx].lecturer_id = val;
                                      handleUpdateSubjectInModal({ seminars: newSeminars });
                                    }}
                                    placeholder="Chọn giảng viên..."
                                    searchable
                                    showAvatars
                                  />
                                </div>
                                <div style={{ flex: '1.5 1 200px' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '3px' }}>Địa điểm học</label>
                                  <input
                                    type="text"
                                    placeholder="Online hoặc địa chỉ..."
                                    disabled={!canEdit}
                                    value={sem.location || ''}
                                    onChange={e => {
                                      const newSeminars = [...sub.seminars];
                                      newSeminars[sIdx].location = e.target.value;
                                      handleUpdateSubjectInModal({ seminars: newSeminars });
                                    }}
                                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                  />
                                </div>
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="btn secondary sm"
                                    style={{ height: '34px', width: '34px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--color-danger)', border: '1px solid var(--color-border-light)' }}
                                    onClick={() => {
                                      handleUpdateSubjectInModal({ seminars: sub.seminars.filter((_: any, idx: number) => idx !== sIdx) });
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                              {(() => {
                                const semTime = sem.time_slot || (sem.time_start && sem.time_end ? `${sem.time_start} - ${sem.time_end}` : '08:30 - 11:30');
                                const conflict = checkLecturerConflict(sem.lecturer_id || sub.lecturer_id, sem.date, semTime, sub.id, sem.id || `sem_${sIdx}`);
                                if (conflict) {
                                  return (
                                    <div style={{ color: 'var(--color-danger)', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.05)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.15)', marginTop: '8px' }}>
                                      <AlertCircle size={12} style={{ flexShrink: 0 }} />
                                      <span>Cảnh báo trùng lịch: Giảng viên này đã có lịch dạy lớp {conflict.type} ở khóa {conflict.course} ({conflict.subject}) vào lúc {conflict.time} cùng ngày!</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Zoom Meeting */}
                  {activeConfigTab === 'zoom' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                      {/* Zoom Toggle Switch */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--color-border-light)' }}>
                        <div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', display: 'block' }}>Tài khoản Zoom Meeting dùng chung</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px', display: 'block' }}>Bật để dùng chung một Zoom cho cả lịch trường và chuyên đề. Tắt để cấu hình liên kết riêng biệt.</span>
                        </div>
                        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                          <input 
                            type="checkbox" 
                            disabled={!canEdit}
                            checked={sub.zoom_shared !== false} 
                            onChange={e => handleUpdateSubjectInModal({ zoom_shared: e.target.checked })}
                            style={{ display: 'none' }}
                          />
                          <div style={{
                            width: '44px',
                            height: '24px',
                            backgroundColor: (sub.zoom_shared !== false) ? 'var(--color-primary)' : '#cbd5e1',
                            borderRadius: '100px',
                            position: 'relative',
                            transition: 'background-color 0.2s ease',
                          }}>
                            <div style={{
                              width: '18px',
                              height: '18px',
                              backgroundColor: '#ffffff',
                              borderRadius: '50%',
                              position: 'absolute',
                              top: '3px',
                              left: (sub.zoom_shared !== false) ? '23px' : '3px',
                              transition: 'left 0.2s ease',
                              boxShadow: 'var(--shadow-xs)'
                            }} />
                          </div>
                        </label>
                      </div>

                      {/* Zoom details */}
                      {sub.zoom_shared !== false ? (
                        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>Thông tin Zoom dùng chung</span>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ flex: '2 1 240px' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Đường dẫn Zoom Link</label>
                              <input
                                type="text"
                                placeholder="https://us02web.zoom.us/j/..."
                                disabled={!canEdit}
                                value={sub.zoom_link || ''}
                                onChange={e => handleUpdateSubjectInModal({ zoom_link: e.target.value })}
                                style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                              />
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Meeting ID</label>
                              <input
                                type="text"
                                placeholder="306 909 7520"
                                disabled={!canEdit}
                                value={sub.zoom_id || ''}
                                onChange={e => handleUpdateSubjectInModal({ zoom_id: e.target.value })}
                                style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                              />
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Passcode</label>
                              <input
                                type="text"
                                placeholder="umef@812"
                                disabled={!canEdit}
                                value={sub.zoom_pass || ''}
                                onChange={e => handleUpdateSubjectInModal({ zoom_pass: e.target.value })}
                                style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {/* School Zoom Account */}
                          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>1. Zoom Lớp học với trường (Swiss UMEF)</span>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ flex: '2 1 240px' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Đường dẫn Zoom Link (Trường)</label>
                                <input
                                  type="text"
                                  placeholder="https://us02web.zoom.us/j/..."
                                  disabled={!canEdit}
                                  value={sub.school_zoom_link || ''}
                                  onChange={e => handleUpdateSubjectInModal({ school_zoom_link: e.target.value })}
                                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                                />
                              </div>
                              <div style={{ flex: '1 1 120px' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Meeting ID</label>
                                <input
                                  type="text"
                                  placeholder="306 909 7520"
                                  disabled={!canEdit}
                                  value={sub.school_zoom_id || ''}
                                  onChange={e => handleUpdateSubjectInModal({ school_zoom_id: e.target.value })}
                                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                                />
                              </div>
                              <div style={{ flex: '1 1 100px' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Passcode</label>
                                <input
                                  type="text"
                                  placeholder="umef@812"
                                  disabled={!canEdit}
                                  value={sub.school_zoom_pass || ''}
                                  onChange={e => handleUpdateSubjectInModal({ school_zoom_pass: e.target.value })}
                                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Seminar Zoom Account */}
                          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>2. Zoom Lớp chuyên đề (IDEAS)</span>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ flex: '2 1 240px' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Đường dẫn Zoom Link (Chuyên đề)</label>
                                <input
                                  type="text"
                                  placeholder="https://us02web.zoom.us/j/..."
                                  disabled={!canEdit}
                                  value={sub.seminar_zoom_link || ''}
                                  onChange={e => handleUpdateSubjectInModal({ seminar_zoom_link: e.target.value })}
                                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                                />
                              </div>
                              <div style={{ flex: '1 1 120px' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Meeting ID</label>
                                <input
                                  type="text"
                                  placeholder="306 909 7520"
                                  disabled={!canEdit}
                                  value={sub.seminar_zoom_id || ''}
                                  onChange={e => handleUpdateSubjectInModal({ seminar_zoom_id: e.target.value })}
                                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                                />
                              </div>
                              <div style={{ flex: '1 1 100px' }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-light)', display: 'block', marginBottom: '4px' }}>Passcode</label>
                                <input
                                  type="text"
                                  placeholder="umef@812"
                                  disabled={!canEdit}
                                  value={sub.seminar_zoom_pass || ''}
                                  onChange={e => handleUpdateSubjectInModal({ seminar_zoom_pass: e.target.value })}
                                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid var(--color-border-light)', height: '38px' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 4: Homework & Quiz */}
                  {activeConfigTab === 'quiz' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                      {/* Quiz & Assignment list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Danh sách bài tập / Quiz / Bài thi</span>
                          {canEdit && (
                            <button type="button" className="btn secondary" style={{ height: '36px', padding: '0 16px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handleAddAssignment}>
                              <Plus size={14} /> Thêm bài tập
                            </button>
                          )}
                        </div>

                        {(!sub.assignments || sub.assignments.length === 0) ? (
                          <div style={{ padding: '3rem 2rem', textAlign: 'center', background: 'var(--color-bg-light)', borderRadius: '12px', border: '1px dashed var(--color-border-light)' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-light)', fontStyle: 'italic' }}>Chưa thiết lập bài tập nào.</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sub.assignments.map((asm: any, aIdx: number) => (
                              <div key={asm.id || aIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border-light)', boxShadow: 'var(--shadow-sm)' }}>
                                <input
                                  type="text"
                                  placeholder="Tên bài tập (ví dụ: Quiz 1, Final Exam...)"
                                  disabled={!canEdit}
                                  value={asm.name || ''}
                                  onChange={e => {
                                    const newAsms = [...sub.assignments];
                                    newAsms[aIdx].name = e.target.value;
                                    handleUpdateSubjectInModal({ assignments: newAsms });
                                  }}
                                  style={{ flex: 2, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                />

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 180px' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', whiteSpace: 'nowrap' }}>Hạn nộp:</span>
                                  <input
                                    type="datetime-local"
                                    disabled={!canEdit}
                                    value={asm.due_date || ''}
                                    onChange={e => {
                                      const newAsms = [...sub.assignments];
                                      newAsms[aIdx].due_date = e.target.value;
                                      handleUpdateSubjectInModal({ assignments: newAsms });
                                    }}
                                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid var(--color-border-light)', height: '34px' }}
                                  />
                                </div>

                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateSubjectInModal({ assignments: sub.assignments.filter((_: any, idx: number) => idx !== aIdx) });
                                    }}
                                    style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '6px' }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}
                </div>

              </div>
            ),
            '1000px',
            saveButton,
            false,
            true
          );
        })()}

        {/* Preview Announcement Text Modal */}
        <CustomModal
          isOpen={showNotifModal}
          onClose={() => setShowNotifModal(false)}
          title="Mẫu thông báo học vụ (Preview)"
          width="600px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Mẫu tin nhắn sau đây đã được sao chép tự động vào Clipboard của bạn. Bạn có thể dán (Ctrl+V) trực tiếp vào Zalo hoặc Telegram:
            </p>
            <textarea
              readOnly
              value={notifText}
              style={{
                width: '100%',
                height: '350px',
                padding: '12px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border-light)',
                background: 'var(--color-bg-light)',
                resize: 'none',
                lineHeight: 1.5
              }}
              onClick={e => (e.target as any).select()}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn secondary sm"
                style={{ borderRadius: '8px', fontWeight: 700 }}
                onClick={() => setShowNotifModal(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn primary sm"
                style={{ borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)' }}
                onClick={() => {
                  navigator.clipboard.writeText(notifText).then(() => {
                    addToast('Đã sao chép mẫu thông báo thành công!', 'success');
                  });
                }}
              >
                Sao chép lại
              </button>
            </div>
          </div>
        </CustomModal>

        {/* Copy Subject to Other Courses Modal */}
        <CustomModal
          isOpen={isCopySubjectModalOpen}
          onClose={() => {
            setIsCopySubjectModalOpen(false);
            setSubjectToCopy(null);
          }}
          title={`Sao chép môn học: ${subjectToCopy?.name || ''}`}
          width="500px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Chọn khóa học (Campaign) đích để import cấu hình môn học này (bao gồm cả các buổi học trường, chuyên đề và bài tập).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>Khóa học nhận môn học:</label>
              <CustomSelect
                options={[
                  { value: '', label: 'Chọn khóa học...' },
                  ...campaigns
                    .filter(c => c.status === 'active' && (editingCampaign ? c.id !== editingCampaign.id : true))
                    .map(c => ({ value: String(c.id), label: `${c.name} (ID: ${c.id})` }))
                ]}
                value={copyTargetCampaignId}
                onChange={val => setCopyTargetCampaignId(val)}
                placeholder="Chọn khóa học đích..."
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--color-border-light)', paddingTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)' }}>Khi trùng mã môn học ở khóa học đích:</label>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="copy-conflict-mode"
                    checked={copyConflictMode === 'replace'}
                    onChange={() => setCopyConflictMode('replace')}
                    style={{ cursor: 'pointer' }}
                  />
                  Ghi đè (Replace)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="copy-conflict-mode"
                    checked={copyConflictMode === 'add'}
                    onChange={() => setCopyConflictMode('add')}
                    style={{ cursor: 'pointer' }}
                  />
                  Thêm mới
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn secondary sm"
                style={{ borderRadius: '8px', fontWeight: 700 }}
                onClick={() => {
                  setIsCopySubjectModalOpen(false);
                  setSubjectToCopy(null);
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn primary sm"
                style={{ borderRadius: '8px', fontWeight: 700, background: 'var(--color-primary)', border: 'none' }}
                disabled={isCopyingSubject || !copyTargetCampaignId}
                onClick={handleConfirmCopySubject}
              >
                {isCopyingSubject ? 'Đang sao chép...' : 'Xác nhận sao chép'}
              </button>
            </div>
          </div>
        </CustomModal>

        {selectedContactForDrawer && (
          <Suspense fallback={null}>
            <CustomerProfileDrawer
              isOpen={!!selectedContactForDrawer}
              onClose={() => setSelectedContactForDrawer(null)}
              contact={selectedContactForDrawer}
              onUpdate={() => {
                window.dispatchEvent(new CustomEvent('contact-updated'));
              }}
              zIndex={selectedTaskForDrawer ? 1000300 : undefined}
            />
          </Suspense>
        )}
        {isLecturerDrawerOpen && selectedLecturerEntity && (
          <CompanyDrawer
            isOpen={isLecturerDrawerOpen}
            onClose={() => {
              setIsLecturerDrawerOpen(false);
              setSelectedLecturerEntity(null);
            }}
            entity={selectedLecturerEntity}
            onSave={() => loadProjects()}
          />
        )}
      </div>
      );
}

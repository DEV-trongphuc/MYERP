import { 
  FileText, FileSpreadsheet, FileArchive, FileCode, Film, Music, type LucideIcon 
} from 'lucide-react';

export interface FileFormatConfig {
  badge: string;
  bg: string;
  text: string;
  darkText: string;
  border: string;
  icon: LucideIcon;
  isAudio: boolean;
  isVideo: boolean;
  isImage: boolean;
}

export const getFileFormatConfig = (fileName: string): FileFormatConfig => {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  if (['pdf'].includes(ext)) {
    return {
      badge: 'PDF',
      bg: '#fee2e2',
      text: '#dc2626',
      darkText: '#991b1b',
      border: '#fca5a5',
      icon: FileText,
      isAudio: false,
      isVideo: false,
      isImage: false
    };
  }

  if (['xls', 'xlsx'].includes(ext)) {
    return {
      badge: 'EXCEL',
      bg: '#dcfce7',
      text: '#15803d',
      darkText: '#166534',
      border: '#86efac',
      icon: FileSpreadsheet,
      isAudio: false,
      isVideo: false,
      isImage: false
    };
  }

  if (['csv'].includes(ext)) {
    return {
      badge: 'CSV',
      bg: '#d1fae5',
      text: '#059669',
      darkText: '#065f46',
      border: '#6ee7b7',
      icon: FileSpreadsheet,
      isAudio: false,
      isVideo: false,
      isImage: false
    };
  }

  if (['doc', 'docx', 'odt'].includes(ext)) {
    return {
      badge: 'WORD',
      bg: '#dbeafe',
      text: '#1d4ed8',
      darkText: '#1e40af',
      border: '#93c5fd',
      icon: FileText,
      isAudio: false,
      isVideo: false,
      isImage: false
    };
  }

  if (['ppt', 'pptx'].includes(ext)) {
    return {
      badge: 'PPT',
      bg: '#ffedd5',
      text: '#c2410c',
      darkText: '#9a3412',
      border: '#fdba74',
      icon: FileText,
      isAudio: false,
      isVideo: false,
      isImage: false
    };
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return {
      badge: ext.toUpperCase() === 'ZIP' ? 'ZIP' : ext.toUpperCase(),
      bg: '#ede9fe',
      text: '#6d28d9',
      darkText: '#5b21b6',
      border: '#c4b5fd',
      icon: FileArchive,
      isAudio: false,
      isVideo: false,
      isImage: false
    };
  }

  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) {
    return {
      badge: 'AUDIO',
      bg: '#fae8ff',
      text: '#a21caf',
      darkText: '#86198f',
      border: '#f0abfc',
      icon: Music,
      isAudio: true,
      isVideo: false,
      isImage: false
    };
  }

  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) {
    return {
      badge: 'VIDEO',
      bg: '#e0f2fe',
      text: '#0369a1',
      darkText: '#075985',
      border: '#7dd3fc',
      icon: Film,
      isAudio: false,
      isVideo: true,
      isImage: false
    };
  }

  if (['js', 'jsx', 'ts', 'tsx', 'py', 'php', 'sql', 'html', 'css', 'json', 'vue', 'sh'].includes(ext)) {
    return {
      badge: ext.toUpperCase(),
      bg: '#e0e7ff',
      text: '#4338ca',
      darkText: '#3730a3',
      border: '#a5b4fc',
      icon: FileCode,
      isAudio: false,
      isVideo: false,
      isImage: false
    };
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return {
      badge: ext.toUpperCase(),
      bg: '#fef3c7',
      text: '#b45309',
      darkText: '#92400e',
      border: '#fde68a',
      icon: FileText,
      isAudio: false,
      isVideo: false,
      isImage: true
    };
  }

  return {
    badge: ext ? ext.toUpperCase() : 'FILE',
    bg: '#f1f5f9',
    text: '#475569',
    darkText: '#334155',
    border: '#cbd5e1',
    icon: FileText,
    isAudio: false,
    isVideo: false,
    isImage: false
  };
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const extractFirstUrl = (text?: string): string | null => {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s()<>]+/i);
  return match ? match[0] : null;
};

export const formatStaffCleanTitle = (user?: { job_title?: string; role?: string; team_name?: string } | null): string => {
  if (!user) return 'Nhân sự';
  const roleMap: Record<string, string> = {
    director: 'Giám đốc',
    superadmin: 'Quản trị cấp cao',
    super_admin: 'Quản trị cấp cao',
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    sales: 'Chuyên viên Tư vấn',
    sale_admin: 'Sale Admin',
    academic: 'Học vụ',
    accountant: 'Kế toán',
    staff: 'Nhân viên'
  };

  const isCodeRole = (val?: string) => {
    if (!val) return true;
    const v = val.toLowerCase().trim();
    return Boolean(roleMap[v]) || ['user'].includes(v);
  };

  const rawTitle = (user.job_title || '').trim();
  const rawRole = (user.role || '').toLowerCase().trim();
  const title = (!isCodeRole(rawTitle) && rawTitle) ? rawTitle : (roleMap[rawRole] || rawTitle || 'Nhân sự');
  const team = (user.team_name || '').trim();

  if (title && team && title.toLowerCase() !== team.toLowerCase()) {
    return `${title} • ${team}`;
  }
  return title || team || 'Nhân sự';
};

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Globe, Lock, Users, ShieldCheck, X, Search, Check, Building2,
    UserCheck, Eye, Edit3, Sparkles, Loader2, Layers
} from 'lucide-react';
import erpApi from '../../../../api/axios';
import { Avatar } from '../../../ui/Avatar';
import { getMktPortalRoot } from '../../utils/portalRoot';

export type TemplateVisibilityMode = 'shared' | 'personal' | 'custom' | 'system';

export interface TemplateAccessConfig {
    visibility: TemplateVisibilityMode;
    allowed_user_ids: number[];
    allowed_team_ids: number[];
    allowed_departments: string[];
    permission: 'use' | 'edit';
}

export interface ErpUserItem {
    id: number;
    full_name: string;
    name?: string;
    email: string;
    role: string;
    job_title?: string;
    department?: string;
    team_id?: number | null;
    avatar_url?: string | null;
}

export interface ErpTeamItem {
    id: number;
    name: string;
    leader_id?: number | null;
    leader_name?: string | null;
    description?: string | null;
    branch?: string | null;
    member_count?: number;
}

const STANDARD_DEPARTMENTS = [
    'Kinh doanh / Tuyển sinh',
    'Marketing',
    'Đào tạo / Học vụ',
    'Chăm sóc khách hàng',
    'Kế toán - Tài chính',
    'Nhân sự - Hành chính',
    'Ban Giám đốc',
];

export function resolveUserStandardDepartment(u?: any): string {
    if (!u) return '';
    if (typeof u.department === 'string' && u.department.trim()) {
        return u.department.trim();
    }
    if (u.extra_fields_json) {
        try {
            const parsed = typeof u.extra_fields_json === 'string'
                ? JSON.parse(u.extra_fields_json)
                : u.extra_fields_json;
            if (parsed?.department && typeof parsed.department === 'string' && parsed.department.trim()) {
                return parsed.department.trim();
            }
        } catch {
            // ignore JSON parse error
        }
    }
    const r = String(u.role || '').toLowerCase().trim();
    if (['sale', 'sales', 'leader', 'team_leader', 'sale_admin', 'saleadmin'].includes(r)) {
        return 'Kinh doanh / Tuyển sinh';
    }
    if (['marketing', 'mkt', 'digital_marketing', 'content', 'ads'].includes(r)) {
        return 'Marketing';
    }
    if (r === 'accountant') return 'Kế toán - Tài chính';
    if (r === 'hr') return 'Nhân sự - Hành chính';
    if (['admin', 'superadmin', 'super_admin', 'director'].includes(r)) {
        return 'Ban Giám đốc';
    }
    if (r === 'manager') return 'Đào tạo / Học vụ';
    if (r === 'assistant') return 'Chăm sóc khách hàng';
    return 'Khác';
}

export function normalizeTemplateAccessConfig(
    tpl?: any,
    defaultVisibility: TemplateVisibilityMode = 'shared'
): TemplateAccessConfig {
    if (!tpl) {
        return {
            visibility: defaultVisibility,
            allowed_user_ids: [],
            allowed_team_ids: [],
            allowed_departments: [],
            permission: 'use',
        };
    }
    if (typeof tpl.id === 'string' && tpl.id.startsWith('sys_')) {
        return {
            visibility: 'system',
            allowed_user_ids: [],
            allowed_team_ids: [],
            allowed_departments: [],
            permission: 'use',
        };
    }
    const rawAccess = tpl.accessConfig || tpl.bodyStyle?.accessConfig || {};
    const rawVis = tpl.visibility || rawAccess.visibility || tpl.bodyStyle?.visibility || defaultVisibility;
    const visibility: TemplateVisibilityMode = ['shared', 'personal', 'custom', 'system'].includes(rawVis)
        ? rawVis
        : defaultVisibility;

    return {
        visibility,
        allowed_user_ids: Array.isArray(rawAccess.allowed_user_ids)
            ? rawAccess.allowed_user_ids.map((id: any) => Number(id)).filter((n: number) => n > 0)
            : [],
        allowed_team_ids: Array.isArray(rawAccess.allowed_team_ids)
            ? rawAccess.allowed_team_ids.map((id: any) => Number(id)).filter((n: number) => n > 0)
            : [],
        allowed_departments: Array.isArray(rawAccess.allowed_departments)
            ? rawAccess.allowed_departments.map((d: any) => String(d).trim()).filter(Boolean)
            : [],
        permission: rawAccess.permission === 'edit' ? 'edit' : 'use',
    };
}

export function countAccessTargets(config?: Partial<TemplateAccessConfig> | null): number {
    if (!config) return 0;
    return (
        (config.allowed_team_ids?.length || 0) +
        (config.allowed_departments?.length || 0) +
        (config.allowed_user_ids?.length || 0)
    );
}

export function isTemplateOwner(
    tpl: any,
    currentUserId?: number,
    currentUserEmail?: string,
    currentUserName?: string
): boolean {
    if (!tpl || (typeof tpl.id === 'string' && tpl.id.startsWith('sys_'))) return false;
    const createdBy = Number(tpl.created_by || tpl.bodyStyle?.creator?.id || tpl.creator?.id || 0);
    if (currentUserId && currentUserId > 0 && createdBy > 0 && createdBy === Number(currentUserId)) {
        return true;
    }
    const creatorEmail = String(tpl.creator?.email || tpl.bodyStyle?.creator?.email || '').trim().toLowerCase();
    if (currentUserEmail && creatorEmail && creatorEmail === currentUserEmail.trim().toLowerCase()) {
        return true;
    }
    const creatorName = String(
        tpl.creator?.name || tpl.creator?.full_name || tpl.bodyStyle?.creator?.name || tpl.bodyStyle?.creator?.full_name || ''
    ).trim().toLowerCase();
    const normUserName = String(currentUserName || '').trim().toLowerCase();
    if (normUserName && creatorName && creatorName !== 'hệ thống' && creatorName === normUserName) {
        return true;
    }
    return false;
}

export function canUserViewTemplate(tpl: any, erpUser: any, isAdmin: boolean): boolean {
    if (!tpl) return false;
    if (typeof tpl.id === 'string' && tpl.id.startsWith('sys_')) return true;
    if (isAdmin) return true;

    const uid = Number(erpUser?.id || 0);
    const uEmail = String(erpUser?.email || '');
    const uName = String(erpUser?.full_name || erpUser?.name || '');
    if (isTemplateOwner(tpl, uid, uEmail, uName)) return true;

    const cfg = normalizeTemplateAccessConfig(tpl);
    if (cfg.visibility === 'shared' || cfg.visibility === 'system') return true;
    if (cfg.visibility === 'personal') return false;

    if (cfg.visibility === 'custom') {
        if (uid > 0 && cfg.allowed_user_ids.includes(uid)) return true;
        const teamId = Number(erpUser?.team_id || 0);
        if (teamId > 0 && cfg.allowed_team_ids.includes(teamId)) return true;
        const userDept = resolveUserStandardDepartment(erpUser);
        if (userDept && cfg.allowed_departments.some(d => d.toLowerCase() === userDept.toLowerCase())) {
            return true;
        }
        return false;
    }
    return true;
}

export function canUserEditTemplate(tpl: any, erpUser: any, isAdmin: boolean): boolean {
    if (!tpl) return true;
    if (typeof tpl.id === 'string' && tpl.id.startsWith('sys_')) return false;
    if (isAdmin) return true;

    const uid = Number(erpUser?.id || 0);
    const uEmail = String(erpUser?.email || '');
    const uName = String(erpUser?.full_name || erpUser?.name || '');
    if (isTemplateOwner(tpl, uid, uEmail, uName)) return true;

    const cfg = normalizeTemplateAccessConfig(tpl);
    if (cfg.visibility === 'custom' && cfg.permission === 'edit') {
        if (uid > 0 && cfg.allowed_user_ids.includes(uid)) return true;
        const teamId = Number(erpUser?.team_id || 0);
        if (teamId > 0 && cfg.allowed_team_ids.includes(teamId)) return true;
        const userDept = resolveUserStandardDepartment(erpUser);
        if (userDept && cfg.allowed_departments.some(d => d.toLowerCase() === userDept.toLowerCase())) {
            return true;
        }
    }
    return false;
}

// ─── Module-level Directory Cache for 0ms Instant Modal Open ────────────────
let cachedUsers: ErpUserItem[] | null = null;
let cachedTeams: ErpTeamItem[] | null = null;
let directoryFetchPromise: Promise<{ users: ErpUserItem[]; teams: ErpTeamItem[] }> | null = null;

export function preloadAccessDirectory(): Promise<{ users: ErpUserItem[]; teams: ErpTeamItem[] }> {
    if (cachedUsers && cachedTeams) {
        return Promise.resolve({ users: cachedUsers, teams: cachedTeams });
    }
    if (directoryFetchPromise) return directoryFetchPromise;

    directoryFetchPromise = Promise.all([
        erpApi.get('/users').catch(() => ({ data: [] })),
        erpApi.get('/teams').catch(() => ({ data: [] })),
    ]).then(([uRes, tRes]) => {
        const rawUsers = Array.isArray(uRes?.data)
            ? uRes.data
            : Array.isArray(uRes?.data?.data)
                ? uRes.data.data
                : [];
        const rawTeams = Array.isArray(tRes?.data)
            ? tRes.data
            : Array.isArray(tRes?.data?.data)
                ? tRes.data.data
                : [];

        cachedUsers = rawUsers.map((u: any) => ({
            id: Number(u.id),
            full_name: u.full_name || u.name || u.username || 'Nhân viên',
            name: u.name || u.full_name || '',
            email: u.email || '',
            role: u.role || 'sale',
            job_title: u.job_title || '',
            department: resolveUserStandardDepartment(u),
            team_id: u.team_id ? Number(u.team_id) : null,
            avatar_url: u.avatar_url || u.avatar || null,
        })).filter((u: ErpUserItem) => u.id > 0);

        cachedTeams = rawTeams.map((t: any) => ({
            id: Number(t.id),
            name: t.name || `Team #${t.id}`,
            leader_id: t.leader_id ? Number(t.leader_id) : null,
            leader_name: t.leader_name || null,
            description: t.description || null,
            branch: t.branch || null,
            member_count: Number(t.member_count || 0),
        })).filter((t: ErpTeamItem) => t.id > 0);

        directoryFetchPromise = null;
        return { users: cachedUsers || [], teams: cachedTeams || [] };
    });

    return directoryFetchPromise;
}

interface TemplateAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    templateName?: string;
    value: TemplateAccessConfig;
    onSave: (nextConfig: TemplateAccessConfig) => void | Promise<void>;
    canSetShared?: boolean;
}

const TemplateAccessModal: React.FC<TemplateAccessModalProps> = ({
    isOpen,
    onClose,
    templateName = 'Mẫu thiết kế',
    value,
    onSave,
    canSetShared = true,
}) => {
    const [draft, setDraft] = useState<TemplateAccessConfig>(() => ({
        visibility: value.visibility === 'system' ? 'shared' : value.visibility,
        allowed_user_ids: [...(value.allowed_user_ids || [])],
        allowed_team_ids: [...(value.allowed_team_ids || [])],
        allowed_departments: [...(value.allowed_departments || [])],
        permission: value.permission || 'use',
    }));
    const [activeSubTab, setActiveSubTab] = useState<'teams' | 'departments' | 'users'>('teams');
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<ErpUserItem[]>(cachedUsers || []);
    const [teams, setTeams] = useState<ErpTeamItem[]>(cachedTeams || []);
    const [loadingDir, setLoadingDir] = useState(!cachedUsers || !cachedTeams);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setDraft({
            visibility: value.visibility === 'system' ? 'shared' : value.visibility,
            allowed_user_ids: [...(value.allowed_user_ids || [])],
            allowed_team_ids: [...(value.allowed_team_ids || [])],
            allowed_departments: [...(value.allowed_departments || [])],
            permission: value.permission || 'use',
        });
        setSearchQuery('');

        if (cachedUsers && cachedTeams) {
            setUsers(cachedUsers);
            setTeams(cachedTeams);
            setLoadingDir(false);
        } else {
            setLoadingDir(true);
            preloadAccessDirectory().then(({ users: uList, teams: tList }) => {
                setUsers(uList);
                setTeams(tList);
                setLoadingDir(false);
            });
        }
    }, [isOpen, value]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const departmentItems = useMemo(() => {
        const countMap = new Map<string, number>();
        STANDARD_DEPARTMENTS.forEach(d => countMap.set(d, 0));
        users.forEach(u => {
            const dept = u.department || 'Khác';
            countMap.set(dept, (countMap.get(dept) || 0) + 1);
        });
        return Array.from(countMap.entries())
            .filter(([name, cnt]) => STANDARD_DEPARTMENTS.includes(name) || cnt > 0)
            .map(([name, count]) => ({ name, count }));
    }, [users]);

    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return users;
        return users.filter(u =>
            u.full_name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.job_title || '').toLowerCase().includes(q) ||
            (u.department || '').toLowerCase().includes(q)
        );
    }, [users, searchQuery]);

    const selectedUserObjects = useMemo(() => {
        const idSet = new Set(draft.allowed_user_ids);
        return users.filter(u => idSet.has(u.id));
    }, [users, draft.allowed_user_ids]);

    const toggleTeam = (teamId: number) => {
        setDraft(prev => {
            const exists = prev.allowed_team_ids.includes(teamId);
            return {
                ...prev,
                allowed_team_ids: exists
                    ? prev.allowed_team_ids.filter(id => id !== teamId)
                    : [...prev.allowed_team_ids, teamId],
            };
        });
    };

    const toggleDepartment = (dept: string) => {
        setDraft(prev => {
            const exists = prev.allowed_departments.includes(dept);
            return {
                ...prev,
                allowed_departments: exists
                    ? prev.allowed_departments.filter(d => d !== dept)
                    : [...prev.allowed_departments, dept],
            };
        });
    };

    const toggleUser = (userId: number) => {
        setDraft(prev => {
            const exists = prev.allowed_user_ids.includes(userId);
            return {
                ...prev,
                allowed_user_ids: exists
                    ? prev.allowed_user_ids.filter(id => id !== userId)
                    : [...prev.allowed_user_ids, userId],
            };
        });
    };

    const handleSelectAllFilteredUsers = () => {
        const filteredIds = filteredUsers.map(u => u.id);
        setDraft(prev => ({
            ...prev,
            allowed_user_ids: Array.from(new Set([...prev.allowed_user_ids, ...filteredIds])),
        }));
    };

    const handleClearAllUsers = () => {
        setDraft(prev => ({ ...prev, allowed_user_ids: [] }));
    };

    const handleConfirm = async () => {
        setIsSaving(true);
        try {
            await onSave(draft);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const totalTargets = countAccessTargets(draft);

    const modalNode = (
        <div
            className="fixed inset-0 z-[2147483646] bg-black/60 backdrop-blur-[6px] flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ zIndex: 2147483646, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            <div
                className="bg-white w-full max-w-2xl rounded-[20px] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-[14px] bg-[#BD1D2D]/10 text-[#BD1D2D] flex items-center justify-center shrink-0 shadow-xs">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 leading-snug">
                                Phân quyền & Chia sẻ Mẫu thiết kế
                            </h3>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                Mẫu: <span className="font-semibold text-slate-700">{templateName || 'Thiết kế mới'}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors outline-none focus:outline-none cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                    {/* Section 1: 3 Visibility Mode Cards */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                            Chế độ hiển thị & Phạm vi truy cập
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {/* 1. Shared / Public */}
                            <button
                                type="button"
                                disabled={!canSetShared}
                                onClick={() => setDraft(prev => ({ ...prev, visibility: 'shared' }))}
                                className={`p-3.5 rounded-[16px] border text-left transition-all flex flex-col gap-2 relative outline-none focus:outline-none ${
                                    !canSetShared
                                        ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
                                        : draft.visibility === 'shared'
                                            ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/15 shadow-xs cursor-pointer'
                                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60 cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                        draft.visibility === 'shared'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-50 text-emerald-600'
                                    }`}>
                                        <Globe className="w-4 h-4" />
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        draft.visibility === 'shared'
                                            ? 'border-emerald-600 bg-emerald-600 text-white'
                                            : 'border-slate-300'
                                    }`}>
                                        {draft.visibility === 'shared' && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">Công khai (Toàn công ty)</div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                                        Toàn bộ nhân sự & đội ngũ Sale đều có thể xem và sử dụng
                                    </p>
                                </div>
                            </button>

                            {/* 2. Personal / Private */}
                            <button
                                type="button"
                                onClick={() => setDraft(prev => ({ ...prev, visibility: 'personal' }))}
                                className={`p-3.5 rounded-[16px] border text-left transition-all flex flex-col gap-2 relative outline-none focus:outline-none cursor-pointer ${
                                    draft.visibility === 'personal'
                                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/15 shadow-xs'
                                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                        draft.visibility === 'personal'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-amber-50 text-amber-600'
                                    }`}>
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        draft.visibility === 'personal'
                                            ? 'border-amber-500 bg-amber-500 text-white'
                                            : 'border-slate-300'
                                    }`}>
                                        {draft.visibility === 'personal' && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">Riêng tư — Chỉ mình tôi</div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                                        Chỉ người tạo và Quản trị viên mới có thể xem và chỉnh sửa
                                    </p>
                                </div>
                            </button>

                            {/* 3. Custom Granular Sharing */}
                            <button
                                type="button"
                                onClick={() => setDraft(prev => ({ ...prev, visibility: 'custom' }))}
                                className={`p-3.5 rounded-[16px] border text-left transition-all flex flex-col gap-2 relative outline-none focus:outline-none cursor-pointer ${
                                    draft.visibility === 'custom'
                                        ? 'border-[#BD1D2D] bg-[#BD1D2D]/[0.04] ring-2 ring-[#BD1D2D]/15 shadow-xs'
                                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                        draft.visibility === 'custom'
                                            ? 'bg-[#BD1D2D] text-white'
                                            : 'bg-rose-50 text-[#BD1D2D]'
                                    }`}>
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        draft.visibility === 'custom'
                                            ? 'border-[#BD1D2D] bg-[#BD1D2D] text-white'
                                            : 'border-slate-300'
                                    }`}>
                                        {draft.visibility === 'custom' && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">Tùy chỉnh đối tượng</div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                                        Chỉ định cụ thể Team, Phòng ban hoặc từng Nhân viên được truy cập
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Section 2: Multi-tier selector when visibility === 'custom' */}
                    {draft.visibility === 'custom' && (
                        <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                            {/* Permission Level Selector */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-3 rounded-[14px] border border-slate-200/80">
                                <div>
                                    <p className="text-xs font-bold text-slate-800">Quyền hạn cho đối tượng được chọn</p>
                                    <p className="text-[11px] text-slate-500">Áp dụng cho các Team, Phòng ban & Nhân viên bên dưới</p>
                                </div>
                                <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 shadow-2xs shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setDraft(prev => ({ ...prev, permission: 'use' }))}
                                        className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all outline-none focus:outline-none cursor-pointer ${
                                            draft.permission === 'use'
                                                ? 'bg-[#BD1D2D] text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Chỉ sử dụng & Nhân bản</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDraft(prev => ({ ...prev, permission: 'edit' }))}
                                        className={`h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all outline-none focus:outline-none cursor-pointer ${
                                            draft.permission === 'edit'
                                                ? 'bg-[#BD1D2D] text-white shadow-xs'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Cho phép chỉnh sửa</span>
                                    </button>
                                </div>
                            </div>

                            {/* 3 Sub-tabs */}
                            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('teams')}
                                    className={`h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all outline-none focus:outline-none cursor-pointer ${
                                        activeSubTab === 'teams'
                                            ? 'bg-slate-900 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Theo Team / Nhóm</span>
                                    {draft.allowed_team_ids.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                            activeSubTab === 'teams' ? 'bg-[#BD1D2D] text-white' : 'bg-white text-slate-800'
                                        }`}>
                                            {draft.allowed_team_ids.length}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('departments')}
                                    className={`h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all outline-none focus:outline-none cursor-pointer ${
                                        activeSubTab === 'departments'
                                            ? 'bg-slate-900 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span>Theo Phòng ban</span>
                                    {draft.allowed_departments.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                            activeSubTab === 'departments' ? 'bg-[#BD1D2D] text-white' : 'bg-white text-slate-800'
                                        }`}>
                                            {draft.allowed_departments.length}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setActiveSubTab('users')}
                                    className={`h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all outline-none focus:outline-none cursor-pointer ${
                                        activeSubTab === 'users'
                                            ? 'bg-slate-900 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                                    }`}
                                >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Theo Nhân viên</span>
                                    {draft.allowed_user_ids.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                            activeSubTab === 'users' ? 'bg-[#BD1D2D] text-white' : 'bg-white text-slate-800'
                                        }`}>
                                            {draft.allowed_user_ids.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {loadingDir ? (
                                <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#BD1D2D]" />
                                    <span className="text-xs font-medium">Đang tải danh bạ nhân sự & đội nhóm...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Sub-tab 1: Teams */}
                                    {activeSubTab === 'teams' && (
                                        <div className="space-y-2.5">
                                            {teams.length === 0 ? (
                                                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                    Chưa có Team / Đội nhóm nào được cấu hình trên hệ thống.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {teams.map(team => {
                                                        const checked = draft.allowed_team_ids.includes(team.id);
                                                        return (
                                                            <button
                                                                key={team.id}
                                                                type="button"
                                                                onClick={() => toggleTeam(team.id)}
                                                                className={`p-3 rounded-[14px] border text-left flex items-center justify-between gap-3 transition-all outline-none focus:outline-none cursor-pointer ${
                                                                    checked
                                                                        ? 'border-[#BD1D2D] bg-[#BD1D2D]/[0.05] shadow-2xs'
                                                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                                                                }`}
                                                            >
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-bold text-slate-900 truncate">
                                                                            {team.name}
                                                                        </span>
                                                                        {team.branch && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium shrink-0">
                                                                                {team.branch}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                                                        {team.leader_name ? `Leader: ${team.leader_name}` : (team.description || 'Đội nhóm kinh doanh')}
                                                                        {typeof team.member_count === 'number' && ` • ${team.member_count} TV`}
                                                                    </p>
                                                                </div>
                                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                                                    checked
                                                                        ? 'bg-[#BD1D2D] border-[#BD1D2D] text-white'
                                                                        : 'border-slate-300 bg-white'
                                                                }`}>
                                                                    {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Sub-tab 2: Departments */}
                                    {activeSubTab === 'departments' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                                            {departmentItems.map(item => {
                                                const checked = draft.allowed_departments.includes(item.name);
                                                return (
                                                    <button
                                                        key={item.name}
                                                        type="button"
                                                        onClick={() => toggleDepartment(item.name)}
                                                        className={`p-3 rounded-[14px] border text-left flex items-center justify-between gap-3 transition-all outline-none focus:outline-none cursor-pointer ${
                                                            checked
                                                                ? 'border-[#BD1D2D] bg-[#BD1D2D]/[0.05] shadow-2xs'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                                                checked ? 'bg-[#BD1D2D] text-white' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                <Building2 className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                                                                <p className="text-[11px] text-slate-500">{item.count} nhân sự</p>
                                                            </div>
                                                        </div>
                                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                                            checked
                                                                ? 'bg-[#BD1D2D] border-[#BD1D2D] text-white'
                                                                : 'border-slate-300 bg-white'
                                                        }`}>
                                                            {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Sub-tab 3: Individual Employees */}
                                    {activeSubTab === 'users' && (
                                        <div className="space-y-3">
                                            {/* Search + Quick actions */}
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    <input
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        placeholder="Tìm kiếm theo tên, email, chức vụ, phòng ban..."
                                                        className="w-full h-9 pl-9 pr-8 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-slate-800 outline-none focus:border-[#BD1D2D] transition-all"
                                                    />
                                                    {searchQuery && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSearchQuery('')}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 outline-none focus:outline-none"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleSelectAllFilteredUsers}
                                                    className="h-9 px-2.5 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700 hover:border-[#BD1D2D] hover:text-[#BD1D2D] transition-colors shrink-0 outline-none focus:outline-none cursor-pointer"
                                                >
                                                    Chọn tất cả
                                                </button>
                                                {draft.allowed_user_ids.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleClearAllUsers}
                                                        className="h-9 px-2.5 rounded-xl border border-rose-200 bg-rose-50/60 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 transition-colors shrink-0 outline-none focus:outline-none cursor-pointer"
                                                    >
                                                        Bỏ chọn ({draft.allowed_user_ids.length})
                                                    </button>
                                                )}
                                            </div>

                                            {/* Selected Employee Chips */}
                                            {selectedUserObjects.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200/80 custom-scrollbar">
                                                    {selectedUserObjects.map(u => (
                                                        <span
                                                            key={u.id}
                                                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 shadow-2xs"
                                                        >
                                                            <Avatar name={u.full_name} src={u.avatar_url || undefined} size={18} />
                                                            <span className="truncate max-w-[130px]">{u.full_name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleUser(u.id)}
                                                                className="text-slate-400 hover:text-rose-600 outline-none focus:outline-none cursor-pointer"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Scrollable Employee List */}
                                            <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-[14px] bg-white custom-scrollbar">
                                                {filteredUsers.length === 0 ? (
                                                    <div className="py-8 text-center text-xs text-slate-400">
                                                        Không tìm thấy nhân viên phù hợp.
                                                    </div>
                                                ) : (
                                                    filteredUsers.map(u => {
                                                        const checked = draft.allowed_user_ids.includes(u.id);
                                                        return (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                onClick={() => toggleUser(u.id)}
                                                                className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left transition-colors outline-none focus:outline-none cursor-pointer ${
                                                                    checked ? 'bg-[#BD1D2D]/[0.05]' : 'hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5 min-w-0">
                                                                    <Avatar name={u.full_name} src={u.avatar_url || undefined} size={32} />
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="text-xs font-bold text-slate-900 truncate">
                                                                                {u.full_name}
                                                                            </span>
                                                                            {u.department && (
                                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium shrink-0">
                                                                                    {u.department}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[11px] text-slate-500 truncate">
                                                                            {u.job_title ? `${u.job_title} • ` : ''}{u.email}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                                                    checked
                                                                        ? 'bg-[#BD1D2D] border-[#BD1D2D] text-white'
                                                                        : 'border-slate-300 bg-white'
                                                                }`}>
                                                                    {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                        {draft.visibility === 'shared' && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                <Globe className="w-3.5 h-3.5" /> Công khai cho toàn công ty
                            </span>
                        )}
                        {draft.visibility === 'personal' && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                <Lock className="w-3.5 h-3.5" /> Chỉ mình tôi & Admin
                            </span>
                        )}
                        {draft.visibility === 'custom' && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-[#BD1D2D] bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                                <Sparkles className="w-3.5 h-3.5" />
                                Đã chọn: {draft.allowed_team_ids.length} Team, {draft.allowed_departments.length} Phòng ban, {draft.allowed_user_ids.length} Nhân sự ({draft.permission === 'edit' ? 'Được sửa' : 'Chỉ dùng'})
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors outline-none focus:outline-none cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isSaving || (draft.visibility === 'custom' && totalTargets === 0)}
                            className="h-9 px-4 rounded-xl bg-[#BD1D2D] text-white text-xs font-bold hover:brightness-95 disabled:opacity-50 transition-all shadow-xs inline-flex items-center gap-1.5 outline-none focus:outline-none cursor-pointer"
                        >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Áp dụng phân quyền</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalNode, getMktPortalRoot());
};

export default TemplateAccessModal;

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useChatPage, OrgUser } from '../../../contexts/ChatPageContext';
import { api } from '../../../services/storageAdapter';
import { Users, UserPlus, Search, MoreVertical, Shield, ShieldAlert, Trash2, Edit2, Check, X, AlertTriangle, Ban, BarChart, Clock, Lock, ArrowRight, UserCheck, User, ChevronDown, MessageSquare, FileCode, ImageIcon, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../../common/ConfirmModal';
import { getMktPortalRoot } from '../../../utils/portalRoot';

interface OrgUserManagerProps {
    initialEditUserId?: number | null;
    categoryId?: string | null;
    isDarkTheme?: boolean;
    hideHeader?: boolean;
}

// [P18-A4 FIX] Helper: converts DB last_login timestamp to relative time string.
// Replaces the hardcoded "Just now" that misled admins about user activity.
const formatLastLogin = (lastLogin: string | null | undefined): string => {
    if (!lastLogin) return 'Never';
    const date = new Date(lastLogin);
    if (isNaN(date.getTime())) return 'Unknown';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
};

const OrgUserManager: React.FC<OrgUserManagerProps> = ({ initialEditUserId, categoryId, isDarkTheme, hideHeader }) => {
    const { orgUser } = useChatPage();
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'assistant' | 'user'>('all');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        gender: null as 'male' | 'female' | 'other' | null,
        role: 'user',
        status: 'active',
        status_reason: '',
        status_expiry: '',
        permissions: { modes: ['chat'], access: 'limited' }
    });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const url = categoryId
                ? `ai_org_users.php?action=list&category_id=${categoryId}`
                : 'ai_org_users.php?action=list';
            const res = await api.get<OrgUser[]>(url);
            if (res.success) {
                setUsers(res.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (orgUser && (orgUser.role === 'admin' || orgUser.role === 'assistant')) {
            fetchUsers();
        }
    }, [orgUser, categoryId]); // Re-fetch when categoryId changes

    // Handle initial edit user if provided
    useEffect(() => {
        if (initialEditUserId && users.length > 0) {
            const user = users.find(u => u.id === initialEditUserId || (u as any).id === String(initialEditUserId));
            if (user) {
                openEdit(user);
            }
        }
    }, [initialEditUserId, users]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const action = editingUser ? 'update' : 'add';
        const payload = editingUser
            ? { ...formData, id: editingUser.id, category_id: categoryId }
            : { ...formData, category_id: categoryId };

        try {
            const res = await api.post(`ai_org_users.php?action=${action}`, payload);
            if (res.success) {
                toast.success(editingUser ? 'User updated' : 'User added');
                setIsAddModalOpen(false);
                setEditingUser(null);
                setFormData({
                    email: '', password: '', full_name: '', gender: null, role: 'user', status: 'active',
                    status_reason: '', status_expiry: '',
                    permissions: { modes: ['chat'], access: 'limited' }
                });
                fetchUsers();
            } else {
                toast.error(res.message || 'Operation failed');
            }
        } catch (error) {
            toast.error('Error saving user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (id: number) => {
        setUserToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (userToDelete === null) return;
        try {
            const res = await api.post('ai_org_users.php?action=delete', { id: userToDelete });
            if (res.success) {
                toast.success('User deleted');
                fetchUsers();
                setIsDeleteModalOpen(false);
            } else {
                toast.error(res.message);
            }
        } catch (error) {
            toast.error('Error deleting user');
        }
    };

    const openEdit = (user: OrgUser) => {
        setEditingUser(user);
        setFormData({
            email: user.email,
            password: '', // Don't show password
            full_name: user.full_name,
            gender: user.gender || null,
            role: user.role,
            status: user.status,
            status_reason: (user as any).status_reason || '',
            status_expiry: (user as any).status_expiry || '',
            permissions: user.permissions || { modes: ['chat'], access: 'limited' }
        });
        setIsAddModalOpen(true);
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.full_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    if (!orgUser || (orgUser.role !== 'admin' && orgUser.role !== 'assistant')) {
        return <div className="p-8 text-center text-slate-500">Access Denied</div>;
    }

    return (
        <div className={`rounded-[14px] shadow-sm border overflow-hidden h-full flex flex-col transition-colors duration-500 ${isDarkTheme ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            {!hideHeader ? (
                <div className={`p-6 border-b flex items-center justify-between ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div>
                        <h2 className={`text-lg font-bold flex items-center gap-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                            <Users className="w-5 h-5 text-[var(--color-primary)]" /> Organization Users
                        </h2>
                        <p className={`text-sm ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>Manage access and permissions for your team.</p>
                    </div>
                    <button
                        id="org-user-add-btn"
                        onClick={() => { setEditingUser(null); setIsAddModalOpen(true); }}
                        className="bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#9A1523] transition-colors flex items-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" /> Add User
                    </button>
                </div>
            ) : (
                /* Hidden helper button for AITrainingGrid when header is hidden */
                <button
                    id="org-user-add-btn"
                    onClick={() => { setEditingUser(null); setIsAddModalOpen(true); }}
                    className="hidden"
                    aria-hidden="true"
                />
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0">
                {/* Statistics Row */}
                {!hideHeader && (
                    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 p-4 lg:p-6 ${isDarkTheme ? 'bg-[#1E2532]/20' : 'bg-slate-50/50'}`}>
                        {[
                            { label: 'Total Users', value: users.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
                            { label: 'Active', value: users.filter(u => u.status === 'active').length, icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                            { label: 'Warning', value: users.filter(u => u.status === 'warning').length, icon: AlertTriangle, color: 'text-[var(--color-primary)]', bg: 'bg-amber-50' },
                            { label: 'Banned', value: users.filter(u => u.status === 'banned').length, icon: Ban, color: 'text-rose-500', bg: 'bg-rose-50' }
                        ].map((stat, idx) => (
                            <div key={idx} className={`p-4 rounded-xl border transition-all ${isDarkTheme ? 'bg-[#1E2532] border-slate-800 shadow-inner shadow-slate-950/20' : 'bg-white border-slate-100 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} ${isDarkTheme ? 'bg-opacity-10' : ''}`}>
                                        <stat.icon size={18} />
                                    </div>
                                    <span className={`text-lg font-black ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{stat.value}</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Toolbar */}
                <div className={`px-4 lg:px-6 py-4 flex flex-col md:flex-row md:items-center gap-4 justify-between sticky top-0 z-20 ${isDarkTheme ? 'bg-[#1E2532]/10 border-b border-slate-800' : 'bg-white'}`}>
                    <div className="relative group max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-10 pr-4 py-2 border-2 rounded-xl text-xs font-bold transition-all outline-none ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-[var(--color-primary)] placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-700 focus:bg-white focus:border-[var(--color-primary)]'}`}
                        />
                    </div>
                    <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-hide">
                        <div className={`flex items-center gap-2 p-1 rounded-xl ${isDarkTheme ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                            {['all', 'admin', 'assistant', 'user'].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setRoleFilter(f as any)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${f === roleFilter
                                        ? (isDarkTheme ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20' : 'bg-white text-slate-800 shadow-sm')
                                        : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-4 lg:px-6 pb-6">
                    <div className={`rounded-[18px] border shadow-sm overflow-hidden ${isDarkTheme ? 'bg-[#1E2532]/30 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className={`text-[10px] font-black uppercase tracking-wide border-b ${isDarkTheme ? 'bg-slate-800/50 text-slate-400 border-slate-700' : 'bg-slate-50/80 text-slate-400 border-slate-100'}`}>
                                    <th className="px-6 py-4">User Details</th>
                                    <th className="px-6 py-4">Current Role</th>
                                    <th className="px-6 py-4">Status & Access</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDarkTheme ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                {loading && users.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium italic">Loading database...</td></tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-slate-400 font-medium italic">{searchTerm ? `No users found for "${searchTerm}"` : 'No users have been added yet.'}</td></tr>
                                ) : filteredUsers.map(user => (
                                    <tr key={user.id} className={`transition-colors group ${isDarkTheme ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center text-sm font-bold shadow-inner border-2 ${user.status === 'banned' ? (isDarkTheme ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-rose-50 text-rose-500 border-rose-100') :
                                                    user.status === 'warning' ? (isDarkTheme ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-amber-50 text-[var(--color-primary)] border-amber-100') :
                                                        (isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-600 border-white')
                                                    }`}>
                                                    {user.full_name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`font-bold text-sm truncate flex items-center gap-1.5 flex-wrap ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                                                        <span>{user.full_name}</span>
                                                        {user.gender === 'male' && <span className="text-[10px]" title="Male">👨</span>}
                                                        {user.gender === 'female' && <span className="text-[10px]" title="Female">👩</span>}
                                                        {user.gender === 'other' && <span className="text-[10px]" title="Other">👤</span>}
                                                        {Boolean((user as any).erp_user_id) && (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                                                                title={`Đồng bộ từ Hồ sơ Nhân sự MYERP (#${(user as any).erp_user_id})`}
                                                            >
                                                                Nhân sự MYERP #{(user as any).erp_user_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 font-medium truncate">{user.email}</div>
                                                    {((user as any).job_title || (user as any).department) && (
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold text-slate-400 truncate">
                                                            {(user as any).job_title && <span>{(user as any).job_title}</span>}
                                                            {(user as any).job_title && (user as any).department && <span>•</span>}
                                                            {(user as any).department && <span className="text-indigo-500">{(user as any).department}</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wide w-fit shadow-sm border ${user.role === 'admin' ? 'bg-rose-700 text-white border-rose-600' :
                                                    user.role === 'assistant' ? 'bg-sky-500 text-white border-sky-400' :
                                                        (isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200')
                                                    }`}>
                                                    {user.role === 'admin' ? <ShieldAlert className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                                                    {user.role}
                                                </span>
                                                {/* [P18-A4 FIX] Show actual last_login timestamp from DB instead of hardcoded "Just now" */}
                                                <span className="text-[9px] text-slate-400 ml-1 font-bold leading-none">
                                                    Last active: {formatLastLogin((user as any).last_login)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${user.status === 'active' ? (isDarkTheme ? 'text-emerald-400 bg-emerald-900/30 border border-emerald-800/50' : 'text-emerald-500 bg-emerald-50 border border-emerald-100') :
                                                    user.status === 'banned' ? (isDarkTheme ? 'text-rose-400 bg-rose-900/30 border border-rose-800/50' : 'text-rose-600 bg-rose-50 border border-rose-100') :
                                                        (isDarkTheme ? 'text-amber-400 bg-amber-900/30 border border-amber-800/50' : 'text-[var(--color-primary)] bg-amber-50 border border-amber-100')
                                                    }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500 animate-pulse' :
                                                        user.status === 'banned' ? 'bg-rose-500' :
                                                            'bg-[var(--color-primary)]'
                                                        }`} />
                                                    {user.status}
                                                </div>
                                                <div className="flex gap-1">
                                                    {user.permissions?.modes?.map(m => (
                                                        <div key={m} className={`p-1 px-1.5 rounded-md text-[8px] font-bold uppercase ${isDarkTheme ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>{m}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(user)}
                                                    className={`w-9 h-9 flex items-center justify-center text-slate-400 rounded-xl transition-all border border-transparent ${isDarkTheme ? 'hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/30' : 'hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/20'}`}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id)}
                                                    className={`w-9 h-9 flex items-center justify-center text-slate-400 rounded-xl transition-all border border-transparent ${isDarkTheme ? 'hover:text-rose-400 hover:bg-rose-900/30 hover:border-rose-800/50' : 'hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100'}`}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isAddModalOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-300" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className={`rounded-[18px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border ${isDarkTheme ? 'bg-[#0B0F17] border-slate-800' : 'bg-white border-white'}`}>
                        {/* Modal Header */}
                        <div className="p-8 pb-4 flex items-center justify-between relative">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-[14px] bg-gradient-to-br from-[var(--color-primary)] to-[#9A1523] flex items-center justify-center text-white shadow-xl shadow-[var(--color-primary)]/20">
                                    {editingUser ? <Edit2 className="w-7 h-7" /> : <UserPlus className="w-7 h-7" />}
                                </div>
                                <div>
                                    <h3 className={`text-2xl font-bold tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                                        {editingUser ? 'Update Member' : 'Add New Member'}
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-0.5">Workspace access control</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className={`w-10 h-10 flex items-center justify-center rounded-[14px] transition-all ${isDarkTheme ? 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto flex-1 px-8 custom-scrollbar">
                            <form id="user-form" onSubmit={handleSubmit} className="pb-6 space-y-6">
                                {/* Basic Information Section */}
                                <div className={`p-6 border-2 rounded-[18px] space-y-5 ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Basic Information
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="group">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2 block">Full Name</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                                <input
                                                    required type="text"
                                                    placeholder="John Doe"
                                                    className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl text-sm font-bold outline-none transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-[var(--color-primary)] placeholder:text-slate-600' : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-[var(--color-primary)]'}`}
                                                    value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="group">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2 block">Email Address</label>
                                            <div className="relative">
                                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                                <input
                                                    required type="email"
                                                    placeholder="user@example.com"
                                                    className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl text-sm font-bold outline-none transition-all disabled:opacity-50 ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-[var(--color-primary)] placeholder:text-slate-600' : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-[var(--color-primary)]'}`}
                                                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    disabled={!!editingUser}
                                                />
                                            </div>
                                        </div>

                                        <div className="group md:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2 block">Gender Selection</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: 'male', label: 'Male', icon: '👨' },
                                                    { id: 'female', label: 'Female', icon: '👩' },
                                                    { id: 'other', label: 'Other', icon: '👤' }
                                                ].map(g => (
                                                    <button
                                                        key={g.id}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, gender: g.id as any })}
                                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.gender === g.id ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)] text-[var(--color-primary)]' : (isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-50 text-slate-600')}`}
                                                    >
                                                        <span className="text-lg">{g.icon}</span>
                                                        <span className="text-xs font-bold">{g.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="group md:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2 block">Password {!editingUser && "(Optional)"}</label>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                                <input
                                                    type="password"
                                                    placeholder={editingUser ? "Leave blank to keep current password" : "Create password (optional for existing accounts)"}
                                                    className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl text-sm font-bold outline-none transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-[var(--color-primary)] placeholder:text-slate-600' : 'bg-slate-50 border-slate-50 text-slate-800 focus:bg-white focus:border-[var(--color-primary)]'}`}
                                                    value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Role Selection */}
                                <div className={`border-2 rounded-[18px] p-5 space-y-4 ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                        <Shield className="w-3.5 h-3.5" />
                                        Role & Permissions
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {[
                                            { id: 'user', label: 'End User', desc: 'Standard AI access', icon: User },
                                            { id: 'assistant', label: 'Assistant', desc: 'Can manage bots', icon: Shield },
                                            { id: 'admin', label: 'Admin', desc: 'Full control', icon: ShieldAlert },
                                        ].map(role => (
                                            <button
                                                key={role.id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData({
                                                        ...formData,
                                                        role: role.id as any,
                                                        permissions: {
                                                            ...formData.permissions,
                                                            modes: (role.id === 'admin' || role.id === 'assistant') ? ['chat', 'code', 'image'] : (formData.permissions.modes.includes('chat') ? formData.permissions.modes : ['chat'])
                                                        }
                                                    });
                                                }}
                                                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${formData.role === role.id ? 'bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-primary)]/10 border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/10' : (isDarkTheme ? 'bg-slate-800/50 border-transparent hover:border-slate-700' : 'bg-slate-50 border-transparent hover:border-slate-200')}`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.role === role.id ? 'bg-[var(--color-primary)] text-white' : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-white text-slate-400')}`}>
                                                    <role.icon className="w-4 h-4" />
                                                </div>
                                                <div className="text-center">
                                                    <div className={`text-[10px] font-bold uppercase tracking-wide ${formData.role === role.id ? (isDarkTheme ? 'text-[var(--color-primary)]' : 'text-slate-800') : (isDarkTheme ? 'text-slate-400' : 'text-slate-500')}`}>{role.label}</div>
                                                    <div className="text-[8px] font-medium text-slate-400 mt-0.5">{role.desc}</div>
                                                </div>
                                                {formData.role === role.id && <Check className="w-3.5 h-3.5 text-[var(--color-primary)] absolute top-2 right-2" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Status Management (Only for editing) */}
                                {editingUser && (
                                    <div className={`border-2 rounded-[18px] p-6 space-y-5 ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-100'}`}>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Account Status
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2 block">Current Status</label>
                                                <div className="relative">
                                                    <select
                                                        className={`w-full px-4 py-3.5 border-2 rounded-xl text-sm font-bold outline-none transition-all appearance-none cursor-pointer ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-[var(--color-primary)]' : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-[var(--color-primary)]'}`}
                                                        value={formData.status}
                                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                                    >
                                                        <option value="active">Active & Online</option>
                                                        <option value="banned">Banned (Blocked)</option>
                                                        <option value="warning">Warning Issued</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>

                                            {(formData.status === 'warning' || formData.status === 'banned') && (
                                                <>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2 block">Reason for {formData.status}</label>
                                                        <textarea
                                                            className={`w-full px-4 py-3 border-2 rounded-xl text-xs font-bold outline-none transition-all min-h-[80px] resize-none ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-[var(--color-primary)] placeholder:text-slate-600' : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-[var(--color-primary)]'}`}
                                                            placeholder="Describe why this action was taken..."
                                                            value={formData.status_reason}
                                                            onChange={e => setFormData({ ...formData, status_reason: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2 block">Expiration Date (Optional)</label>
                                                        <div className="relative">
                                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                                            <input
                                                                type="datetime-local"
                                                                className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl text-sm font-bold outline-none transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-[var(--color-primary)] color-white-calendar' : 'bg-slate-50 border-slate-50 text-slate-700 focus:bg-white focus:border-[var(--color-primary)]'}`}
                                                                value={formData.status_expiry}
                                                                onChange={e => setFormData({ ...formData, status_expiry: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* AI Capabilities */}
                                <div className={`border-2 rounded-[18px] p-5 space-y-4 ${isDarkTheme ? 'bg-slate-800/40 border-slate-800' : 'bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-100'}`}>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        AI Capability Access
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {[
                                            { id: 'chat', label: 'Chat RAG', icon: MessageSquare, required: true },
                                            { id: 'code', label: 'Code Mode', icon: FileCode },
                                            { id: 'image', label: 'Image Gen', icon: ImageIcon },
                                        ].map(mode => (
                                            <label
                                                key={mode.id}
                                                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${(mode as any).required ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${formData.permissions.modes.includes(mode.id) ? (isDarkTheme ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/5' : 'bg-white border-emerald-500 shadow-md shadow-emerald-500/10') : (isDarkTheme ? 'bg-slate-800/40 border-transparent hover:border-slate-700' : 'bg-slate-50 border-transparent hover:border-slate-200')}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <mode.icon className={`w-4 h-4 ${formData.permissions.modes.includes(mode.id) ? 'text-emerald-500' : 'text-slate-300'}`} />
                                                    <div>
                                                        <span className={`text-[10px] font-bold uppercase tracking-wide block ${formData.permissions.modes.includes(mode.id) ? (isDarkTheme ? 'text-slate-200' : 'text-slate-800') : 'text-slate-400'}`}>{mode.label}</span>
                                                        {(mode as any).required && <span className="text-[7px] text-slate-400 font-medium">Required</span>}
                                                    </div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    disabled={(mode as any).required}
                                                    checked={formData.permissions.modes.includes(mode.id)}
                                                    onChange={e => {
                                                        if ((mode as any).required) return;
                                                        const modes = e.target.checked
                                                            ? [...formData.permissions.modes, mode.id]
                                                            : formData.permissions.modes.filter(m => m !== mode.id);
                                                        setFormData({ ...formData, permissions: { ...formData.permissions, modes } });
                                                    }}
                                                />
                                                {formData.permissions.modes.includes(mode.id) && (
                                                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                                        <Check className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Sticky Footer Actions */}
                        <div className={`sticky bottom-0 border-t px-8 py-5 flex items-center justify-between ${isDarkTheme ? 'bg-[#05070A] border-slate-800' : 'bg-white border-slate-100'}`}>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className={`px-6 py-3 text-xs font-bold uppercase tracking-wide transition-colors ${isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Discard Changes
                            </button>
                            <button
                                type="submit"
                                form="user-form"
                                disabled={isSubmitting}
                                className="px-10 py-3.5 bg-[var(--color-primary)] text-white hover:bg-[#9A1523] rounded-[14px] text-[11px] font-bold uppercase tracking-wider transition-all shadow-xl shadow-[var(--color-primary)]/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                {isSubmitting ? 'Saving...' : (editingUser ? 'Sync Updates' : 'Confirm Registration')}
                                <ArrowRight className="w-4 h-4 ml-1" />
                            </button>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Xác nhận xóa thành viên"
                message="Bạn có chắc chắn muốn xóa thành viên này khỏi hệ thống? Hành động này không thể hoàn tác."
                confirmText="Xóa thành viên"
                variant="danger"
                isDarkTheme={isDarkTheme}
            />
        </div >
    );
};

export default OrgUserManager;

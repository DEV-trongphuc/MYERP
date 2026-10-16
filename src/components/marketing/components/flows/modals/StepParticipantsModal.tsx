import { EXTERNAL_ASSET_BASE } from '../../../utils/config';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Search, RefreshCcw, Check, MailOpen, Clock, Download, MousePointer2, MessageSquare, AlertOctagon, Reply, MousePointerClick, Monitor, Smartphone, Tablet, Globe, FastForward, Trash2, Play, SkipForward, UserPlus, UserMinus, Send, Loader2, ChevronDown, Tag, List, Circle, CheckCircle2, Layers, GitMerge, Beaker } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../../../services/storageAdapter';
import { toast } from 'react-hot-toast';
import Skeleton from '../../common/Skeleton';
import LinkClicksTab from '../../common/LinkClicksTab';
import TechStatsTab from '../../campaigns/TechStatsTab';
import ConfirmModal from '../../common/ConfirmModal';
import SelectBranchModal from '../../common/SelectBranchModal';

const GoogleSheetsIcon = ({ className }: { className?: string }) => (
    <div className={className} style={{ width: className?.includes('w-3') ? '12px' : '20px', height: className?.includes('h-3') ? '12px' : '20px' }}>
        <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-full h-full max-w-full max-h-full object-contain block" alt="Google Sheets" />
    </div>
);

const MisaIcon = ({ className }: { className?: string }) => (
    <div className={className} style={{ width: className?.includes('w-3') ? '12px' : '20px', height: className?.includes('h-3') ? '12px' : '20px' }}>
        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s" className="w-full h-full max-w-full max-h-full object-contain block rounded-full" alt="MISA CRM" />
    </div>
);


const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (email) {
        const localPart = email.split('@')[0];
        return localPart.substring(0, 2).toUpperCase();
    }
    return '?';
};

const getAvatarBg = (name: string, email: string) => {
    const key = name || email || 'Unknown';
    const colors = [
        'bg-blue-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500', 'bg-blue-500'
    ];
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

interface StepParticipantsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    participants: any[];
    loading: boolean;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    onPageChange: (page: number) => void;
    onRefresh: () => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    getStepName: (id: string) => string;
    activeTab: 'waiting' | 'opened' | 'failed' | 'unsubscribed' | 'all' | 'clicks' | 'report' | 'zns_sent' | 'zns_clicked' | 'zns_replied' | 'zns_failed' | 'zns_skipped' | 'all_touched' | 'preview' | 'inactive';
    onTabChange: (tab: any) => void;
    stepType?: string;
    stepConfig?: any;
    flowId?: string;
    stepId?: string;
    stepData?: any;
    onActionComplete?: () => void;
    activeBranchFilter?: string | null;
    onBranchClick?: (branch: string | null) => void;
    isDarkTheme?: boolean;
    onSelectSubscriber?: (subscriber: any) => void;
}

const StepParticipantsModal: React.FC<StepParticipantsModalProps> = ({
    isOpen,
    onClose,
    title,
    participants,
    loading,
    pagination,
    onPageChange,
    onRefresh,
    searchTerm,
    onSearchChange,
    getStepName,
    activeTab,
    onTabChange,
    stepType,
    stepConfig,
    flowId,
    stepId,
    stepData,
    onActionComplete,
    activeBranchFilter,
    onBranchClick,
    isDarkTheme = false,
    onSelectSubscriber
}) => {
    const [animateIn, setAnimateIn] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    // Add Users Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addEmails, setAddEmails] = useState('');
    const [addingUsers, setAddingUsers] = useState(false);
    const [addListIds, setAddListIds] = useState<string[]>([]);
    const [timingMode, setTimingMode] = useState<'immediate' | 'native'>('immediate');
    const [estimateData, setEstimateData] = useState<{ total_found: number, duplicated: number, valid: number } | null>(null);
    const [isEstimating, setIsEstimating] = useState(false);
    // NEW: Branch Selection State
    const [targetAddStepId, setTargetAddStepId] = useState<string>('');
    const [availableBranches, setAvailableBranches] = useState<any[]>([]);
    const [branchSelectOpen, setBranchSelectOpen] = useState(false);

    const [isGlobalSelected, setIsGlobalSelected] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [branchModalOpen, setBranchModalOpen] = useState(false);
    const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
    const [resendingParticipant, setResendingParticipant] = useState<any>(null);
    const [actionMode, setActionMode] = useState<'skip' | 'execute'>('skip');
    const [branches, setBranches] = useState<any[]>([]);

    // NEW: Quick Actions State
    const [quickActionsOpen, setQuickActionsOpen] = useState(false);
    const [tagModalOpen, setTagModalOpen] = useState(false);
    const [listModalOpen, setListModalOpen] = useState(false);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [selectedTag, setSelectedTag] = useState('');
    const [selectedList, setSelectedList] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [availableTags, setAvailableTags] = useState<any[]>([]);
    const [availableLists, setAvailableLists] = useState<any[]>([]);
    
    // NEW: Source Tab & Search State for Add User Modal
    const [addSourceTab, setAddSourceTab] = useState<'list' | 'sync' | 'segment'>('list');
    const [addSearchTerm, setAddSearchTerm] = useState('');
    const [availableSegments, setAvailableSegments] = useState<any[]>([]);
    const [addSegmentIds, setAddSegmentIds] = useState<string[]>([]);

    const isManualList = (l: any) => l.source === 'Manual' || !l.source || l.type === 'static';
    const isSyncList = (l: any) => l.source !== 'Manual' && l.source && l.type !== 'static';

    useEffect(() => {
        if (!isAddModalOpen || (!addEmails.trim() && addListIds.length === 0 && addSegmentIds.length === 0)) {
            setEstimateData(null);
            return;
        }

        const timer = setTimeout(() => {
            setIsEstimating(true);
            const emailsList = addEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e);
            
            api.post(`flows?id=${flowId}&route=estimate-manual-add`, {
                inputs: emailsList,
                list_ids: addListIds,
                segment_ids: addSegmentIds
            }).then(res => {
                const data = res.data as any;
                if (res.success && data) {
                    setEstimateData(data);
                }
            }).catch(err => {
                console.error("Estimate Error:", err);
            }).finally(() => {
                setIsEstimating(false);
            });
        }, 500);

        return () => clearTimeout(timer);
    }, [addEmails, addListIds, addSegmentIds, isAddModalOpen, flowId]);

    useEffect(() => {
        if (isOpen) setTimeout(() => setAnimateIn(true), 10);
        else {
            setAnimateIn(false);
            setSelectedIds(new Set()); // Clear selections when modal closes
            setIsGlobalSelected(false);
        }
    }, [isOpen]);

    // Clear selections when changing tabs or pages
    useEffect(() => {
        setSelectedIds(new Set());
        setIsGlobalSelected(false);
    }, [activeTab, pagination.page]);

    // Load branches when branch modal opens
    useEffect(() => {
        if (branchModalOpen) {
            getBranches().then(setBranches);
        }
    }, [branchModalOpen]);

    const handleClose = () => {
        setAnimateIn(false);
        setTimeout(onClose, 400);
    };



    const formatTime = (iso: string) => {
        if (!iso) return '--';
        return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    };

    const calculateTimeRemaining = (dateStr: string) => {
        if (!dateStr) return { text: '', isUrgent: false };

        // Parse the date string and get timestamps
        const target = new Date(dateStr).getTime();
        const now = new Date().getTime();
        const diff = target - now;

        // Debug logging (remove after fixing)
        if (process.env.NODE_ENV === 'development') {
            console.log('[Time Debug]', {
                scheduledAt: dateStr,
                targetTime: new Date(target).toLocaleString('vi-VN'),
                currentTime: new Date(now).toLocaleString('vi-VN'),
                diffMs: diff,
                diffMinutes: Math.floor(diff / (1000 * 60))
            });
        }

        // If time has passed or is within 30 seconds
        if (diff <= 30000) return { text: 'Sắp chạy ngay', isUrgent: true };

        const totalMinutes = Math.floor(diff / (1000 * 60));
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) {
            return { text: `Còn ${days} ngày ${hours}h ${minutes}p`, isUrgent: false };
        }
        if (hours > 0) return { text: `Còn ${hours}h ${minutes}p`, isUrgent: false };
        return { text: `Còn ${minutes} phút`, isUrgent: totalMinutes <= 5 };
    };

    // Bulk Actions Handlers
    const handleSelectAll = () => {
        if (selectedIds.size === participants.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(participants.map(p => p.subscriber_id || p.id));
            setSelectedIds(allIds);
        }
    };

    const handleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleBulkSkip = async () => {
        if (!flowId || (selectedIds.size === 0 && !isGlobalSelected)) return;

        // Check if current step has multiple branches
        const needsBranchSelection = await checkIfNeedsBranchSelection();

        if (needsBranchSelection) {
            setActionMode('skip');
            setBranchModalOpen(true);
        } else {
            executeBulkAction(null, false);
        }
    };

    const handleBulkExecute = async () => {
        if (!flowId || (selectedIds.size === 0 && !isGlobalSelected)) return;

        // Check if current step has multiple branches
        const needsBranchSelection = await checkIfNeedsBranchSelection();

        if (needsBranchSelection) {
            setActionMode('execute');
            setBranchModalOpen(true);
        } else {
            executeBulkAction(null, true);
        }
    };

    const checkIfNeedsBranchSelection = async (): Promise<boolean> => {
        try {
            const res = await api.get(`flows?id=${flowId}`);
            if (res.success && res.data) {
                const stepsData = (res.data as any).steps;
                const steps = typeof stepsData === 'string' ? JSON.parse(stepsData) : (stepsData || []);
                const currentStep = steps.find((s: any) => s.id === stepId);

                if (currentStep) {
                    const type = currentStep.type?.toLowerCase();
                    // Multi-branch steps: condition, advanced_condition, split_test
                    return ['condition', 'advanced_condition', 'split_test'].includes(type);
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking step type:', error);
            return false;
        }
    };

    const getBranches = async () => {
        try {
            const res = await api.get(`flows?id=${flowId}`);
            if (res.success && res.data) {
                const stepsData = (res.data as any).steps;
                const steps = typeof stepsData === 'string' ? JSON.parse(stepsData) : (stepsData || []);
                const currentStep = steps.find((s: any) => s.id === stepId);

                if (currentStep) {
                    const type = currentStep.type?.toLowerCase();
                    const branches: any[] = [];

                    if (type === 'condition') {
                        branches.push(
                            { id: currentStep.yesStepId || currentStep.yesStepID, label: '→ YES', description: 'Điều kiện đúng' },
                            { id: currentStep.noStepId || currentStep.noStepID, label: '→ NO', description: 'Điều kiện sai' }
                        );
                    } else if (type === 'advanced_condition') {
                        branches.push(
                            { id: currentStep.yesStepId || currentStep.yesStepID, label: '→ YES', description: 'Điều kiện đúng' },
                            { id: currentStep.noStepId || currentStep.noStepID, label: '→ NO', description: 'Điều kiện sai' }
                        );
                    } else if (type === 'split_test') {
                        const config = currentStep.config || {};
                        const variants = config.variants || [];
                        variants.forEach((v: any, index: number) => {
                            branches.push({
                                id: v.nextStepId || v.nextStepID,
                                label: `Variant ${String.fromCharCode(65 + index)} (${v.percentage}%)`,
                                description: v.name || `Test variant ${index + 1}`
                            });
                        });
                    }

                    return branches.filter(b => b.id); // Remove invalid branches
                }
            }
            return [];
        } catch (error) {
            console.error('Error getting branches:', error);
            return [];
        }
    };

    const executeBulkAction = async (targetStepId: string | null, executeAction: boolean) => {
        console.log('executeBulkAction called with:', { targetStepId, executeAction, stepId, flowId });

        setBulkActionLoading(true);
        try {
            const payload = {
                subscriber_ids: isGlobalSelected ? [] : Array.from(selectedIds),
                step_id: stepId,
                select_all: isGlobalSelected,
                execute_action: executeAction,
                target_step_id: targetStepId // For multi-branch steps
            };

            const res = await api.post(`flows?id=${flowId}&route=bulk-next-step`, payload);

            if (res.success) {
                const count = isGlobalSelected ? pagination.total : selectedIds.size;
                const action = executeAction ? 'Hoàn thành bước này' : 'Bỏ qua';
                toast.success(`Đã ${action} cho ${count} Khách hàng`);
                setSelectedIds(new Set());
                setIsGlobalSelected(false);
                onRefresh();
                onActionComplete?.();
            } else {
                toast.error(res.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            toast.error('Không thể thực hiện thao tác');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkRemove = async () => {
        if (!flowId || (selectedIds.size === 0 && !isGlobalSelected)) return;

        const count = isGlobalSelected ? pagination.total : selectedIds.size;

        // Show custom confirm modal
        setConfirmModalOpen(true);
    };

    const executeRemove = async () => {
        const count = isGlobalSelected ? pagination.total : selectedIds.size;

        const payload = {
            subscriber_ids: isGlobalSelected ? [] : Array.from(selectedIds),
            step_id: stepId,
            select_all: isGlobalSelected
        };

        console.log('Bulk remove payload:', payload);
        console.log('Flow ID:', flowId);

        setBulkActionLoading(true);
        try {
            const res = await api.post(`flows?id=${flowId}&route=bulk-remove`, payload);

            console.log('Bulk remove response:', res);

            if (res.success) {
                const actualCount = (res.data as any)?.count || count;
                toast.success(`Đã loại ${actualCount} Khách hàng ra khỏi flow`);
                setSelectedIds(new Set());
                setIsGlobalSelected(false);
                onRefresh();
                onActionComplete?.();
            } else {
                toast.error(res.message || 'Có lỗi xảy ra');
                console.error('Bulk remove failed:', res);
            }
        } catch (error) {
            console.error('Bulk remove error:', error);
            toast.error('Không thể thực hiện thao tác');
        } finally {
            setBulkActionLoading(false);
            setConfirmModalOpen(false);
        }
    };

    const handleResendInit = (participant: any) => {
        setResendingParticipant(participant);
        setResendConfirmOpen(true);
    };

    const executeResend = async () => {
        if (!resendingParticipant) return;
        setBulkActionLoading(true);
        try {
            const res = await api.post(`flows?id=${flowId}&route=test-step-action`, {
                target_email: resendingParticipant.email,
                step_id: stepId
            });
            if (res.success) toast.success(res.message || 'đã gửi lại thành công');
            else toast.error(res.message || 'Lỗiđã gửi lại');
        } catch (error) {
            toast.error('Lỗi kết nối');
        } finally {
            setBulkActionLoading(false);
            setResendingParticipant(null);
            setResendConfirmOpen(false);
        }
    };

    // NEW: Quick Actions Handlers
    const handleBulkAddTag = async () => {
        if (!selectedTag || (selectedIds.size === 0 && !isGlobalSelected)) {
            toast.error('Vui lòng chọn tag');
            return;
        }

        setBulkActionLoading(true);
        try {
            const payload = {
                subscriber_ids: isGlobalSelected ? [] : Array.from(selectedIds),
                select_all: isGlobalSelected,
                tag_id: selectedTag,
                flow_id: flowId,
                step_id: stepId
            };

            const res = await api.post(`subscribers?route=bulk-add-tag`, payload);
            if (res.success) {
                const count = isGlobalSelected ? pagination.total : selectedIds.size;
                toast.success(`Đã gắn tag cho ${count} Khách hàng`);
                setSelectedIds(new Set());
                setIsGlobalSelected(false);
                setTagModalOpen(false);
                setSelectedTag('');
                onRefresh();
            } else {
                toast.error(res.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            toast.error('Không thể thực hiện thao tác');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkAddToList = async () => {
        if (!selectedList || (selectedIds.size === 0 && !isGlobalSelected)) {
            toast.error('Vui lòng chọn danh sách');
            return;
        }

        setBulkActionLoading(true);
        try {
            const payload = {
                subscriber_ids: isGlobalSelected ? [] : Array.from(selectedIds),
                select_all: isGlobalSelected,
                list_id: selectedList,
                flow_id: flowId,
                step_id: stepId
            };

            const res = await api.post(`subscribers?route=bulk-add-to-list`, payload);
            if (res.success) {
                const count = isGlobalSelected ? pagination.total : selectedIds.size;
                toast.success(`Đã thêm ${count} Khách hàng vào danh sách`);
                setSelectedIds(new Set());
                setIsGlobalSelected(false);
                setListModalOpen(false);
                setSelectedList('');
                onRefresh();
            } else {
                toast.error(res.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            toast.error('Không thể thực hiện thao tác');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleBulkChangeStatus = async () => {
        if (!selectedStatus || (selectedIds.size === 0 && !isGlobalSelected)) {
            toast.error('Vui lòng chọn Trạng thái');
            return;
        }

        setBulkActionLoading(true);
        try {
            const payload = {
                subscriber_ids: isGlobalSelected ? [] : Array.from(selectedIds),
                select_all: isGlobalSelected,
                status: selectedStatus,
                flow_id: flowId,
                step_id: stepId
            };

            const res = await api.post(`subscribers?route=bulk-change-status`, payload);
            if (res.success) {
                const count = isGlobalSelected ? pagination.total : selectedIds.size;
                toast.success(`Đã cập nhật Trạng thái cho ${count} Khách hàng`);
                setSelectedIds(new Set());
                setIsGlobalSelected(false);
                setStatusModalOpen(false);
                setSelectedStatus('');
                onRefresh();
            } else {
                toast.error(res.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            toast.error('Không thể thực hiện thao tác');
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleExportCSV = () => {
        let headers = ['Email', 'Tên', 'SĐT', 'Trạng thái', 'Thời gian vào', 'Thời gian hoàn thành', 'Lỗi (nếu có)'];
        if (activeTab === 'clicks' || activeTab === 'zns_clicked') {
            headers = ['Email', 'Tên', 'SĐT', 'URL Click', 'Thiết bị', 'Hệ điều hành', 'Trình duyệt', 'Vị trí', 'Thời gian'];
        } else if (activeTab === 'opened') {
            headers = ['Email', 'Tên', 'SĐT', 'Số lần mở', 'Thiết bị', 'Hệ điều hành', 'Trình duyệt', 'Vị trí', 'Thời gian mở đầu'];
        }

        const rows = participants.map(p => {
            if (activeTab === 'clicks' || activeTab === 'zns_clicked') {
                return [
                    p.email || '', p.name || '', p.phone || '', p.url || '', p.device || '', p.os || '', p.browser || '', p.location || '',
                    p.enteredAt ? new Date(p.enteredAt).toLocaleString('vi-VN') : ''
                ];
            } else if (activeTab === 'opened') {
                return [
                    p.email || '', p.name || '', p.phone || '', p.open_count || '', p.device || '', p.os || '', p.browser || '', p.location || '',
                    p.firstOpenAt ? new Date(p.firstOpenAt).toLocaleString('vi-VN') : ''
                ];
            }

            const error = p.lastError || p.last_error || p.error_message || '';
            const errorStr = typeof error === 'object' ? JSON.stringify(error) : error;

            return [
                p.email || '',
                p.name || '',
                p.phone || '',
                p.status || '',
                p.enteredAt ? new Date(p.enteredAt).toLocaleString('vi-VN') : '',
                p.completedAt || p.updated_at || p.updatedAt ? new Date(p.completedAt || p.updated_at || p.updatedAt).toLocaleString('vi-VN') : '',
                errorStr
            ];
        });

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" +
            [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `step_${stepId}_export_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Đã xuất ${participants.length} dữ liệu`);
    };
    const fetchTagsAndLists = async () => {
        try {
            const [tagsRes, listsRes, segmentsRes] = await Promise.all([
                api.get('tags'),
                api.get('lists'),
                api.get('segments')
            ]);

            if (tagsRes.success && tagsRes.data) {
                setAvailableTags(Array.isArray(tagsRes.data) ? tagsRes.data : ((tagsRes.data as any).data || []));
            }

            if (listsRes.success && listsRes.data) {
                setAvailableLists(Array.isArray(listsRes.data) ? listsRes.data : []);
            }

            if (segmentsRes.success && segmentsRes.data) {
                setAvailableSegments(Array.isArray(segmentsRes.data) ? segmentsRes.data : []);
            }
        } catch (error) {
            console.error('Error fetching tags and lists:', error);
        }
    };

    // Load tags and lists when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchTagsAndLists();
        }
    }, [isOpen]);


    if (!isOpen && !animateIn) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 !mt-0">
            <div
                className={`absolute inset-0 bg-slate-950/70 transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`w-full max-w-5xl rounded-[24px] flex flex-col max-h-[92vh] border transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-97 opacity-0 translate-y-4'} ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80 shadow-[0_24px_60px_rgba(0,0,0,0.6)] text-slate-100' : 'bg-white border-slate-200/80 shadow-[0_24px_50px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.02)] text-slate-800'}`}
            >
                {/* Header */}
                <div className={`px-6 py-5 border-b flex items-center justify-between rounded-t-[24px] ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100">
                            {stepType === 'zalo_zns' ? (
                                <img
                                    src={`${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`}
                                    alt="Zalo"
                                    className="w-5 h-5"
                                />
                            ) : stepType === 'action' ? (
                                <MailOpen className="w-5 h-5" />
                            ) : (
                                <Clock className="w-5 h-5" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">{title}</h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Tổng số: {pagination.total} {['clicks', 'zns_clicked'].includes(activeTab) ? 'lượt click' : 'Khách hàng'}
                                {selectedIds.size > 0 && ` • ${selectedIds.size} đã chọn`}
                            </p>
                            {/* BRANCH STATS SUMMARY */}
                            {stepData && stepData.stats && (() => {
                                const type = stepData.type?.toLowerCase();
                                const s = stepData.stats;
                                
                                if (type === 'condition') {
                                    return (
                                        <div className="w-full mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <GitMerge className="w-4 h-4 text-slate-400" />
                                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Thống kê điều kiện</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div 
                                                    onClick={() => onBranchClick?.(activeBranchFilter === 'matched' ? null : 'matched')}
                                                    className={`p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer ${activeBranchFilter === 'matched' ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-white border-emerald-100 hover:border-emerald-300'}`}
                                                >
                                                    <div className={`absolute inset-0 bg-emerald-50 transition-opacity ${activeBranchFilter === 'matched' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                                    <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1 relative z-10 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Đúng điều kiện</span>
                                                    <span className="text-2xl font-black text-emerald-700 relative z-10">{s.matched || 0}</span>
                                                </div>
                                                <div 
                                                    onClick={() => onBranchClick?.(activeBranchFilter === 'timed_out' ? null : 'timed_out')}
                                                    className={`p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer ${activeBranchFilter === 'timed_out' ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20' : 'bg-white border-rose-100 hover:border-rose-300'}`}
                                                >
                                                    <div className={`absolute inset-0 bg-rose-50 transition-opacity ${activeBranchFilter === 'timed_out' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                                    <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-1 relative z-10 flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> Sai điều kiện</span>
                                                    <span className="text-2xl font-black text-rose-700 relative z-10">{s.timed_out || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                if (type === 'split_test') {
                                    return (
                                        <div className="w-full mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Beaker className="w-4 h-4 text-slate-400" />
                                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Thống kê A/B Test</h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div 
                                                    onClick={() => onBranchClick?.(activeBranchFilter === 'path_a' ? null : 'path_a')}
                                                    className={`p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer ${activeBranchFilter === 'path_a' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20' : 'bg-white border-blue-100 hover:border-blue-300'}`}
                                                >
                                                    <div className={`absolute inset-0 bg-blue-50 transition-opacity ${activeBranchFilter === 'path_a' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1 relative z-10 flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-black">A</span> Nhánh A</span>
                                                    <span className="text-2xl font-black text-blue-700 relative z-10">{s.path_a || 0}</span>
                                                </div>
                                                <div 
                                                    onClick={() => onBranchClick?.(activeBranchFilter === 'path_b' ? null : 'path_b')}
                                                    className={`p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer ${activeBranchFilter === 'path_b' ? 'bg-fuchsia-50 border-fuchsia-500 ring-2 ring-fuchsia-500/20' : 'bg-white border-fuchsia-100 hover:border-fuchsia-300'}`}
                                                >
                                                    <div className={`absolute inset-0 bg-fuchsia-50 transition-opacity ${activeBranchFilter === 'path_b' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                                    <span className="text-[11px] font-bold text-fuchsia-600 uppercase tracking-wider mb-1 relative z-10 flex items-center gap-1.5"><span className="w-4 h-4 rounded bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center font-black">B</span> Nhánh B</span>
                                                    <span className="text-2xl font-black text-fuchsia-700 relative z-10">{s.path_b || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                if (type === 'advanced_condition') {
                                    const branches = stepConfig?.branches || [];
                                    const bStats = s.branchStats || {};
                                    return (
                                        <div className="w-full mt-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <GitMerge className="w-4 h-4 text-slate-400" />
                                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Thống kê rẽ nhánh</h4>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                {branches.map((b: any, idx: number) => (
                                                    <div 
                                                        key={b.id} 
                                                        onClick={() => onBranchClick?.(activeBranchFilter === b.label ? null : b.label)}
                                                        className={`p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer ${activeBranchFilter === b.label ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-white border-indigo-100 hover:border-indigo-300'}`}
                                                    >
                                                        <div className={`absolute inset-0 bg-indigo-50/50 transition-opacity ${activeBranchFilter === b.label ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 relative z-10 text-center truncate w-full px-2" title={b.label || "Nhánh "}>{b.label || "Nhánh "}</span>
                                                        <span className={`text-xl font-black relative z-10 ${activeBranchFilter === b.label ? 'text-indigo-700' : 'text-indigo-600'}`}>{bStats[b.label] || 0}</span>
                                                    </div>
                                                ))}
                                                <div 
                                                    onClick={() => onBranchClick?.(activeBranchFilter === 'fallback' ? null : 'fallback')}
                                                    className={`p-3 rounded-xl border shadow-sm flex flex-col items-center justify-center relative overflow-hidden group transition-all cursor-pointer ${activeBranchFilter === 'fallback' ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-500/20' : 'bg-white border-slate-200 hover:border-slate-400'}`}
                                                >
                                                    <div className={`absolute inset-0 bg-slate-50 transition-opacity ${activeBranchFilter === 'fallback' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 relative z-10">Mặc định</span>
                                                    <span className={`text-xl font-black relative z-10 ${activeBranchFilter === 'fallback' ? 'text-slate-900' : 'text-slate-700'}`}>{bStats['Fallback'] || bStats['fallback'] || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                return null;
                            })()}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {stepType !== 'completed' && stepType !== 'inactive' && (
                            <button
                                onClick={() => {
                                    setIsAddModalOpen(true);

                                    // Parse branches from stepData
                                    let initialTarget = stepId || '';

                                    if (stepData) {
                                        const type = stepData.type?.toLowerCase();
                                        const branches: any[] = [];

                                        if (type === 'condition' || type === 'advanced_condition') {
                                            branches.push(
                                                { id: stepData.yesStepId || stepData.yesStepID, label: 'Nhánh YES (Điều kiện đúng)' },
                                                { id: stepData.noStepId || stepData.noStepID, label: 'Nhánh NO (Điều kiện sai)' }
                                            );
                                        } else if (type === 'split_test') {
                                            const variants = stepData.config?.variants || [];
                                            variants.forEach((v: any, index: number) => {
                                                branches.push({
                                                    id: v.nextStepId || v.nextStepID,
                                                    label: `Variant ${String.fromCharCode(65 + index)} (${v.name || v.percentage + '%'})`
                                                });
                                            });
                                        }

                                        const validBranches = branches.filter(b => b.id);
                                        setAvailableBranches(validBranches);

                                        // Default to YES branch (first branch) if available
                                        if (validBranches.length > 0) {
                                            initialTarget = validBranches[0].id;
                                        }
                                    } else {
                                        setAvailableBranches([]);
                                    }

                                    setTargetAddStepId(initialTarget);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Thêm User</span>
                            </button>
                        )}
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Xuất CSV</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white hover:shadow-md rounded-full text-slate-400 transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="px-6 py-2.5 border-b border-slate-100 flex justify-between items-center gap-4">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm email..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {stepType === 'action' && (
                            <button
                                onClick={() => onTabChange(activeTab === 'preview' ? 'all_touched' : 'preview')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border shadow-sm ${activeTab === 'preview'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-blue-200'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                                    }`}
                            >
                                <MailOpen className="w-4 h-4" />
                                <span>{activeTab === 'preview' ? 'Đóng Xem Mail' : 'XEM MAIL'}</span>
                            </button>
                        )}
                        <button onClick={onRefresh} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Đã làm mới">
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* TAB FILTERS (Only for Action Steps) */}
                {stepType === 'action' && (
                    <div className="px-6 py-3 border-b border-slate-50 flex gap-2 overflow-x-auto" style={{ minHeight: '56px' }}>
                        <button
                            onClick={() => onTabChange('all_touched')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'all_touched' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Đã đi qua
                        </button>
                        <button
                            onClick={() => onTabChange('waiting')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'waiting' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Đang chờ gửi
                        </button>
                        <button
                            onClick={() => onTabChange('opened')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'opened' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Đã mở mail
                        </button>
                        <button
                            onClick={() => onTabChange('failed')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Gửi lỗi
                        </button>
                        <button
                            onClick={() => onTabChange('unsubscribed')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'unsubscribed' ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Hủy đăng ký
                        </button>
                        <button
                            onClick={() => onTabChange('clicks')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'clicks' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Lượt Click
                        </button>
                        <button
                            onClick={() => onTabChange('report')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'report' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Báo cáo
                        </button>
                    </div>
                )}

                {stepType === 'zalo_zns' && (
                    <div className="px-6 py-3 border-b border-slate-50 flex gap-2 overflow-x-auto" style={{ minHeight: '56px' }}>
                        <button onClick={() => onTabChange('zns_sent')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'zns_sent' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}>Gửi thành công</button>
                        <button onClick={() => onTabChange('waiting')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'waiting' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}>Đang chờ gửi</button>
                        <button onClick={() => onTabChange('zns_clicked')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'zns_clicked' ? 'bg-cyan-50 text-cyan-600 border-cyan-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}>Đã Click Link</button>
                        <button onClick={() => onTabChange('zns_replied')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'zns_replied' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}>Đã Phản hồi</button>
                        <button onClick={() => onTabChange('zns_failed')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'zns_failed' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}>Gửi lỗi</button>
                        <button onClick={() => onTabChange('zns_skipped')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'zns_skipped' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}>Bỏ qua</button>
                    </div>
                )}

                {/* Generic Tabs for Condition/Wait/etc */}
                {!['action', 'zalo_zns', 'completed', 'inactive'].includes(stepType || '') && (
                    <div className="px-6 py-3 border-b border-slate-50 flex gap-2 overflow-x-auto" style={{ minHeight: '56px' }}>
                        <button
                            onClick={() => onTabChange('all_touched')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'all_touched' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            Đã đi qua
                        </button>
                        <button
                            onClick={() => onTabChange('waiting')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${activeTab === 'waiting' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                        >
                            đang chạy
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-[450px] relative">
                    {activeTab === 'clicks' && flowId && stepId ? (
                        <div className="p-6">
                            <LinkClicksTab type="flow" id={flowId} stepId={stepId} />
                        </div>
                    ) : activeTab === 'report' && flowId && stepId ? (
                        <div className="p-6">
                            <TechStatsTab type="flow" id={flowId} stepId={stepId} />
                        </div>
                    ) : activeTab === 'preview' && flowId && stepId ? (
                        <div className="p-6">
                            <LinkClicksTab
                                type="flow"
                                id={flowId}
                                stepId={stepId}
                                initialHtml={stepConfig?.body}
                                initialViewMode="heatmap"
                            />
                        </div>
                    ) : (
                        <div className="relative">
                            {loading && participants.length > 0 && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-30" />
                            )}
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/80 border-b border-slate-200 text-left sticky top-0 z-20 backdrop-blur-sm">
                                    {selectedIds.size > 0 && ['waiting', 'failed', 'unsubscribed', 'zns_failed', 'inactive'].includes(activeTab) ? (
                                        <tr className="bg-[#fffbf0] border-b border-orange-200 shadow-sm animate-in fade-in duration-200">
                                            <th colSpan={['waiting', 'failed', 'unsubscribed', 'zns_failed', 'inactive'].includes(activeTab) ? 5 : 4} className="px-6 py-3">
                                                <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={handleSelectAll} className="p-1 hover:bg-orange-100 rounded text-orange-600 transition-colors" title="Bỏ chọn tất cả">
                                                            <div className="relative flex items-center justify-center">
                                                                <input type="checkbox" checked readOnly className="peer w-5 h-5 cursor-pointer appearance-none rounded-md border-2 border-orange-400 bg-orange-400" />
                                                                <Check className="absolute w-3.5 h-3.5 text-white pointer-events-none" />
                                                            </div>
                                                        </button>
                                                        <span className="text-xs font-bold text-slate-700">Đã chọn <span className="text-orange-600 font-black text-sm">{selectedIds.size}</span> Khách hàng</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {stepType !== 'inactive' && (
                                                            <>
                                                                <button
                                                                    onClick={handleBulkExecute}
                                                                    disabled={bulkActionLoading}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                                                                >
                                                                    <Play className="w-3.5 h-3.5" />
                                                                    <span>{bulkActionLoading ? 'Đang gửi...' : 'Complete & Next'}</span>
                                                                </button>
                                                                <button
                                                                    onClick={handleBulkSkip}
                                                                    disabled={bulkActionLoading}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                                                                >
                                                                    <SkipForward className="w-3.5 h-3.5" />
                                                                    <span>{bulkActionLoading ? 'Đang gửi...' : 'Bỏ qua & Next'}</span>
                                                                </button>
                                                                <div className="h-4 w-px bg-orange-200 mx-1"></div>
                                                            </>
                                                        )}

                                                        {/* Quick Actions Dropdown for Inactive Tab */}
                                                        {stepType === 'inactive' && (
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                                                                    disabled={bulkActionLoading}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                                                                >
                                                                    <Tag className="w-3.5 h-3.5" />
                                                                    <span>Hành động nhanh</span>
                                                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${quickActionsOpen ? 'rotate-180' : ''}`} />
                                                                </button>

                                                                {quickActionsOpen && (
                                                                    <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                                        <button
                                                                            onClick={() => {
                                                                                setQuickActionsOpen(false);
                                                                                setTagModalOpen(true);
                                                                            }}
                                                                            className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 group"
                                                                        >
                                                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                                                                <Tag className="w-4 h-4 text-blue-600" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-bold text-slate-700">Gắn Tag</p>
                                                                                <p className="text-[10px] text-slate-400">Thêm nhãn cho Khách hàng</p>
                                                                            </div>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setQuickActionsOpen(false);
                                                                                setListModalOpen(true);
                                                                            }}
                                                                            className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors flex items-center gap-3 group"
                                                                        >
                                                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                                                                <List className="w-4 h-4 text-blue-600" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-bold text-slate-700">Thêm vào List</p>
                                                                                <p className="text-[10px] text-slate-400">Thêm vào danh sách</p>
                                                                            </div>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setQuickActionsOpen(false);
                                                                                setStatusModalOpen(true);
                                                                            }}
                                                                            className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 transition-colors flex items-center gap-3 group"
                                                                        >
                                                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                                                                                <Check className="w-4 h-4 text-emerald-600" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-xs font-bold text-slate-700">Đổi Trạng thái</p>
                                                                                <p className="text-[10px] text-slate-400">Cập nhật Trạng thái</p>
                                                                            </div>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <button
                                                            onClick={handleBulkRemove}
                                                            disabled={bulkActionLoading}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            <span>{isGlobalSelected ? 'Loại bỏ TẤT CẢ' : 'Loại bỏ'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            {/* Checkbox Column - Show for actionable tabs */}
                                            {['waiting', 'failed', 'unsubscribed', 'zns_failed', 'inactive'].includes(activeTab) && (
                                                <th className="px-4 py-3 w-12">
                                                    <div className="relative flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.size === participants.length && participants.length > 0}
                                                            onChange={handleSelectAll}
                                                            className="peer w-5 h-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition-all checked:border-[#2563eb] checked:bg-[#2563eb] hover:border-[#2563eb]"
                                                        />
                                                        <Check className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                                                    </div>
                                                </th>
                                            )}
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-[35%] min-w-[200px]">
                                                Khách hàng
                                            </th>
                                            {['all_touched', 'report'].includes(activeTab) && stepType !== 'action' && stepType !== 'zalo_zns' && stepType !== 'completed' && (
                                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[20%]">
                                                    Tên nhánh
                                                </th>
                                            )}
                                            {(stepType === 'action' || stepType === 'zalo_zns') && activeTab !== 'waiting' && activeTab !== 'unsubscribed' && !['failed', 'zns_failed'].includes(activeTab as string) && (
                                                <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[80px]">
                                                    Gửi lại
                                                </th>
                                            )}
                                            {stepType === 'completed' ? (
                                                <>
                                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Bước cuối cùng</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Trạng thái</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Số lần</th>
                                                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right whitespace-nowrap">Thời gian</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-[15%]">Trạng thái</th>
                                                    {activeTab === 'opened' && (
                                                        <>
                                                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">Số lần</th>
                                                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Thời gian</th>
                                                        </>
                                                    )}
                                                    {activeTab === 'waiting' ? (
                                                        <>
                                                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Thời gian vào</th>
                                                            <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Thời gian chờ</th>
                                                        </>
                                                    ) : activeTab !== 'opened' ? (
                                                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">
                                                            {['failed', 'zns_failed'].includes(activeTab as string) ? 'Chi tiết lỗi' : 'Thời gian'}
                                                        </th>
                                                    ) : null}

                                                    {activeTab !== 'inactive' && activeTab !== 'unsubscribed' && activeTab !== 'opened' && activeTab !== 'all_touched' && activeTab !== 'waiting' && activeTab !== 'failed' && stepType !== 'zalo_zns' && (
                                                        <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                                                            ĐỊA CHỈ IP
                                                        </th>
                                                    )}
                                                </>
                                            )}
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-slate-100 relative">
                                    {/* "Select All" row - Show when all on page are selected and there are more */}
                                    {selectedIds.size === participants.length && participants.length > 0 && pagination.total > participants.length && ['waiting', 'failed', 'unsubscribed', 'zns_failed', 'zns_skipped'].includes(activeTab) && (
                                        <tr className="bg-orange-50/50">
                                            <td colSpan={['waiting', 'failed', 'unsubscribed', 'zns_failed', 'inactive', 'zns_skipped'].includes(activeTab) ? 5 : 4} className="px-6 py-2.5 text-center">
                                                {isGlobalSelected ? (
                                                    <p className="text-xs font-medium text-slate-600">đã chọn tất cả <span className="font-bold text-orange-600">{pagination.total.toLocaleString()}</span> Khách hàng. <button onClick={() => setIsGlobalSelected(false)} className="ml-2 text-blue-600 font-bold hover:underline">Bỏ chọn</button></p>
                                                ) : (
                                                    <p className="text-xs font-medium text-slate-600">Đã chọn {participants.length} Khách hàng. <button onClick={() => setIsGlobalSelected(true)} className="ml-1 text-orange-600 font-bold hover:underline italic underline-offset-2">Chọn tất cả {pagination.total.toLocaleString()} Khách hàng?</button></p>
                                                )}
                                            </td>
                                        </tr>
                                    )}

                                    {loading && participants.length === 0 ? (
                                        [...Array(6)].map((_, i) => (
                                            <tr key={i}>
                                                {['waiting', 'failed', 'unsubscribed', 'zns_failed', 'inactive', 'zns_skipped'].includes(activeTab) && <td className="px-4 py-4"><Skeleton variant="rectangular" width={16} height={16} /></td>}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <Skeleton variant="circular" width={32} height={32} />
                                                        <div className="space-y-2">
                                                            <Skeleton variant="text" width={100} height={12} />
                                                            <Skeleton variant="text" width={150} height={10} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4"><Skeleton variant="text" width={80} height={12} /></td>
                                                <td className="px-6 py-4"><Skeleton variant="text" width={60} height={12} /></td>
                                                <td className="px-6 py-4 text-right"><Skeleton variant="text" width={100} height={12} /></td>
                                            </tr>
                                        ))
                                    ) : participants.length === 0 ? (
                                        <tr><td colSpan={['waiting', 'failed', 'unsubscribed', 'zns_failed', 'inactive', 'zns_skipped'].includes(activeTab) ? 6 : 5} className="py-20 text-center">
                                            <p className="text-xs font-bold text-slate-400">Không tìm thấy dữ liệu nào.</p>
                                        </td></tr>
                                    ) : participants.map((p, i) => {
                                        const participantId = p.subscriber_id || p.id;
                                        return (
                                            <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                                {/* Checkbox - Show for actionable tabs */}
                                                {['waiting', 'failed', 'unsubscribed', 'zns_failed', 'inactive', 'zns_skipped'].includes(activeTab) && (
                                                    <td className="px-4 py-3">
                                                        <div className="relative flex items-center justify-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedIds.has(participantId)}
                                                                onChange={() => handleSelectOne(participantId)}
                                                                className="peer w-5 h-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition-all checked:border-[#2563eb] checked:bg-[#2563eb] hover:border-[#2563eb]"
                                                            />
                                                            <Check className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                                                        </div>
                                                    </td>
                                                )}
                                                <td className={['failed', 'zns_failed'].includes(activeTab as string) ? 'px-4 py-3' : 'px-6 py-4'}>
                                                    <div 
                                                        className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
                                                        onClick={() => {
                                                            if (onSelectSubscriber) {
                                                                onSelectSubscriber({
                                                                    id: participantId,
                                                                    email: p.email,
                                                                    firstName: p.name || '',
                                                                    ...p
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <div className={`w-7 h-7 rounded-full ${getAvatarBg(p.name, p.email)} flex items-center justify-center text-white font-bold text-[10px] uppercase shrink-0 shadow-sm`}>
                                                            {getInitials(p.name, p.email)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate">{p.name || 'Unknown'}</p>
                                                            <p className="text-[10px] text-slate-400 truncate">
                                                                {stepType === 'zalo_zns' ? (p.phone || p.phone_number || p.phoneNumber || p.email) : p.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {['all_touched', 'report'].includes(activeTab) && stepType !== 'action' && stepType !== 'zalo_zns' && stepType !== 'completed' && (
                                                    <td className="px-4 py-3">
                                                        {p.branchName ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200 bg-white text-slate-700">
                                                                <GitMerge className="w-3 h-3 text-slate-400" />
                                                                {p.branchName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic">Chưa rẽ nhánh</span>
                                                        )}
                                                    </td>
                                                )}

                                                {/* Dedicated Action Column - hidden for failed tabs (error detail needs space) */}
                                                {(stepType === 'action' || stepType === 'zalo_zns') && activeTab !== 'waiting' && activeTab !== 'unsubscribed' && !['failed', 'zns_failed'].includes(activeTab as string) && (
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleResendInit(p);
                                                            }}
                                                            disabled={bulkActionLoading && (resendingParticipant?.id === participantId || resendingParticipant?.subscriber_id === participantId)}
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all inline-flex items-center justify-center border border-slate-100 shadow-sm bg-white disabled:opacity-50"
                                                            title="Gửi lại cho người này"
                                                        >
                                                            {bulkActionLoading && (resendingParticipant?.id === participantId || resendingParticipant?.subscriber_id === participantId) ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                                            ) : (
                                                                <Send className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                    </td>
                                                )}

                                                {stepType === 'completed' ? (
                                                    <>
                                                        <td className="px-6 py-3 text-xs text-slate-600 font-medium">
                                                            {p.stepId ? getStepName(p.stepId) : '--'}
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-100 inline-flex items-center gap-1">
                                                                <Check className="w-3 h-3" /> Hoàn thành
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                {p.completion_count || 1}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-xs font-medium text-slate-500 text-right">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {formatTime(p.completedAt || p.updatedAt || p.enteredAt)}
                                                            </span>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className={`whitespace-nowrap ${['failed', 'zns_failed'].includes(activeTab as string) ? 'px-4 py-3' : 'px-6 py-4'}`}>
                                                            {p.status === 'completed' ? (
                                                                <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-100 inline-flex items-center gap-1">
                                                                    <Check className="w-3 h-3" /> Hoàn thành
                                                                </span>
                                                            ) : p.status === 'opened' ? (
                                                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-100 inline-flex items-center gap-1">
                                                                    <MailOpen className="w-3 h-3" /> Mở email
                                                                </span>
                                                            ) : (activeTab === 'failed' || p.status?.toLowerCase().includes('failed') || p.status?.toLowerCase().includes('error') || p.status?.toLowerCase() === 'fail') ? (
                                                                <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-[10px] font-bold border border-rose-100 inline-flex items-center gap-1">
                                                                    <AlertOctagon className="w-3 h-3" /> Lỗi
                                                                </span>
                                                            ) : p.status === 'zns_sent' ? (
                                                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-100 inline-flex items-center gap-1">
                                                                    <MessageSquare className="w-3 h-3" /> ZNS đã gửi
                                                                </span>
                                                            ) : p.status === 'zns_clicked' ? (
                                                                <span className="bg-cyan-50 text-cyan-600 px-2 py-1 rounded-md text-[10px] font-bold border border-cyan-200 inline-flex items-center gap-1">
                                                                    <MousePointerClick className="w-3 h-3" /> ZNS Clicked
                                                                </span>
                                                            ) : p.status === 'zns_replied' ? (
                                                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-200 inline-flex items-center gap-1">
                                                                    <Reply className="w-3 h-3" /> ZNS Replied
                                                                </span>
                                                            ) : p.status === 'zns_failed' ? (
                                                                <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-[10px] font-bold border border-rose-100 inline-flex items-center gap-1">
                                                                    <AlertOctagon className="w-3 h-3" /> ZNS Lỗi
                                                                </span>
                                                            ) : p.status === 'zns_skipped' ? (
                                                                <span className="bg-slate-50 text-slate-600 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200 inline-flex items-center gap-1">
                                                                    <SkipForward className="w-3 h-3" /> Bỏ qua
                                                                </span>
                                                            ) : (activeTab === 'unsubscribed' || p.status === 'unsubscribed') ? (
                                                                <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded-md text-[10px] font-bold border border-orange-100 inline-flex items-center gap-1">
                                                                    <UserMinus className="w-3 h-3" /> Hủy đăng ký
                                                                </span>
                                                            ) : p.status === 'condition_true' ? (
                                                                <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-100 inline-flex items-center gap-1">
                                                                    <Check className="w-3 h-3" /> Đã khớp
                                                                </span>
                                                            ) : p.status === 'condition_false' ? (
                                                                <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-[10px] font-bold border border-rose-100 inline-flex items-center gap-1">
                                                                    <X className="w-3 h-3" /> Không khớp
                                                                </span>
                                                            ) : (p.status === 'processed' || p.status === 'success') ? (
                                                                <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-100 inline-flex items-center gap-1">
                                                                    <Check className="w-3 h-3" /> Hoàn thành
                                                                </span>
                                                            ) : p.status === 'processing' ? (
                                                                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-100 inline-flex items-center gap-1">
                                                                    <RefreshCcw className="w-3 h-3 animate-spin" /> Đang xử lý
                                                                </span>
                                                            ) : (p.lastError || p.last_error) && p.status === 'waiting' ? (
                                                                <span className="bg-orange-50 text-orange-600 px-2 py-1 rounded-md text-[10px] font-bold border border-orange-200 inline-flex items-center gap-1" title={p.lastError || p.last_error}>
                                                                    <AlertOctagon className="w-3 h-3" /> {p.lastError || p.last_error}
                                                                </span>
                                                            ) : (
                                                                <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-md text-[10px] font-bold border border-amber-100 inline-flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> Đang đợi
                                                                </span>
                                                            )}
                                                        </td>

                                                        {activeTab === 'opened' && (
                                                            <>
                                                                <td className="px-6 py-3 text-center">
                                                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                                                        {p.open_count || 1}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    {(() => {
                                                                        const lastOpen = p.updatedAt || p.updated_at || p.lastOpenAt || p.completedAt;
                                                                        const firstOpen = p.firstOpenAt || p.first_open_at;

                                                                        return (
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
                                                                                    <Clock className="w-3 h-3" />
                                                                                    {lastOpen ? formatTime(lastOpen) : (firstOpen ? formatTime(firstOpen) : '--:--')}
                                                                                </span>
                                                                                {firstOpen && lastOpen && firstOpen !== lastOpen && (
                                                                                    <span className="text-[9px] text-slate-400 mt-0.5">
                                                                                        Lần đầu: {formatTime(firstOpen)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </td>
                                                            </>
                                                        )}

                                                        {['failed', 'zns_failed'].includes(activeTab as string) && (
                                                            <>
                                                                <td className="px-4 py-2 max-w-[260px]">
                                                                    <div className="flex flex-col gap-1">
                                                                        {(() => {
                                                                            // Priority: errorMessage (step-errors API), lastError (participants API), last_error, error_message, fallback
                                                                            const error = p.errorMessage || p.lastError || p.last_error || p.error_message || 'Lỗi không xác định';
                                                                            // Extract short readable part (before first comma or max 80 chars)
                                                                            const shortError = error.length > 80 ? error.substring(0, 80) + '...' : error;
                                                                            return (
                                                                                <div
                                                                                    className="px-2 py-1.5 bg-rose-50 border border-rose-100 rounded-lg text-[10px] text-rose-600 font-semibold flex items-start gap-1.5"
                                                                                    title={error}
                                                                                >
                                                                                    <AlertOctagon className="w-3 h-3 shrink-0 mt-0.5" />
                                                                                    <span className="line-clamp-2 leading-tight">{shortError}</span>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                        <span className="text-[9px] text-slate-400 flex items-center gap-1 ml-0.5">
                                                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                                                            {/* timestamp from step-errors API, fallback to updated_at / completedAt */}
                                                                            {formatTime(p.timestamp || p.updated_at || p.updatedAt || p.completedAt)}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        )}

                                                        {activeTab === 'waiting' ? (
                                                            <>
                                                                <td className="px-6 py-3 text-[11px] font-medium text-slate-500">
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        {p.enteredAt ? formatTime(p.enteredAt) : '--'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    {(() => {
                                                                        // For Condition steps: Calculate deadline from enteredAt + waitDuration
                                                                        if (stepType === 'condition' && stepConfig?.waitDuration) {
                                                                            const enteredMs = new Date(p.enteredAt || p.createdAt || new Date()).getTime();
                                                                            const duration = parseInt(stepConfig.waitDuration);
                                                                            const unit = stepConfig.waitUnit || 'hours';

                                                                            let durationMs = 0;
                                                                            if (unit === 'minutes') durationMs = duration * 60 * 1000;
                                                                            else if (unit === 'hours') durationMs = duration * 60 * 60 * 1000;
                                                                            else if (unit === 'days') durationMs = duration * 24 * 60 * 60 * 1000;

                                                                            const deadline = enteredMs + durationMs;
                                                                            const diff = deadline - new Date().getTime();

                                                                            if (diff > 0) {
                                                                                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                                                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                                                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                                                return (
                                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                                                                                        <Clock className="w-3.5 h-3.5" />
                                                                                        Còn {d > 0 ? `${d}d ` : ''}{h > 0 ? `${h}h ` : ''}{m}m
                                                                                    </span>
                                                                                );
                                                                            } else {
                                                                                return (
                                                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600">
                                                                                        <Clock className="w-3.5 h-3.5" />
                                                                                        Sắp chạy ngay
                                                                                    </span>
                                                                                );
                                                                            }
                                                                        }

                                                                        // For ALL other steps (Email, Action, etc.): Show scheduledAt
                                                                        const timeInfo = calculateTimeRemaining(p.scheduledAt);
                                                                        return (
                                                                            <div className="flex flex-col">
                                                                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${timeInfo.isUrgent
                                                                                    ? 'text-blue-600'
                                                                                    : (new Date(p.scheduledAt) > new Date() ? 'text-blue-600' : 'text-amber-600')
                                                                                    }`}>
                                                                                    <Clock className="w-3.5 h-3.5" />
                                                                                    {timeInfo.text || '--'}
                                                                                </span>
                                                                                <span className="text-[9px] text-slate-400">
                                                                                    {new Date(p.scheduledAt).toLocaleString('vi-VN')}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </td>
                                                            </>
                                                        ) : (activeTab !== 'opened' && !['failed', 'zns_failed'].includes(activeTab as string)) ? (
                                                            <td className="px-6 py-3 text-[11px] font-medium text-slate-500">
                                                                {(activeTab === 'failed' || activeTab === 'unsubscribed' || activeTab === 'all_touched' || activeTab === 'inactive' || p.status === 'completed' || p.status === 'processed' || p.status === 'success' || p.status === 'condition_true' || p.status === 'condition_false' || p.status === 'unsubscribed' || p.status === 'zns_sent' || p.status === 'zns_skipped') ? (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        {activeTab === 'failed' && p.updated_at ? formatTime(p.updated_at) : (p.completedAt ? formatTime(p.completedAt) : (p.updated_at ? formatTime(p.updated_at) : (p.enteredAt ? formatTime(p.enteredAt) : (p.timestamp ? formatTime(p.timestamp) : '--:--'))))}
                                                                    </span>
                                                                ) : p.status === 'opened' ? (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        Lần đầu: {p.firstOpenAt ? formatTime(p.firstOpenAt) : '--:--'}
                                                                    </span>
                                                                ) : (
                                                                    (() => {
                                                                        // Special handling for Condition steps: Show Deadline instead of Polling Time
                                                                        if (stepType === 'condition' && (activeTab as string) === 'waiting' && stepConfig?.waitDuration) {
                                                                            const enteredMs = new Date(p.enteredAt || p.createdAt || new Date()).getTime();
                                                                            const duration = parseInt(stepConfig.waitDuration);
                                                                            const unit = stepConfig.waitUnit || 'hours';

                                                                            let durationMs = 0;
                                                                            if (unit === 'minutes') durationMs = duration * 60 * 1000;
                                                                            else if (unit === 'hours') durationMs = duration * 60 * 60 * 1000;
                                                                            else if (unit === 'days') durationMs = duration * 24 * 60 * 60 * 1000;

                                                                            const deadline = enteredMs + durationMs;
                                                                            const diff = deadline - new Date().getTime();

                                                                            if (diff > 0) {
                                                                                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                                                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                                                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                                                return (
                                                                                    <span className="inline-flex items-center gap-1 font-bold text-blue-600" title={`Kiểm tra - Làm mới mỗi 1 phút. Hết hạn lúc: ${new Date(Date.now() + 30000).toLocaleTimeString()}`}>
                                                                                        <Clock className="w-3.5 h-3.5" />
                                                                                        Chờ {d > 0 ? `${d}d ` : ''}{h > 0 ? `${h}h ` : ''}{m}m (Deadline)
                                                                                    </span>
                                                                                );
                                                                            }
                                                                        }

                                                                        const timeInfo = calculateTimeRemaining(p.scheduledAt);
                                                                        return (
                                                                            <span className={`inline-flex items-center gap-1 font-bold ${timeInfo.isUrgent
                                                                                ? 'text-blue-600'
                                                                                : 'text-amber-600'
                                                                                }`}>
                                                                                <Clock className="w-3.5 h-3.5" />
                                                                                {timeInfo.text || '--'}
                                                                            </span>
                                                                        );
                                                                    })()
                                                                )}
                                                            </td>
                                                        ) : null}

                                                        {activeTab !== 'inactive' && activeTab !== 'unsubscribed' && activeTab !== 'opened' && activeTab !== 'all_touched' && activeTab !== 'waiting' && activeTab !== 'failed' && stepType !== 'zalo_zns' && (
                                                            <td className="px-6 py-3 text-[11px] text-slate-500 font-mono text-right">
                                                                {p.ip || '--'}
                                                            </td>
                                                        )}
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer / Pagination */}
                {
                    pagination.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-[24px] flex items-center justify-between">
                            <button
                                disabled={pagination.page <= 1}
                                onClick={() => onPageChange(pagination.page - 1)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                Trước
                            </button>
                            <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                                Trang {pagination.page} / {pagination.totalPages}
                            </span>
                            <button
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => onPageChange(pagination.page + 1)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                Sau
                            </button>
                        </div>
                    )
                }
            </div >

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={executeRemove}
                title="Xác nhận loại bỏ"
                message={`Bạn có chắc muốn loại ${isGlobalSelected ? pagination.total : selectedIds.size} Khách hàng ra khỏi flow?`}
                confirmText="Loại bỏ"
                cancelText="Hủy"
                variant="danger"
                isLoading={bulkActionLoading}
            />

            {/* Branch Selection Modal */}
            <SelectBranchModal
                isOpen={branchModalOpen}
                onClose={() => setBranchModalOpen(false)}
                onConfirm={(branchId) => executeBulkAction(branchId, actionMode === 'execute')}
                branches={branches}
                title="Chọn nhánh tiếp theo"
                stepType={stepType || ''}
            />

            {/* Add User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
                    <div className={`w-full max-w-3xl border rounded-2xl shadow-2xl animate-in fade-in zoom-in-97 duration-200 flex flex-col max-h-[90vh] ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
                        <div className={`px-6 py-4 border-b flex items-center justify-between rounded-t-2xl shrink-0 ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80' : 'bg-slate-50/50 border-slate-100'}`}>
                            <h3 className={`font-bold flex items-center gap-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                                <UserPlus className="w-5 h-5 text-blue-600" />
                                Thêm người dùng vào bước này
                            </h3>
                            <button onClick={() => setIsAddModalOpen(false)} className={`p-2 rounded-full transition-colors ${isDarkTheme ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                            
                            {/* Danh sách List Multi-select */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">
                                    Thêm từ dữ liệu hệ thống
                                </label>
                                
                                <div className="space-y-3">
                                    {/* Sub-Tabs */}
                                    <div className="flex bg-slate-100 p-0.5 rounded-lg w-full mb-1">
                                        <button
                                            onClick={() => setAddSourceTab('list')}
                                            className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${addSourceTab === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <List className="w-3 h-3" /> Danh sách
                                        </button>
                                        <button
                                            onClick={() => setAddSourceTab('sync')}
                                            className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${addSourceTab === 'sync' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Globe className="w-3 h-3" /> Đồng bộ
                                        </button>
                                        <button
                                            onClick={() => setAddSourceTab('segment')}
                                            className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${addSourceTab === 'segment' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <Layers className="w-3 h-3" /> Phân khúc
                                        </button>
                                    </div>

                                    {/* Search Bar */}
                                    <div className="relative group">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-slate-500 transition-colors" />
                                        <input 
                                            value={addSearchTerm} 
                                            onChange={e => setAddSearchTerm(e.target.value)} 
                                            placeholder="Tìm kiếm nhanh..." 
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all" 
                                        />
                                    </div>

                                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-3 p-1">
                                        {availableLists.length === 0 && availableSegments.length === 0 ? (
                                            <div className="p-get bg-slate-50 border border-slate-200 rounded-2xl text-center">
                                                <p className="text-sm text-slate-500 italic">Hệ thống chưa có danh sách này.</p>
                                            </div>
                                        ) : (
                                            (addSourceTab === 'segment' ? availableSegments : availableLists)
                                                .filter(l => addSourceTab === 'list' ? isManualList(l) : (addSourceTab === 'sync' ? isSyncList(l) : true))
                                                .filter(l => l.name.toLowerCase().includes(addSearchTerm.toLowerCase()))
                                                .map(list => {
                                                const isSelected = addSourceTab === 'segment' ? addSegmentIds.includes(list.id) : addListIds.includes(list.id);
                                                return (
                                                <label 
                                                    key={list.id} 
                                                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 group relative overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-50 shadow-md ring-4 ring-blue-500/5' : 'border-transparent bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm'} cursor-pointer`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl transition-all duration-500 ${isSelected ? 'bg-blue-500 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-400 group-hover:text-slate-600 shadow-sm'}`}>
                                                            {addSourceTab === 'list' ? <List className="w-5 h-5" /> : (addSourceTab === 'segment' ? <Layers className="w-5 h-5" /> : (list.source === 'MISA CRM' ? <MisaIcon className="w-5 h-5" /> : <GoogleSheetsIcon className="w-5 h-5" />))}
                                                        </div>
                                                        <div className="text-left overflow-hidden">
                                                            <p className={`text-[13px] font-black tracking-tight transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{list.name}</p>
                                                            <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 transition-colors ${isSelected ? 'text-blue-600/70' : 'text-slate-400'}`}>{list.count || 0} LIÊN HỆ {list.source && list.source !== 'Manual' && `- ${list.source}`}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ml-2 ${isSelected ? 'border-blue-500 bg-blue-500 text-white scale-110 shadow-sm' : 'border-slate-200 bg-white group-hover:border-slate-400'}`}>
                                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <input 
                                                        type="checkbox" 
                                                        className="hidden"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (addSourceTab === 'segment') {
                                                                if (e.target.checked) setAddSegmentIds([...addSegmentIds, list.id]);
                                                                else setAddSegmentIds(addSegmentIds.filter(id => id !== list.id));
                                                            } else {
                                                                if (e.target.checked) setAddListIds([...addListIds, list.id]);
                                                                else setAddListIds(addListIds.filter(id => id !== list.id));
                                                            }
                                                        }}
                                                    />
                                                </label>
                                        )})
                                    )}
                                    </div>
                                </div>
                            </div>

                            {/* Raw Data Textarea */}
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">
                                    Danh sách Email / SĐT / UID (Nhập thủ công)
                                </label>
                                <textarea
                                    className="w-full h-28 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-mono text-slate-700 resize-none"
                                    placeholder="example@gmail.com&#10;0912345678&#10;84912345678..."
                                    value={addEmails}
                                    onChange={e => setAddEmails(e.target.value)}
                                ></textarea>
                                <p className="mt-2 text-[11px] text-slate-400">
                                    * Mỗi dòng một thông tin. Liên hệ chưa có sẽ được tự động tạo mới.
                                </p>
                            </div>

                            {/* Branch Selection (if available) */}
                            {availableBranches.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                                        Vị trí bắt đầu
                                    </label>
                                    <div className="relative z-50">
                                        <button
                                            type="button"
                                            onClick={() => setBranchSelectOpen(!branchSelectOpen)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all text-sm font-bold text-slate-700 flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-2">
                                                {/* Display Logic */}
                                                {(() => {
                                                    if (targetAddStepId === stepId || !targetAddStepId) {
                                                        return (
                                                            <>
                                                                <span className="text-amber-600">?</span>
                                                                <span>Mặc định (Kiểm tra Logic/Random)</span>
                                                            </>
                                                        );
                                                    }
                                                    const selectedBranch = availableBranches.find(b => b.id === targetAddStepId);
                                                    return (
                                                        <>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                            <span className="text-blue-700">{selectedBranch?.label || 'Đã chọn nhánh'}</span>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${branchSelectOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {branchSelectOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={() => setBranchSelectOpen(false)}
                                                ></div>
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-200 ring-4 ring-slate-400/10 max-h-[300px] overflow-y-auto custom-scrollbar">
                                                    {/* Option 1: Default */}
                                                    <div
                                                        onClick={() => {
                                                            setTargetAddStepId(stepId || '');
                                                            setBranchSelectOpen(false);
                                                        }}
                                                        className={`px-3 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all ${(!targetAddStepId || targetAddStepId === stepId)
                                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                                            : 'hover:bg-slate-50 text-slate-600'
                                                            }`}
                                                    >
                                                        <span className={(!targetAddStepId || targetAddStepId === stepId) ? 'text-blue-200' : 'text-slate-400'}>?</span>
                                                        <span className="text-sm font-bold">Mặc định (Kiểm tra Logic/Random)</span>
                                                        {(!targetAddStepId || targetAddStepId === stepId) && <Check className="w-4 h-4 ml-auto text-white" />}
                                                    </div>

                                                    <div className="my-2 h-px bg-slate-100"></div>

                                                    <div className="px-3 pb-2 pt-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                            Bắt buộc vào nhánh (Bỏ qua logic)
                                                        </span>
                                                    </div>

                                                    <div className="space-y-1">
                                                        {availableBranches.map((b, i) => {
                                                            const isSelected = targetAddStepId === b.id;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    onClick={() => {
                                                                        setTargetAddStepId(b.id);
                                                                        setBranchSelectOpen(false);
                                                                    }}
                                                                    className={`px-3 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all ${isSelected
                                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                                                        : 'hover:bg-slate-50 text-slate-600'
                                                                        }`}
                                                                >
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-300'}`}></span>
                                                                    <span className="text-sm font-medium">{b.label}</span>
                                                                    {isSelected && <Check className="w-4 h-4 ml-auto text-white" />}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex gap-2">
                                        <AlertOctagon className="w-4 h-4 shrink-0" />
                                        <span>
                                            Nếu chọn nhánh cụ thể, người dùng sẽ <b>Bỏ qua</b> logic của bước này và đi thẳng vào nhánh đã chọn.
                                        </span>
                                    </p>
                                </div>
                            )}

                            {/* Timing Options for Wait step */}
                            {((targetAddStepId ? availableBranches.find(b => b.id === targetAddStepId) : stepData)?.type === 'wait' || stepData?.type === 'wait') && (
                                <div>
                                    <label className="block text-[11px] font-black text-slate-500 mb-2 uppercase tracking-wide">
                                        Thời gian thực thi (Cho bước Wait)
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className={`flex flex-col gap-1 p-3 rounded-xl border border-slate-200 cursor-pointer transition-all ${timingMode === 'native' ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-500/50' : 'hover:bg-slate-50'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="radio" checked={timingMode === 'native'} onChange={() => setTimingMode('native')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                                <span className="text-sm font-bold text-slate-700">Chờ theo cài đặt</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 ml-6 leading-tight">Tuân thủ thời gian đợi của bước này.</p>
                                        </label>
                                        <label className={`flex flex-col gap-1 p-3 rounded-xl border border-slate-200 cursor-pointer transition-all ${timingMode === 'immediate' ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-500/50' : 'hover:bg-slate-50'}`}>
                                            <div className="flex items-center gap-2">
                                                <input type="radio" checked={timingMode === 'immediate'} onChange={() => setTimingMode('immediate')} className="w-4 h-4 text-orange-600 focus:ring-orange-500" />
                                                <span className="text-sm font-bold text-slate-700">Bỏ qua Wait</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 ml-6 leading-tight">Thời gian Wait = 0. Gửi ngay lập tức (Chỉ đợi 5p chống Spam).</p>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Deduplication Estimate Display */}
                            {(!addEmails.trim() && addListIds.length === 0) ? null : isEstimating ? (
                                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-xl text-xs font-medium border border-blue-100">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Đang kiểm tra trùng lặp hệ thống...
                                </div>
                            ) : estimateData ? (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-emerald-100 flex items-center justify-center shrink-0">
                                            <Check className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-emerald-800">Sẽ thêm <span className="text-xl mx-0.5">{estimateData.valid}</span> Khách hàng vào Flow</h4>
                                            <p className="text-[11px] text-emerald-700 mt-1.5 opacity-90 leading-relaxed">
                                                Tổng hợp được <b>{estimateData.total_found}</b> liên hệ từ danh sách.<br/>
                                                Hệ thống tự động cấn trừ <b>{estimateData.duplicated}</b> Khách hàng <span className="underline decoration-emerald-300 underline-offset-2">đã từng</span> tham gia Flow này.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl shrink-0">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-slate-600 font-semibold text-sm hover:bg-white hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-slate-200"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={() => {
                                    if (!addEmails.trim() && addListIds.length === 0) return toast.error('Vui lòng nhập email hoặc chọn Danh sách');
                                    setAddingUsers(true);

                                    const emails = addEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e);

                                    api.post(`flows?id=${flowId}&route=manual-add-participant`, {
                                        inputs: emails, 
                                        list_ids: addListIds,
                                        segment_ids: addSegmentIds,
                                        timing_mode: timingMode,
                                        step_id: targetAddStepId || stepId 
                                    }).then(res => {
                                        const data = res.data as any; 
                                        if (res.success) {
                                            toast.success(res.message || `Đã thêm ${data?.added || 0} Khách hàng`);
                                            setAddEmails(''); 
                                            setAddListIds([]);
                                            setAddSegmentIds([]);
                                            setTimingMode('immediate');
                                            setEstimateData(null);
                                            setIsAddModalOpen(false); 
                                            onRefresh(); 
                                        } else {
                                            toast.error(res.message || 'Lỗi thêm Khách hàng');
                                            if (data?.errors && data.errors.length > 0) {
                                                console.error(data.errors);
                                                toast.error(`Chi tiết lỗi: ${data.errors[0]}...`);
                                            }
                                        }
                                    }).catch(err => {
                                        toast.error('Lỗi kết nối server');
                                        console.error(err);
                                    }).finally(() => setAddingUsers(false));
                                }}
                                disabled={addingUsers || isEstimating}
                                className="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {addingUsers ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                {addingUsers ? 'Đang thêm...' : 'Thêm ngay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resend Confirmation Modal */}
            <ConfirmModal
                isOpen={resendConfirmOpen}
                onClose={() => {
                    setResendConfirmOpen(false);
                    setResendingParticipant(null);
                }}
                onConfirm={executeResend}
                title="Xác nhận gửi lại?"
                message={`Bạn có chắc chắn muốn gửi lại nội dung bước này cho ${(resendingParticipant?.phone || resendingParticipant?.email || resendingParticipant?.zalo_uid || 'người này')}?`}
                confirmText="Gửi ngay"
                variant="info"
                isLoading={bulkActionLoading}
            />

            {/* Quick Action: Tag Selection Modal */}
            {tagModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                <Tag className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Gắn Tag Khách hàng</h3>
                                <p className="text-xs text-slate-500">Chọn tag muốn gắn cho {isGlobalSelected ? pagination.total : selectedIds.size} Khách hàng</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Chọn Tag</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                                    value={selectedTag}
                                    onChange={(e) => setSelectedTag(e.target.value)}
                                >
                                    <option value="">-- Chọn mớit Tag --</option>
                                    {availableTags.map(tag => (
                                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setTagModalOpen(false)}
                                    className="flex-1 py-2.5 px-4 bg-slate-50 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={handleBulkAddTag}
                                    disabled={bulkActionLoading || !selectedTag}
                                    className="flex-[2] py-2.5 px-4 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    <span>Xác nhận gắn Tag</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Action: List Selection Modal */}
            {listModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                <List className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Thêm vào Danh sách</h3>
                                <p className="text-xs text-slate-500">Chọn list muốn thêm {isGlobalSelected ? pagination.total : selectedIds.size} Khách hàng vào</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Chọn Danh sách</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
                                    value={selectedList}
                                    onChange={(e) => setSelectedList(e.target.value)}
                                >
                                    <option value="">-- Chọn mớit List --</option>
                                    {availableLists.map(list => (
                                        <option key={list.id} value={list.id}>{list.name} ({list.subscribers_count || 0} user)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setListModalOpen(false)}
                                    className="flex-1 py-2.5 px-4 bg-slate-50 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={handleBulkAddToList}
                                    disabled={bulkActionLoading || !selectedList}
                                    className="flex-[2] py-2.5 px-4 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    <span>Xác nhận thêm vào List</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Action: Status Selection Modal */}
            {statusModalOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[24px] shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                                <Check className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Đổi Trạng thái liên hệ</h3>
                                <p className="text-xs text-slate-500">Cập nhật Trạng thái cho {isGlobalSelected ? pagination.total : selectedIds.size} Khách hàng</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Chọn Trạng thái mới</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'active', label: 'Hoạt động', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                                        { value: 'unsubscribed', label: 'Hủy đăng ký', bg: 'bg-orange-50 text-orange-600 border-orange-100' },
                                        { value: 'bounced', label: 'Bounced', bg: 'bg-rose-50 text-rose-600 border-rose-100' },
                                        { value: 'complained', label: 'Khiếu nại', bg: 'bg-slate-100 text-slate-600 border-slate-200' }
                                    ].map(status => (
                                        <button
                                            key={status.value}
                                            onClick={() => setSelectedStatus(status.value)}
                                            className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${selectedStatus === status.value ? status.bg + ' ring-2 ring-offset-1 select-none' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                                        >
                                            {status.label}
                                            {selectedStatus === status.value && <Check className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setStatusModalOpen(false)}
                                    className="flex-1 py-2.5 px-4 bg-slate-50 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    onClick={handleBulkChangeStatus}
                                    disabled={bulkActionLoading || !selectedStatus}
                                    className="flex-[2] py-2.5 px-4 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    <span>Xác nhận đổi Trạng thái</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default StepParticipantsModal;



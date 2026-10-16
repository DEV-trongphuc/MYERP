import React from 'react';
import { MoreHorizontal, Clock, MailOpen, MousePointer2, UserPlus, Zap, Users, AlertTriangle, Edit, Tag, PlusSquare, Trash2, Check } from 'lucide-react';
import Badge from '../../common/Badge';
import { Subscriber } from '../../../types';
import BulkActionsToolbar from '../BulkActionsToolbar';
import Skeleton from '../../common/Skeleton';
import { ContextMenu } from '../../common/ContextMenu';
import Pagination from '../../common/Pagination';
import { Avatar } from '../../../../ui/Avatar';
import { AudienceEmptyState, ROW_CLASS, TD_CLASS, TH_CLASS, THEAD_CLASS } from '../AudienceUi';

/** Column ids understood by the table (must match COLUMN_DEFINITIONS in AudienceSegmentsPage). */
export const CONTACT_COLUMN_LABELS: Record<string, string> = {
    name: 'Khách hàng',
    phone: 'Liên hệ',
    company: 'Công ty',
    status: 'Trạng thái',
    source: 'Nguồn',
    lastActivity: 'Hoạt động gần nhất',
    leadScore: 'Điểm Lead',
    tags: 'Tags',
    salesperson: 'Phụ trách',
    joinedAt: 'Ngày tham gia',
};
const COLUMN_ORDER = Object.keys(CONTACT_COLUMN_LABELS);

interface ContactsTabProps {
    loading?: boolean;
    /** Error message from the last subscribers request (null when OK). */
    error?: string | null;
    onRetry?: () => void;
    /** True when any search / filter is active — switches the empty-state copy. */
    hasActiveFilters?: boolean;
    onClearFilters?: () => void;
    onImport?: () => void;
    subscribers: Subscriber[];
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onToggleSelectAll: () => void;
    onSelectSubscriber: (sub: Subscriber) => void;
    formatRelativeTime: (dateString?: string) => string;
    currentPage: number;
    totalPages: number;
    totalCount: number;
    onPageChange: (page: number) => void;
    onBulkDelete: (options?: { targetType: string, status?: string, tag?: string }) => void;
    onBulkTag: () => void;
    onBulkAddToList: () => void;
    isGlobalSelected: boolean;
    onToggleGlobalSelection: (val: boolean) => void;
    visibleColumns: string[];
    itemsPerPage: number;
    onItemsPerPageChange: (value: number) => void;
}

const isValidDate = (d: Date) => d instanceof Date && !Number.isNaN(d.getTime());

const getCleanName = (name: unknown) => {
    if (!name || name === 0 || name === '0') return '';
    return String(name).trim();
};

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (!isValidDate(d)) return dateStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'neutral' | 'info' }> = {
    active: { label: 'Active', variant: 'success' },
    lead: { label: 'Lead', variant: 'info' },
    customer: { label: 'Customer', variant: 'success' },
    unsubscribed: { label: 'Unsubscribed', variant: 'danger' },
    bounced: { label: 'Bounced', variant: 'danger' },
    complained: { label: 'Complained', variant: 'danger' },
};

const sourceLabel = (sub: Subscriber) => {
    const email = sub.email || '';
    const s = (sub.source || '').toLowerCase();
    if (s.includes('zalo') || email.includes('@zalo-oa.vn')) return 'Zalo OA';
    if (s.includes('facebook') || s.includes('messenger') || email.includes('@facebook.com') || (sub.meta_psid && sub.meta_psid !== '0')) return 'Meta Messenger';
    if (s.includes('csv') || s.includes('import') || s.includes('file')) return 'CSV Import';
    if (s.includes('api')) return 'API';
    return sub.source || 'Web Form';
};

interface ContactRowProps {
    sub: Subscriber;
    isSelected: boolean;
    columns: string[];
    onToggle: (id: string) => void;
    onSelect: (sub: Subscriber) => void;
    renderLastActive: (sub: Subscriber) => React.ReactNode;
    onContextMenu: (e: React.MouseEvent, sub: Subscriber) => void;
}

const ContactRow = React.memo<ContactRowProps>(({ sub, isSelected, columns, onToggle, onSelect, renderLastActive, onContextMenu }) => {
    const fullName = `${getCleanName(sub.firstName)} ${getCleanName(sub.lastName)}`.trim() || 'Chưa có tên';
    const email = sub.email || '';
    const isVirtualEmail = email.includes('@no-email.domation') || email.includes('@zalo-oa.vn') || email.includes('@facebook.com');
    const displayEmail = isVirtualEmail ? (email.includes('@zalo-oa.vn') ? 'Zalo Identity' : 'Meta Identity') : email;
    const contactId = (sub as any).contact_id;
    const statusKey = String(sub.status || 'active');
    const status = STATUS_MAP[statusKey] || { label: statusKey.charAt(0).toUpperCase() + statusKey.slice(1), variant: 'neutral' as const };

    const renderCell = (col: string) => {
        switch (col) {
            case 'name':
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={fullName} src={sub.avatar} size={32} className="shrink-0" />
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[13px] font-semibold text-[var(--color-text)] truncate max-w-[220px]">{fullName}</span>
                                {contactId ? (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { initialTab: 'journey360', id: Number(contactId) } }));
                                        }}
                                        className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-primary-light)] text-[var(--color-primary)] hover:opacity-80 transition-opacity"
                                        title="Mở hồ sơ CRM 360°"
                                    >
                                        CRM #{contactId}
                                    </button>
                                ) : null}
                            </div>
                            {!columns.includes('phone') && displayEmail && (
                                <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[260px]">{displayEmail}</div>
                            )}
                        </div>
                    </div>
                );
            case 'phone':
                return (
                    <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[var(--color-text)]">{sub.phoneNumber || '—'}</div>
                        <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[240px]">{displayEmail || '—'}</div>
                    </div>
                );
            case 'company':
                return <span className="text-[13px] text-[var(--color-text-light)]">{sub.companyName || '—'}</span>;
            case 'status':
                return <Badge variant={status.variant}>{status.label}</Badge>;
            case 'source':
                return <span className="text-[13px] text-[var(--color-text-light)]">{sourceLabel(sub)}</span>;
            case 'lastActivity':
                return renderLastActive(sub);
            case 'leadScore':
                return <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">{Number(sub.leadScore || 0)}</span>;
            case 'tags': {
                const tags = Array.isArray(sub.tags) ? sub.tags : [];
                if (tags.length === 0) return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
                return (
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {tags.slice(0, 2).map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-light)] truncate max-w-[100px]">{t}</span>
                        ))}
                        {tags.length > 2 && <span className="text-[11px] text-[var(--color-text-muted)]">+{tags.length - 2}</span>}
                    </div>
                );
            }
            case 'salesperson':
                return <span className="text-[13px] text-[var(--color-text-light)]">{sub.salesperson || '—'}</span>;
            case 'joinedAt':
                return <span className="text-xs text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">{formatDateTime(sub.joinedAt || (sub as any).createdAt)}</span>;
            default:
                return null;
        }
    };

    return (
        <tr
            className={`${ROW_CLASS} cursor-pointer ${isSelected ? 'bg-[var(--color-primary-light)]' : ''}`}
            onClick={() => onSelect(sub)}
            onContextMenu={(e) => onContextMenu(e, sub)}
        >
            <td className="pl-4 pr-2 py-3 w-10" onClick={(e) => { e.stopPropagation(); onToggle(sub.id); }}>
                <span
                    role="checkbox"
                    aria-checked={isSelected}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>
            </td>
            {columns.map(col => (
                <td key={col} className={TD_CLASS}>{renderCell(col)}</td>
            ))}
            <td className="px-4 py-3 text-right w-12">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onContextMenu(e, sub); }}
                    className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition-colors"
                    title="Thao tác"
                >
                    <MoreHorizontal className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
});
ContactRow.displayName = 'ContactRow';

const ContactsTab = React.memo<ContactsTabProps>(({
    loading, error, onRetry, hasActiveFilters, onClearFilters, onImport,
    subscribers, selectedIds, onToggleSelection, onToggleSelectAll, onSelectSubscriber,
    formatRelativeTime, currentPage, totalPages, totalCount, onPageChange, onBulkDelete,
    onBulkTag, onBulkAddToList, isGlobalSelected, onToggleGlobalSelection, visibleColumns, itemsPerPage
}) => {
    const columns = React.useMemo(() => {
        const cols = COLUMN_ORDER.filter(c => c === 'name' || visibleColumns.includes(c));
        return cols.length > 0 ? cols : ['name'];
    }, [visibleColumns]);

    const selectedOnPageCount = subscribers.reduce((n, s) => n + (selectedIds.has(s.id) ? 1 : 0), 0);
    const isAllPageSelected = subscribers.length > 0 && selectedOnPageCount === subscribers.length;
    const colSpan = columns.length + 2;
    const isFirstLoad = loading && subscribers.length === 0;

    const renderLastActive = React.useCallback((sub: Subscriber) => {
        const lastClickDate = sub.stats?.lastClickAt ? new Date(sub.stats.lastClickAt) : null;
        const lastOpenDate = sub.stats?.lastOpenAt ? new Date(sub.stats.lastOpenAt) : null;
        const joinedDate = sub.joinedAt ? new Date(sub.joinedAt) : null;
        const genericActivityDate = sub.lastActivityAt ? new Date(sub.lastActivityAt) : null;

        let latest: { type: 'click' | 'open' | 'joined' | 'generic', date: Date } | null = null;
        if (lastClickDate && isValidDate(lastClickDate)) latest = { type: 'click', date: lastClickDate };
        if (lastOpenDate && isValidDate(lastOpenDate) && (!latest || lastOpenDate.getTime() > latest.date.getTime())) latest = { type: 'open', date: lastOpenDate };
        if (genericActivityDate && isValidDate(genericActivityDate)) {
            const joinMs = (joinedDate && isValidDate(joinedDate)) ? joinedDate.getTime() : 0;
            if (genericActivityDate.getTime() > joinMs + 2000 && (!latest || genericActivityDate.getTime() > latest.date.getTime())) {
                latest = { type: 'generic', date: genericActivityDate };
            }
        }
        if (joinedDate && isValidDate(joinedDate) && (!latest || joinedDate.getTime() > latest.date.getTime())) latest = { type: 'joined', date: joinedDate };

        if (!latest) {
            return (
                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <Clock className="w-3.5 h-3.5" /> Chưa tương tác
                </span>
            );
        }
        const timeAgo = formatRelativeTime(latest.date.toISOString());
        const meta = {
            click: { Icon: MousePointer2, label: 'Click link', cls: 'text-emerald-600' },
            open: { Icon: MailOpen, label: 'Mở email', cls: 'text-emerald-600' },
            generic: { Icon: Zap, label: 'Tương tác', cls: 'text-[var(--color-text-light)]' },
            joined: { Icon: UserPlus, label: 'Tham gia', cls: 'text-[var(--color-text-light)]' },
        }[latest.type];
        return (
            <span className={`inline-flex items-center gap-1.5 text-xs ${meta.cls}`}>
                <meta.Icon className="w-3.5 h-3.5" />
                <span className="font-medium">{meta.label}</span>
                <span className="text-[var(--color-text-muted)]">· {timeAgo}</span>
            </span>
        );
    }, [formatRelativeTime]);

    // --- CONTEXT MENU ---
    const [contextMenu, setContextMenu] = React.useState<{ x: number, y: number, sub: Subscriber } | null>(null);
    const handleContextMenu = React.useCallback((e: React.MouseEvent, sub: Subscriber) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, sub });
    }, []);
    const closeContextMenu = React.useCallback(() => setContextMenu(null), []);

    const ensureSelected = (id: string) => {
        if (!selectedIds.has(id)) onToggleSelection(id);
    };

    return (
        <>
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={closeContextMenu}
                    items={[
                        { id: 'edit', label: 'Xem / chỉnh sửa', icon: Edit, onClick: () => onSelectSubscriber(contextMenu.sub) },
                        { id: 'add-tag', label: 'Thêm Tag', icon: Tag, onClick: () => { ensureSelected(contextMenu.sub.id); setTimeout(() => onBulkTag(), 100); } },
                        { id: 'add-list', label: 'Thêm vào danh sách', icon: PlusSquare, onClick: () => { ensureSelected(contextMenu.sub.id); setTimeout(() => onBulkAddToList(), 100); } },
                        { id: 'delete', label: 'Xóa liên hệ', icon: Trash2, danger: true, divider: true, onClick: () => { ensureSelected(contextMenu.sub.id); setTimeout(() => onBulkDelete(), 100); } },
                    ]}
                />
            )}

            <div className={`overflow-auto max-h-[calc(100vh-360px)] min-h-[320px] transition-opacity ${loading && !isFirstLoad ? 'opacity-60' : ''}`}>
                <table className="w-full text-sm border-collapse">
                    <thead className={THEAD_CLASS}>
                        {selectedIds.size > 0 ? (
                            <BulkActionsToolbar
                                selectedIds={selectedIds}
                                subscribers={subscribers}
                                visibleColumnsCount={columns.length}
                                isGlobalSelected={isGlobalSelected}
                                onToggleSelectAll={onToggleSelectAll}
                                onBulkTag={onBulkTag}
                                onBulkAddToList={onBulkAddToList}
                                onBulkDelete={() => {
                                    if (isGlobalSelected) onBulkDelete({ targetType: 'all' });
                                    else onBulkDelete();
                                }}
                            />
                        ) : (
                            <tr className="border-b border-[var(--color-border)]">
                                <th className="pl-4 pr-2 py-3 w-10">
                                    <button
                                        type="button"
                                        onClick={onToggleSelectAll}
                                        disabled={subscribers.length === 0}
                                        className={`w-4 h-4 rounded border flex items-center justify-center ${isAllPageSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                                        title="Chọn tất cả trên trang"
                                    >
                                        {isAllPageSelected && <Check className="w-3 h-3 text-white" />}
                                    </button>
                                </th>
                                {columns.map(col => (
                                    <th key={col} className={TH_CLASS}>{CONTACT_COLUMN_LABELS[col]}</th>
                                ))}
                                <th className="px-4 py-3 w-12" />
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {isAllPageSelected && totalCount > subscribers.length && (
                            <tr className="bg-[var(--color-primary-light)]">
                                <td colSpan={colSpan} className="px-4 py-2 text-center text-xs text-[var(--color-text-light)]">
                                    {isGlobalSelected ? (
                                        <>Đã chọn tất cả <b className="text-[var(--color-primary)]">{totalCount.toLocaleString('vi-VN')}</b> liên hệ.{' '}
                                            <button type="button" onClick={() => onToggleGlobalSelection(false)} className="ml-1 font-semibold text-[var(--color-primary)] hover:underline">Bỏ chọn</button></>
                                    ) : (
                                        <>Đã chọn {subscribers.length} liên hệ trên trang này.{' '}
                                            <button type="button" onClick={() => onToggleGlobalSelection(true)} className="ml-1 font-semibold text-[var(--color-primary)] hover:underline">
                                                Chọn tất cả {totalCount.toLocaleString('vi-VN')} liên hệ
                                            </button></>
                                    )}
                                </td>
                            </tr>
                        )}

                        {isFirstLoad && Array.from({ length: 8 }).map((_, i) => (
                            <tr key={`sk-${i}`} className="border-b border-[var(--color-border-light)]">
                                <td className="pl-4 pr-2 py-3"><Skeleton variant="rounded" width={16} height={16} /></td>
                                {columns.map(col => (
                                    <td key={col} className={TD_CLASS}>
                                        {col === 'name' ? (
                                            <div className="flex items-center gap-3">
                                                <Skeleton variant="circular" width={32} height={32} />
                                                <Skeleton variant="text" width={120} height={14} />
                                            </div>
                                        ) : <Skeleton variant="text" width={80} height={12} />}
                                    </td>
                                ))}
                                <td className="px-4 py-3" />
                            </tr>
                        ))}

                        {!isFirstLoad && subscribers.map(sub => (
                            <ContactRow
                                key={sub.id}
                                sub={sub}
                                isSelected={selectedIds.has(sub.id)}
                                columns={columns}
                                onToggle={onToggleSelection}
                                onSelect={onSelectSubscriber}
                                renderLastActive={renderLastActive}
                                onContextMenu={handleContextMenu}
                            />
                        ))}

                        {!loading && subscribers.length === 0 && (
                            <tr>
                                <td colSpan={colSpan}>
                                    {error ? (
                                        <AudienceEmptyState
                                            icon={AlertTriangle}
                                            tone="danger"
                                            title="Không tải được danh sách liên hệ"
                                            description={error}
                                            actionLabel={onRetry ? 'Thử lại' : undefined}
                                            onAction={onRetry}
                                        />
                                    ) : hasActiveFilters ? (
                                        <AudienceEmptyState
                                            icon={Users}
                                            title="Không có liên hệ khớp bộ lọc"
                                            description="Thử đổi từ khóa tìm kiếm hoặc bỏ bớt điều kiện lọc."
                                            actionLabel={onClearFilters ? 'Xóa bộ lọc' : undefined}
                                            onAction={onClearFilters}
                                        />
                                    ) : (
                                        <AudienceEmptyState
                                            icon={Users}
                                            title="Chưa có liên hệ nào"
                                            description="Import file CSV/Excel hoặc kết nối nguồn dữ liệu để bắt đầu xây dựng tệp khách hàng."
                                            actionLabel={onImport ? 'Import liên hệ' : undefined}
                                            onAction={onImport}
                                        />
                                    )}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-[var(--color-border-light)] px-4">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    itemsPerPage={itemsPerPage}
                    onPageChange={onPageChange}
                />
            </div>
        </>
    );
});
ContactsTab.displayName = 'ContactsTab';

export default ContactsTab;

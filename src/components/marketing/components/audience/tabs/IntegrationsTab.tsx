import React from 'react';
import { RefreshCw, Trash2, Edit3, Loader2, Database, Play, Eraser } from 'lucide-react';
import { AudienceEmptyState, ROW_CLASS, TD_CLASS, TH_CLASS, THEAD_CLASS } from '../AudienceUi';

interface IntegrationsTabProps {
    integrations: any[];
    onEdit: (integration: any) => void;
    onDelete: (id: string) => void;
    onSyncNow: (id: string) => void;
    onView: (integration: any) => void;
    onCleanup: (integration: any) => void;
    onSplit?: (integration: any) => void;
    lists: any[];
    onConnect?: () => void;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({ integrations, onEdit, onDelete, onSyncNow, onView, onCleanup, lists, onConnect }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead className={THEAD_CLASS}>
                    <tr className="border-b border-[var(--color-border)]">
                        <th className={TH_CLASS}>Tên kết nối</th>
                        <th className={TH_CLASS}>Trạng thái</th>
                        <th className={TH_CLASS}>Đồng bộ lần cuối</th>
                        <th className={`${TH_CLASS} text-right`}>Thành viên</th>
                        <th className={`${TH_CLASS} text-right w-36`}>Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {integrations.length === 0 ? (
                        <tr>
                            <td colSpan={5}>
                                <AudienceEmptyState
                                    icon={Database}
                                    title="Chưa có kết nối đồng bộ nào"
                                    description="Kết nối Google Sheets hoặc MISA AMIS CRM để tự động đồng bộ danh sách khách hàng."
                                    actionLabel={onConnect ? 'Thêm kết nối' : undefined}
                                    onAction={onConnect}
                                />
                            </td>
                        </tr>
                    ) : (
                        integrations.map((item) => {
                            const config = JSON.parse(item.config || '{}');
                            return (
                                <tr key={item.id} className={`group ${ROW_CLASS} cursor-pointer`} onClick={() => onView(item)}>
                                    <td className={TD_CLASS}>
                                        <div className="flex items-center gap-3">
                                            {item.type === 'google_sheets' ? (
                                                <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-8 h-8 object-contain" alt="Google Sheets" />
                                            ) : item.type === 'misa' ? (
                                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s" className="w-8 h-8 object-contain rounded" alt="MISA CRM" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-bg)] flex items-center justify-center">
                                                    <Database className="w-4 h-4 text-[var(--color-text-muted)]" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-[13px] font-semibold text-[var(--color-text)]">
                                                    {item.name.replace(/^(Google Sheets|MISA CRM)\s*-\s*/i, '')}
                                                </p>
                                                <p className="text-xs text-[var(--color-text-muted)]">
                                                    {item.type === 'google_sheets' ? 'Google Sheets' : item.type === 'misa' ? 'MISA CRM' : 'Nguồn dữ liệu'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={TD_CLASS}>
                                        {item.sync_status === 'syncing' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-sky-50 text-sky-700 border-sky-200">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                Đang đồng bộ
                                            </span>
                                        ) : (
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.status === 'active'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                {item.status === 'active' ? 'Active' : 'Disconnected'}
                                            </span>
                                        )}
                                    </td>
                                    <td className={TD_CLASS}>
                                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] tabular-nums">
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            {item.last_sync_at ? new Date(item.last_sync_at).toLocaleString('vi-VN') : 'Chưa đồng bộ'}
                                        </div>
                                    </td>
                                    <td className={`${TD_CLASS} text-right`}>
                                        <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                                            {(() => {
                                                if (item.active_count !== undefined) {
                                                    return item.active_count.toLocaleString('vi-VN');
                                                }
                                                const targetList = lists.find(l => l.id == config.targetListId);
                                                return targetList ? (targetList.count || 0).toLocaleString('vi-VN') : '0';
                                            })()}
                                        </span>
                                    </td>
                                    <td className={`${TD_CLASS} text-right`}>
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onSyncNow(item.id); }}
                                                disabled={item.sync_status === 'syncing'}
                                                className={`p-1.5 rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${item.sync_status === 'syncing'
                                                    ? 'text-sky-600 bg-sky-50'
                                                    : 'text-[var(--color-text-muted)] hover:text-emerald-600 hover:bg-emerald-50'
                                                    }`}
                                                title={item.sync_status === 'syncing' ? 'Đang đồng bộ...' : 'Chạy đồng bộ ngay'}
                                            >
                                                {item.sync_status === 'syncing' ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onCleanup(item); }}
                                                className="p-1.5 text-[var(--color-text-muted)] hover:text-amber-600 hover:bg-amber-50 rounded-[var(--radius-sm)] transition-colors"
                                                title="Dọn dẹp danh sách"
                                            >
                                                <Eraser className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                                className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-[var(--radius-sm)] transition-colors"
                                                title="Cấu hình"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                                className="p-1.5 text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 rounded-[var(--radius-sm)] transition-colors"
                                                title="Xóa kết nối"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default IntegrationsTab;


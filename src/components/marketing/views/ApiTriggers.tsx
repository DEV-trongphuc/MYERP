import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Database, CheckCircle2 } from 'lucide-react';
import PageHero from '../components/common/PageHero';
import FormsTab from '../components/triggers/FormsTab';
import PurchasesTab from '../components/triggers/PurchasesTab';
import CustomEventsTab from '../components/triggers/CustomEventsTab';
import OTPTriggersTab from '../components/triggers/OTPTriggersTab';
import Modal from '../components/common/Modal';
import StatCard from '../components/common/StatCard';
import { MktPage, MktPanel, MktStatGrid } from '../components/dashboard/MktLayout';
import { domationApi } from '../../../services/domationApi';
import { api } from '../services/storageAdapter';
import { AppIcon } from '../../common/AppIcons';

const DB_FIELDS_REF = [
    { field: 'email', type: 'String', req: 'YES', desc: 'Định danh Khách hàng duy nhất (Bắt buộc).' },
    { field: 'firstName', type: 'String', req: 'No', desc: 'Tên Khách hàng (First Name).' },
    { field: 'lastName', type: 'String', req: 'No', desc: 'Họ Khách hàng (Last Name).' },
    { field: 'phoneNumber', type: 'String', req: 'No', desc: 'Số điện thoại.' },
    { field: 'gender', type: 'String', req: 'No', desc: 'Giới tính (male / female / other).' },
    { field: 'dateOfBirth', type: 'Date', req: 'No', desc: 'Ngày sinh, định dạng YYYY-MM-DD.' },
    { field: 'tags', type: 'Array', req: 'No', desc: 'Mảng các thẻ nhãn phân loại (VD: ["VIP", "Lead"]).' },
    { field: 'city', type: 'String', req: 'No', desc: 'Thành phố.' },
    { field: 'country', type: 'String', req: 'No', desc: 'Quốc gia.' },
    { field: 'jobTitle', type: 'String', req: 'No', desc: 'Chức danh công việc.' },
    { field: 'companyName', type: 'String', req: 'No', desc: 'Tên công ty / tổ chức.' },
];

const ApiTriggers: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'forms' | 'purchases' | 'custom' | 'otp'>('forms');
    const [showDocs, setShowDocs] = useState(false);
    const [stats, setStats] = useState<{
        forms: number | null;
        purchases: number | null;
        customEvents: number | null;
        activeFlows: number | null;
    }>({
        forms: null,
        purchases: null,
        customEvents: null,
        activeFlows: null,
    });

    const loadStats = useCallback(async () => {
        try {
            const [formsRes, purchasesRes, customRes, flowsRes] = await Promise.all([
                domationApi.get<any[]>('forms'),
                api.get<any[]>('purchase_events').then(r => r.success ? r : domationApi.get<any[]>('purchases')),
                domationApi.get<any[]>('custom_events'),
                domationApi.get<any[]>('flows'),
            ]);
            setStats({
                forms: formsRes.success && Array.isArray(formsRes.data) ? formsRes.data.length : 0,
                purchases: purchasesRes.success && Array.isArray(purchasesRes.data) ? purchasesRes.data.length : 0,
                customEvents: customRes.success && Array.isArray(customRes.data) ? customRes.data.length : 0,
                activeFlows: flowsRes.success && Array.isArray(flowsRes.data)
                    ? flowsRes.data.filter((f: any) => f.status === 'active').length
                    : 0,
            });
        } catch {
            setStats({ forms: 0, purchases: 0, customEvents: 0, activeFlows: 0 });
        }
    }, []);

    useEffect(() => {
        loadStats();
        const handleInvalidate = () => { loadStats(); };
        window.addEventListener('domation:invalidate', handleInvalidate);
        return () => window.removeEventListener('domation:invalidate', handleInvalidate);
    }, [loadStats]);

    const subTabs = [
        { id: 'forms' as const, label: 'Biểu mẫu (Forms)', iconName: 'trigger_form', count: stats.forms },
        { id: 'purchases' as const, label: 'Mua hàng (Purchases)', iconName: 'trigger_purchase', count: stats.purchases },
        { id: 'custom' as const, label: 'Sự kiện (Custom)', iconName: 'trigger_custom', count: stats.customEvents },
        { id: 'otp' as const, label: 'OTP & Access', iconName: 'trigger_otp', count: stats.activeFlows },
    ];

    return (
        <MktPage>
            {/* Page Hero */}
            <PageHero
                title="API & Sự kiện Webhook"
                subtitle="Quản lý Biểu mẫu, Đơn hàng và Sự kiện thông qua hệ thống API Webhook tích hợp."
                actions={[
                    { label: 'Tài liệu Data', icon: BookOpen, onClick: () => setShowDocs(true), primary: true }
                ]}
            />

            {/* KPI StatCards Row */}
            <MktStatGrid cols={4}>
                <StatCard
                    loading={stats.forms === null}
                    title="Biểu mẫu thu thập"
                    value={stats.forms !== null ? String(stats.forms) : '0'}
                    icon={<AppIcon name="trigger_form" size={34} />}
                    color="#06B6D4"
                    breakdown={<span>Forms Landing Page</span>}
                />
                <StatCard
                    loading={stats.purchases === null}
                    title="Đơn hàng Webhook"
                    value={stats.purchases !== null ? String(stats.purchases) : '0'}
                    icon={<AppIcon name="trigger_purchase" size={34} />}
                    color="#10b981"
                    breakdown={<span>Sự kiện mua hàng tự động</span>}
                />
                <StatCard
                    loading={stats.customEvents === null}
                    title="Sự kiện Custom"
                    value={stats.customEvents !== null ? String(stats.customEvents) : '0'}
                    icon={<AppIcon name="trigger_custom" size={34} />}
                    color="#F59E0B"
                    breakdown={<span>App & Web Custom Triggers</span>}
                />
                <StatCard
                    loading={stats.activeFlows === null}
                    title="Luồng & OTP Active"
                    value={stats.activeFlows !== null ? String(stats.activeFlows) : '0'}
                    icon={<AppIcon name="trigger_otp" size={34} />}
                    color="#8b5cf6"
                    breakdown={<span>Automation Flows đang chạy</span>}
                />
            </MktStatGrid>

            {/* Main Panel with Approvals Toolbar & Subtabs */}
            <MktPanel>
                <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-border)]">
                        {subTabs.map((item) => {
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveTab(item.id)}
                                    className={`px-3.5 py-2 rounded-[10px] text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                                        isActive
                                            ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-xs border border-[var(--color-border)]'
                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    <AppIcon name={item.iconName} size={18} />
                                    <span>{item.label}</span>
                                    {item.count !== null && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            isActive
                                                ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                                                : 'bg-slate-200/70 dark:bg-white/[0.06] text-[var(--color-text-muted)]'
                                        }`}>
                                            {item.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-medium">
                        <AppIcon name="api_triggers" size={18} />
                        <span>Cổng API Webhook tự động đồng bộ CRM</span>
                    </div>
                </div>

                <div className="p-4 lg:p-6 animate-in fade-in duration-300">
                    {activeTab === 'forms' && <FormsTab />}
                    {activeTab === 'purchases' && <PurchasesTab />}
                    {activeTab === 'custom' && <CustomEventsTab />}
                    {activeTab === 'otp' && <OTPTriggersTab />}
                </div>
            </MktPanel>

            {/* GLOBAL DATABASE REFERENCE MODAL */}
            <Modal isOpen={showDocs} onClose={() => setShowDocs(false)} title="Cấu trúc Dữ liệu Khách hàng (Database)" size="lg">
                <div className="space-y-6 pb-6">
                    <div className="p-5 bg-blue-50 border border-blue-100 rounded-[18px] flex gap-4">
                        <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm h-fit"><Database className="w-6 h-6" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-tight">Quy chuẩn trường dữ liệu</h4>
                            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                                Khi gọi API (Purchase, Custom Event hoặc Form), bạn có thể gửi kèm các thông tin dưới đây để hệ thống tự động cập nhật vào hồ sơ Khách hàng (Subscriber Profile).
                            </p>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-4">Tên trường (Key)</th>
                                    <th className="px-5 py-4">Loại dữ liệu</th>
                                    <th className="px-5 py-4">Mô tả chi tiết</th>
                                    <th className="px-5 py-4 text-right">Bắt buộc</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {DB_FIELDS_REF.map((f, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-blue-600 font-bold text-sm">{f.field}</td>
                                        <td className="px-5 py-3 text-slate-500 font-medium">{f.type}</td>
                                        <td className="px-5 py-3 text-slate-700">{f.desc}</td>
                                        <td className="px-5 py-3 text-right">
                                            {f.req === 'YES' ? (
                                                <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                                                    <CheckCircle2 className="w-4 h-4" /> YES
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 font-bold">NO</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </MktPage>
    );
};

export default ApiTriggers;

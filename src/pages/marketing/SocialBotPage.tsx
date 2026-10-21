import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, MessageSquare, Smartphone, Zap, Users, BarChart3, Settings, RefreshCw, Send, ShieldCheck, HelpCircle } from 'lucide-react';
import PageHero from '../../components/marketing/components/common/PageHero';
import Tabs from '../../components/marketing/components/common/Tabs';
import StatCard from '../../components/marketing/components/common/StatCard';
import { MktPage, MktPanel, MktStatGrid } from '../../components/marketing/components/dashboard/MktLayout';
import MetaMessenger from '../../components/marketing/views/MetaMessenger';
import ZaloAudienceTab from '../../components/marketing/components/zalo/ZaloAudienceTab';
import ZaloAutomationTab from '../../components/marketing/components/zalo/ZaloAutomationTab';
import ZaloBroadcastTab from '../../components/marketing/components/zalo/ZaloBroadcastTab';
import ZaloDashboard from '../../components/marketing/components/zalo/ZaloDashboard';
import { api } from '../../components/marketing/services/storageAdapter';

type SocialChannel = 'meta' | 'zalo';
type ZaloSubTab = 'audience' | 'automation' | 'broadcast' | 'templates';

const SocialBotPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const channelParam = (searchParams.get('channel') as SocialChannel) || 'meta';
    const [activeChannel, setActiveChannel] = useState<SocialChannel>(channelParam);
    const [zaloSubTab, setZaloSubTab] = useState<ZaloSubTab>('audience');

    // Stats
    const [stats, setStats] = useState({
        metaCustomers: 0,
        zaloFollowers: 0,
        runningBots: 0,
        sentMessages: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const c = searchParams.get('channel') as SocialChannel;
        if (c && (c === 'meta' || c === 'zalo')) {
            setActiveChannel(c);
        }
    }, [searchParams]);

    const handleChannelChange = (channel: SocialChannel) => {
        setActiveChannel(channel);
        setSearchParams(channel === 'meta' ? {} : { channel }, { replace: true });
    };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const [metaRes, zaloRes, flowsRes] = await Promise.all([
                api.get<any>('meta_customers?limit=1'),
                api.get<any>('zalo_audience?route=lists'),
                api.get<any>('flows?limit=100'),
            ]);
            const metaCount = Number(metaRes?.data?.total ?? metaRes?.total ?? 0) || 0;
            const zaloLists = Array.isArray(zaloRes?.data) ? zaloRes.data : [];
            const zaloCount = zaloLists.length > 0
                ? zaloLists.reduce((sum: number, l: any) => sum + (Number(l.followed_count ?? l.real_count ?? l.subscriber_count ?? 0) || 0), 0)
                : (Number(zaloRes?.data?.total ?? zaloRes?.total ?? 0) || 0);
            const flowList = Array.isArray(flowsRes?.data) ? flowsRes.data : [];
            const activeBots = Number(flowsRes?.summary?.active ?? flowList.filter((f: any) => f.status === 'active').length) || 0;
            const sentCount = Number(
                flowsRes?.summary?.completed_participants ??
                flowList.reduce((sum: number, f: any) => sum + (Number(f.stat_completed ?? f.stats?.completed ?? 0) || 0), 0)
            ) || 0;
            setStats({
                metaCustomers: metaCount,
                zaloFollowers: zaloCount,
                runningBots: activeBots,
                sentMessages: sentCount,
            });
        } catch {
            setStats({
                metaCustomers: 0,
                zaloFollowers: 0,
                runningBots: 0,
                sentMessages: 0,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return (
        <MktPage>
            {/* Page Hero */}
            <PageHero
                title="Social Bot (Meta & Zalo)"
                subtitle="Quản lý Chatbot, Trợ lý AI và Tự động hóa tin nhắn Facebook Fanpages & Zalo OA."
                actions={[
                    {
                        label: 'Làm mới',
                        icon: RefreshCw,
                        onClick: fetchStats,
                        primary: false,
                    },
                ]}
            />

            {/* KPI StatCards Row */}
            <MktStatGrid cols={4}>
                <StatCard
                    loading={loading}
                    title="Khách hàng Messenger"
                    value={stats.metaCustomers.toLocaleString('vi-VN')}
                    icon={<MessageSquare />}
                    color="#C6333D"
                    breakdown={<span>Đồng bộ từ Fanpages</span>}
                />
                <StatCard
                    loading={loading}
                    title="Người quan tâm Zalo"
                    value={stats.zaloFollowers.toLocaleString('vi-VN')}
                    icon={<Smartphone />}
                    color="#0f172a"
                    breakdown={<span>Kết nối Zalo OA</span>}
                />
                <StatCard
                    loading={loading}
                    title="Kịch bản Bot chạy"
                    value={stats.runningBots.toLocaleString('vi-VN')}
                    icon={<Bot />}
                    color="#334155"
                    breakdown={<span>Tự động phản hồi 24/7</span>}
                />
                <StatCard
                    loading={loading}
                    title="Tin nhắn tự động"
                    value={stats.sentMessages.toLocaleString('vi-VN')}
                    icon={<Zap />}
                    color="#64748b"
                    breakdown={<span>Messenger + ZNS/Zalo</span>}
                />
            </MktStatGrid>

            {/* Main Content Panel */}
            <MktPanel>
                {/* Channel Selector - Approvals Toolbar Tab Style */}
                <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-3">
                    <Tabs
                        variant="segmented"
                        activeId={activeChannel}
                        onChange={(id) => handleChannelChange(id as SocialChannel)}
                        items={[
                            { id: 'meta', label: 'Meta Messenger (Facebook)', icon: MessageSquare, count: stats.metaCustomers },
                            { id: 'zalo', label: 'Zalo OA & ZNS', icon: Smartphone, count: stats.zaloFollowers },
                        ]}
                    />

                    {activeChannel === 'zalo' && (
                        <div className="flex items-center gap-2">
                            <Tabs
                                variant="segmented"
                                activeId={zaloSubTab}
                                onChange={(id) => setZaloSubTab(id as ZaloSubTab)}
                                items={[
                                    { id: 'audience', label: 'Khách hàng Zalo', icon: Users },
                                    { id: 'automation', label: 'Kịch bản Zalo', icon: Zap },
                                    { id: 'broadcast', label: 'Broadcast & ZBS', icon: Send },
                                    { id: 'templates', label: 'Mẫu tin ZNS', icon: Settings },
                                ]}
                            />
                        </div>
                    )}
                </div>

                {/* Tab Views */}
                <div className="p-4 lg:p-6">
                    {activeChannel === 'meta' && (
                        <MetaMessenger />
                    )}

                    {activeChannel === 'zalo' && (
                        <div>
                            {zaloSubTab === 'audience' && <ZaloAudienceTab />}
                            {zaloSubTab === 'automation' && <ZaloAutomationTab />}
                            {zaloSubTab === 'broadcast' && <ZaloBroadcastTab />}
                            {zaloSubTab === 'templates' && <ZaloDashboard />}
                        </div>
                    )}
                </div>
            </MktPanel>
        </MktPage>
    );
};

export default SocialBotPage;

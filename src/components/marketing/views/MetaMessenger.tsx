import * as React from 'react';
import { useState } from 'react';
import { Users, Settings, Zap, BarChart3, Info, HelpCircle } from 'lucide-react';
import PageHero from '../components/common/PageHero';
import Tabs from '../components/common/Tabs';
import MetaConfig from '../components/meta/MetaConfig';
import MetaAutomation from '../components/meta/MetaAutomation';
import MetaCustomers from '../components/meta/MetaCustomers';
import MetaPolicyModal from '../components/meta/MetaPolicyModal';
import MetaGrowthReport from '../components/meta/MetaGrowthReport';

const MetaMessenger: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'automation' | 'customers' | 'report' | 'config'>('customers');
    const [showPolicyModal, setShowPolicyModal] = useState(false);

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-10 mx-auto">
            <PageHero
                title="Meta Messenger"
                subtitle="Quản lý tin nhắn, Chatbot và Tự động hóa chăm sóc khách hàng cho Facebook Fanpages."
                actions={[
                    { label: 'Cấu hình Fanpage', icon: Settings, onClick: () => setActiveTab('config'), primary: false },
                    { label: 'Quy tắc 24h', icon: HelpCircle, onClick: () => setShowPolicyModal(true), primary: false },
                    { label: 'Meta Platform', icon: Zap, onClick: () => window.open('https://developers.facebook.com/docs/messenger-platform', '_blank'), primary: true }
                ]}
            />

            <MetaPolicyModal
                isOpen={showPolicyModal}
                onClose={() => setShowPolicyModal(false)}
            />

            <div className="bg-[var(--color-surface)] rounded-[18px] border border-[var(--color-border)] shadow-xs overflow-hidden min-h-[500px]">
                <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
                    <Tabs
                        variant="segmented"
                        activeId={activeTab}
                        onChange={setActiveTab as any}
                        items={[
                            { id: 'customers', label: 'Khách hàng', icon: Users },
                            { id: 'automation', label: 'Kịch bản Chatbot', icon: Zap },
                            { id: 'report', label: 'Báo cáo', icon: BarChart3 },
                            { id: 'config', label: 'Cấu hình Fanpage & Ad Account', icon: Settings }
                        ]}
                    />
                </div>

                <div className="p-4 lg:p-6">
                    {activeTab === 'config' && <MetaConfig />}
                    {activeTab === 'automation' && <MetaAutomation />}
                    {activeTab === 'customers' && <MetaCustomers />}
                    {activeTab === 'report' && <MetaGrowthReport />}
                </div>
            </div>
        </div>
    );
};

export default MetaMessenger;

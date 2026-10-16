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
        <div className="space-y-8 animate-in fade-in duration-500 pb-20 mx-auto ">
            <PageHero
                title={<>Meta <span className="text-slate-500 dark:text-slate-400">Messenger</span></>}
                subtitle="Quản lý tin nhắn, Chatbot và Tự động hóa cho Facebook Fanpages."
                statusText="Meta Cloud API Active"
                showStatus={true}
                actions={[
                    { label: 'CẤU HÌNH META', icon: Settings, onClick: () => setActiveTab('config'), primary: false },
                    { label: '', title: 'Quy tắc 24h', icon: HelpCircle, onClick: () => setShowPolicyModal(true), primary: true },
                    { label: '', title: 'Meta Platform', icon: Zap, onClick: () => window.open('https://developers.facebook.com/docs/messenger-platform', '_blank'), primary: true }
                ]}
            />

            <MetaPolicyModal
                isOpen={showPolicyModal}
                onClose={() => setShowPolicyModal(false)}
            />

            <div className="bg-white rounded-3xl lg:rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                <div className="px-4 lg:px-6 py-4 border-b border-slate-50 bg-slate-50/30">
                    <Tabs
                        variant="segmented"
                        activeId={activeTab}
                        onChange={setActiveTab as any}
                        items={[
                            { id: 'customers', label: 'Khách hàng', icon: Users },
                            { id: 'automation', label: 'Kịch bản', icon: Zap },
                            { id: 'report', label: 'Báo cáo', icon: BarChart3 }
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

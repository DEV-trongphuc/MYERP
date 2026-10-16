import * as React from 'react';
import { useState } from 'react';
import { Zap, Smartphone, FileText, Share2 } from 'lucide-react';
import { WebStats, WebProperty } from './types';
import Tabs from '../common/Tabs';
import TabTransition from '../common/TabTransition';
import GeneralTabContent from './overview/GeneralTabContent';
import AudienceTabContent from './overview/AudienceTabContent';
import SourcesTabContent from './overview/SourcesTabContent';
import PagesTabContent from './overview/PagesTabContent';

interface OverviewTabProps {
    stats: WebStats | null;
    formatDuration: (seconds: number) => string;
    shortenUrl: (url: string) => string;
    renderEventIcon: (type: string) => React.ReactNode;
    property: WebProperty;
    startDate: string;
    endDate: string;
    reportDevice?: string;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ stats, formatDuration, shortenUrl, renderEventIcon, property, startDate, endDate, reportDevice }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'audience' | 'sources' | 'pages'>('general');

    return (
        <TabTransition className="space-y-4">
            <Tabs
                activeId={activeTab}
                onChange={setActiveTab as any}
                variant="sub-segmented"
                layoutId="webTrackingOverviewSubTabs"
                items={[
                    { id: 'general', label: 'Chỉ số chính', icon: Zap },
                    { id: 'audience', label: 'Thiết bị - Vị trí', icon: Smartphone },
                    { id: 'sources', label: 'Nguồn truy cập', icon: Share2 },
                    { id: 'pages', label: 'Trang & sự kiện', icon: FileText },
                ]}
                className="mb-4"
            />

            {activeTab === 'general' && <GeneralTabContent stats={stats} formatDuration={formatDuration} />}
            {activeTab === 'audience' && <AudienceTabContent stats={stats} />}
            {activeTab === 'sources' && <SourcesTabContent stats={stats} />}
            {activeTab === 'pages' && (
                <PagesTabContent
                    stats={stats}
                    formatDuration={formatDuration}
                    shortenUrl={shortenUrl}
                    renderEventIcon={renderEventIcon}
                    propertyId={property.id}
                    startDate={startDate}
                    endDate={endDate}
                    reportDevice={reportDevice}
                />
            )}
        </TabTransition>
    );
};

export default OverviewTab;

import React from 'react';
import AITraining from '../../components/marketing/views/AITraining';
import { MktPage } from '../../components/marketing/components/dashboard/MktLayout';

const AITrainingMarketingPage: React.FC = () => {
    return (
        <MktPage className="pb-12">
            <AITraining />
        </MktPage>
    );
};

export default AITrainingMarketingPage;

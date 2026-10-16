// components/templates/EmailEditor/components/Properties/BackgroundControl.tsx
import React from 'react';
import { EmailBlockStyle } from '../../../../../types';
// No longer importing ImageUploader as per instructions, it's not used in this file

interface BackgroundControlProps {
    style: EmailBlockStyle;
    onChange: (updates: Partial<EmailBlockStyle>) => void;
    isSection?: boolean;
}

const BackgroundControl: React.FC<BackgroundControlProps> = ({ style, onChange, isSection = false }) => (
    <div className="space-y-3">
        <p className="text-[10px] text-slate-400 italic">Background images/gradients are not fully supported in compiled email HTML for maximum compatibility. Only solid background colors are consistently used.</p>
    </div>
);

export default BackgroundControl;

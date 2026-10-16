// components/templates/EmailEditor/constants/editorConstants.ts
import { EmailBodyStyle } from '../../../../types';

export const DEFAULT_BODY_STYLE: EmailBodyStyle = {
    backgroundColor: '#F3F4F6',
    contentBackgroundColor: '#FFFFFF',
    contentWidth: '600px',
    fontFamily: "'Roboto', Arial, sans-serif",
    linkColor: '#2563eb'
};

export const DEFAULT_BLOCKS = [];

export const SOCIAL_COLORS_COMPILE: Record<string, string> = {
    facebook: '#1877F2', twitter: '#1DA1F2', instagram: '#E4405F',
    linkedin: '#0A66C2', youtube: '#FF0000', website: '#333333',
    email: '#EA4335', phone: '#34A853', tiktok: '#000000', github: '#181717', address: '#666666',
    zalo: '#0068FF', custom: '#999999'
};

export const SOCIAL_NETWORKS_CONFIG = [
    { id: 'facebook', icon: 'Facebook', color: '#1877F2' },
    { id: 'twitter', icon: 'Twitter', color: '#1DA1F2' },
    { id: 'instagram', 'icon': 'Instagram', color: '#E4405F' },
    { id: 'linkedin', icon: 'Linkedin', color: '#0A66C2' },
    { id: 'youtube', icon: 'Youtube', color: '#FF0000' },
    { id: 'zalo', icon: 'Zalo', color: '#0068FF' }, // Zalo VN
    { id: 'tiktok', icon: 'Video', color: '#000000' },
    { id: 'github', icon: 'Github', color: '#181717' },
    { id: 'website', icon: 'Globe', color: '#333333' },
    { id: 'email', icon: 'Mail', color: '#EA4335' },
    { id: 'phone', icon: 'Phone', color: '#34A853' },
    { id: 'address', icon: 'MapPin', color: '#666666' },
    { id: 'custom', icon: 'Star', color: '#999999' },
];

export const SOCIAL_ICON_MAP: Record<string, string> = {
    facebook: 'Facebook', twitter: 'Twitter', instagram: 'Instagram',
    linkedin: 'Linkedin', youtube: 'Youtube', website: 'Globe',
    email: 'Mail', phone: 'Phone', address: 'MapPin', tiktok: 'Video', github: 'Github',
    zalo: 'Zalo', custom: 'Star'
};

export const PREMIUM_COLORS = [
    '#ffffff', '#000000', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b', '#0f172a',
    '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#ef4444', '#dc2626', '#b91c1c',
    '#fff7ed', '#ffedd5', '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#c2410c',
    '#fffbeb', '#fef3c7', '#fde68a', '#fbbf24', '#d97706', '#d97706', '#b45309',
    '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#22c55e', '#16a34a', '#15803d',
    '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#3b82f6', '#2563eb', '#1d4ed8',
    '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#a855f7', '#9333ea', '#7e22ce'
];

export const SUGGESTED_GRADIENTS = [
    { name: 'Sunset', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' },
    { name: 'Ocean', value: 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)' },
    { name: 'Purple Love', value: 'linear-gradient(to right, #cc2b5e, #753a88)' },
    { name: 'Piggy Pink', value: 'linear-gradient(to top, #fad0c4 0%, #ffd1ff 100%)' },
    { name: 'Dark Space', value: 'linear-gradient(to right, #434343 0%, black 100%)' },
    { name: 'Azure Lane', value: 'linear-gradient(to right, #7f7fd5, #86a8e7, #91eae4)' },
    { name: 'Cool Sky', value: 'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)' },
    { name: 'Premium Dark', value: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
    { name: 'Orange Fun', value: 'linear-gradient(120deg, #f6d365 0%, #fda085 100%)' },
];

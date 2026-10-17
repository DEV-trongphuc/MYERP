// components/templates/EmailEditor/EmailProperties.tsx
import React, { useState, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react'; // Import all Lucide icons
import { type LucideIcon } from 'lucide-react'; // Import specific type
import { EmailBlock, EmailBodyStyle, EmailBlockStyle, ListItem, VoucherCampaign } from '../../../types';
import RichText from '../../common/RichText/RichText'; // UPDATED IMPORT
import { api } from '../../../services/storageAdapter';
import erpApi from '../../../../../api/axios';

import Input from '../../common/Input';

// Import new components
import Accordion from './components/Properties/Accordion';
import VisualMeasure from './components/Properties/VisualMeasure';
import SpacingControl from './components/Properties/SpacingControl';
import ImageUploader from './components/Properties/ImageUploader';
import AlignmentControl from './components/Properties/AlignmentControl';
import ColumnStructureControl from './components/Properties/ColumnStructureControl';


import BorderControl from './components/Properties/BorderControl';
import RadiusControl from './components/Properties/RadiusControl';
import CustomSelect from './components/Properties/CustomSelect';

import ColorPicker from './components/Properties/ColorPicker';

import { SOCIAL_NETWORKS_CONFIG, SOCIAL_ICON_MAP } from './constants/editorConstants';
import { getIconUrl } from './utils/htmlCompiler';


const BODY_FONT_OPTIONS = [
    { value: "'Roboto', Arial, sans-serif", label: "Roboto" },
    { value: "'Inter', sans-serif", label: "Inter" },
    { value: "'Montserrat', sans-serif", label: "Montserrat" },
    { value: "'Poppins', sans-serif", label: "Poppins" },
    { value: "'Playfair Display', serif", label: "Playfair Display" },
    { value: "'Outfit', sans-serif", label: "Outfit" },
    { value: "'Nunito', sans-serif", label: "Nunito" },
    { value: "Arial, sans-serif", label: "Arial" },
    { value: "Helvetica, sans-serif", label: "Helvetica" },
    { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
    { value: "'Courier New', Courier, monospace", label: "Courier New" },
    { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" }
];


interface EmailPropertiesProps {
    blocks: EmailBlock[];
    selectedBlock: EmailBlock | null;
    bodyStyle: EmailBodyStyle;
    deviceMode: 'desktop' | 'mobile';
    onUpdateBlock: (id: string, data: Partial<EmailBlock>) => void;
    onUpdateBodyStyle: (style: EmailBodyStyle) => void;
    onDeleteBlock: (id: string) => void;
    onDuplicateBlock: (block: EmailBlock) => void;
    onDeselect: () => void;
    customMergeTags?: { label: string; key: string }[];
}

const LucideIconMap: Record<string, any> = LucideIcons; // For dynamic icon rendering

const EmailProperties: React.FC<EmailPropertiesProps> = ({
    selectedBlock, bodyStyle, deviceMode, onUpdateBlock, onUpdateBodyStyle, onDeselect, onDeleteBlock, onDuplicateBlock, blocks, customMergeTags = []
}) => {
    const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');
    const [editSocialId, setEditSocialId] = useState<string | null>(null);
    const [voucherCampaigns, setVoucherCampaigns] = useState<VoucherCampaign[]>([]);
    const [surveys, setSurveys] = useState<any[]>([]);
    const [loadingSurveys, setLoadingSurveys] = useState(false);

    // Reset to 'content' tab whenever a different block is selected
    useEffect(() => {
        if (selectedBlock) {
            setActiveTab('content');
        }
    }, [selectedBlock?.id]);

    useEffect(() => {
        if (selectedBlock?.type === 'survey_card' && surveys.length === 0 && !loadingSurveys) {
            setLoadingSurveys(true);
            api.get('surveys')
                .then((res: any) => {
                    const list = Array.isArray(res) ? res : (res?.data || res?.surveys || []);
                    if (Array.isArray(list) && list.length > 0) {
                        setSurveys(list);
                        return;
                    }
                    return erpApi.get('/surveys').then((r2: any) => {
                        const payload = r2?.data ?? r2;
                        const list2 = Array.isArray(payload) ? payload : (payload?.data || payload?.surveys || []);
                        if (Array.isArray(list2)) setSurveys(list2);
                    });
                })
                .catch(() => {})
                .finally(() => setLoadingSurveys(false));
        }
    }, [selectedBlock?.type, surveys.length, loadingSurveys]);

    useEffect(() => {
        try {
            const stored = JSON.parse(localStorage.getItem('mailflow_voucher_campaigns') || '[]');
            setVoucherCampaigns(stored);
        } catch (e) { }
    }, []);

    // Scan tất cả màu đang dùng trong email để hiển thị trong tooltip màu chữ
    const usedColors = useMemo(() => {
        const colors = new Set<string>();
        const traverse = (items: EmailBlock[]) => {
            items.forEach(b => {
                if (b.style.backgroundColor && !b.style.backgroundColor.includes('gradient')) colors.add(b.style.backgroundColor);
                if (b.style.color) colors.add(b.style.color);
                if (b.style.contentBackgroundColor) colors.add(b.style.contentBackgroundColor);
                if (b.style.borderColor) colors.add(b.style.borderColor);
                if (b.children) traverse(b.children);
            });
        };
        traverse(blocks || []);
        if (bodyStyle.backgroundColor) colors.add(bodyStyle.backgroundColor);
        if (bodyStyle.contentBackgroundColor) colors.add(bodyStyle.contentBackgroundColor);
        if (bodyStyle.linkColor) colors.add(bodyStyle.linkColor);
        return Array.from(colors).filter(c => c !== 'transparent' && c !== 'none' && c !== '').slice(0, 14);
    }, [blocks, bodyStyle]);

    // Helper to handle color/gradient update correctly
    const handleColorUpdate = (colorVal: string, type: 'solid' | 'gradient', property: string) => {
        // Properties that are always solid colors (no gradients supported/needed)
        const isSolidOnly = ['color', 'timelineDotColor', 'timelineLineColor', 'iconColor', 'checkIconColor', 'playButtonColor', 'iconBackgroundColor'].includes(property);

        if (isSolidOnly) {
            updateStyle({ [property]: colorVal });
            return;
        }

        // Properties that support gradients
        if (type === 'gradient') {
            updateStyle({ backgroundImage: colorVal, [property]: 'transparent' });
            // If updating contentBackgroundColor, ensure it's handled as primary for background.
            if (property === 'contentBackgroundColor') {
                updateStyle({ [property]: colorVal });
            }
        } else {
            // Solid color update
            const updates: any = { [property]: colorVal };
            // Only clear backgroundImage if it's a primary background property being updated
            if (['backgroundColor', 'contentBackgroundColor'].includes(property)) {
                updates.backgroundImage = 'none';
            }
            updateStyle(updates);
        }
    };

    // Wrapper for Body Style updates
    const handleBodyColorUpdate = (colorVal: string, type: 'solid' | 'gradient', property: 'backgroundColor' | 'contentBackgroundColor' | 'linkColor') => {
        if (property === 'linkColor') {
            onUpdateBodyStyle({ ...bodyStyle, [property]: colorVal });
            return;
        }

        if (type === 'gradient') {
            onUpdateBodyStyle({ ...bodyStyle, backgroundImage: colorVal, [property]: 'transparent' });
        } else {
            onUpdateBodyStyle({ ...bodyStyle, [property]: colorVal, backgroundImage: 'none' });
        }
    };


    if (!selectedBlock) {
        return (
            <div className="w-[380px] shrink-0 bg-white border-l border-slate-200 flex flex-col shadow-xl z-40 h-full">
                <div className="p-5 border-b border-slate-100 font-bold text-xs uppercase tracking-widest text-slate-800 flex items-center gap-2">
                    <LucideIcons.Settings className="w-4 h-4 text-[#BD1D2D]" /> Cấu hình Body
                </div>
                <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <VisualMeasure label="Độ rộng nội dung" value={bodyStyle.contentWidth} onChange={(v: string) => onUpdateBodyStyle({ ...bodyStyle, contentWidth: v })} max={1000} bodyWidth={1200} />
                        <div className="space-y-2">
                            <CustomSelect
                                label="Font Chữ Chung"
                                value={bodyStyle.fontFamily || "'Roboto', Arial, sans-serif"}
                                onChange={(v) => onUpdateBodyStyle({ ...bodyStyle, fontFamily: v })}
                                options={BODY_FONT_OPTIONS}
                            />
                        </div>
                    </div>

                    <div className="pt-5 border-t border-slate-200/80 space-y-3">
                        <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
                            <ColorPicker label="Màu nền toàn trang" value={bodyStyle.backgroundColor} onChange={(v: string, t: any) => handleBodyColorUpdate(v, t, 'backgroundColor')} blocks={blocks} bodyStyle={bodyStyle} />
                            <p className="text-[10px] text-slate-400 mt-1 leading-normal">Màu nền bao phủ toàn bộ cửa sổ trình duyệt.</p>
                        </div>
                        <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
                            <ColorPicker label="Màu nền nội dung" value={bodyStyle.contentBackgroundColor} onChange={(v: string, t: any) => handleBodyColorUpdate(v, t, 'contentBackgroundColor')} blocks={blocks} bodyStyle={bodyStyle} />
                            <p className="text-[10px] text-slate-400 mt-1 leading-normal">Màu nền chỉ áp dụng cho khu vực chứa nội dung email.</p>
                        </div>
                        <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
                            <ColorPicker label="Màu Link chung" value={bodyStyle.linkColor} onChange={(v: string, t: any) => handleBodyColorUpdate(v, t, 'linkColor')} blocks={blocks} bodyStyle={bodyStyle} />
                            <p className="text-[10px] text-slate-400 mt-1 leading-normal">Màu mặc định cho tất cả các liên kết trong email.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const s = selectedBlock.style;
    const isColumn = selectedBlock.type === 'column';
    const isRow = selectedBlock.type === 'row';
    const isButton = selectedBlock.type === 'button';

    /**
     * Inject CSS property trực tiếp vào TOÀN BỘ element (kể cả nested) trong HTML content.
     * Dùng cho fontSize, fontFamily, và color để canvas update realtime từ panel.
     */
    const injectStyleIntoContent = (html: string, prop: 'fontSize' | 'fontFamily' | 'color', value: string): string => {
        if (!html || !value) return html;
        const div = document.createElement('div');
        div.innerHTML = html;

        const cssPropMap: Record<string, string> = {
            fontSize: 'font-size',
            fontFamily: 'font-family',
            color: 'color',
        };
        const cssProp = cssPropMap[prop];

        // Với color: chỉ xóa inline color khỏi các element không phải link (a)
        // Với fontSize/fontFamily: xóa khỏi tất cả
        div.querySelectorAll('[style]').forEach(el => {
            const htmlEl = el as HTMLElement;
            if (prop === 'color' && htmlEl.tagName === 'A') return; // giữ màu link
            htmlEl.style.removeProperty(cssProp);
            if (!htmlEl.getAttribute('style')?.trim()) {
                htmlEl.removeAttribute('style');
            }
        });

        // Apply trực tiếp vào từng top-level node
        Array.from(div.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (prop === 'fontSize') el.style.fontSize = value;
                else if (prop === 'fontFamily') el.style.fontFamily = value;
                else if (prop === 'color') el.style.color = value;
            } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                const span = document.createElement('span');
                if (prop === 'fontSize') span.style.fontSize = value;
                else if (prop === 'fontFamily') span.style.fontFamily = value;
                else if (prop === 'color') span.style.color = value;
                span.textContent = node.textContent;
                div.replaceChild(span, node);
            }
        });

        return div.innerHTML;
    };

    const updateStyle = (updates: Partial<EmailBlockStyle>) => {
        const textTypes = ['text', 'quote', 'review'];
        const isTextBlock = selectedBlock && textTypes.includes(selectedBlock.type);

        const updateObj: any = {};
        let finalStyle = { ...s };

        // Handle responsive vs desktop
        if (deviceMode === 'desktop') {
            finalStyle = { ...s, ...updates };
        } else {
            const currentResponsive = s.mobile || {};
            finalStyle = { ...s, mobile: { ...currentResponsive, ...updates } as any };
        }

        updateObj.style = finalStyle;

        // fontSize / fontFamily / color → inject vào content để thấy realtime cho text blocks
        if (isTextBlock) {
            let newContent = selectedBlock!.content || '';
            let contentChanged = false;

            if ('fontSize' in updates && updates.fontSize) {
                newContent = injectStyleIntoContent(newContent, 'fontSize', updates.fontSize as string);
                contentChanged = true;
            }
            if ('fontFamily' in updates && updates.fontFamily) {
                newContent = injectStyleIntoContent(newContent, 'fontFamily', updates.fontFamily as string);
                contentChanged = true;
            }
            if ('color' in updates && updates.color) {
                newContent = injectStyleIntoContent(newContent, 'color', updates.color as string);
                contentChanged = true;
            }

            if (contentChanged) {
                updateObj.content = newContent;
            }
        }

        onUpdateBlock(selectedBlock!.id, updateObj);
    };

    const getStyle = (key: keyof EmailBlockStyle): any => {
        if (deviceMode === 'desktop') return s[key];
        const responsive = s.mobile; return responsive ? (responsive[key as keyof typeof responsive] ?? s[key]) : s[key];
    };

    const handleTimelineItemChange = (idx: number, field: keyof ListItem, value: string) => {
        const items = [...(selectedBlock.items || [])]; items[idx] = { ...items[idx], [field]: value }; onUpdateBlock(selectedBlock.id, { items });
    };
    const addTimelineItem = () => { const newItem: ListItem = { id: crypto.randomUUID(), date: '00:00', title: 'New Event', description: 'Description' }; onUpdateBlock(selectedBlock.id, { items: [...(selectedBlock.items || []), newItem] }); };
    const removeTimelineItem = (idx: number) => { const items = [...(selectedBlock.items || [])]; items.splice(idx, 1); onUpdateBlock(selectedBlock.id, { items }); };

    return (
        <div className="w-[380px] shrink-0 bg-white border-l border-slate-200 flex flex-col shadow-xl z-40 h-full animate-in slide-in-from-right-2">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest bg-white px-2 py-1 rounded border shadow-sm">{selectedBlock.type}</span></div>
                <div className="flex gap-1">
                    <button type="button" onClick={() => onDuplicateBlock(selectedBlock)} className="p-1.5 hover:bg-white hover:text-[#BD1D2D] rounded text-slate-400 transition-all outline-none focus:outline-none cursor-pointer"><LucideIcons.Copy className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => onDeleteBlock(selectedBlock.id)} className="p-1.5 hover:bg-white hover:text-rose-600 rounded text-slate-400 transition-all outline-none focus:outline-none cursor-pointer"><LucideIcons.Trash2 className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={onDeselect} className="p-1.5 hover:bg-slate-200 rounded text-slate-400 outline-none focus:outline-none cursor-pointer"><LucideIcons.X className="w-3.5 h-3.5" /></button>
                </div>
            </div>

            <div className="flex p-2 gap-1 border-b border-slate-100">
                <button type="button" onClick={() => setActiveTab('content')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-xl transition-all outline-none focus:outline-none cursor-pointer ${activeTab === 'content' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Content</button>
                <button type="button" onClick={() => setActiveTab('style')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-xl transition-all outline-none focus:outline-none cursor-pointer ${activeTab === 'style' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>Design</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {activeTab === 'content' && (
                    <div className="space-y-6 animate-in fade-in">

                        {/* ROW quick settings */}
                        {isRow && (
                            <div className="space-y-4">
                                <ColumnStructureControl children={selectedBlock.children || []} onUpdateChildren={(cols) => onUpdateBlock(selectedBlock.id, { children: cols })} />
                                <div className="p-3 bg-slate-50 rounded-[14px] border border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <LucideIcons.LayoutPanelTop className="w-4 h-4 text-[#BD1D2D]" />
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none">Stack trên Mobile</p>
                                            <p className="text-[8px] text-slate-400 mt-0.5">Tự động xếp chồng cột</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={getStyle('noStack') !== true} onChange={(e) => updateStyle({ noStack: !e.target.checked })} />
                                        <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#BD1D2D]/20 peer-checked:bg-[#BD1D2D] transition-colors shadow-inner after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow-sm after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white"></div>
                                    </label>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-[14px] border border-slate-100 space-y-3">
                                    <VisualMeasure
                                        label="Khoảng cách giữa các cột"
                                        value={getStyle('gap')}
                                        defaultValue={0}
                                        onChange={(v) => updateStyle({ gap: v })}
                                        max={60}
                                        unit="px"
                                    />
                                    <p className="text-[8px] text-slate-400 italic">Khoảng cách này được tự động chia đều vào các cột.</p>
                                </div>
                            </div>
                        )}

                        {/* COLUMN quick settings */}
                        {isColumn && (
                            <div className="space-y-4">
                                <VisualMeasure label="Chiều rộng cột" value={getStyle('width')} onChange={(v) => updateStyle({ width: v })} max={600} canAuto />
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Căn chỉnh</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                        {['top', 'middle', 'bottom'].map(v => (
                                            <button
                                                key={v}
                                                onClick={() => updateStyle({ verticalAlign: v as any })}
                                                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all ${(getStyle('verticalAlign') || 'top') === v ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {v === 'top' && <LucideIcons.AlignVerticalJustifyStart className="w-3.5 h-3.5" />}
                                                {v === 'middle' && <LucideIcons.AlignVerticalJustifyCenter className="w-3.5 h-3.5" />}
                                                {v === 'bottom' && <LucideIcons.AlignVerticalJustifyEnd className="w-3.5 h-3.5" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <ColorPicker label="Màu nền cột" value={getStyle('backgroundColor')} onChange={(v, t) => handleColorUpdate(v, t, 'backgroundColor')} blocks={blocks} bodyStyle={bodyStyle} />
                            </div>
                        )}

                        {['text', 'quote'].includes(selectedBlock.type) && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nội dung</label>

                                    <RichText value={selectedBlock.content} onChange={(v) => onUpdateBlock(selectedBlock.id, { content: v })} className="min-h-[100px]" bodyLinkColor={bodyStyle.linkColor} customMergeTags={customMergeTags} usedColors={usedColors} fontSize={getStyle('fontSize') as string | undefined} />
                                </div>
                                <Accordion title="Typography" icon={LucideIcons.Type} defaultOpen>
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        <VisualMeasure label="Cỡ" value={getStyle('fontSize')} defaultValue={14} onChange={(v) => updateStyle({ fontSize: v })} max={100} unit="px" />
                                        <VisualMeasure label="Dòng" tooltip="Tỷ lệ chiều cao của mỗi dòng chữ. Giá trị chuẩn thường là 1.5 để dễ đọc." value={getStyle('lineHeight')} defaultValue={1.5} onChange={(v) => updateStyle({ lineHeight: v })} max={3} unit="" hideSlider />
                                    </div>
                                    <CustomSelect
                                        label="Font chữ"
                                        value={getStyle('fontFamily') || "'Roboto', Arial, sans-serif"}
                                        onChange={(v) => updateStyle({ fontFamily: v })}
                                        options={BODY_FONT_OPTIONS}
                                    />
                                    <div className="mt-2">
                                        <ColorPicker label="Màu chữ" value={getStyle('color') || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'color')} blocks={blocks} bodyStyle={bodyStyle} />
                                    </div>
                                </Accordion>
                            </div>
                        )}
                        {isButton && (
                            <div className="space-y-4">
                                <Input label="Nhãn nút" value={(() => { const d = document.createElement('div'); d.innerHTML = selectedBlock.content || ''; return d.textContent || d.innerText || ''; })()} onChange={(e) => onUpdateBlock(selectedBlock.id, { content: e.target.value })} customSize="sm" />
                                <Input label="Đường dẫn" value={selectedBlock.url || ''} onChange={(e) => onUpdateBlock(selectedBlock.id, { url: e.target.value })} icon={LucideIcons.Link} customSize="sm" placeholder="VD: https://domain.com hoặc {{cert_link}}" />

                                {/* Auto-detected Dynamic Variable in Button URL -> Show Fallback Link Input */}
                                {/(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i.test(selectedBlock.url || '') && (
                                    <Input 
                                        label="Đường dẫn dự phòng (Fallback Link URL)" 
                                        placeholder="VD: https://ideas.edu.vn hoặc https://yoursite.com"
                                        value={selectedBlock.fallbackUrl || ''} 
                                        onChange={(e) => onUpdateBlock(selectedBlock.id, { fallbackUrl: e.target.value })} 
                                        icon={LucideIcons.ShieldCheck} 
                                        customSize="sm" 
                                    />
                                )}

                                {/* Validation hint for button */}
                                {(!selectedBlock.url || selectedBlock.url === '#' || !selectedBlock.url.trim()) && (
                                    <div className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-100 rounded-xl">
                                        <LucideIcons.AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-rose-700 font-medium">Nút chưa có đường dẫn — nhớ điền URL để nút có tác dụng.</p>
                                    </div>
                                )}
                                <Accordion title="Typography" icon={LucideIcons.Type} defaultOpen>
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        <VisualMeasure label="Cỡ" value={getStyle('fontSize')} defaultValue={14} onChange={(v) => updateStyle({ fontSize: v })} max={100} unit="px" />
                                        <VisualMeasure label="Dòng" tooltip="Tỷ lệ chiều cao của mỗi dòng chữ. Giá trị chuẩn thường là 1.5 để dễ đọc." value={getStyle('lineHeight')} defaultValue={1.5} onChange={(v) => updateStyle({ lineHeight: v })} max={3} unit="" hideSlider />
                                    </div>
                                    <ColorPicker label="Màu chữ" value={getStyle('color') || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'color')} blocks={blocks} bodyStyle={bodyStyle} />
                                </Accordion>
                            </div>
                        )}
                        {selectedBlock.type === 'countdown' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-[14px] space-y-4">
                                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase mb-2"><LucideIcons.Clock className="w-4 h-4" /> Thời gian kết thúc</div>
                                    <input type="datetime-local" value={getStyle('targetDate') || ''} onChange={(e) => updateStyle({ targetDate: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#BD1D2D]" />
                                </div>
                                <Accordion title="Giao diện Countdown" icon={LucideIcons.Clock} defaultOpen>
                                    <div className="space-y-4">
                                        <ColorPicker label="Màu chữ số" solidOnly value={(getStyle('digitColor' as any) as string) || getStyle('color') || '#ffffff'} onChange={(v) => updateStyle({ digitColor: v, color: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        <ColorPicker label="Màu nền hộp số" solidOnly value={getStyle('contentBackgroundColor') || getStyle('backgroundColor') || '#1e293b'} onChange={(v) => updateStyle({ contentBackgroundColor: v })} blocks={blocks} bodyStyle={bodyStyle} />
                                        <ColorPicker label="Màu nhãn (Ngày, Giờ...)" solidOnly value={getStyle('labelColor') || '#004a7c'} onChange={(v, t) => handleColorUpdate(v, t, 'labelColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                    </div>
                                </Accordion>
                            </div>
                        )}
                        {selectedBlock.type === 'timeline' && (
                            <div className="space-y-4">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sự kiện Timeline</label>
                                {selectedBlock.items?.map((item, i) => (
                                    <div key={item.id || i} className="bg-slate-50 p-4 rounded-[18px] border border-slate-100 relative group animate-in slide-in-from-left-1 space-y-3 transition-all focus-within:z-[50] focus-within:ring-2 focus-within:ring-[#BD1D2D]/20 focus-within:border-[#BD1D2D]/30 focus-within:bg-white shadow-sm hover:shadow-md">
                                        <button onClick={() => removeTimelineItem(i)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 z-10" title="Xóa sự kiện"><LucideIcons.X className="w-4 h-4" /></button>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase px-1">Thời gian / Bước</label>
                                            <input
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-[#BD1D2D] outline-none transition-all shadow-sm"
                                                placeholder="VD: BƯỚC 1, 09:00 AM..."
                                                value={item.date || ''}
                                                onChange={(e) => handleTimelineItemChange(i, 'date', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase px-1">Tiêu đề</label>
                                            <RichText
                                                value={item.title || ''}
                                                onChange={(v) => handleTimelineItemChange(i, 'title', v)}
                                                minHeight="40px"
                                                bodyLinkColor={bodyStyle.linkColor}
                                                customMergeTags={customMergeTags}
                                                usedColors={usedColors}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-bold text-slate-400 uppercase px-1">Mô tả chi tiết</label>
                                            <RichText
                                                value={item.description || ''}
                                                onChange={(v) => handleTimelineItemChange(i, 'description', v)}
                                                minHeight="70px"
                                                bodyLinkColor={bodyStyle.linkColor}
                                                customMergeTags={customMergeTags}
                                                usedColors={usedColors}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button onClick={addTimelineItem} className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-[14px] text-xs font-bold text-slate-400 hover:text-[#BD1D2D] hover:border-[#BD1D2D] hover:bg-[#BD1D2D]/10 transition-all">
                                    <LucideIcons.Plus className="w-4 h-4 inline mr-1.5" /> Thêm sự kiện
                                </button>
                                <Accordion title="Giao diện Timeline" icon={LucideIcons.ListStart} defaultOpen>
                                    <div className="space-y-4">
                                        <ColorPicker label="Màu Chấm (Dot)" value={getStyle('timelineDotColor') || '#BD1D2D'} onChange={(v, t) => handleColorUpdate(v, t, 'timelineDotColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        <ColorPicker label="Màu Đường (Line)" value={getStyle('timelineLineColor') || '#e2e8f0'} onChange={(v, t) => handleColorUpdate(v, t, 'timelineLineColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kiểu đường</label>
                                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                                {['solid', 'dashed', 'dotted'].map(st => (
                                                    <button key={st} onClick={() => updateStyle({ timelineLineStyle: st as any })} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all ${getStyle('timelineLineStyle') === st ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}>{st}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </Accordion>
                            </div>
                        )}
                        {selectedBlock.type === 'review' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Số sao: {selectedBlock.rating || 5}</label>
                                    <input type="range" min="1" max="5" step="1" value={selectedBlock.rating || 5} onChange={(e) => onUpdateBlock(selectedBlock.id, { rating: parseInt(e.target.value) })} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#BD1D2D]" />
                                </div>
                                <RichText value={selectedBlock.content} onChange={(v) => onUpdateBlock(selectedBlock.id, { content: v })} className="min-h-[80px]" bodyLinkColor={bodyStyle.linkColor} customMergeTags={customMergeTags} usedColors={usedColors} fontSize={getStyle('fontSize') as string | undefined} />
                                <Accordion title="Typography" icon={LucideIcons.Type} defaultOpen>
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        <VisualMeasure label="Cỡ" value={getStyle('fontSize')} defaultValue={14} onChange={(v) => updateStyle({ fontSize: v })} max={100} unit="px" />
                                        <VisualMeasure label="Dòng" tooltip="Tỷ lệ chiều cao của mỗi dòng chữ. Giá trị chuẩn thường là 1.5 để dễ đọc." value={getStyle('lineHeight')} defaultValue={1.5} onChange={(v) => updateStyle({ lineHeight: v })} max={3} unit="" hideSlider />
                                    </div>
                                    <ColorPicker label="Màu chữ" value={getStyle('color') || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'color')} blocks={blocks} bodyStyle={bodyStyle} />
                                </Accordion>
                            </div>
                        )}
                        {selectedBlock.type === 'image' && (
                            <div className="space-y-4">
                                <ImageUploader 
                                    label="Upload ảnh" 
                                    value={selectedBlock.content} 
                                    onChange={(url: string) => onUpdateBlock(selectedBlock.id, { content: url })} 
                                    fallbackValue={selectedBlock.fallbackContent}
                                    onFallbackChange={(fbUrl: string) => onUpdateBlock(selectedBlock.id, { fallbackContent: fbUrl })}
                                />

                                <Input label="Alt Text" value={selectedBlock.altText || ''} onChange={(e) => onUpdateBlock(selectedBlock.id, { altText: e.target.value })} customSize="sm" />
                                <Input label="Link khi click vào ảnh" value={selectedBlock.url || ''} onChange={(e) => onUpdateBlock(selectedBlock.id, { url: e.target.value })} icon={LucideIcons.Link} customSize="sm" placeholder="VD: https://domain.com hoặc {{cert_link}}" />

                                {/* Auto-detected Dynamic Variable in Image click link */}
                                {/(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i.test(selectedBlock.url || '') && (
                                    <Input 
                                        label="Đường dẫn dự phòng (Fallback Link URL)" 
                                        placeholder="VD: https://ideas.edu.vn hoặc https://yoursite.com"
                                        value={selectedBlock.fallbackUrl || ''} 
                                        onChange={(e) => onUpdateBlock(selectedBlock.id, { fallbackUrl: e.target.value })} 
                                        icon={LucideIcons.ShieldCheck} 
                                        customSize="sm" 
                                    />
                                )}

                                {/* Ratio & Fit */}
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-[14px] space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tỷ lệ khung hình (Aspect Ratio)</label>
                                        <div className="flex bg-white border border-slate-200 p-1 rounded-xl gap-1 overflow-x-auto custom-scrollbar no-scrollbar-x">
                                            {[
                                                { label: 'Auto', value: 'auto' },
                                                { label: '1:1', value: '1/1' },
                                                { label: '4:3', value: '4/3' },
                                                { label: '16:9', value: '16/9' },
                                                { label: '3:2', value: '3/2' },
                                                { label: '2:1', value: '2/1' }
                                            ].map(ratio => (
                                                <button
                                                    key={ratio.value}
                                                    onClick={() => updateStyle({ aspectRatio: ratio.value } as any)}
                                                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${(getStyle('aspectRatio') || 'auto') === ratio.value ? 'bg-[var(--color-primary)] text-white shadow-xs font-semibold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {ratio.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Chế độ hiển thị (Object Fit)</label>
                                        <div className="flex bg-white border border-slate-200 p-1 rounded-xl gap-1">
                                            {[
                                                { label: 'Cover', value: 'cover' },
                                                { label: 'Contain', value: 'contain' },
                                                { label: 'Fill', value: 'fill' }
                                            ].map(fit => (
                                                <button
                                                    key={fit.value}
                                                    onClick={() => updateStyle({ objectFit: fit.value as any })}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${(getStyle('objectFit') || 'cover') === fit.value ? 'bg-[var(--color-primary)] text-white shadow-xs font-semibold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {fit.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100">
                                        <VisualMeasure
                                            label="Chiều cao tối đa (Nên để Auto nếu dùng Ratio)"
                                            value={getStyle('height')}
                                            onChange={(v) => updateStyle({ height: v })}
                                            max={800}
                                            unit="px"
                                            canAuto
                                        />
                                    </div>
                                </div>

                                {/* Validation hints */}
                                {(!selectedBlock.altText || !selectedBlock.altText.trim()) && (
                                    <div className="flex items-start gap-2 p-2 bg-[#BD1D2D]/10 border border-[#BD1D2D]/30 rounded-xl">
                                        <LucideIcons.AlertTriangle className="w-3.5 h-3.5 text-[#BD1D2D] shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-[#BD1D2D] font-medium">Chưa có mô tả ALT — ảnh không thân thiện với email client và SEO.</p>
                                    </div>
                                )}
                                {(!selectedBlock.url || selectedBlock.url === '#' || !selectedBlock.url.trim()) && (
                                    <div className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-100 rounded-xl">
                                        <LucideIcons.Link className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-orange-700 font-medium">Chưa gắn link cho ảnh — người đọc click không đi đến đâu.</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {selectedBlock.type === 'video' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-[14px] flex gap-3 text-slate-800"><LucideIcons.Video className="w-5 h-5 shrink-0" /><p className="text-[10px] font-medium leading-tight">Video hiển thị dạng thumbnail có nút Play.</p></div>
                                <Input label="Video URL" value={selectedBlock.videoUrl || ''} onChange={(e) => onUpdateBlock(selectedBlock.id, { videoUrl: e.target.value })} icon={LucideIcons.Link} customSize="sm" />
                                <ImageUploader label="Thumbnail (Optional)" value={selectedBlock.thumbnailUrl || ''} onChange={(url: string) => onUpdateBlock(selectedBlock.id, { thumbnailUrl: url })} />
                                <ColorPicker label="Màu nút Play" value={getStyle('playButtonColor') || '#BD1D2D'} onChange={(v, t) => handleColorUpdate(v, t, 'playButtonColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                            </div>
                        )}

                        {selectedBlock.type === 'divider' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-[14px] border border-slate-100 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <LucideIcons.Minus className="w-4 h-4 text-[#BD1D2D]" />
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Kẻ ngang</span>
                                    </div>
                                    <VisualMeasure label="Độ dày" value={getStyle('borderTopWidth')} defaultValue={1} onChange={(v) => updateStyle({ borderTopWidth: v })} max={10} unit="px" />
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kiểu đường</label>
                                        <div className="flex bg-white border border-slate-200 p-1 rounded-xl gap-1">
                                            {(['solid', 'dashed', 'dotted'] as const).map(lineStyle => (
                                                <button
                                                    key={lineStyle}
                                                    onClick={() => updateStyle({ borderStyle: lineStyle })}
                                                    className={`flex-1 py-2 text-[9px] font-bold uppercase rounded-lg transition-all ${(getStyle('borderStyle') === lineStyle || (!getStyle('borderStyle') && lineStyle === 'solid')) ? 'bg-[var(--color-primary)] text-white shadow-xs font-semibold' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {lineStyle === 'solid' ? '— Liền' : lineStyle === 'dashed' ? '-- Đứt' : '··· Chấm'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <ColorPicker label="Màu đường kẻ" value={getStyle('borderColor') || '#eeeeee'} onChange={(v, t) => handleColorUpdate(v, t, 'borderColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                </div>
                                {/* Live preview */}
                                <div className="px-4">
                                    <div style={{
                                        borderTop: `${getStyle('borderTopWidth') || '1px'} ${getStyle('borderStyle') || 'solid'} ${getStyle('borderColor') || '#eeeeee'}`,
                                        margin: '8px 0'
                                    }} />
                                </div>
                            </div>
                        )}


                        {selectedBlock.type === 'social' && (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Mạng xã hội</label>
                                    <div className="grid grid-cols-6 gap-2">
                                        {SOCIAL_NETWORKS_CONFIG.map(net => {
                                            const isAdded = selectedBlock.socialLinks?.some(l => l.network === net.id);
                                            const IconComponent = LucideIconMap[net.icon as string] || LucideIcons.Star;
                                            return (
                                                <button key={net.id} onClick={() => { if (isAdded) return; const newLinks = [...(selectedBlock.socialLinks || []), { id: crypto.randomUUID(), network: net.id as any, url: '', customStyle: {} }]; onUpdateBlock(selectedBlock.id, { socialLinks: newLinks }); }} className={`p-2 rounded-xl flex items-center justify-center border ${isAdded ? 'bg-slate-100 border-slate-200 opacity-50 cursor-default' : 'bg-white border-slate-100 hover:border-[#BD1D2D] shadow-sm'}`} style={{ color: isAdded ? '#94a3b8' : net.color }}><IconComponent className="w-5 h-5" /></button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {selectedBlock.socialLinks?.map((link, idx) => {
                                        const IconComponent = LucideIconMap[SOCIAL_ICON_MAP[link.network] || 'Share2'];
                                        return (
                                            <div key={link.id} className="bg-white p-3 rounded-[14px] border border-slate-200 shadow-sm animate-in slide-in-from-left-2">
                                                <div className="flex gap-2 items-center mb-2">
                                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><IconComponent className="w-4 h-4" /></div>
                                                    <div className="flex-1 font-bold text-[10px] uppercase text-slate-700">{link.network}</div>
                                                    <button onClick={() => setEditSocialId(editSocialId === link.id ? null : link.id)} className={`p-1.5 rounded-lg ${editSocialId === link.id ? 'bg-[#BD1D2D] text-white' : 'text-slate-400 hover:bg-slate-100'}`}><LucideIcons.Settings className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => onUpdateBlock(selectedBlock.id, { socialLinks: selectedBlock.socialLinks?.filter((_, i) => i !== idx) })} className="p-1.5 text-slate-300 hover:text-rose-500"><LucideIcons.X className="w-3.5 h-3.5" /></button>
                                                </div>
                                                <input className="w-full text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 outline-none focus:border-[#BD1D2D]" placeholder="https://..." value={link.url} onChange={(e) => { const newLinks = [...(selectedBlock.socialLinks || [])]; newLinks[idx] = { ...newLinks[idx], url: e.target.value }; onUpdateBlock(selectedBlock.id, { socialLinks: newLinks }); }} />
                                                {editSocialId === link.id && (
                                                    <div className="pt-3 mt-3 border-t border-slate-50 space-y-3 animate-in zoom-in-95">
                                                        {link.network === 'custom' && <ImageUploader label="Custom Icon (URL)" value={link.imageUrl || ''} onChange={(url) => { const newLinks = [...(selectedBlock.socialLinks || [])]; newLinks[idx] = { ...newLinks[idx], imageUrl: url }; onUpdateBlock(selectedBlock.id, { socialLinks: newLinks }); }} />}
                                                        <div className="grid grid-cols-2 gap-3"><ColorPicker label="Màu Icon" value={link.customStyle?.iconColor || ''} onChange={(v) => { const newLinks = [...(selectedBlock.socialLinks || [])]; newLinks[idx] = { ...newLinks[idx], customStyle: { ...newLinks[idx].customStyle, iconColor: v } }; onUpdateBlock(selectedBlock.id, { socialLinks: newLinks }); }} blocks={blocks} bodyStyle={bodyStyle} /><ColorPicker label="Màu Nền" value={link.customStyle?.backgroundColor || ''} onChange={(v) => { const newLinks = [...(selectedBlock.socialLinks || [])]; newLinks[idx] = { ...newLinks[idx], customStyle: { ...newLinks[idx].customStyle, backgroundColor: v } }; onUpdateBlock(selectedBlock.id, { socialLinks: newLinks }); }} blocks={blocks} bodyStyle={bodyStyle} /></div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {selectedBlock.type === 'check_list' && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Tiêu đề List</label><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={getStyle('showCheckListTitle') !== false} onChange={(e) => updateStyle({ showCheckListTitle: e.target.checked })} /><div className="w-9 h-5 bg-slate-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#BD1D2D]/20 peer-checked:bg-[#BD1D2D] transition-colors shadow-inner after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow-sm after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 after:border-white"></div></label></div>
                                    {getStyle('showCheckListTitle') !== false && (
                                        <RichText
                                            value={selectedBlock.checkListTitle || ''}
                                            onChange={(v) => onUpdateBlock(selectedBlock.id, { checkListTitle: v })}
                                            minHeight="48px"
                                            bodyLinkColor={bodyStyle.linkColor}
                                            customMergeTags={customMergeTags}
                                            usedColors={usedColors}
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-100">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Tiêu đề mục</label>
                                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={getStyle('showItemTitle') !== false} onChange={(e) => { if (!e.target.checked && getStyle('showItemDescription') === false) return; updateStyle({ showItemTitle: e.target.checked }); }} /><div className="w-9 h-5 bg-slate-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#BD1D2D]/20 peer-checked:bg-[#BD1D2D] transition-colors shadow-inner after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow-sm after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 after:border-white"></div></label>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase">Mô tả mục</label>
                                        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={getStyle('showItemDescription') !== false} onChange={(e) => { if (!e.target.checked && getStyle('showItemTitle') === false) return; updateStyle({ showItemDescription: e.target.checked }); }} /><div className="w-9 h-5 bg-slate-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#BD1D2D]/20 peer-checked:bg-[#BD1D2D] transition-colors shadow-inner after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow-sm after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 after:border-white"></div></label>
                                    </div>
                                </div>
                                {/* Icon picker moved here from Design tab */}
                                <Accordion title="Giao diện Check" icon={LucideIcons.CheckCircle} defaultOpen>
                                    <div className="space-y-4">
                                        {/* Mode: preset icon vs custom image */}
                                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                            {(['icon', 'image'] as const).map(mode => (
                                                <button
                                                    key={mode}
                                                    onClick={() => updateStyle({ checkIconMode: mode } as any)}
                                                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${(getStyle('checkIconMode') || 'icon') === mode ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {mode === 'icon' ? 'Icon thư viện' : 'Ảnh tùy chỉnh'}
                                                </button>
                                            ))}
                                        </div>

                                        {(getStyle('checkIconMode') || 'icon') === 'icon' ? (
                                            <>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chọn Icon</label>
                                                    <div className="grid grid-cols-5 gap-2">
                                                        {[
                                                            'CheckCircle', 'CircleCheckBig', 'Check', 'Star', 'ArrowRight',
                                                            'MousePointer2', 'Sparkles', 'Heart', 'Zap', 'Target',
                                                            'ThumbsUp', 'Shield', 'Award', 'Gift', 'User',
                                                            'Home', 'Calendar', 'Clock', 'Lock', 'Settings'
                                                        ].map((iconId) => {
                                                            const isSelected = getStyle('checkIcon') === iconId || (!getStyle('checkIcon') && iconId === 'Check');
                                                            const iconColor = isSelected ? '#ffffff' : '#94a3b8';
                                                            return (
                                                                <button key={iconId} onClick={() => updateStyle({ checkIcon: iconId })} className={`p-2 rounded-xl flex items-center justify-center border transition-all ${isSelected ? 'bg-[#BD1D2D] border-[#BD1D2D] shadow-md' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                                                                    <img src={getIconUrl(iconId, iconColor)} className="w-4 h-4 object-contain" alt={iconId} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                {/* Solid-only color swatch — no gradient */}
                                                <div className="space-y-1.5">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Màu Icon</label>
                                                    <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-100 rounded-xl">
                                                        <div className="relative w-8 h-8 shrink-0">
                                                            <div 
                                                                className="w-8 h-8 rounded-full border-2 border-slate-200 shadow-sm flex items-center justify-center overflow-hidden" 
                                                                style={{ backgroundColor: getStyle('checkIconColor') || '#BD1D2D' }}
                                                            >
                                                                <LucideIcons.Pipette className="w-3.5 h-3.5 text-white mix-blend-difference" />
                                                            </div>
                                                            <input
                                                                type="color"
                                                                value={getStyle('checkIconColor') || '#BD1D2D'}
                                                                onChange={(e) => updateStyle({ checkIconColor: e.target.value } as any)}
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                            />
                                                        </div>
                                                        <span className="text-xs font-mono font-black text-slate-600">{getStyle('checkIconColor') || '#BD1D2D'}</span>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <ImageUploader
                                                label="Ảnh icon tùy chỉnh"
                                                value={getStyle('checkCustomIconUrl') || ''}
                                                onChange={(url: string) => updateStyle({ checkCustomIconUrl: url } as any)}
                                            />
                                        )}

                                        {(getStyle('checkIconMode') || 'icon') === 'image' && (
                                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <LucideIcons.Layers className="w-4 h-4 text-emerald-600" />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none">Ảnh riêng từng mục</p>
                                                        <p className="text-[8px] text-slate-400 mt-0.5">Mỗi hàng dùng một ảnh khác nhau</p>
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" checked={!!getStyle('checkIndividualIcons' as any)} onChange={(e) => updateStyle({ checkIndividualIcons: e.target.checked } as any)} />
                                                    <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/20 peer-checked:bg-emerald-600 transition-colors shadow-inner after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:shadow-sm after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 peer-checked:after:border-white"></div>
                                                </label>
                                            </div>
                                        )}

                                        <VisualMeasure label="Cỡ Icon" value={getStyle('checkIconSize')} defaultValue={20} onChange={(v) => updateStyle({ checkIconSize: v })} max={60} unit="px" />

                                        <div className="grid grid-cols-2 gap-3">
                                            <VisualMeasure
                                                label="Bo tròn"
                                                value={getStyle('checkIconRadius')}
                                                onChange={(v) => updateStyle({ checkIconRadius: v })}
                                                max={100}
                                                unit="px"
                                            />
                                            <VisualMeasure
                                                label="Độ dày viền"
                                                value={getStyle('checkIconBorderWidth')}
                                                onChange={(v) => updateStyle({ checkIconBorderWidth: v })}
                                                max={10}
                                                unit="px"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <ColorPicker
                                                solidOnly
                                                label="Màu nền"
                                                value={getStyle('checkIconBackgroundColor') || 'transparent'}
                                                onChange={(v) => updateStyle({ checkIconBackgroundColor: v })}
                                                blocks={blocks}
                                                bodyStyle={bodyStyle}
                                            />
                                            <ColorPicker
                                                solidOnly
                                                label="Màu viền"
                                                value={getStyle('checkIconBorderColor') || '#e2e8f0'}
                                                onChange={(v) => updateStyle({ checkIconBorderColor: v })}
                                                blocks={blocks}
                                                bodyStyle={bodyStyle}
                                            />
                                        </div>

                                        <VisualMeasure
                                            label="Đệm Icon (Padding)"
                                            value={getStyle('checkIconPadding')}
                                            onChange={(v) => updateStyle({ checkIconPadding: v })}
                                            max={20}
                                            unit="px"
                                        />

                                        {/* Icon Vertical Alignment */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Căn chỉnh</label>
                                            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                {['top', 'middle', 'bottom'].map(v => (
                                                    <button
                                                        key={v}
                                                        onClick={() => updateStyle({ checkIconVerticalAlign: v as any })}
                                                        className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all ${(getStyle('checkIconVerticalAlign') || 'middle') === v ? 'bg-white shadow-sm text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        {v === 'top' && <LucideIcons.AlignVerticalJustifyStart className="w-3.5 h-3.5" />}
                                                        {v === 'middle' && <LucideIcons.AlignVerticalJustifyCenter className="w-3.5 h-3.5" />}
                                                        {v === 'bottom' && <LucideIcons.AlignVerticalJustifyEnd className="w-3.5 h-3.5" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <VisualMeasure label="Max Width (checklist)" value={getStyle('maxWidth')} defaultValue={600} onChange={(v) => updateStyle({ maxWidth: v })} max={700} unit="px" />
                                    </div>
                                </Accordion>
                                <div className="space-y-4 pt-3">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Danh sách mục</label>
                                    {selectedBlock.items?.map((item, i) => (
                                        <div key={item.id} className="bg-slate-50 p-4 rounded-[18px] border border-slate-100 relative group animate-in slide-in-from-left-1 space-y-3 transition-all focus-within:z-[50] focus-within:ring-2 focus-within:ring-[#BD1D2D]/20 focus-within:border-[#BD1D2D]/30 focus-within:bg-white shadow-sm hover:shadow-md">
                                            <button onClick={() => removeTimelineItem(i)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 z-10"><LucideIcons.X className="w-4 h-4" /></button>
                                            {getStyle('showItemTitle') !== false && (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-[8px] font-bold text-slate-400 uppercase">Tiêu đề</label>
                                                        {getStyle('checkIndividualIcons' as any) === true && (getStyle('checkIconMode') || 'icon') === 'image' && (
                                                            <span className="text-[8px] font-bold text-[#BD1D2D] uppercase flex items-center gap-1"><LucideIcons.Image className="w-2.5 h-2.5" /> Iconic</span>
                                                        )}
                                                    </div>
                                                    <RichText value={item.title} onChange={(v) => handleTimelineItemChange(i, 'title', v)} minHeight="40px" bodyLinkColor={bodyStyle.linkColor} customMergeTags={customMergeTags} usedColors={usedColors} />
                                                </div>
                                            )}
                                            {getStyle('checkIndividualIcons' as any) === true && (getStyle('checkIconMode') || 'icon') === 'image' && (
                                                <div className="px-1 py-1">
                                                    <ImageUploader
                                                        compact
                                                        label="Icon riêng cho mục này"
                                                        value={item.customIconUrl || ''}
                                                        onChange={(url: string) => handleTimelineItemChange(i, 'customIconUrl' as any, url)}
                                                    />
                                                </div>
                                            )}
                                            {getStyle('showItemDescription') !== false && (
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-bold text-slate-400 uppercase px-1">Mô tả</label>
                                                    <RichText value={item.description} onChange={(v) => handleTimelineItemChange(i, 'description', v)} minHeight="80px" bodyLinkColor={bodyStyle.linkColor} customMergeTags={customMergeTags} usedColors={usedColors} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={addTimelineItem} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[18px] text-xs font-bold text-slate-400 hover:text-[#BD1D2D] hover:border-[#BD1D2D] hover:bg-[#BD1D2D]/10 transition-all"><LucideIcons.Plus className="w-4 h-4 inline mr-2" /> Thêm mục mới</button>
                                </div>
                            </div>
                        )}
                        {selectedBlock.type === 'header' && (
                            <div className="space-y-6">
                                <Accordion title="Logo" icon={LucideIcons.Image} defaultOpen>
                                    <div className="space-y-4">
                                        <ImageUploader label="Logo Image" value={selectedBlock.content} onChange={(url: string) => onUpdateBlock(selectedBlock.id, { content: url })} />
                                        <Input label="Alt Text" value={selectedBlock.altText || ''} onChange={(e) => onUpdateBlock(selectedBlock.id, { altText: e.target.value })} />
                                        <div className="pt-2">
                                            <VisualMeasure label="Logo Width" value={getStyle('logoWidth')} defaultValue={120} onChange={(v) => updateStyle({ logoWidth: v })} max={300} unit="px" />
                                        </div>
                                    </div>
                                </Accordion>

                                <Accordion title="Menu Links" icon={LucideIcons.Link} defaultOpen>
                                    <div className="space-y-4">
                                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                            {(['link', 'button'] as const).map(v => (
                                                <button key={v} onClick={() => updateStyle({ headerMenuType: v })} className={`flex-1 py-1.5 rounded-lg flex items-center justify-center text-[10px] uppercase font-bold transition-all ${(getStyle('headerMenuType') || 'link') === v ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}>{v === 'link' ? 'Simple Link' : 'CTA Button'}</button>
                                            ))}
                                        </div>

                                        <div className="space-y-3">
                                            {selectedBlock.items?.map((item, i) => (
                                                <div key={item.id} className="bg-slate-50 p-3 rounded-[14px] border border-slate-100 relative group space-y-2">
                                                    <button onClick={() => removeTimelineItem(i)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500"><LucideIcons.X className="w-3.5 h-3.5" /></button>
                                                    <Input label="Label" value={item.title} onChange={(e) => handleTimelineItemChange(i, 'title', e.target.value)} />
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex-1">
                                                            <Input label="URL" value={item.description} onChange={(e) => handleTimelineItemChange(i, 'description', e.target.value)} icon={LucideIcons.Link} />
                                                        </div>
                                                        <div className="flex flex-col gap-1.5 pt-4">
                                                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                                                {(['link', 'button'] as const).map(type => (
                                                                    <button
                                                                        key={type}
                                                                        onClick={() => handleTimelineItemChange(i, 'menuType' as any, type)}
                                                                        className={`p-1.5 rounded-md transition-all ${(item.menuType || (getStyle('headerMenuType') || 'link')) === type ? 'bg-white shadow-sm text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}
                                                                        title={type === 'link' ? 'Simple Link' : 'CTA Button'}
                                                                    >
                                                                        {type === 'link' ? <LucideIcons.Link className="w-3 h-3" /> : <LucideIcons.Square className="w-3 h-3" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button onClick={() => {
                                                const newItem: ListItem = { id: crypto.randomUUID(), title: 'New Link', description: 'https://' };
                                                onUpdateBlock(selectedBlock.id, { items: [...(selectedBlock.items || []), newItem] });
                                            }} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-[14px] text-[10px] font-bold text-slate-400 hover:text-[#BD1D2D] hover:border-[#BD1D2D] transition-all uppercase tracking-widest leading-none"><LucideIcons.Plus className="w-3.5 h-3.5 inline mr-1" /> Thêm menu item</button>
                                        </div>
                                    </div>
                                </Accordion>
                            </div>
                        )}
                        {selectedBlock.type === 'voucher' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-[14px] space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <LucideIcons.Gift className="w-5 h-5 text-[#BD1D2D]" />
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Cấu hình Voucher</span>
                                    </div>
                                    <CustomSelect
                                        label="Chọn chiến dịch Voucher"
                                        value={selectedBlock.voucherCampaignId || ''}
                                        onChange={(v) => onUpdateBlock(selectedBlock.id, { voucherCampaignId: v })}
                                        options={[
                                            { value: '', label: '-- Chưa chọn --' },
                                            ...voucherCampaigns.filter(c => c.status !== 'expired').map(c => ({
                                                value: c.id,
                                                label: c.name
                                            }))
                                        ]}
                                    />

                                    <CustomSelect
                                        label="Kiểu hiển thị"
                                        value={getStyle('voucherStyle') || 'ticket'}
                                        onChange={(v) => updateStyle({ voucherStyle: v as any })}
                                        options={[
                                            { value: 'ticket', label: 'Vé cắt góc (Ticket)' },
                                            { value: 'box', label: 'Hộp chữ nhật (Box)' }
                                        ]}
                                    />
                                </div>
                                <Accordion title="Màu sắc ưu đãi" icon={LucideIcons.Palette} defaultOpen>
                                    <div className="space-y-4">
                                        <ColorPicker label="Màu viền ranh (Border)" value={getStyle('voucherBorderColor') || '#BD1D2D'} onChange={(v, t) => handleColorUpdate(v, t, 'voucherBorderColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kiểu viền</label>
                                            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                {['dashed', 'dotted', 'solid'].map(v => (
                                                    <button key={v} onClick={() => updateStyle({ voucherBorderStyle: v as any })} className={`flex-1 py-1.5 rounded-lg flex items-center justify-center text-[10px] uppercase font-bold transition-all ${(getStyle('voucherBorderStyle') || 'dashed') === v ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}>{v}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <ColorPicker label="Màu nền" solidOnly value={getStyle('voucherBg') || '#fffbe1'} onChange={(v) => updateStyle({ voucherBg: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                            <ColorPicker label="Màu chữ" solidOnly value={getStyle('voucherTextColor') || '#b45309'} onChange={(v) => updateStyle({ voucherTextColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                            <ColorPicker label="Nút - Màu nền" solidOnly value={getStyle('voucherButtonBg') || '#BD1D2D'} onChange={(v) => updateStyle({ voucherButtonBg: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                            <ColorPicker label="Nút - Màu chữ" solidOnly value={getStyle('voucherButtonTextColor') || '#ffffff'} onChange={(v) => updateStyle({ voucherButtonTextColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        </div>
                                    </div>
                                </Accordion>
                            </div>
                        )}
                        {selectedBlock.type === 'otp' && (
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-[14px] flex gap-3 text-slate-800">
                                    <LucideIcons.KeyRound className="w-5 h-5 shrink-0 text-emerald-600" />
                                    <p className="text-[10px] font-medium leading-tight">
                                        Mã OTP sẽ được tự động điền thay thế cho <span className="font-mono text-emerald-600 bg-emerald-50 px-1 rounded">[short_code]</span>.
                                    </p>
                                </div>

                                <Accordion title="Typography & Màu sắc" icon={LucideIcons.Type} defaultOpen>
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        <VisualMeasure label="Cỡ chữ" value={getStyle('fontSize')} defaultValue={36} onChange={(v) => updateStyle({ fontSize: v })} max={100} unit="px" />
                                        <VisualMeasure label="Khoảng cách (Letter Spacing)" value={getStyle('letterSpacing')} defaultValue={12} onChange={(v) => updateStyle({ letterSpacing: v })} max={40} unit="px" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 mb-2 pt-2 border-t border-slate-100">
                                        <ColorPicker label="Màu chữ" value={getStyle('color') || '#166534'} onChange={(v, t) => handleColorUpdate(v, t, 'color')} blocks={blocks} bodyStyle={bodyStyle} />
                                        <ColorPicker label="Màu nền" value={getStyle('backgroundColor') || '#f0fdf4'} onChange={(v, t) => handleColorUpdate(v, t, 'backgroundColor')} blocks={blocks} bodyStyle={bodyStyle} />
                                    </div>
                                </Accordion>

                                <Accordion title="Đường viền (Border)" icon={LucideIcons.Square} defaultOpen>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <VisualMeasure label="Độ dày viền" value={getStyle('borderTopWidth')} defaultValue={2} onChange={(v) => updateStyle({ borderTopWidth: v, borderRightWidth: v, borderBottomWidth: v, borderLeftWidth: v })} max={10} unit="px" />
                                            <VisualMeasure label="Bo góc (Radius)" value={getStyle('borderRadius')} defaultValue={12} onChange={(v) => updateStyle({ borderRadius: v })} max={100} unit="px" />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kiểu viền</label>
                                            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                                {['solid', 'dashed', 'dotted'].map(v => (
                                                    <button key={v} onClick={() => updateStyle({ borderStyle: v as any })} className={`flex-1 py-1.5 rounded-lg flex items-center justify-center text-[10px] uppercase font-bold transition-all ${(getStyle('borderStyle') || 'dashed') === v ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}>
                                                        {v === 'solid' ? 'Liền' : v === 'dashed' ? 'Đứt' : 'Chấm'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <ColorPicker solidOnly label="Màu viền" value={getStyle('borderColor') || '#86efac'} onChange={(v, t) => handleColorUpdate(v, t, 'borderColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                    </div>
                                </Accordion>
                            </div>
                        )}
                        {selectedBlock.type === 'survey_card' && (
                            <div className="space-y-4">
                                <Accordion title="Chọn Khảo sát MYERP" icon={LucideIcons.ClipboardList} defaultOpen>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
                                                Liên kết Biểu mẫu Khảo sát
                                            </label>
                                            <select
                                                value={(getStyle('surveyId' as any) as string) || ''}
                                                onChange={(e) => {
                                                    const sid = e.target.value;
                                                    const chosen = surveys.find(sv => String(sv.id) === String(sid));
                                                    if (chosen) {
                                                        const surveyUrl = `${window.location.origin}/s/${chosen.slug}?email={{email}}`;
                                                        onUpdateBlock(selectedBlock.id, {
                                                            url: surveyUrl,
                                                            content: chosen.title || selectedBlock.content,
                                                            style: {
                                                                ...selectedBlock.style,
                                                                surveyId: String(chosen.id),
                                                                surveySlug: chosen.slug || '',
                                                                surveyTitle: chosen.title || selectedBlock.style.surveyTitle || 'Khảo sát mức độ hài lòng của bạn',
                                                                surveyDescription: chosen.description || selectedBlock.style.surveyDescription || 'Ý kiến của bạn giúp chúng tôi nâng cao chất lượng dịch vụ mỗi ngày. Chỉ mất 1 phút để hoàn thành!',
                                                            }
                                                        });
                                                    } else {
                                                        updateStyle({ surveyId: '' } as any);
                                                    }
                                                }}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-[#BD1D2D] shadow-xs"
                                            >
                                                <option value="">{loadingSurveys ? 'Đang tải danh sách khảo sát...' : '-- Chọn khảo sát từ hệ thống --'}</option>
                                                {surveys.map((sv: any) => (
                                                    <option key={sv.id} value={sv.id}>
                                                        {sv.title} {sv.status === 'active' ? '(Đang mở)' : sv.status ? `(${sv.status})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <Input
                                            label="Nhãn phụ (Badge Text)"
                                            value={(getStyle('surveyBadgeText' as any) as string) ?? 'KHẢO SÁT NHANH'}
                                            onChange={(e) => updateStyle({ surveyBadgeText: e.target.value } as any)}
                                            placeholder="VD: KHẢO SÁT NHANH"
                                        />
                                        <Input
                                            label="Tiêu đề Thẻ Khảo sát"
                                            value={(getStyle('surveyTitle' as any) as string) ?? selectedBlock.content ?? ''}
                                            onChange={(e) => {
                                                onUpdateBlock(selectedBlock.id, {
                                                    content: e.target.value,
                                                    style: { ...selectedBlock.style, surveyTitle: e.target.value }
                                                });
                                            }}
                                            placeholder="Khảo sát mức độ hài lòng của bạn"
                                        />
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block px-1">Mô tả ngắn</label>
                                            <textarea
                                                rows={3}
                                                value={(getStyle('surveyDescription' as any) as string) ?? ''}
                                                onChange={(e) => updateStyle({ surveyDescription: e.target.value } as any)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-[#BD1D2D]"
                                                placeholder="Ý kiến của bạn giúp chúng tôi nâng cao chất lượng dịch vụ..."
                                            />
                                        </div>
                                        <Input
                                            label="Chữ trên Nút (CTA Text)"
                                            value={(getStyle('surveyButtonText' as any) as string) ?? 'Tham gia khảo sát ngay →'}
                                            onChange={(e) => updateStyle({ surveyButtonText: e.target.value } as any)}
                                            placeholder="Tham gia khảo sát ngay →"
                                        />
                                        <Input
                                            label="Đường dẫn Khảo sát (URL)"
                                            value={selectedBlock.url || ''}
                                            onChange={(e) => onUpdateBlock(selectedBlock.id, { url: e.target.value })}
                                            placeholder="https://.../s/slug?email={{email}}"
                                        />
                                    </div>
                                </Accordion>
                                <Accordion title="Màu sắc & Giao diện Thẻ" icon={LucideIcons.Palette} defaultOpen>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <ColorPicker solidOnly label="Màu nhấn & Nút" value={(getStyle('surveyAccentColor' as any) as string) || '#BD1D2D'} onChange={(v) => updateStyle({ surveyAccentColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                            <ColorPicker solidOnly label="Màu chữ Nút" value={(getStyle('surveyButtonTextColor' as any) as string) || '#FFFFFF'} onChange={(v) => updateStyle({ surveyButtonTextColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <ColorPicker solidOnly label="Màu nền Thẻ" value={(getStyle('surveyCardBgColor' as any) as string) || '#F8FAFC'} onChange={(v) => updateStyle({ surveyCardBgColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                            <ColorPicker solidOnly label="Màu viền Thẻ" value={(getStyle('surveyBorderColor' as any) as string) || '#BFDBFE'} onChange={(v) => updateStyle({ surveyBorderColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        </div>
                                        <VisualMeasure label="Bo góc Thẻ (Radius)" value={getStyle('borderRadius')} defaultValue={14} onChange={(v) => updateStyle({ borderRadius: v })} max={40} unit="px" />
                                        <AlignmentControl values={{ textAlign: getStyle('textAlign') || 'center', verticalAlign: getStyle('verticalAlign') || 'middle' }} onChange={(a) => updateStyle(a as any)} />
                                    </div>
                                </Accordion>
                            </div>
                        )}
                        {/* TABLE block properties */}
                        {selectedBlock.type === 'table' && (
                            <div className="space-y-5">
                                {/* Quick row/col count resize */}
                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-[14px] space-y-3">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cấu trúc bảng</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[['tableRows', 'Hàng', 'Rows'] as const, ['tableCols', 'Cột', 'Cols'] as const].map(([key, label]) => {
                                            const cur = (getStyle(key) ?? (key === 'tableRows' ? 3 : 4)) as number;
                                            const setCnt = (val: number) => {
                                                const next = Math.max(2, val);
                                                try {
                                                    const curCells: any[][] = JSON.parse(selectedBlock.content || '[]');
                                                    const curRows = curCells.length || (getStyle('tableRows') as number) || 3;
                                                    const curCols = curCells[0]?.length || (getStyle('tableCols') as number) || 4;
                                                    let newCells = curCells.map((r: any[]) => [...r]);
                                                    if (key === 'tableRows') {
                                                        while (newCells.length < next) newCells.push(Array.from({ length: curCols }, () => ({ content: '', align: 'left' })));
                                                        if (newCells.length > next) newCells = newCells.slice(0, next);
                                                    } else {
                                                        if (next > curCols) {
                                                            newCells = newCells.map(r => { const row = [...r]; while (row.length < next) row.push({ content: '', align: 'left' }); return row; });
                                                        } else {
                                                            newCells = newCells.map(r => r.slice(0, next));
                                                        }
                                                    }
                                                    const newStyle = { ...selectedBlock.style, [key]: next } as any;
                                                    onUpdateBlock(selectedBlock.id, { style: newStyle, content: JSON.stringify(newCells) });
                                                } catch { updateStyle({ [key]: next } as any); }
                                            };
                                            return (
                                                <div key={key} className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
                                                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1">
                                                        <button onMouseDown={() => setCnt(cur - 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-[#BD1D2D] font-black text-base leading-none transition-colors">-</button>
                                                        <input
                                                            type="number" min={2} max={20}
                                                            value={cur}
                                                            onChange={e => setCnt(parseInt(e.target.value) || 2)}
                                                            className="flex-1 text-center text-[11px] font-black text-slate-700 bg-transparent outline-none"
                                                        />
                                                        <button onMouseDown={() => setCnt(cur + 1)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-[#BD1D2D] font-black text-base leading-none transition-colors">+</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Info hint */}
                                <div className="p-3 bg-[#BD1D2D]/5 border border-[#BD1D2D]/20 rounded-[14px] flex items-start gap-2">
                                    <LucideIcons.Info className="w-3.5 h-3.5 text-[#BD1D2D] shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-[#BD1D2D] font-medium leading-relaxed">Kéo thả để thay đổi độ rộng cột ngay trên canvas, hoặc click ô để sửa nội dung.</p>
                                </div>

                                <Accordion title="Cấu trúc & Màu sắc" icon={LucideIcons.Table2} defaultOpen>
                                    <div className="space-y-4">
                                        {/* Header row toggle */}
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <LucideIcons.TableProperties className="w-4 h-4 text-[#BD1D2D]" />
                                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Hàng Header</span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" className="sr-only peer" checked={getStyle('tableHeaderRow') !== false} onChange={e => updateStyle({ tableHeaderRow: e.target.checked } as any)} />
                                                <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-[#BD1D2D] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                            </label>
                                        </div>

                                        {getStyle('tableHeaderRow') !== false && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <ColorPicker solidOnly label="Màu nền Header" value={getStyle('tableHeaderBg') || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'tableHeaderBg' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                <ColorPicker solidOnly label="Màu chữ Header" value={getStyle('tableHeaderTextColor') || '#ffffff'} onChange={(v, t) => handleColorUpdate(v, t, 'tableHeaderTextColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                            </div>
                                        )}

                                        {/* Stripe mode */}
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kiểu màu hàng</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {([['alternate', 'Xen kế'], ['solid', 'Đồng nhất']] as const).map(([val, label]) => (
                                                    <button key={val} onClick={() => updateStyle({ tableStripe: val } as any)} className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition-all ${(getStyle('tableStripe') || 'alternate') === val ? 'bg-[#BD1D2D] text-white border-[#BD1D2D] shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>{label}</button>
                                                ))}
                                            </div>
                                        </div>

                                        {(getStyle('tableStripe') || 'alternate') === 'alternate' ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <ColorPicker solidOnly label="Nền hàng chẵn" value={getStyle('tableEvenBg') || '#f8fafc'} onChange={(v, t) => handleColorUpdate(v, t, 'tableEvenBg' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                    <ColorPicker solidOnly label="Nền hàng lẻ" value={getStyle('tableOddBg') || '#ffffff'} onChange={(v, t) => handleColorUpdate(v, t, 'tableOddBg' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <ColorPicker solidOnly label="Chữ hàng chẵn" value={getStyle('tableEvenTextColor') || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'tableEvenTextColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                    <ColorPicker solidOnly label="Chữ hàng lẻ" value={getStyle('tableOddTextColor') || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'tableOddTextColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                </div>
                                            </div>
                                        ) : (
                                            <ColorPicker solidOnly label="Màu nền hàng" value={getStyle('tableSolidBg') || '#ffffff'} onChange={(v, t) => handleColorUpdate(v, t, 'tableSolidBg' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        )}

                                        {/* Font size */}
                                        <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest shrink-0">Cỡ chữ</span>
                                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 flex-1">
                                                <input
                                                    type="number" min={8} max={48}
                                                    value={parseInt(getStyle('tableFontSize') as string) || 13}
                                                    onChange={e => updateStyle({ tableFontSize: `${e.target.value}px` } as any)}
                                                    className="w-full text-center text-[11px] font-black text-slate-700 bg-transparent outline-none"
                                                />
                                                <span className="text-[9px] text-slate-400">px</span>
                                            </div>
                                        </div>

                                        {/* Last row highlight */}
                                        <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Hàng cuối đặc biệt</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" checked={!!(getStyle('tableLastRowBg') as any)} onChange={e => updateStyle({ tableLastRowBg: e.target.checked ? '#fef9c3' : '' } as any)} />
                                                    <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-[#BD1D2D] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                                                </label>
                                            </div>
                                            {(getStyle('tableLastRowBg') as any) && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <ColorPicker solidOnly label="Nền" value={(getStyle('tableLastRowBg') as any) || '#fef9c3'} onChange={(v, t) => handleColorUpdate(v, t, 'tableLastRowBg' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                    <ColorPicker solidOnly label="Chữ" value={(getStyle('tableLastRowTextColor') as any) || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'tableLastRowTextColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Last col highlight */}
                                        <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Cột cuối đặc biệt</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" className="sr-only peer" checked={!!(getStyle('tableLastColBg') as any)} onChange={e => updateStyle({ tableLastColBg: e.target.checked ? '#eff6ff' : '' } as any)} />
                                                    <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:bg-[#BD1D2D] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                                                </label>
                                            </div>
                                            {(getStyle('tableLastColBg') as any) && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <ColorPicker solidOnly label="Nền" value={(getStyle('tableLastColBg') as any) || '#eff6ff'} onChange={(v, t) => handleColorUpdate(v, t, 'tableLastColBg' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                    <ColorPicker solidOnly label="Chữ" value={(getStyle('tableLastColTextColor') as any) || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'tableLastColTextColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Accordion>

                                <Accordion title="Đường viền & Padding" icon={LucideIcons.SquareDashed}>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <ColorPicker solidOnly label="Màu viền" value={getStyle('tableBorderColor') || '#e2e8f0'} onChange={(v, t) => handleColorUpdate(v, t, 'tableBorderColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Độ dày viền</label>
                                                <CustomSelect
                                                    value={getStyle('tableBorderWidth') || '1px'}
                                                    onChange={v => updateStyle({ tableBorderWidth: v } as any)}
                                                    options={['0px', '1px', '2px', '3px', '4px'].map(v => ({ value: v, label: v }))}
                                                />
                                            </div>
                                        </div>
                                        {/* Cell padding via SpacingControl - same style as rest of app, max 40px */}
                                        {(() => {
                                            const raw = (getStyle('tableCellPadding') || '8px 12px').toString();
                                            const parts = raw.trim().split(/\s+/);
                                            const pt = parts[0] || '8px';
                                            const pr = parts[1] || pt;
                                            const pb = parts[2] || pt;
                                            const pl = parts[3] || pr;
                                            return (
                                                <SpacingControl
                                                    label="Padding ô"
                                                    max={40}
                                                    values={{ top: pt, right: pr, bottom: pb, left: pl }}
                                                    onChange={(v) => updateStyle({ tableCellPadding: `${v.top} ${v.right} ${v.bottom} ${v.left}` } as any)}
                                                />
                                            );
                                        })()}
                                    </div>
                                </Accordion>

                                <Accordion title="Độ rộng &amp; Còn chỉnh cột" icon={LucideIcons.Columns}>
                                    <div className="space-y-2">
                                        {Array.from({ length: getStyle('tableCols') ?? 4 }, (_, ci) => {
                                            const widths: string[] = getStyle('tableColWidths') || [];
                                            const aligns: string[] = getStyle('tableColAligns') || Array(getStyle('tableCols') ?? 4).fill('left');
                                            const cellAlign = aligns[ci] || 'left';
                                            return (
                                                <div key={ci} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase w-7">C{ci + 1}</span>
                                                    <input
                                                        type="text"
                                                        value={widths[ci] || 'auto'}
                                                        onChange={e => {
                                                            const updated = [...(getStyle('tableColWidths') || Array(getStyle('tableCols') ?? 4).fill('auto'))];
                                                            updated[ci] = e.target.value;
                                                            updateStyle({ tableColWidths: updated } as any);
                                                        }}
                                                        className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-mono bg-white focus:border-[#BD1D2D] outline-none"
                                                        placeholder="auto"
                                                    />
                                                    <div className="flex gap-0.5 ml-auto">
                                                        {(['left', 'center', 'right'] as const).map(align => {
                                                            const Icon = align === 'left' ? LucideIcons.AlignLeft : align === 'center' ? LucideIcons.AlignCenter : LucideIcons.AlignRight;
                                                            const active = cellAlign === align;
                                                            return (
                                                                <button key={align} onClick={() => {
                                                                    const updated = [...(getStyle('tableColAligns') || Array(getStyle('tableCols') ?? 4).fill('left'))];
                                                                    updated[ci] = align;
                                                                    updateStyle({ tableColAligns: updated } as any);
                                                                }} className={`p-1 rounded-lg transition-all ${active ? 'bg-[#BD1D2D] text-white' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
                                                                    <Icon className="w-3 h-3" />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Accordion>
                            </div>
                        )}

                    </div>
                )}

                {activeTab === 'style' && (
                    <div className="space-y-6 animate-in fade-in">
                        {(isColumn || isRow || isButton || ['social', 'review', 'image', 'text', 'quote'].includes(selectedBlock.type)) && <AlignmentControl values={s} onChange={updateStyle} />}

                        {isRow && (
                            <div className="bg-slate-50 p-3 rounded-[14px] border border-slate-100 flex items-center justify-between mx-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                        <LucideIcons.LayoutPanelTop className="w-3.5 h-3.5 text-[#BD1D2D]" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest leading-none">Stack trên Mobile</p>
                                        <p className="text-[8px] text-slate-400 mt-1 uppercase font-medium">Tự động xếp chồng cột</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={getStyle('noStack') !== true}
                                        onChange={(e) => updateStyle({ noStack: !e.target.checked })}
                                    />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-[#BD1D2D] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                </label>
                            </div>
                        )}

                        <Accordion title="Kích thước & Khoảng cách" icon={LucideIcons.Maximize} defaultOpen>
                            {selectedBlock.type !== 'section' && <VisualMeasure label="Chiều rộng" value={getStyle('width')} onChange={(v) => updateStyle({ width: v })} max={600} canAuto />}
                            {selectedBlock.type === 'spacer' && <VisualMeasure label="Chiều cao" value={getStyle('height')} onChange={(v) => updateStyle({ height: v })} max={200} />}
                            <SpacingControl label="Padding" values={{ top: getStyle('paddingTop'), right: getStyle('paddingRight'), bottom: getStyle('paddingBottom'), left: getStyle('paddingLeft') }} onChange={(v: any) => updateStyle({ paddingTop: v.top, paddingRight: v.right, paddingBottom: v.bottom, paddingLeft: v.left })} />
                            <SpacingControl label="Margin" values={{ top: getStyle('marginTop'), right: getStyle('marginRight'), bottom: getStyle('marginBottom'), left: getStyle('marginLeft') }} onChange={(v: any) => updateStyle({ marginTop: v.top, marginRight: v.right, marginBottom: v.bottom, marginLeft: v.left })} allowAuto isMargin />
                            <RadiusControl label="Bo góc" values={{ borderRadius: getStyle('borderRadius') }} onChange={(v: any) => updateStyle({ borderRadius: v.borderRadius })} />
                        </Accordion>



                        {/* [UX] Secondary sections start collapsed — expand when needed */}
                        <Accordion title="Màu nền & Viền" icon={LucideIcons.Palette}>
                            <div className="space-y-4">
                                <ColorPicker label="Màu nền" value={getStyle('backgroundColor')} onChange={(v, t) => handleColorUpdate(v, t, 'backgroundColor')} blocks={blocks} bodyStyle={bodyStyle} />
                                {isButton && <ColorPicker label="Màu nền nút" value={getStyle('contentBackgroundColor')} onChange={(v, t) => handleColorUpdate(v, t, 'contentBackgroundColor')} blocks={blocks} bodyStyle={bodyStyle} />}
                                <BorderControl values={s} onChange={updateStyle} blocks={blocks} bodyStyle={bodyStyle} />
                            </div>
                        </Accordion>

                        {selectedBlock.type === 'social' && (
                            <Accordion title="Giao diện Icon" icon={LucideIcons.Share2}>
                                <div className="space-y-4">
                                    <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase">Kiểu</label><div className="flex bg-slate-100 p-1 rounded-xl">{['color', 'dark', 'light'].map(m => (<button key={m} onClick={() => updateStyle({ iconMode: m as any })} className={`flex-1 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${getStyle('iconMode') === m ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}>{m}</button>))}</div></div>
                                    <VisualMeasure label="Cỡ Icon" value={getStyle('iconSize')} defaultValue={32} onChange={(v) => updateStyle({ iconSize: v })} max={64} unit="px" />
                                    <VisualMeasure label="Khoảng cách" value={getStyle('gap')} defaultValue={10} onChange={(v) => updateStyle({ gap: v })} max={50} unit="px" />
                                    <div className="grid grid-cols-2 gap-3"><ColorPicker label="Màu Icon" value={getStyle('iconColor')} onChange={(v, t) => handleColorUpdate(v, t, 'iconColor')} blocks={blocks} bodyStyle={bodyStyle} /><ColorPicker label="Màu Nền" value={getStyle('iconBackgroundColor')} onChange={(v, t) => handleColorUpdate(v, t, 'iconBackgroundColor')} blocks={blocks} bodyStyle={bodyStyle} /></div>
                                </div>
                            </Accordion>
                        )}

                        {selectedBlock.type === 'check_list' && (
                            <>
                                <Accordion title="Typography & Màu sắc" icon={LucideIcons.Type} defaultOpen>
                                    <div className="space-y-4">
                                        <div className="space-y-3">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tiêu đề List</p>
                                            <CustomSelect
                                                label="Font tiêu đề"
                                                value={(getStyle('checkTitleFont' as any) as string) || 'Arial, sans-serif'}
                                                onChange={(v) => updateStyle({ checkTitleFont: v } as any)}
                                                options={BODY_FONT_OPTIONS}
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <VisualMeasure label="Cỡ tiêu đề" value={getStyle('checkTitleSize' as any)} defaultValue={18} onChange={(v) => updateStyle({ checkTitleSize: v } as any)} max={60} unit="px" />
                                                <VisualMeasure label="Cỡ mục" value={getStyle('checkItemSize' as any)} defaultValue={14} onChange={(v) => updateStyle({ checkItemSize: v } as any)} max={48} unit="px" />
                                            </div>
                                            <ColorPicker label="Màu tiêu đề" value={(getStyle('checkTitleColor' as any) as string) || '#1e293b'} onChange={(v, t) => handleColorUpdate(v, t, 'checkTitleColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                            <ColorPicker label="Màu chữ mục" value={getStyle('color') || '#334155'} onChange={(v, t) => handleColorUpdate(v, t, 'color')} blocks={blocks} bodyStyle={bodyStyle} />
                                            <ColorPicker label="Màu mô tả mục" value={(getStyle('checkDescColor' as any) as string) || '#64748b'} onChange={(v, t) => handleColorUpdate(v, t, 'checkDescColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        </div>
                                    </div>
                                </Accordion>
                            </>
                        )}

                        {selectedBlock.type === 'timeline' && (
                            <Accordion title="Giao diện Timeline" icon={LucideIcons.ListStart}>
                                <div className="space-y-4">
                                    <ColorPicker label="Màu Chấm (Dot)" value={getStyle('timelineDotColor') || '#BD1D2D'} onChange={(v, t) => handleColorUpdate(v, t, 'timelineDotColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                    <ColorPicker label="Màu Đường (Line)" value={getStyle('timelineLineColor') || '#e2e8f0'} onChange={(v, t) => handleColorUpdate(v, t, 'timelineLineColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kiểu đường</label>
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            {['solid', 'dashed', 'dotted'].map(s => (
                                                <button key={s} onClick={() => updateStyle({ timelineLineStyle: s as any })} className={`flex-1 py-1 text-[9px] font-bold uppercase rounded-lg transition-all ${getStyle('timelineLineStyle') === s ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}>{s}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Accordion>
                        )}

                        {selectedBlock.type === 'video' && (
                            <Accordion title="Giao diện Video" icon={LucideIcons.PlayCircle}>
                                <div className="space-y-4">
                                    <ColorPicker label="Màu nút Play" value={getStyle('playButtonColor') || '#BD1D2D'} onChange={(v, t) => handleColorUpdate(v, t, 'playButtonColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                </div>
                            </Accordion>
                        )}

                        {selectedBlock.type === 'countdown' && (
                            <Accordion title="Giao diện Countdown" icon={LucideIcons.Clock}>
                                <div className="space-y-4">
                                    <ColorPicker label="Màu chữ số" solidOnly value={(getStyle('digitColor' as any) as string) || getStyle('color') || '#ffffff'} onChange={(v) => updateStyle({ digitColor: v, color: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                    <ColorPicker label="Màu nền hộp số" solidOnly value={getStyle('contentBackgroundColor') || getStyle('backgroundColor') || '#1e293b'} onChange={(v) => updateStyle({ contentBackgroundColor: v })} blocks={blocks} bodyStyle={bodyStyle} />
                                    <ColorPicker label="Màu nhãn (Ngày, Giờ...)" solidOnly value={getStyle('labelColor') || '#004a7c'} onChange={(v, t) => handleColorUpdate(v, t, 'labelColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                </div>
                            </Accordion>
                        )}

                        {selectedBlock.type === 'survey_card' && (
                            <Accordion title="Giao diện Thẻ Khảo sát" icon={LucideIcons.ClipboardList} defaultOpen>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <ColorPicker solidOnly label="Màu nhấn & Nút" value={(getStyle('surveyAccentColor' as any) as string) || '#BD1D2D'} onChange={(v) => updateStyle({ surveyAccentColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        <ColorPicker solidOnly label="Màu chữ Nút" value={(getStyle('surveyButtonTextColor' as any) as string) || '#FFFFFF'} onChange={(v) => updateStyle({ surveyButtonTextColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <ColorPicker solidOnly label="Màu nền Thẻ" value={(getStyle('surveyCardBgColor' as any) as string) || '#F8FAFC'} onChange={(v) => updateStyle({ surveyCardBgColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                        <ColorPicker solidOnly label="Màu viền Thẻ" value={(getStyle('surveyBorderColor' as any) as string) || '#BFDBFE'} onChange={(v) => updateStyle({ surveyBorderColor: v } as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                    </div>
                                    <VisualMeasure label="Bo góc Thẻ (Radius)" value={getStyle('borderRadius')} defaultValue={14} onChange={(v) => updateStyle({ borderRadius: v })} max={40} unit="px" />
                                    <AlignmentControl values={{ textAlign: getStyle('textAlign') || 'center', verticalAlign: getStyle('verticalAlign') || 'middle' }} onChange={(a) => updateStyle(a as any)} />
                                </div>
                            </Accordion>
                        )}

                        {selectedBlock.type === 'header' && (
                            <div className="space-y-4">
                                <Accordion title="Header Styles" icon={LucideIcons.Layout} defaultOpen>
                                    <div className="space-y-4">
                                        <VisualMeasure label="Menu Gap" value={getStyle('menuGap')} defaultValue={20} onChange={(v) => updateStyle({ menuGap: v })} max={50} unit="px" />

                                        <div className="pt-3 border-t border-slate-100 space-y-4">
                                            {(getStyle('headerMenuType') || 'link') === 'button' ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <ColorPicker label="Button Bg" solidOnly value={getStyle('buttonBg') || '#BD1D2D'} onChange={(v) => updateStyle({ buttonBg: v })} blocks={blocks} bodyStyle={bodyStyle} />
                                                    <ColorPicker label="Button Text" solidOnly value={getStyle('buttonColor') || '#ffffff'} onChange={(v) => updateStyle({ buttonColor: v })} blocks={blocks} bodyStyle={bodyStyle} />
                                                </div>
                                            ) : (
                                                <ColorPicker label="Link Color" solidOnly value={getStyle('color') || '#475569'} onChange={(v, t) => handleColorUpdate(v, t, 'color')} blocks={blocks} bodyStyle={bodyStyle} />
                                            )}
                                        </div>
                                    </div>
                                </Accordion>

                                <Accordion title="Kích thước & Khoảng cách" icon={LucideIcons.Maximize}>
                                    <ColorPicker label="Background Color" value={getStyle('backgroundColor')} onChange={(v, t) => handleColorUpdate(v, t, 'backgroundColor')} blocks={blocks} bodyStyle={bodyStyle} />
                                    <SpacingControl label="Padding" values={{ top: getStyle('paddingTop'), right: getStyle('paddingRight'), bottom: getStyle('paddingBottom'), left: getStyle('paddingLeft') }} onChange={(v: any) => updateStyle({ paddingTop: v.top, paddingRight: v.right, paddingBottom: v.bottom, paddingLeft: v.left })} />
                                    <RadiusControl label="Border Radius" values={{ borderRadius: getStyle('borderRadius') }} onChange={(v: any) => updateStyle({ borderRadius: v.borderRadius })} />
                                </Accordion>
                            </div>
                        )}

                        {selectedBlock.type === 'divider' && (
                            <Accordion title="Kẻ ngang" icon={LucideIcons.Minus} defaultOpen>
                                <div className="space-y-4">
                                    <VisualMeasure label="Độ dày" value={getStyle('borderTopWidth')} defaultValue={1} onChange={(v) => updateStyle({ borderTopWidth: v })} max={10} unit="px" />
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kiểu đường</label>
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            {(['solid', 'dashed', 'dotted'] as const).map(style => (
                                                <button key={style} onClick={() => updateStyle({ borderStyle: style })} className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all ${getStyle('borderStyle') === style || (!getStyle('borderStyle') && style === 'solid') ? 'bg-white shadow text-[#BD1D2D]' : 'text-slate-400 hover:text-slate-600'}`}>{style}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <ColorPicker label="Màu đường kẻ" value={getStyle('borderColor') || '#eeeeee'} onChange={(v, t) => handleColorUpdate(v, t, 'borderColor' as any)} blocks={blocks} bodyStyle={bodyStyle} />
                                </div>
                            </Accordion>
                        )}



                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(EmailProperties);

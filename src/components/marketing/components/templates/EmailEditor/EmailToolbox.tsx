
// components/templates/EmailEditor/EmailToolbox.tsx
import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react'; // Import all Lucide icons
import { type LucideIcon } from 'lucide-react'; // Import specific type
import { EmailBlock } from '../../../types';
import ToolboxSavedItem from './components/ToolboxSavedItem'; // Import new component
import { TOOLBOX_ITEMS } from './constants/toolboxItems';
import { TEMPLATE_PRESETS } from './constants/templatePresets';

interface EmailToolboxProps {
    blocks: EmailBlock[];
    onDragStart: (e: React.DragEvent, type: string, layout?: string) => void;
    onSelectBlock: (id: string) => void;
    onLoadTemplate?: (blocks: EmailBlock[]) => void;
    selectedBlockId: string | null;
    savedSections?: { id: string, name: string, data: EmailBlock }[];
    onDeleteSavedSection?: (id: string) => void;
}

// Dynamic Icon mapping
const IconMap: Record<string, any> = LucideIcons;

const EmailToolbox: React.FC<EmailToolboxProps> = ({ blocks, onDragStart, onSelectBlock, selectedBlockId, savedSections = [], onLoadTemplate, onDeleteSavedSection }) => {
    const [activeTab, setActiveTab] = useState<'blocks' | 'layers' | 'saved' | 'templates'>('blocks');
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    const toggleCollapse = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSet = new Set(collapsedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setCollapsedIds(newSet);
    };

    const LayoutVisual = ({ layout }: { layout: string }) => {
        let widths: string[] = [];
        if (layout === '1') widths = ['100%'];
        else if (layout === '2') widths = ['50%', '50%'];
        else if (layout === '3') widths = ['33%', '34%', '33%'];
        else if (layout === '4') widths = ['25%', '25%', '25%', '25%'];
        else if (layout === '1-2') widths = ['33%', '67%'];
        else if (layout === '2-1') widths = ['67%', '33%'];

        return (
            <div className="flex w-10 h-8 gap-0.5 rounded-sm overflow-hidden bg-slate-100 border border-slate-200">
                {widths.map((w, i) => (
                    <div key={i} style={{ width: w }} className="h-full bg-slate-300 first:bg-slate-400"></div>
                ))}
            </div>
        );
    };

    const ToolItem = ({ type, label, icon: IconName, layout, badge }: any) => {
        const Icon = IconMap[IconName as string] || IconMap.Layers; // Default to Layers if icon not found
        return (
            <div
                draggable
                onDragStart={(e) => {
                    (window as any).__mktDraggingToolboxType = type;
                    onDragStart(e, type, layout);
                }}
                onDragEnd={() => {
                    (window as any).__mktDraggingToolboxType = '';
                }}
                className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col gap-2.5 cursor-grab active:cursor-grabbing hover:border-[var(--color-primary)]/40 hover:shadow-xs transition-all group h-[100px] justify-center items-center text-center shadow-[0_4px_10px_rgba(0,0,0,0.03)] active:scale-95 duration-300 relative overflow-hidden"
            >
                {badge && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[8px] font-black uppercase tracking-wider shadow-xs">
                        {badge}
                    </span>
                )}
                <div className="p-3 bg-slate-50 rounded-[14px] group-hover:bg-[var(--color-primary)]/10 group-hover:text-[var(--color-primary)] transition-all duration-300 text-slate-400 group-hover:scale-110">
                    {type === 'layout' ? <LayoutVisual layout={layout} /> : <Icon className="w-5 h-5 transition-all" />}
                </div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none group-hover:text-slate-900 transition-colors">{label}</span>
            </div>
        );
    };

    const filteredTools = TOOLBOX_ITEMS.filter(t => t.label.toLowerCase().includes(searchTerm.toLowerCase()));

    const renderTreeItem = (block: EmailBlock, depth: number = 0) => {
        const isSelected = selectedBlockId === block.id;
        const hasChildren = block.children && block.children.length > 0;
        const isCollapsed = collapsedIds.has(block.id);

        const getIcon = (type: string): LucideIcon => {
            switch (type) {
                case 'section': return IconMap.Maximize as LucideIcon;
                case 'row': return IconMap.GripHorizontal as LucideIcon;
                case 'column': return IconMap.Box as LucideIcon;
                case 'text': return IconMap.Type as LucideIcon;
                case 'image': return IconMap.Image as LucideIcon;
                case 'button': return IconMap.MousePointer2 as LucideIcon;
                case 'social': return IconMap.Share2 as LucideIcon;
                case 'video': return IconMap.Video as LucideIcon;
                case 'quote': return IconMap.Quote as LucideIcon;
                case 'timeline': return IconMap.List as LucideIcon;
                case 'review': return IconMap.Star as LucideIcon;
                case 'countdown': return IconMap.Clock as LucideIcon;
                case 'order_list': return IconMap.ShoppingBag as LucideIcon;
                case 'check_list': return IconMap.CheckCircle as LucideIcon;
                case 'voucher': return IconMap.Ticket as LucideIcon;
                case 'otp': return IconMap.KeyRound as LucideIcon;
                case 'survey_card': return IconMap.ClipboardList as LucideIcon;
                default: return IconMap.Layers as LucideIcon;
            }
        };

        const Icon = getIcon(block.type);

        return (
            <div key={block.id} className="space-y-1 select-none">
                <button
                    onClick={() => onSelectBlock(block.id)}
                    className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-lg transition-all text-left group/item border ${isSelected ? 'bg-slate-100 border-slate-300 text-slate-800' : 'border-transparent hover:bg-slate-50 text-slate-600'}`}
                    style={{ paddingLeft: `${depth * 10 + 8}px` }}
                >
                    {hasChildren ? (
                        <div onClick={(e) => toggleCollapse(e, block.id)} className="p-0.5 hover:bg-black/5 rounded transition-colors cursor-pointer">
                            <IconMap.ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        </div>
                    ) : <div className="w-4" />}
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--color-primary)]' : 'text-slate-400 group-hover/item:text-slate-600'}`} />
                    <span className="text-[10px] font-bold uppercase truncate tracking-tight">{block.type.replace('_', ' ')}</span>
                </button>
                {hasChildren && !isCollapsed && (
                    <div className="space-y-1 relative before:absolute before:left-[14px] before:top-0 before:bottom-0 before:w-px before:bg-slate-100 ml-2">
                        {block.children?.map(child => renderTreeItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-[320px] shrink-0 bg-white border-r border-slate-200 flex flex-col z-40 h-full shadow-xl">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex gap-1 bg-slate-200/50 p-1 rounded-xl mb-3">
                    <button onClick={() => setActiveTab('blocks')} className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition-all ${activeTab === 'blocks' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}>
                        <LucideIcons.Blocks className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-wider truncate">Blocks</span>
                    </button>
                    <button onClick={() => setActiveTab('templates')} className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition-all ${activeTab === 'templates' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}>
                        <LucideIcons.Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-wider truncate">Mẫu</span>
                    </button>
                    <button onClick={() => setActiveTab('saved')} className={`flex-1 py-2 px-1 rounded-lg flex items-center justify-center gap-1 transition-all ${activeTab === 'saved' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}>
                        <LucideIcons.Bookmark className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[9px] font-bold uppercase tracking-wider truncate">SAVE</span>
                    </button>
                    <button onClick={() => setActiveTab('layers')} title="Cấu trúc" className={`w-10 shrink-0 py-2 px-0 rounded-lg flex items-center justify-center transition-all ${activeTab === 'layers' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}>
                        <LucideIcons.Layers className="w-4 h-4" />
                    </button>
                </div>
                {activeTab === 'blocks' && (
                    <div className="relative group">
                        <IconMap.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm block..."
                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold outline-none focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 transition-all placeholder:text-slate-300"
                        />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"><IconMap.X className="w-3 h-3" /></button>}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar-thin bg-[#fcfcfc]">
                {activeTab === 'blocks' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="space-y-6 pt-2">
                            {['layout', 'content', 'basic'].map(cat => {
                                const catTools = filteredTools.filter(t => t.cat === cat);
                                if (catTools.length === 0) return null;
                                return (
                                    <div key={cat}>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 border-b border-slate-100 pb-1 w-fit">
                                            {cat === 'layout' ? 'Bố cục' : (cat === 'content' ? 'Nội dung' : 'Cơ bản')}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {catTools.map(tool => (
                                                <ToolItem key={tool.id} type={tool.type || tool.id} layout={tool.layout} label={tool.label} icon={tool.icon} badge={(tool as any).badge} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredTools.filter(t => ['layout', 'content', 'basic'].includes(t.cat)).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 px-4 opacity-70">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 border-2 border-white shadow-sm">
                                        <IconMap.SearchX className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 tracking-tight">Không tìm thấy Block</p>
                                    <p className="text-[10px] text-slate-400 mt-1 text-center font-medium">Vui lòng thử từ khóa khác</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'templates' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300 pt-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Mẫu kéo thả nhanh</p>
                        <div className="grid grid-cols-2 gap-2.5">
                            {TOOLBOX_ITEMS.filter(t => t.cat === 'template_tab').map(tool => (
                                <ToolItem key={tool.id} type={tool.type || tool.id} layout={tool.layout} label={tool.label} icon={tool.icon} badge={(tool as any).badge} />
                            ))}
                        </div>
                        {TOOLBOX_ITEMS.filter(t => t.cat === 'template_tab').length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 px-4 opacity-70">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3 border-2 border-white shadow-sm">
                                    <IconMap.LayoutTemplate className="w-8 h-8 text-[var(--color-primary)]/50" />
                                </div>
                                <p className="text-xs font-bold text-slate-500 tracking-tight">Chưa có mẫu nhanh</p>
                                <p className="text-[10px] text-slate-400 mt-1 text-center font-medium">Các mẫu đang được cập nhật</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'saved' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Mẫu đã lưu</p>
                        {savedSections.length > 0 ? (
                            savedSections.map(item => <ToolboxSavedItem key={item.id} item={item} onDragStart={onDragStart} onDelete={onDeleteSavedSection} />)
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 px-4 opacity-70">
                                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-3 border-2 border-white shadow-sm">
                                    <IconMap.BookmarkPlus className="w-8 h-8 text-[var(--color-primary)]/50" />
                                </div>
                                <p className="text-[11px] font-bold text-slate-500 tracking-tight">Chưa có mẫu lưu</p>
                                <p className="text-[9px] text-slate-400 mt-1 text-center font-medium leading-relaxed">Chọn một phần trong email và nhấn <b className="text-slate-500">Lưu</b> để tái sử dụng sau này</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'layers' && (
                    <div className="animate-in fade-in slide-in-from-left-2 duration-300 pb-10">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cấu trúc Email</span>
                        </div>
                        {blocks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 opacity-70">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 border-2 border-white shadow-sm">
                                    <IconMap.Layers className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="text-xs font-bold text-slate-500 tracking-tight">Bản nháp trống</p>
                                <p className="text-[10px] text-slate-400 mt-1 text-center font-medium leading-relaxed">Hãy kéo thả một Block vào màn hình để bắt đầu thiết kế</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {blocks.map(b => renderTreeItem(b))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <p className="text-[9px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
                    <IconMap.Settings className="w-3 h-3" /> Kéo thả để thêm Block
                </p>
            </div>
        </div>
    );
};

export default EmailToolbox;
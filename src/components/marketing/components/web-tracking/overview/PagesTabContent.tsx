import * as React from 'react';
import { useState } from 'react';
import { FileText, MousePointer2, Globe, ChevronDown, Info, Activity, BookOpen, TrendingUp, Table } from 'lucide-react';
import Modal from '../../common/Modal';
import SearchBox from '../../common/SearchBox';
import { WebStats } from '../types';
import PageDetailsModal from '../PageDetailsModal';

interface PagesTabContentProps {
    stats: WebStats | null;
    formatDuration: (seconds: number) => string;
    shortenUrl: (url: string) => string;
    renderEventIcon: (type: string) => React.ReactNode;
    propertyId: string;
    startDate: string;
    endDate: string;
    reportDevice?: string;
}

const PagesTabContent: React.FC<PagesTabContentProps> = ({
    stats,
    formatDuration,
    shortenUrl,
    renderEventIcon,
    propertyId,
    startDate,
    endDate,
    reportDevice
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [selectedPage, setSelectedPage] = useState<{ url: string; urlHash?: string; title: string } | null>(null);
    const [isBounceInfoOpen, setIsBounceInfoOpen] = useState(false);

    const filteredPages = (stats?.topPages || []).filter(page =>
        (page.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const displayedPages = showAll ? filteredPages : filteredPages.slice(0, 10);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Top Pages - 8 cols */}
                <div className="lg:col-span-8 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 tracking-tight">Trang Phổ Biến</h3>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Nội dung thu hút người dùng</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-1 md:max-w-xs">
                            <SearchBox
                                value={searchQuery}
                                onChange={setSearchQuery}
                                placeholder="Tìm kiếm trang..."
                                className="w-full"
                            />
                        </div>

                        <div className="hidden sm:flex items-center gap-6 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                            <div className="flex items-center gap-1.5 w-14 justify-end group cursor-pointer" onClick={() => setIsBounceInfoOpen(true)}>
                                <span className="whitespace-nowrap group-hover:text-rose-500 transition-colors">Tỷ lệ thoát</span>
                                <Info className="w-3 h-3 text-slate-300 group-hover:text-rose-500 transition-colors" />
                            </div>
                            <span className="w-14 text-right">Thời gian</span>
                            <span className="w-14 text-right">Lượt xem</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {displayedPages?.map((page, idx) => {
                            const scrollPercent = Math.round(Number(page.avgScroll || 0));
                            const loadTimeMs = page.avgLoadTime || 0;
                            const isSlow = loadTimeMs > 2500;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedPage({ url: page.url, urlHash: page.urlHash, title: page.title || page.url })}
                                    className="group relative bg-white hover:bg-slate-50/80 p-3 rounded-xl transition-all duration-300 border border-slate-100/50 hover:border-blue-200 hover:shadow-sm cursor-pointer"
                                >
                                    <div className="relative flex items-center justify-between gap-4">
                                        <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                            <span className="text-[10px] font-bold text-slate-300 group-hover:text-blue-500 transition-colors pt-0.5 w-4">{idx + 1}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-semibold text-slate-700 truncate group-hover:text-blue-700 transition-colors mb-1" title={page.title || page.url}>
                                                    {page.title || page.url}
                                                </p>
                                                <p className="text-[10px] text-slate-400 truncate mb-2.5 font-medium" title={page.url}>
                                                    {shortenUrl(page.url)}
                                                </p>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold uppercase tracking-widest shrink-0">
                                                        <MousePointer2 className="w-2.5 h-2.5 text-slate-300" />
                                                        Cuộn {scrollPercent}%
                                                    </div>
                                                    <div className="flex-1 max-w-[200px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${scrollPercent >= 50 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                                                                scrollPercent >= 25 ? 'bg-[var(--color-primary)] shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                                                                    'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                                                                }`}
                                                            style={{ width: `${scrollPercent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 shrink-0">
                                            <div className="w-14 text-right">
                                                {(() => {
                                                    const br = page.bounceRate || 0;
                                                    const colorClass = 'text-slate-800';
                                                    return <span className={`text-[11px] font-black ${colorClass}`}>{Math.round(br)}%</span>
                                                })()}
                                            </div>
                                            <div className="w-14 text-right">
                                                <span className="text-[11px] font-bold text-slate-600">
                                                    {formatDuration(Math.round(page.avgTime || 0))}
                                                </span>
                                            </div>
                                            <div className="w-14 text-right">
                                                <span className="text-[13px] font-bold text-slate-700">{page.count.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {(!displayedPages || displayedPages.length === 0) && (
                            <div className="py-20 text-center text-slate-400 text-sm italic font-medium bg-white rounded-[14px] border border-slate-100">Không tìm thấy trang nào</div>
                        )}
                    </div>

                    {/* Show More Button */}
                    {filteredPages.length > 10 && (
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 rounded-[14px] transition-all flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 group"
                        >
                            <span>{showAll ? 'Thu gọn' : `Xem thêm ${filteredPages.length - 10} trang`}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>

                {/* Interactions - 4 cols */}
                <div className="lg:col-span-4 space-y-2">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500 text-white shadow-lg shadow-blue-500/20">
                            <MousePointer2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 tracking-tight">Tương Tác</h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Hành vi người dùng</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {stats?.topEvents.slice(0, 10).map((event, idx) => {
                            const isUnknown = !event.target || event.target === 'N/A' || event.target === 'Unknown';
                            return (
                                <div key={idx} className="group flex items-center justify-between p-2.5 bg-white hover:bg-slate-50/80 rounded-lg transition-all border border-slate-100/50 hover:border-slate-200">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-all shrink-0 ${event.type === 'click' ? 'bg-blue-50 text-blue-600' :
                                            event.type === 'form' ? 'bg-emerald-50 text-emerald-600' :
                                                event.type === 'select' ? 'bg-blue-50 text-blue-600' :
                                                    'bg-slate-50 text-slate-400'
                                            }`}>
                                            {renderEventIcon(event.type)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-[11px] font-semibold truncate mb-0.5 ${isUnknown ? 'text-slate-300 italic' : 'text-slate-600 group-hover:text-slate-900'}`} title={event.target}>
                                                {isUnknown ? 'Không rõ' : event.target}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${event.type === 'click' ? 'text-blue-500 group-hover:text-blue-600' :
                                                    event.type === 'form' ? 'text-emerald-500 group-hover:text-emerald-600' :
                                                        'text-slate-400 group-hover:text-slate-600'
                                                    }`}>
                                                    {event.type.replace('_', ' ')}
                                                </span>
                                                {event.url && (
                                                    <>
                                                        <span className="text-slate-300">·</span>
                                                        <span className="text-[8px] text-slate-400 truncate max-w-[150px]" title={event.url}>
                                                            {shortenUrl(event.url)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <span className={`text-[11px] font-bold transition-all ${event.type === 'click' ? 'text-slate-600 group-hover:text-blue-600' :
                                            event.type === 'form' ? 'text-slate-600 group-hover:text-emerald-600' :
                                                'text-slate-600 group-hover:text-slate-900'
                                            }`}>
                                            {event.count}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                        {(!stats?.topEvents || stats.topEvents.length === 0) && (
                            <div className="py-20 text-center text-slate-400 text-sm italic font-medium bg-white rounded-xl border border-slate-100">Chưa có dữ liệu</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Page Details Modal */}
            {selectedPage && (
                <PageDetailsModal
                    isOpen={!!selectedPage}
                    onClose={() => setSelectedPage(null)}
                    propertyId={propertyId}
                    pageUrl={selectedPage.url}
                    urlHash={selectedPage.urlHash}
                    pageTitle={selectedPage.title}
                    startDate={startDate}
                    endDate={endDate}
                    formatDuration={formatDuration}
                    renderEventIcon={renderEventIcon}
                    initialDevice={reportDevice as any}
                />
            )}
            {/* Bounce Rate Info Modal */}
            <Modal
                isOpen={isBounceInfoOpen}
                onClose={() => setIsBounceInfoOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                            <Activity className="w-5 h-5" />
                        </div>
                        <span className="text-xl font-black text-slate-800 tracking-tight">Về Tỷ lệ thoát (Bounce Rate)</span>
                    </div>
                }
                size="xl"
            >
                <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[18px] relative overflow-hidden group">
                        <h4 className="flex items-center gap-2 font-black text-lg mb-4 text-slate-800 relative">
                            <div className="p-2 bg-rose-600 text-white rounded-xl">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            Bounce Rate là gì?
                        </h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">
                            Bounce rate hay Tỷ lệ thoát là phần trăm số lượt truy cập trang web chỉ xem duy nhất một trang và rời đi ngay lập tức mà không có thêm tương tác nào khác (như nhấn vào link hoặc xem trang thứ hai). Nó đo lường mức độ tương tác và tính hấp dẫn của trang đích.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 bg-white border border-slate-100 rounded-[18px] shadow-sm">
                            <h5 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                                <div className="w-8 h-8 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                                Tỷ lệ bao nhiêu là tốt?
                            </h5>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                                Không có con số "chuẩn" cho mọi lĩnh vực. Tỷ lệ thoát phụ thuộc rất lớn vào loại trang web và mục đích của trang.
                            </p>
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-[14px] italic text-[11px] text-orange-800 font-bold">
                                "Ví dụ: Một trang blog trả lời đúng câu hỏi người dùng tìm kiếm có thể có tỷ lệ thoát 90%+ nhưng vẫn là trải nghiệm tốt."
                            </div>
                        </div>

                        <div className="p-8 bg-white border border-slate-100 rounded-[18px] shadow-sm">
                            <h5 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                    <Table className="w-4 h-4" />
                                </div>
                                Trung bình theo ngành
                            </h5>
                            <div className="space-y-3">
                                {[
                                    { label: 'Bán lẻ / TMĐT', range: '20% - 40%', color: 'text-teal-500' },
                                    { label: 'Dịch vụ', range: '10% - 30%', color: 'text-teal-500' },
                                    { label: 'Tạo Khách hàng tiềm năng', range: '30% - 50%', color: 'text-blue-500' },
                                    { label: 'Nội dung (Content site)', range: '40% - 60%', color: 'text-[var(--color-primary)]' },
                                    { label: 'Blog / Landing Page', range: '70% - 90%', color: 'text-rose-500' }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-[11px] font-bold py-2 border-b border-slate-50 last:border-0">
                                        <span className="text-slate-500">{item.label}</span>
                                        <span className={item.color}>{item.range}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-slate-900 rounded-[18px] text-white">
                        <h5 className="font-black text-sm mb-4 text-rose-400">Cách giảm tỷ lệ thoát:</h5>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-bold text-slate-300">
                            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 italic">
                                • Cải thiện tốc độ tải trang
                            </li>
                            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 italic">
                                • Tối ưu hiển thị trên di động
                            </li>
                            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 italic">
                                • Nội dung dễ đọc, chia nhỏ đoạn
                            </li>
                            <li className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 italic">
                                • Kêu gọi hành động (CTA) rõ ràng
                            </li>
                        </ul>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PagesTabContent;

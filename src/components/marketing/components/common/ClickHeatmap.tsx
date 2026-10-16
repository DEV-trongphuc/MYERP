import * as React from 'react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { MousePointer2, Info, Eye, Download, Smartphone, Monitor } from 'lucide-react';

interface ClickData {
    url: string;
    total_clicks: number;
    unique_clicks: number;
}

interface ClickHeatmapProps {
    html: string;
    clickData: ClickData[];
    deviceFilter?: 'desktop' | 'mobile' | 'all';
    onDeviceFilterChange?: (filter: 'desktop' | 'mobile' | 'all') => void;
    onDownload?: () => void;
}

const ClickHeatmap: React.FC<ClickHeatmapProps> = ({ html, clickData, deviceFilter = 'desktop', onDeviceFilterChange, onDownload }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [bubbles, setBubbles] = useState<any[]>([]);
    const [iframeHeight, setIframeHeight] = useState(600);
    const viewMode = deviceFilter === 'all' ? 'desktop' : deviceFilter; // Map 'all' to desktop layout by default

    // Normalize URL for matching (removes activity prefixes, protocol, www, and auto-injected tracking params)
    const normalizeUrl = (url: string, stripAllQuery = false) => {
        if (!url) return '';
        try {
            let clean = url.trim();
            // Strip activity log prefixes like "Clicked link (A) (+5 điểm): "
            clean = clean.replace(/^(?:Zalo\s+)?Click(?:ed)?\s+(?:link(?:\/button)?|button)(?:\s*\([^)]*\))*:\s*/i, '').trim();
            if (!/^https?:\/\//i.test(clean)) {
                const match = clean.match(/(https?:\/\/\S+)/i);
                if (match) clean = match[1];
            }

            // If it's a tracking URL with a 'url' or 'u' parameter, extract the real destination
            if (clean.includes('?url=') || clean.includes('&url=')) {
                const parts = clean.split(/[?&]url=/i);
                if (parts[1]) {
                    const rawParam = decodeURIComponent(parts[1].split('&')[0]);
                    try {
                        const decoded = atob(rawParam.replace(/ /g, '+'));
                        if (/^https?:\/\//i.test(decoded)) clean = decoded;
                        else clean = rawParam;
                    } catch {
                        clean = rawParam;
                    }
                }
            } else if (clean.includes('?u=') || clean.includes('&u=')) {
                const parts = clean.split(/[?&]u=/i);
                if (parts[1]) clean = decodeURIComponent(parts[1].split('&')[0]);
            }

            // Remove fragments
            clean = clean.split('#')[0];

            // Strip auto-injected tracking query parameters (utm_*, sid, uid, email, name, phone, mc_*)
            const qIndex = clean.indexOf('?');
            if (qIndex !== -1) {
                const basePart = clean.substring(0, qIndex);
                if (stripAllQuery) {
                    clean = basePart;
                } else {
                    const queryPart = clean.substring(qIndex + 1);
                    const params = new URLSearchParams(queryPart);
                    const trackingParams = [
                        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                        'sid', 'uid', 'email', 'name', 'phone', 'mc_cta', 'mc_cid', 'mc_eid'
                    ];
                    trackingParams.forEach(p => params.delete(p));
                    const remaining = params.toString();
                    clean = remaining ? `${basePart}?${remaining}` : basePart;
                }
            }

            clean = clean.toLowerCase();
            // Remove protocol
            clean = clean.replace(/^https?:\/\//, '');
            // Remove www.
            clean = clean.replace(/^www\./, '');
            // Clean up trailing slashes before query params if they exist, or at the end
            clean = clean.replace(/\/\?/, '?').replace(/\/+$/, '');

            return clean;
        } catch (e) {
            return url.toLowerCase().trim().replace(/\/+$/, '');
        }
    };

    const calculateHeatmap = () => {
        if (!iframeRef.current || !iframeRef.current.contentDocument) return;

        const doc = iframeRef.current.contentDocument;
        const body = doc.body;
        const htmlElement = doc.documentElement;

        // Ensure we get links from the whole document
        const links = Array.from(doc.querySelectorAll('a'));
        const newBubbles: any[] = [];

        // Aggregate clicks by normalized URL
        const clickMap = new Map<string, { total: number; unique: number; originalUrls: string[] }>();
        const clickPathMap = new Map<string, { total: number; unique: number; originalUrls: string[] }>();
        clickData.forEach(item => {
            const norm = normalizeUrl(item.url, false);
            if (!norm) return;

            const existing = clickMap.get(norm) || { total: 0, unique: 0, originalUrls: [] };
            clickMap.set(norm, {
                total: existing.total + item.total_clicks,
                unique: existing.unique + item.unique_clicks,
                originalUrls: [...existing.originalUrls, item.url]
            });

            const normPath = normalizeUrl(item.url, true);
            if (normPath) {
                const existingPath = clickPathMap.get(normPath) || { total: 0, unique: 0, originalUrls: [] };
                clickPathMap.set(normPath, {
                    total: existingPath.total + item.total_clicks,
                    unique: existingPath.unique + item.unique_clicks,
                    originalUrls: [...existingPath.originalUrls, item.url]
                });
            }
        });

        const maxClicks = Math.max(...Array.from(clickMap.values()).map(v => v.total), 1);

        links.forEach((linkNode: any, idx) => {
            const link = linkNode as HTMLAnchorElement;
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

            const norm = normalizeUrl(href, false);
            const normPath = normalizeUrl(href, true);

            // 1. Try exact normalized match (with non-tracking query params preserved)
            let stats = clickMap.get(norm);

            // 2. Fallback to exact host + path match (ignoring query params)
            if (!stats && normPath) {
                stats = clickPathMap.get(normPath);
            }

            // 3. Last resort fuzzy match only if one URL contains the other and shares the same base path
            if (!stats) {
                for (const [clickNorm, clickStats] of clickMap.entries()) {
                    const clickBase = clickNorm.split('?')[0];
                    if (clickBase && clickBase === normPath) {
                        stats = clickStats;
                        break;
                    }
                }
            }

            if (stats && stats.total > 0) {
                const rect = link.getBoundingClientRect();
                const win = doc.defaultView;

                // Get absolute position relative to the document (not the viewport)
                const absoluteY = rect.top + (win?.pageYOffset || 0);
                const absoluteX = rect.left + (win?.pageXOffset || 0);

                if (rect.width > 0 && rect.height > 0) {
                    addBubble(link, absoluteX, absoluteY, rect.width, rect.height, stats, maxClicks, href, idx, newBubbles);
                } else {
                    // Check children (images)
                    const childImg = link.querySelector('img');
                    if (childImg) {
                        const imgRect = childImg.getBoundingClientRect();
                        if (imgRect.width > 0) {
                            const imgY = imgRect.top + (win?.pageYOffset || 0);
                            const imgX = imgRect.left + (win?.pageXOffset || 0);
                            addBubble(link, imgX, imgY, imgRect.width, imgRect.height, stats, maxClicks, href, idx, newBubbles);
                        }
                    }
                }
            }
        });

        setBubbles(newBubbles);

        const height = Math.max(
            body?.scrollHeight || 0,
            body?.offsetHeight || 0,
            htmlElement?.clientHeight || 0,
            htmlElement?.scrollHeight || 0,
            htmlElement?.offsetHeight || 0
        );
        setIframeHeight(height || 600);
    };

    const addBubble = (link: any, x: number, y: number, width: number, height: number, stats: any, maxClicks: number, href: string, idx: number, arr: any[]) => {
        const intensity = stats.total / maxClicks;
        arr.push({
            id: `bubble-${idx}`,
            x: x + width / 2,
            y: y + height / 2,
            total: stats.total,
            unique: stats.unique,
            intensity,
            url: href,
            width,
            height
        });
    };

    useEffect(() => {
        // Retry a few times as images might load late
        const t1 = setTimeout(calculateHeatmap, 500);
        const t2 = setTimeout(calculateHeatmap, 1500);
        const t3 = setTimeout(calculateHeatmap, 3000);

        window.addEventListener('resize', calculateHeatmap);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            window.removeEventListener('resize', calculateHeatmap);
        };
    }, [html, clickData, viewMode]);

    const getBubbleColor = (intensity: number) => {
        if (intensity > 0.8) return 'rgba(239, 68, 68, 0.85)'; // Rose-500
        if (intensity > 0.4) return 'rgba(245, 158, 11, 0.85)'; // amber-600
        return 'rgba(16, 185, 129, 0.85)'; // Emerald-500
    };

    const getBubbleSize = (intensity: number) => {
        const base = viewMode === 'mobile' ? 18 : 24;
        return base + (intensity * 20); // Scale based on device
    };

    return (
        <div className="relative border rounded-xl bg-slate-50 overflow-hidden select-none">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <MousePointer2 className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-tight text-slate-700">Link Click Heatmap</h3>
                        <p className="text-[10px] text-slate-400 font-bold">Visual distribution of engagement</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="flex bg-slate-100 p-0.5 rounded-lg mr-2">
                        <button
                            onClick={() => onDeviceFilterChange?.('all')}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${deviceFilter === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            ALL
                        </button>
                        <button
                            onClick={() => onDeviceFilterChange?.('desktop')}
                            className={`p-1.5 rounded-md transition-all ${deviceFilter === 'desktop' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Monitor className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => onDeviceFilterChange?.('mobile')}
                            className={`p-1.5 rounded-md transition-all ${deviceFilter === 'mobile' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {onDownload && (
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <Download className="w-3 h-3" />
                            Export
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex justify-center p-8 min-h-[400px]">
                <div
                    className="relative bg-white shadow-2xl transition-all duration-500 overflow-hidden"
                    style={{
                        width: viewMode === 'mobile' ? '375px' : '100%',
                        maxWidth: viewMode === 'mobile' ? '375px' : '800px',
                        height: 'fit-content'
                    }}
                >
                    <iframe
                        ref={iframeRef}
                        srcDoc={html}
                        title="Heatmap Preview"
                        className="w-full border-none pointer-events-none"
                        style={{ height: `${iframeHeight}px` }}
                        onLoad={calculateHeatmap}
                        sandbox="allow-same-origin"
                    />

                    {/* Heatmap Overlay Layer */}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                        {bubbles.map((b) => (
                            <div
                                key={b.id}
                                className="absolute rounded-full border-2 border-white shadow-lg pointer-events-auto cursor-help group flex items-center justify-center transition-all hover:scale-125"
                                style={{
                                    left: b.x,
                                    top: b.y,
                                    width: getBubbleSize(b.intensity),
                                    height: getBubbleSize(b.intensity),
                                    backgroundColor: getBubbleColor(b.intensity),
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                <span className="text-[10px] font-bold text-white drop-shadow-md">
                                    {b.total}
                                </span>

                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl border border-slate-700">
                                    <div className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mb-1 border-b border-white/10 pb-1">Link Stats</div>
                                    <div className="text-[10px] font-medium break-all mb-2 leading-tight opacity-80">{b.url}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <div className="text-[8px] text-slate-400 uppercase font-black tracking-tighter">Total Clicks</div>
                                            <div className="text-xs font-black">{b.total}</div>
                                        </div>
                                        <div>
                                            <div className="text-[8px] text-slate-400 uppercase font-black tracking-tighter">Unique</div>
                                            <div className="text-xs font-black">{b.unique}</div>
                                        </div>
                                    </div>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Low Impact</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-600"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Medium</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">High Intensity</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full">
                    <Info className="w-3 h-3 text-indigo-400" />
                    <span className="text-[9px] font-bold text-slate-400 italic">Click coordinate estimated by link target matching</span>
                </div>
            </div>
        </div>
    );
};

export default ClickHeatmap;

import { EXTERNAL_API_BASE } from '../../utils/config';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Zap, Code2, Copy, CheckCircle2, X } from 'lucide-react';
import { CustomEvent } from '../../types';
import Button from '../common/Button';

interface CustomEventDetailModalProps {
    event: CustomEvent | null;
    onClose: () => void;
}

const CustomEventDetailModal: React.FC<CustomEventDetailModalProps> = ({ event, onClose: _onClose }) => {
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { if (event) setTimeout(() => setAnimateIn(true), 10); }, [event]);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    if (!event) return null;

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const jsSnippet = `<!-- Thêm vào trang web của bạn -->
<script>
  window.mailflowTrack = window.mailflowTrack || [];
  window.mailflowTrack.push({
    event: 'custom',
    eventId: '${event.id}',
    email: 'user@example.com', // Email người dùng
    data: {
      action: 'video_watched',
      videoId: 'abc123',
      duration: 120, // giây
      completionRate: 0.75
    }
  });
</script>`;

    const curlSnippet = `curl -X POST ${EXTERNAL_API_BASE}/webhook.php \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "custom_event",
    "eventId": "${event.id}",
    "email": "user@example.com",
    "data": {
      "action": "video_watched",
      "videoId": "abc123",
      "duration": 120
    }
  }'`;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                            <Zap className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{event.name}</h2>
                            <p className="text-blue-100 text-sm mt-1">Sự kiện Tùy chỉnh</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Event Info */}
                    <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500 font-semibold">Event ID:</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <code className="bg-white px-3 py-1.5 rounded-lg text-xs font-mono text-slate-700 flex-1">
                                        {event.id}
                                    </code>
                                    <button
                                        onClick={() => handleCopy(event.id, 'id')}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 transition-colors"
                                    >
                                        {copiedKey === 'id' ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-slate-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <span className="text-slate-500 font-semibold">Ngày tạo:</span>
                                <p className="text-slate-700 mt-1">
                                    {event.createdAt ? new Date(event.createdAt).toLocaleDateString('vi-VN') : '—'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Integration Code */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Code2 className="w-5 h-5 text-blue-600" />
                            Mã tích hợp
                        </h3>

                        {/* JavaScript Snippet */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-slate-600">JavaScript (Website)</label>
                                <button
                                    onClick={() => handleCopy(jsSnippet, 'js')}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                                >
                                    {copiedKey === 'js' ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Đã copy!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>
                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed">
                                {jsSnippet}
                            </pre>
                        </div>

                        {/* cURL Snippet */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-slate-600">cURL (API)</label>
                                <button
                                    onClick={() => handleCopy(curlSnippet, 'curl')}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                                >
                                    {copiedKey === 'curl' ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Đã copy!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>
                            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono leading-relaxed">
                                {curlSnippet}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end">
                    <Button onClick={onClose} variant="secondary">
                        Đóng
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CustomEventDetailModal;

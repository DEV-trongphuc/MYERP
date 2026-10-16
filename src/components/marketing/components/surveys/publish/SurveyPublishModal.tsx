import React, { useState, useEffect } from 'react';
import { Survey } from '../../../types/survey';
import { Link, QrCode, Code, Globe, Send, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import Modal from '../../common/Modal';

interface Props {
    survey: Survey;
    onClose: () => void;
    onPublish: () => Promise<void>;
    isDarkTheme?: boolean;
}

const API = '/api/surveys.php';

const SurveyPublishModal: React.FC<Props> = ({ survey, onClose, onPublish, isDarkTheme }) => {
    const [activeTab, setActiveTab] = useState<'link' | 'qr' | 'embed' | 'api'>('link');
    const [qrData, setQrData] = useState<{ url: string; qr_image_url: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isLoadingQr, setIsLoadingQr] = useState(false);

    const surveyUrl = survey.slug ? `${window.location.origin}/s/${survey.slug}` : '';

    const copy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    useEffect(() => {
        if (activeTab === 'qr' && survey.id && !qrData) {
            setIsLoadingQr(true);
            fetch(`${API}?action=qr&id=${survey.id}`)
                .then(r => { if (!r.ok) throw new Error("Network error"); return r.json(); })
                .then(res => { if (res.success) setQrData(res.data); })
                .catch(err => console.error(err))
                .finally(() => setIsLoadingQr(false));
        }
    }, [activeTab, survey.id]);

    const embedCode = `<div id="domation-survey" data-survey="${survey.slug}" data-mode="inline"></div>
<script src="${window.location.origin}/widget/survey.js" async></script>`;

    const popupCode = `<button onclick="window.DomationSurvey.open('${survey.slug}')">Bắt đầu khảo sát</button>
<script src="${window.location.origin}/widget/survey.js" async></script>`;

    const apiCode = `// Lấy schema câu hỏi
GET ${window.location.origin}/api/survey_public.php?slug=${survey.slug}

// Nộp câu trả lời
POST ${window.location.origin}/api/survey_public.php?slug=${survey.slug}&action=submit
Content-Type: application/json

{
  "session_token": "unique-uuid-v4",
  "answers": [
    { "question_id": "q1", "type": "short_text", "answer_text": "Câu trả lời" },
    { "question_id": "q2", "type": "nps", "answer_num": 9 }
  ],
  "source_channel": "api",
  "time_spent_sec": 45
}`;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="lg"
            isDarkTheme={isDarkTheme}
            title={
                <div>
                    <h3 className={`text-lg font-black tracking-tight ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>Xuất bản & Chia sẻ</h3>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">{survey.name}</p>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Status Banner */}
                {survey.status !== 'active' && (
                    <div className={`p-4 border rounded-xl flex items-center justify-between gap-3 ${isDarkTheme ? 'bg-amber-950/20 border-amber-900/30' : 'bg-amber-50 border-amber-250'}`}>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-505 bg-amber-500 animate-pulse" />
                            <span className={`text-sm font-semibold ${isDarkTheme ? 'text-amber-400' : 'text-amber-700'}`}>Khảo sát ở trạng thái Nháp</span>
                        </div>
                        <button
                            onClick={async () => { setIsPublishing(true); await onPublish(); setIsPublishing(false); }}
                            disabled={isPublishing}
                            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all whitespace-nowrap active:scale-95"
                        >
                            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Xuất bản ngay
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div className={`flex gap-1 p-1 rounded-xl border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200/50'}`}>
                    {([['link', Link, 'Link'], ['qr', QrCode, 'QR Code'], ['embed', Code, 'Nhúng Website'], ['api', Globe, 'API']] as const).map(([tab, Icon, label]) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all
                                ${activeTab === tab 
                                    ? 'bg-amber-500 text-white shadow-sm' 
                                    : `${isDarkTheme ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className={`p-5 rounded-2xl border ${isDarkTheme ? 'bg-slate-900/40 border-slate-850' : 'bg-slate-50/50 border-slate-100'}`}>
                    {activeTab === 'link' && (
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Link khảo sát</label>
                            <div className="flex gap-2">
                                <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2.5 overflow-hidden ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                                    <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                    <span className={`text-sm truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{surveyUrl || 'Lưu khảo sát trước...'}</span>
                                </div>
                                <button
                                    onClick={() => surveyUrl && copy(surveyUrl, 'link')}
                                    disabled={!surveyUrl}
                                    className={`flex items-center justify-center w-11 h-11 rounded-xl border transition-all active:scale-95 ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-250' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                >
                                    {copied === 'link' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                                <a
                                    href={surveyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center w-11 h-11 bg-amber-500 hover:bg-amber-600 rounded-xl text-white transition-all active:scale-95"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                            <div className="grid grid-cols-3 gap-2.5 mt-3">
                                {[
                                    { label: 'Trực tiếp', desc: '?src=direct' },
                                    { label: 'Email Campaign', desc: '?src=email' },
                                    { label: 'QR Code', desc: '?src=qr' },
                                ].map(ch => (
                                    <div key={ch.label} className={`rounded-xl p-3 border ${isDarkTheme ? 'bg-slate-950/50 border-slate-850' : 'bg-white border-slate-200/50'}`}>
                                        <p className={`text-xs font-bold ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>{ch.label}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono break-all">{ch.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'qr' && (
                        <div className="flex flex-col items-center gap-4">
                            {isLoadingQr ? (
                                <div className="flex flex-col items-center gap-2 py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                                    <p className="text-sm text-slate-400 font-medium">Đang tạo QR Code...</p>
                                </div>
                            ) : qrData ? (
                                <>
                                    <div className={`p-4 rounded-2xl border ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                                        <img src={qrData.qr_image_url} alt="QR Code" className="w-48 h-48" />
                                    </div>
                                    <p className="text-xs text-slate-400 font-medium text-center">Quét QR để mở khảo sát trên thiết bị di động</p>
                                    <div className="flex gap-2">
                                        <a
                                            href={qrData.qr_image_url}
                                            download="survey-qr.png"
                                            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all"
                                        >
                                            Tải PNG
                                        </a>
                                        <button
                                            onClick={() => copy(qrData.url, 'qrurl')}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isDarkTheme ? 'bg-slate-900 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                                        >
                                            {copied === 'qrurl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            Copy Link
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-slate-400 py-8">Lưu khảo sát trước để tạo QR</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'embed' && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-400 font-medium">Nhúng trực tiếp vào bất kỳ trang web nào bằng đoạn mã JavaScript:</p>
                            <div className="relative">
                                <pre className={`rounded-xl p-4 text-xs overflow-x-auto font-mono ${isDarkTheme ? 'bg-slate-950 text-emerald-450 text-emerald-400 border border-slate-850' : 'bg-slate-900 text-emerald-400'}`}>{embedCode}</pre>
                                <button
                                    onClick={() => copy(embedCode, 'embed')}
                                    className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-750"
                                >
                                    {copied === 'embed' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">Hoặc dùng dạng popup khi click nút:</p>
                            <div className="relative">
                                <pre className={`rounded-xl p-4 text-xs overflow-x-auto font-mono ${isDarkTheme ? 'bg-slate-950 text-emerald-450 text-emerald-400 border border-slate-850' : 'bg-slate-900 text-emerald-400'}`}>{popupCode}</pre>
                                <button
                                    onClick={() => copy(popupCode, 'popup')}
                                    className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-750"
                                >
                                    {copied === 'popup' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-400 font-medium">Sử dụng Headless API để tích hợp vào app mobile, chatbot Zalo, hoặc kiosk:</p>
                            <div className="relative">
                                <pre className={`rounded-xl p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap ${isDarkTheme ? 'bg-slate-950 text-sky-400 border border-slate-850' : 'bg-slate-900 text-sky-400'}`}>{apiCode}</pre>
                                <button
                                    onClick={() => copy(apiCode, 'api')}
                                    className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-750"
                                >
                                    {copied === 'api' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default SurveyPublishModal;

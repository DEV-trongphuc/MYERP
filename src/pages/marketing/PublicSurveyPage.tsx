import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Survey, SurveyBlock, SurveyAnswer } from '../../components/marketing/types/survey';
import { ChevronRight, ChevronLeft, Send, Star, ChevronDown, ExternalLink, Check } from 'lucide-react';
import { API_BASE_URL } from '../../components/marketing/utils/config';
import Select from '../../components/marketing/components/common/Select';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import CanvasConfetti from '../../components/marketing/components/common/CanvasConfetti';

const PUBLIC_API = `${API_BASE_URL}/survey_public.php`;

const PublicSurvey: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [searchParams] = useSearchParams();
    const [survey, setSurvey] = useState<Survey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageHistory, setPageHistory] = useState<number[]>([]);
    const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [thankYouData, setThankYouData] = useState<any>(null);
    const [quizResult, setQuizResult] = useState<{ score: number; maxScore: number } | null>(null);
    const [voucherCode, setVoucherCode] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const startTime = useRef(Date.now());
    const sessionToken = useRef(crypto.randomUUID());

    const srcParam = searchParams.get('src') || searchParams.get('utm_source') || 'direct_link';
    const utmMedium = searchParams.get('utm_medium') || undefined;
    const utmCampaign = searchParams.get('utm_campaign') || undefined;
    const sid = searchParams.get('sid') || undefined;
    const emailParam = searchParams.get('email') || searchParams.get('uid') || undefined;
    const uid = emailParam;
    const nameParam = searchParams.get('name') || undefined;
    const phoneParam = searchParams.get('phone') || undefined;
    const isPreview = !!searchParams.get('preview');
    const nextUrl = searchParams.get('next');

    useEffect(() => {
        const query = new URLSearchParams();
        query.set('slug', slug || '');
        if (searchParams.get('preview')) query.set('preview', '1');
        if (sid) query.set('sid', sid);
        if (emailParam) query.set('email', emailParam);
        if (uid) query.set('uid', uid);
        if (nameParam) query.set('name', nameParam);
        if (phoneParam) query.set('phone', phoneParam);

        fetch(`${PUBLIC_API}?${query.toString()}`)
            .then(r => { if (!r.ok) throw new Error("Fetch survey failed"); return r.json(); })
            .then(res => {
                if (res.success) {
                    const d = res.data;
                    const themeObj = d.cover_style || {};
                    // Check initial expiration
                    if (themeObj.coverCountdown && new Date(themeObj.coverCountdown).getTime() <= Date.now()) {
                        setError('SURVEY_EXPIRED');
                        return; // do not set survey
                    }
                    setSurvey({
                        ...d,
                        theme: themeObj,
                        thankYouPage: d.thank_you_page || {},
                        thankYouPages: d.thank_you_page?.extraScreens || [],
                    });

                    // [AUTO-PREFILL SUBSCRIBER INFO]
                    const prefill = d.prefill || {};
                    const initialAnswers: Record<string, SurveyAnswer> = {};
                    const pEmail = prefill.email || emailParam || '';
                    const pPhone = prefill.phone_number || phoneParam || '';
                    const pName = prefill.full_name || prefill.first_name || nameParam || '';
                    const pCompany = prefill.company_name || '';

                    (d.blocks || []).forEach((b: SurveyBlock) => {
                        const bType = b.type;
                        const bLabel = (b.label || '').toLowerCase();

                        if (bType === 'email' && pEmail) {
                            initialAnswers[b.id] = { question_id: b.id, block_id: b.id, type: 'email', label: b.label || '', answer_text: pEmail };
                        } else if (bType === 'phone' && pPhone) {
                            initialAnswers[b.id] = { question_id: b.id, block_id: b.id, type: 'phone', label: b.label || '', answer_text: pPhone };
                        } else if (bType === 'short_text') {
                            if (pName && (bLabel.includes('tên') || bLabel.includes('name') || bLabel.includes('họ'))) {
                                initialAnswers[b.id] = { question_id: b.id, block_id: b.id, type: 'short_text', label: b.label || '', answer_text: pName };
                            } else if (pPhone && (bLabel.includes('điện thoại') || bLabel.includes('sđt') || bLabel.includes('phone'))) {
                                initialAnswers[b.id] = { question_id: b.id, block_id: b.id, type: 'short_text', label: b.label || '', answer_text: pPhone };
                            } else if (pCompany && (bLabel.includes('công ty') || bLabel.includes('company') || bLabel.includes('đơn vị'))) {
                                initialAnswers[b.id] = { question_id: b.id, block_id: b.id, type: 'short_text', label: b.label || '', answer_text: pCompany };
                            }
                        }
                    });

                    if (Object.keys(initialAnswers).length > 0) {
                        setAnswers(prev => ({ ...initialAnswers, ...prev }));
                    }
                }
                else setError(res.error);
            })
            .finally(() => setIsLoading(false));
    }, [slug, sid, emailParam, uid, nameParam, phoneParam]);

    // Active Expiration Checker
    useEffect(() => {
        if (!survey || error || submitted) return;
        const targetDate = survey.theme?.coverCountdown ? new Date(survey.theme.coverCountdown).getTime() : null;
        if (!targetDate) return;

        const checkExpiration = () => {
            if (Date.now() >= targetDate) {
                setError('SURVEY_EXPIRED');
            }
        };
        const interval = setInterval(checkExpiration, 1000);
        return () => clearInterval(interval);
    }, [survey, error, submitted]);

    // Timer logic for Quiz
    useEffect(() => {
        if (!survey || error || submitted || !survey.settings?.quiz?.enabled || !survey.settings?.quiz?.timeLimitMins) return;
        setTimeLeft(survey.settings.quiz.timeLimitMins * 60);
    }, [survey, error, submitted]);

    useEffect(() => {
        if (timeLeft === null || submitted) return;
        if (timeLeft <= 0) {
            handleForceSubmit();
            return;
        }
        const t = setInterval(() => setTimeLeft(l => (l ? l - 1 : 0)), 1000);
        return () => clearInterval(t);
    }, [timeLeft, submitted]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' + s : s}`;
    };

    // Helper functions
    const isAnswerEmpty = (ans: SurveyAnswer | undefined) => {
        if (!ans) return true;
        if (ans.type === 'short_text' || ans.type === 'long_text' || ans.type === 'email' || ans.type === 'phone' || ans.type === 'number' || ans.type === 'date') {
            return !ans.answer_text?.trim();
        }
        if (ans.type === 'file_upload') {
            return !ans.answer_text?.trim() && (!ans.answer_json || (typeof ans.answer_json === 'object' && Object.keys(ans.answer_json).length === 0));
        }
        if (['single_choice', 'dropdown', 'yes_no'].includes(ans.type)) {
            return !ans.answer_text;
        }
        if (ans.type === 'multi_choice' || ans.type === 'ranking') {
            return !ans.answer_json || !Array.isArray(ans.answer_json) || ans.answer_json.length === 0;
        }
        if (ans.type === 'matrix_single' || ans.type === 'matrix_multi') {
            if (!ans.answer_json) return true;
            return Object.values(ans.answer_json).every((v: any) => !v || (Array.isArray(v) && v.length === 0));
        }
        if (['star_rating', 'nps', 'emoji_rating', 'slider', 'likert'].includes(ans.type)) {
            return ans.answer_num == null; // loosely equals checks undefined/null
        }
        return false;
    };

    // Split blocks into pages by page_break
    const pages: SurveyBlock[][] = [];
    if (survey) {
        let cur: SurveyBlock[] = [];
        for (const b of survey.blocks) {
            if (b.type === 'page_break') { pages.push(cur); cur = []; }
            else cur.push(b);
        }
        if (cur.length > 0) pages.push(cur);
    }
    if (pages.length === 0) pages.push([]);

    const totalPages = pages.length;
    const currentBlocks = pages[currentPage] ?? [];
    const rawTheme: any = survey?.theme ?? {};
    const theme = {
        primaryColor: rawTheme.primaryColor || '#BD1D2D',
        backgroundColor: rawTheme.backgroundColor || '#f8fafc',
        cardBackground: rawTheme.cardBackground || '#ffffff',
        textColor: rawTheme.textColor || '#1e293b',
        fontFamily: rawTheme.fontFamily || "'Inter', sans-serif",
        borderRadius: rawTheme.borderRadius || '12px',
        coverStyle: (rawTheme as any).coverStyle || 'minimal',
        coverHeight: (rawTheme as any).coverHeight || 'md',
    };

    const pageBgColor = theme.backgroundColor || '#f8fafc';

    const setAnswer = (blockId: string, questionId: string, type: string, val: Partial<SurveyAnswer>) => {
        setAnswers(prev => ({
            ...prev,
            [blockId]: { question_id: questionId, block_id: blockId, type: type as any, label: '', ...prev[blockId], ...val }
        }));
        setValidationErrors(prev => {
            if (!prev[blockId]) return prev;
            const copy = { ...prev };
            delete copy[blockId];
            return copy;
        });
    };

    const evaluateLogic = (condition: any, ans: SurveyAnswer | undefined) => {
        if (!ans) {
            return condition.operator === 'is_empty';
        }
        if (condition.operator === 'is_empty') return isAnswerEmpty(ans);
        if (condition.operator === 'is_answered') return !isAnswerEmpty(ans);

        let val: any = undefined;
        if (['short_text', 'long_text', 'email', 'phone', 'date'].includes(ans.type)) val = ans.answer_text;
        else if (['single_choice', 'dropdown', 'yes_no'].includes(ans.type)) val = ans.answer_text;
        else if (['number', 'star_rating', 'nps', 'emoji_rating', 'slider', 'likert'].includes(ans.type)) val = ans.answer_num ?? ans.answer_text;

        // Multi choice logic: answer_json is array of values
        if (ans.type === 'multi_choice' && Array.isArray(ans.answer_json)) {
            if (condition.operator === 'contains') return (ans.answer_json as any[]).includes(String(condition.value));
            if (condition.operator === 'equals') return ans.answer_json.join(',') === String(condition.value);
            return false;
        }

        if (val === undefined || val === null) return false;

        switch (condition.operator) {
            case 'equals': return String(val).toLowerCase() === String(condition.value).toLowerCase();
            case 'not_equals': return String(val).toLowerCase() !== String(condition.value).toLowerCase();
            case 'contains': return String(val).toLowerCase().includes(String(condition.value).toLowerCase());
            case 'greater_than': return Number(val) > Number(condition.value);
            case 'less_than': return Number(val) < Number(condition.value);
            default: return false;
        }
    };

    const handleForceSubmit = () => {
        handleSubmit(undefined);
    };

    const validateCurrentPage = (): boolean => {
        const newErrors: Record<string, string> = {};
        let isValid = true;
        let firstFailedBlockId = '';

        for (const block of currentBlocks) {
            const isLayoutBlock = ['section_header', 'divider', 'image_block', 'button_block', 'link_block', 'banner_block', 'page_break'].includes(block.type);
            if (!isLayoutBlock) {
                const ans = answers[block.id];
                
                // 1. Required question validation
                if (block.required && isAnswerEmpty(ans)) {
                    newErrors[block.id] = 'Vui lòng điền câu hỏi bắt buộc này.';
                    isValid = false;
                    if (!firstFailedBlockId) {
                        firstFailedBlockId = block.id;
                    }
                }
                // 2. Email format validation
                else if (block.type === 'email' && ans && ans.answer_text && ans.answer_text.trim() !== '') {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(ans.answer_text.trim())) {
                        newErrors[block.id] = 'Định dạng email không hợp lệ (ví dụ: name@example.com).';
                        isValid = false;
                        if (!firstFailedBlockId) {
                            firstFailedBlockId = block.id;
                        }
                    }
                }
                // 3. Phone format validation
                else if (block.type === 'phone' && ans && ans.answer_text && ans.answer_text.trim() !== '') {
                    const phoneRegex = /^[0-9+\s\-()]{8,15}$/;
                    if (!phoneRegex.test(ans.answer_text.trim())) {
                        newErrors[block.id] = 'Định dạng số điện thoại không hợp lệ.';
                        isValid = false;
                        if (!firstFailedBlockId) {
                            firstFailedBlockId = block.id;
                        }
                    }
                }
            }
        }

        setValidationErrors(newErrors);

        if (!isValid) {
            toast.error('Vui lòng điền đầy đủ và đúng định dạng các thông tin bắt buộc.');
            if (firstFailedBlockId) {
                const el = document.getElementById(`block-${firstFailedBlockId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }

        return isValid;
    };

    const handleNext = () => {
        if (!validateCurrentPage()) {
            return;
        }
        // Evaluate Branching Logic
        for (const block of currentBlocks) {
            if (block.logic && block.logic.length > 0) {
                const ans = answers[block.id];
                for (const rule of block.logic) {
                    if (evaluateLogic(rule.condition, ans)) {
                        if (rule.action === 'skip_to') {
                            const targetIdx = pages.findIndex(page => page.some(b => b.id === rule.target));
                            if (targetIdx !== -1) {
                                setPageHistory(prev => [...prev, currentPage]);
                                setCurrentPage(targetIdx);
                                return;
                            }
                        } else if (rule.action === 'end_survey') {
                            handleSubmit(undefined);
                            return;
                        } else if (rule.action === 'end_survey_screen') {
                            handleSubmit(rule.target);
                            return;
                        }
                    }
                }
            }
        }
        setPageHistory(prev => [...prev, currentPage]);
        setCurrentPage(p => p + 1);
    };

    const handleBack = () => {
        if (pageHistory.length > 0) {
            const prev = pageHistory[pageHistory.length - 1];
            setCurrentPage(prev);
            setPageHistory(h => h.slice(0, -1));
        } else {
            setCurrentPage(p => Math.max(0, p - 1));
        }
    };

    const evaluateCorrect = (correct: any, ans: SurveyAnswer | undefined, matchType?: 'exact' | 'contains') => {
        if (!ans || !correct) return false;
        if (['single_choice', 'dropdown', 'yes_no', 'short_text', 'number'].includes(ans.type)) {
            const val = String(ans.answer_text ?? ans.answer_num ?? '').toLowerCase();
            const target = String(correct).toLowerCase();
            if (matchType === 'contains') return val.includes(target);
            return val === target;
        }
        if (ans.type === 'multi_choice' && Array.isArray(ans.answer_json) && Array.isArray(correct)) {
            const arrAns = [...ans.answer_json].sort();
            const arrCorr = [...correct].sort();
            return JSON.stringify(arrAns) === JSON.stringify(arrCorr);
        }
        return false;
    };

    const handleSubmit = async (overrideThanksId?: string) => {
        if (!survey) return;
        if (isPreview) {
            toast.error('Đây là màn hình Preview (Xem trước). Bạn không thể điền/nộp trên màn hình này.', { duration: 3000 });
            return;
        }
        if (!validateCurrentPage()) {
            return;
        }
        setIsSubmitting(true);
        try {
            // Check Quiz points
            let score = 0;
            let maxScore = 0;
            if (survey.settings?.quiz?.enabled) {
                Object.values(answers).forEach((ans: any) => {
                    const block = survey.blocks.find(b => b.id === ans.block_id);
                    if (block && block.quizPoints) {
                        maxScore += block.quizPoints;
                        if (evaluateCorrect(block.correctAnswer, ans, block.correctAnswerMatch)) {
                            score += block.quizPoints;
                        }
                    }
                });
            }

            const isEmailTraffic = srcParam === 'email' || 
                srcParam === 'email_embed' || 
                utmMedium === 'email' || 
                searchParams.get('utm_source') === 'mailflow' || 
                Boolean(emailParam) || 
                Boolean(sid);

            const effectiveChannel = isEmailTraffic 
                ? 'email_embed' 
                : (['qr_code', 'widget', 'api'].includes(srcParam) ? srcParam : 'direct_link');

            const res = await fetch(`${PUBLIC_API}?slug=${slug}&action=submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken.current, 'X-Survey-Source': effectiveChannel },
                body: JSON.stringify({
                    session_token: sessionToken.current,
                    answers: Object.values(answers),
                    sid: sid || (survey as any)?.prefill?.subscriber_id,
                    uid: uid || emailParam || (survey as any)?.prefill?.email,
                    email: emailParam || (survey as any)?.prefill?.email,
                    name: nameParam || (survey as any)?.prefill?.name || (survey as any)?.prefill?.full_name,
                    phone: phoneParam || (survey as any)?.prefill?.phone || (survey as any)?.prefill?.phone_number,
                    completion_rate: 100,
                    time_spent_sec: Math.round((Date.now() - startTime.current) / 1000),
                    source_channel: effectiveChannel,
                    utm_source: searchParams.get('utm_source') || undefined,
                    utm_medium: utmMedium,
                    utm_campaign: utmCampaign,
                    total_score: survey.settings?.quiz?.enabled ? score : null,
                    max_score: survey.settings?.quiz?.enabled ? maxScore : null,
                    end_screen_id: overrideThanksId || 'default'
                }),
            }).then(r => { if (!r.ok) throw new Error("Submit failed"); return r.json(); });

            if (res.success) {
                setSubmitted(true);
                let tyScreen = overrideThanksId ? (survey.thankYouPages?.find(p => p.id === overrideThanksId) || survey.thankYouPage) : survey.thankYouPage;
                setThankYouData(res.thank_you || tyScreen);
                if (res.voucher_code) setVoucherCode(res.voucher_code);
                
                if (survey.settings?.quiz?.enabled && survey.settings?.quiz?.scoringType === 'immediate') {
                    setQuizResult({ score, maxScore });
                }

                const safeRedirect = (url: string) => {
                    try {
                        const parsed = new URL(url, window.location.origin);
                        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                            window.location.href = url;
                        }
                    } catch {
                        if (url.startsWith('/')) window.location.href = url;
                    }
                };

                if (nextUrl) {
                    setTimeout(() => { safeRedirect(nextUrl); }, (tyScreen?.redirectDelay ?? 3) * 1000);
                } else if (tyScreen?.redirectUrl) {
                    setTimeout(() => { safeRedirect(tyScreen.redirectUrl!); }, (tyScreen?.redirectDelay ?? 3) * 1000);
                }
            } else {
                toast.error('Lỗi: ' + (res.error || 'Không thể nộp form.'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── Loading ────────────────────────────────────────────────────────────
    if (isLoading) return (
        <div className="min-h-screen py-10 px-4 relative overflow-hidden" style={{ background: pageBgColor, fontFamily: theme.fontFamily }}>
            <div className="relative z-10 max-w-2xl mx-auto bg-white dark:bg-[#111827] rounded-[20px] shadow-2xl overflow-hidden">
                <div className="h-32 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                <div className="p-6 sm:p-8 space-y-5">
                    <div className="space-y-2">
                        <div className="h-6 w-2/3 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                        <div className="h-4 w-1/2 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[10px]" />
                    </div>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-5 rounded-[16px] border border-slate-100 dark:border-white/[0.06] space-y-3">
                            <div className="h-4 w-48 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                            <div className="h-10 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                        </div>
                    ))}
                    <div className="h-12 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px] mt-4" />
                </div>
            </div>
        </div>
    );

    // ─── Error states ───────────────────────────────────────────────────────
    if (error) {
        const msgs: Record<string, { icon: string; title: string; desc: string }> = {
            SURVEY_NOT_FOUND: { icon: '🔍', title: 'Không tìm thấy khảo sát', desc: 'Link không hợp lệ hoặc đã bị xoá.' },
            SURVEY_NOT_PUBLISHED: { icon: '🔒', title: 'Khảo sát chưa mở', desc: 'Khảo sát này chưa được xuất bản.' },
            SURVEY_CLOSED: { icon: '🚫', title: 'Khảo sát đã đóng', desc: 'Khảo sát này đã ngừng nhận phản hồi.' },
            SURVEY_EXPIRED: { icon: '⏰', title: 'Khảo sát đã hết hạn', desc: 'Thời hạn thu thập phản hồi đã kết thúc.' },
            SURVEY_LIMIT_REACHED: { icon: '✅', title: 'Đã đủ phản hồi', desc: 'Khảo sát đã đạt đủ số lượng phản hồi.' },
        };
        const m = msgs[error] ?? { icon: '❌', title: 'Có lỗi xảy ra', desc: error };
        return (
            <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: pageBgColor, fontFamily: theme.fontFamily }}>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-600/10 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-800/8 blur-[100px] rounded-full -ml-48 -mb-48 pointer-events-none" />
                <div className="relative z-10 text-center max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-[18px] p-10 shadow-2xl">
                    <div className="text-5xl mb-4">{m.icon}</div>
                    <h1 className="text-xl font-bold text-white mb-2">{m.title}</h1>
                    <p className="text-sm text-slate-400">{m.desc}</p>
                </div>
            </div>
        );
    }

    // ─── Thank you page ─────────────────────────────────────────────────────
    if (submitted) {
        const ty = thankYouData ?? survey?.thankYouPage;
        return (
            <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" style={{ background: pageBgColor, fontFamily: theme.fontFamily }}>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-600/10 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-800/8 blur-[100px] rounded-full -ml-48 -mb-48 pointer-events-none" />
                <CanvasConfetti particleCount={150} />
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
                    className="relative z-10 text-center max-w-md bg-white rounded-[18px] shadow-2xl p-10"
                >
                    {ty?.imageUrl && (
                        <motion.img 
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
                            src={ty.imageUrl} alt="" className="w-32 h-32 object-contain mx-auto mb-4 rounded-[14px]" 
                        />
                    )}
                    <motion.div 
                        initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: ty?.imageUrl ? 0.3 : 0.1, type: 'spring' }}
                        className="text-5xl mb-4"
                    >
                        {ty?.emoji ?? '🎉'}
                    </motion.div>
                    <h1 className="text-2xl font-black mb-3" style={{ color: theme.textColor }}>{ty?.title ?? 'Cảm ơn!'}</h1>
                    <p className="text-base text-slate-500 leading-relaxed">{ty?.message ?? 'Phản hồi của bạn đã được ghi nhận.'}</p>

                    {quizResult && (
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                            className="mt-6 mb-2 bg-slate-50 border border-slate-200 rounded-[14px] p-6 relative overflow-hidden"
                        >
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Điểm của bạn</h3>
                            <div className="flex items-end justify-center gap-1.5 text-slate-800 relative z-10">
                                <motion.span 
                                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring', bounce: 0.6 }}
                                    className="text-6xl font-black leading-none drop-shadow-sm" 
                                    style={{ color: theme.primaryColor }}
                                >
                                    {quizResult.score}
                                </motion.span>
                                <span className="text-2xl font-bold opacity-30 mb-2">/ {quizResult.maxScore}</span>
                            </div>
                        </motion.div>
                    )}

                    {voucherCode && (
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                            className="mt-6 mb-2 bg-gradient-to-tr from-rose-50 to-white border border-rose-200 rounded-[14px] p-6 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-400/20 blur-3xl rounded-full" />
                            <h3 className="text-[11px] font-black text-[var(--color-primary)] uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5 relative z-10">
                                <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
                                Phần quà của bạn
                            </h3>
                            <div 
                                className="bg-white border-2 border-dashed border-rose-300 rounded-[var(--radius-md)] py-3 px-4 shadow-sm relative group cursor-pointer overflow-hidden transition-all hover:shadow-md" 
                                onClick={() => { navigator.clipboard.writeText(voucherCode); toast.success('Đã sao chép mã!'); }}
                            >
                                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-rose-100/50 to-transparent group-hover:animate-shimmer" />
                                <p className="text-2xl font-mono font-black text-[var(--color-primary)] tracking-wider break-all drop-shadow-sm relative z-10">{voucherCode}</p>
                                <div className="absolute inset-0 bg-[var(--color-primary)] text-white font-bold text-xs flex items-center justify-center rounded-[var(--radius-md)] opacity-0 group-hover:opacity-100 transition-all duration-300 z-20">Bấm để sao chép</div>
                            </div>
                            <p className="text-[10px] text-rose-700/60 mt-2 font-medium relative z-10">Chụp màn hình hoặc lưu mã này lại để sử dụng nhé!</p>
                        </motion.div>
                    )}

                    {(ty?.ctaText && ty?.ctaUrl) || nextUrl ? (
                        <motion.a 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            href={nextUrl || ty?.ctaUrl} target={nextUrl ? '_self' : '_blank'} rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-[14px] font-bold text-white shadow-lg transition-all"
                            style={{ background: (ty as any)?.ctaColor || (survey as any)?.thank_you?.ctaColor || (survey as any)?.thankYouPage?.ctaColor || theme.primaryColor }}
                        >
                            {nextUrl ? 'Bấm để Tiếp tục' : ty?.ctaText} <ExternalLink className="w-4 h-4" />
                        </motion.a>
                    ) : null}
                    
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                        className="mt-8 flex items-center justify-center gap-3"
                    >
                        <div className="relative w-8 h-8 shrink-0">
                            <div className="absolute inset-0 bg-rose-500 blur-lg opacity-20 rounded-full"></div>
                            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full border border-white/80 shadow-md">
                                <img src="/imgs/ICON.png" className="w-full h-full object-contain" alt="Logo" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[13px] font-black text-slate-700 tracking-tighter leading-none">DOMATION</span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Digital AI Vision</span>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        );
    }

    if (!survey) return null;

    const progress = totalPages > 1 ? ((currentPage + 1) / totalPages) * 100 : 100;

    return (
        <div className="min-h-screen py-10 px-4 relative overflow-hidden" style={{ background: pageBgColor, fontFamily: theme.fontFamily }}>
            {/* Ambient glow orbs */}
            <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-rose-600/8 blur-[140px] rounded-full -mr-72 -mt-72 pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-rose-900/10 blur-[120px] rounded-full -ml-56 -mb-56 pointer-events-none" />
            <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(189,29,45,0.12),transparent_70%)] pointer-events-none" />

            {/* Progress bar — floats ABOVE the white card on dark bg */}
            {survey.settings?.showProgressBar !== false && totalPages > 1 && (
                <div className="relative z-10 max-w-2xl mx-auto mb-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span className="font-semibold tracking-wide">Trang {currentPage + 1} / {totalPages}</span>
                        <span className="font-bold" style={{ color: theme.primaryColor ?? '#BD1D2D' }}>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(189,29,45,0.6)]" style={{ width: `${progress}%`, background: theme.primaryColor ?? '#BD1D2D' }} />
                    </div>
                </div>
            )}

            {/* Quiz Timer */}
            {timeLeft !== null && (
                <div className="relative z-20 max-w-2xl mx-auto mb-4 flex justify-end">
                    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-[var(--radius-md)] px-4 py-2 flex items-center gap-2 text-white shadow-lg">
                        <div className={`w-2.5 h-2.5 rounded-full ${timeLeft < 60 ? 'bg-red-500 animate-pulse border border-red-300' : 'bg-green-400'}`}></div>
                        <span className="text-sm font-black tracking-widest font-mono">{formatTime(timeLeft)}</span>
                    </div>
                </div>
            )}

            {/* White content card */}
            <div className="relative z-10 max-w-2xl mx-auto bg-white rounded-[18px] shadow-[0_32px_80px_rgba(0,0,0,0.45)] overflow-hidden">

                {/* Survey header */}
                {currentPage === 0 && (
                    <SurveyCoverPublic survey={survey} />
                )}

                {/* Blocks */}
                <div className="flex flex-col gap-5 mt-6 px-5 sm:px-8">
                    {currentBlocks.map((block, idx) => (
                        <BlockRenderer
                            key={block.id}
                            block={block}
                            index={idx}
                            theme={theme}
                            answer={answers[block.id]}
                            onAnswer={(val) => setAnswer(block.id, block.id, block.type, val)}
                            errorMsg={validationErrors[block.id]}
                        />
                    ))}
                </div>

                {/* Navigation */}
                <div className="flex flex-col gap-3 mt-8 px-5 sm:px-8 pb-8 sm:pb-10">
                    {/* Next / Submit */}
                    {currentPage < totalPages - 1 ? (
                        <button
                            onClick={handleNext}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] font-bold text-white transition-all shadow-lg text-base hover:brightness-105 active:scale-[0.98]"
                            style={{ background: theme.primaryColor }}
                        >
                            Tiếp theo <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSubmit(undefined)}
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[14px] font-bold text-white transition-all shadow-lg text-base hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
                            style={{ background: theme.primaryColor }}
                        >
                            <Send className="w-4 h-4" />
                            {isSubmitting ? 'Đang gửi...' : 'Nộp'}
                        </button>
                    )}
                    {/* Back */}
                    {pageHistory.length > 0 && (
                        <button
                            onClick={handleBack}
                            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-[14px] border-2 border-slate-200 text-slate-500 font-semibold hover:border-slate-300 hover:bg-slate-50 transition-all text-sm"
                        >
                            <ChevronLeft className="w-4 h-4" /> Trang trước
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center gap-3 mt-8 pb-8">
                    <div className="relative w-7 h-7 shrink-0">
                        <div className="absolute inset-0 bg-rose-500 blur-lg opacity-20 rounded-full"></div>
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full border border-white/80 shadow-md">
                            <img src="/imgs/ICON.png" className="w-full h-full object-contain" alt="Logo" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[12px] font-black text-slate-600 tracking-tighter leading-none">DOMATION</span>
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Digital AI Vision</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Survey Cover (public) ────────────────────────────────────────────────────
const SurveyCoverPublic: React.FC<{ survey: Survey }> = ({ survey }) => {
    const theme = (survey.theme ?? {}) as any;
    const coverStyle = theme.coverStyle ?? 'minimal';
    const coverHeight = theme.coverHeight ?? 'md';
    const primaryColor = theme.primaryColor || '#BD1D2D';
    const heightMap: Record<string, string> = { sm: '80px', md: '120px', lg: '200px' };

    const getBg = () => {
        if (coverStyle === 'image' && theme.coverImageUrl) {
            return {
                backgroundImage: `url(${theme.coverImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            };
        }
        if (coverStyle === 'gradient') {
            const from = theme.gradientFrom ?? `${primaryColor}dd`;
            const to = theme.gradientTo ?? `${primaryColor}66`;
            if (theme.coverImageUrl) {
                return {
                    backgroundImage: `linear-gradient(135deg, ${from}cc, ${to}cc), url(${theme.coverImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                };
            }
            return { background: `linear-gradient(135deg, ${from}, ${to})` };
        }
        return { background: primaryColor };
    };

    const textColor = '#ffffff';

    // Countdown Logic
    const targetDate = theme.coverCountdown ? new Date(theme.coverCountdown).getTime() : null;
    const [timeLeft, setTimeLeft] = useState<{ d: string, h: string, m: string, s: string } | null>(null);

    useEffect(() => {
        if (!targetDate) return;
        const tick = () => {
            const now = Date.now();
            const distance = targetDate - now;
            if (distance < 0) {
                setTimeLeft({ d: '00', h: '00', m: '00', s: '00' });
                return;
            }
            const d = Math.floor(distance / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
            const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)).toString().padStart(2, '0');
            const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
            const s = Math.floor((distance % (1000 * 60)) / 1000).toString().padStart(2, '0');
            setTimeLeft({ d, h, m, s });
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return (
        <div
            className="w-full mb-0 overflow-hidden relative transition-all"
            style={{ ...getBg(), minHeight: heightMap[coverHeight] }}
        >
            {(coverStyle === 'image') && (
                <div className="absolute inset-0" style={{ background: theme.coverOverlay ?? 'rgba(0,0,0,0.3)' }} />
            )}
            <div className="relative px-8 py-8 flex flex-col justify-end h-full" style={{ minHeight: heightMap[coverHeight] }}>
                {timeLeft && theme.coverCountdownPos === 'top_right' && (
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md rounded-[var(--radius-md)] p-2 border border-white/20 flex items-center gap-2.5 z-20 shadow-xl">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ring-2 ring-rose-400/50" />
                        <div className="flex gap-1.5">
                            {[timeLeft.h, timeLeft.m, timeLeft.s].map((v, i) => (
                                <div key={i} className="bg-white/10 border border-white/10 rounded flex items-center justify-center p-1 font-mono">
                                    <span className="text-[11px] font-black text-white">{v}</span>
                                    <span className="text-[7px] text-white/50 ml-0.5">{['h', 'm', 's'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="w-full relative z-10">
                    {theme.coverBadge && (
                        <span className="inline-block px-3 py-1 mb-4 rounded-full text-[10px] font-black tracking-widest text-white shadow-none uppercase border border-white/20 relative" style={{ background: 'var(--color-primary)' }}>
                            {theme.coverBadge}
                        </span>
                    )}

                    {theme.logoUrl && (
                        <img src={theme.logoUrl} alt="logo" className="h-10 mb-5 object-contain drop-shadow-md" />
                    )}

                    <h1 className="text-2xl md:text-3xl font-black leading-tight drop-shadow-md" style={{ color: textColor, fontFamily: theme.fontFamily }}>
                        {survey.name}
                    </h1>

                    {theme.coverDescription && (
                        <p className="mt-3 text-base leading-relaxed drop-shadow-sm whitespace-pre-wrap" style={{ color: textColor, opacity: 0.9 }}>
                            {theme.coverDescription}
                        </p>
                    )}

                    {(theme.coverFeatures ?? []).length > 0 && (
                        <div className="mt-6 space-y-2.5">
                            {theme.coverFeatures!.map((feat: string, i: number) => (
                                theme.coverFeaturesStyle === 'dot' ? (
                                    <div key={i} className="flex items-start gap-2.5 max-w-2xl">
                                        <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-white/70" />
                                        <span className="text-sm font-medium drop-shadow-md leading-snug" style={{ color: textColor }}>{feat}</span>
                                    </div>
                                ) : (
                                    <div key={i} className="flex items-center gap-3 bg-white/5 w-fit pr-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ml-1">
                                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                        </div>
                                        <span className="text-sm font-semibold drop-shadow-md" style={{ color: textColor }}>{feat}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    )}

                    {timeLeft && theme.coverCountdownPos !== 'top_right' && (
                        <div className="mt-8 bg-black/20 backdrop-blur-md rounded-[14px] p-4 w-fit border border-white/10">
                            <p className="text-[10px] uppercase tracking-widest text-rose-300 font-bold mb-3 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                                Ưu đãi kết thúc sau
                            </p>
                            <div className="flex gap-2">
                                {[timeLeft.d, timeLeft.h, timeLeft.m, timeLeft.s].map((v, i) => (
                                    <div key={i} className="bg-white/10 border border-white/20 rounded-[var(--radius-md)] w-12 h-12 flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
                                        <div className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
                                        <span className="text-lg font-black text-white z-10">{v}</span>
                                        <span className="text-[7px] uppercase font-bold text-white/70 mt-0.5 z-10">{['Ng', 'Giờ', 'Ph', 'Gi'][i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Block Renderer ───────────────────────────────────────────────────────────
const BlockRenderer: React.FC<{
    block: SurveyBlock;
    index: number;
    theme: any;
    answer?: SurveyAnswer;
    onAnswer: (val: Partial<SurveyAnswer>) => void;
    errorMsg?: string;
}> = ({ block, index, theme, answer, onAnswer, errorMsg }) => {
    const hasError = !!errorMsg;
    const [otherText, setOtherText] = useState('');
    const [otherSelected, setOtherSelected] = useState(false);
    const accent = block.style?.accentColor ?? theme.primaryColor;
    const bgColor = block.style?.backgroundColor ?? theme.cardBackground;
    const textColor = block.style?.textColor ?? theme.textColor;
    const textAlign = block.style?.textAlign ?? 'left';
    const boxShadow = block.style?.boxShadow && block.style.boxShadow !== 'none'
        ? block.style.boxShadow
        : (theme.cardShadow && theme.cardShadow !== 'none' ? theme.cardShadow : undefined);

    const cardStyle: React.CSSProperties = {
        background: hasError ? 'rgba(239, 68, 68, 0.05)' : bgColor,
        borderRadius: theme.borderRadius,
        textAlign,
        boxShadow: hasError ? '0 0 8px rgba(239, 68, 68, 0.2)' : boxShadow,
        borderColor: hasError ? '#ef4444' : undefined,
    };

    // ─ Layout-only blocks ─
    if (block.type === 'section_header') {
        return (
            <div className="pt-2" style={{ textAlign }}>
                <h2 className="text-lg font-bold" style={{ color: textColor }}>{block.label}</h2>
                {block.description && <p className="text-sm text-slate-500 mt-1">{block.description}</p>}
            </div>
        );
    }
    if (block.type === 'divider') return <hr className="border-slate-200" />;
    if (block.type === 'image_block') {
        return block.imageUrl ? (
            <div style={{ textAlign: block.imageAlign ?? 'center' }}>
                <img src={block.imageUrl} alt={block.imageAlt} style={{ width: block.imageWidth ?? '100%' }} className="rounded-[14px] object-cover max-h-64 inline-block" />
            </div>
        ) : null;
    }
    if (block.type === 'button_block') {
        const style = block.buttonStyle ?? 'filled';
        const color = block.buttonColor ?? accent;
        const shadow = block.buttonShadow && block.buttonShadow !== 'none' ? block.buttonShadow : undefined;
        return (
            <div style={{ textAlign: block.buttonAlign ?? 'center' }}>
                <a href={block.buttonUrl || '#'} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)] font-bold transition-all"
                    style={style === 'filled' ? { background: color, color: '#fff', boxShadow: shadow } : style === 'outline' ? { border: `2px solid ${color}`, color, boxShadow: shadow } : { color, textDecoration: 'underline', textShadow: shadow }}
                >
                    {block.buttonText || 'Nhấn vào đây'} <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        );
    }
    if (block.type === 'link_block') {
        return (
            <div style={{ textAlign: block.linkAlign ?? 'left' }}>
                <a href={block.linkUrl || '#'} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2"
                    style={{ color: accent }}
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {block.linkText || 'Xem thêm'}
                </a>
            </div>
        );
    }
    if (block.type === 'banner_block') {
        return (
            <div className="w-full rounded-[14px] overflow-hidden relative flex items-end"
                style={{ height: block.bannerHeight ?? 160, backgroundImage: block.bannerImageUrl ? `url(${block.bannerImageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', background: block.bannerImageUrl ? undefined : `linear-gradient(135deg, ${accent}cc, ${accent}44)` }}
            >
                <div className="absolute inset-0" style={{ background: block.bannerOverlay ?? 'rgba(0,0,0,0.35)' }} />
                <div className="relative px-6 pb-6">
                    <p className="font-bold text-lg" style={{ color: block.bannerTextColor ?? '#fff' }}>{block.label}</p>
                    {block.description && <p className="text-sm mt-1" style={{ color: (block.bannerTextColor ?? '#fff') + 'bb' }}>{block.description}</p>}
                </div>
            </div>
        );
    }

    const justifyClass = textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start';

    // ─ Question blocks ─
    return (
        <div 
            id={`block-${block.id}`}
            className={`p-5 shadow-sm border transition-all ${hasError ? 'border-red-500' : 'border-slate-100'}`}
            style={cardStyle}
        >
            <label className="block font-semibold mb-3 text-sm" style={{ color: textColor, textAlign }}>
                {block.label}
                {block.required && <span style={{ color: accent }} className="ml-1">*</span>}
            </label>
            {block.description && <p className="text-xs text-slate-400 mb-3" style={{ textAlign }}>{block.description}</p>}

            {/* Short/Email/Phone/Number */}
            {(block.type === 'short_text' || block.type === 'email' || block.type === 'phone' || block.type === 'number') && (
                <input
                    type={block.type === 'email' ? 'email' : block.type === 'number' ? 'number' : 'text'}
                    value={answer?.answer_text ?? ''}
                    onChange={e => onAnswer({ answer_text: e.target.value })}
                    placeholder={block.placeholder || 'Nhập câu trả lời...'}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:outline-none transition-colors text-sm"
                    style={{ borderColor: answer?.answer_text ? accent : undefined } as any}
                />
            )}

            {/* Long text */}
            {block.type === 'long_text' && (
                <textarea
                    value={answer?.answer_text ?? ''}
                    onChange={e => onAnswer({ answer_text: e.target.value })}
                    placeholder={block.placeholder || 'Nhập câu trả lời...'}
                    rows={4}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:outline-none resize-none transition-colors text-sm"
                />
            )}

            {/* Date */}
            {block.type === 'date' && (
                <input
                    type={(block as any).dateMode === 'datetime' ? 'datetime-local' : 'date'}
                    value={answer?.answer_text ?? ''}
                    onChange={e => onAnswer({ answer_text: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:outline-none text-sm"
                />
            )}

            {/* Yes / No */}
            {block.type === 'yes_no' && (
                <div className="flex gap-3">
                    {(block.options && block.options.length > 0
                        ? block.options
                        : [{ id: 'yes', label: 'Có', value: 'yes' }, { id: 'no', label: 'Không', value: 'no' }]
                    ).map((opt, i) => {
                        const optVal = opt.value || opt.label;
                        const isSelected = answer?.answer_text === optVal;
                        return (
                            <button
                                key={opt.id || i}
                                type="button"
                                onClick={() => onAnswer({ answer_text: optVal })}
                                className="flex-1 py-2.5 px-4 rounded-xl border-2 text-center text-sm font-semibold transition-all"
                                style={{
                                    borderColor: isSelected ? accent : '#e2e8f0',
                                    background: isSelected ? accent + '12' : '#f8fafc',
                                    color: isSelected ? accent : textColor,
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Single choice */}
            {block.type === 'single_choice' && (
                <div className="flex flex-col gap-2">
                    {(block.options ?? []).map(opt => {
                        const isSelected = answer?.answer_text === opt.value;
                        return (
                            <button key={opt.id} onClick={() => { onAnswer({ answer_text: opt.value }); setOtherSelected(false); }}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left text-sm font-medium"
                                style={{ borderColor: isSelected ? accent : '#e2e8f0', background: isSelected ? accent + '12' : undefined, color: isSelected ? accent : textColor }}
                            >
                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{ borderColor: isSelected ? accent : '#cbd5e1', background: isSelected ? accent : undefined }}>
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                                {opt.label}
                            </button>
                        );
                    })}
                    {block.allowOther && (
                        <div>
                            <button onClick={() => { setOtherSelected(true); onAnswer({ answer_text: `__other__:${otherText}` }); }}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left text-sm font-medium w-full"
                                style={{ borderColor: otherSelected ? accent : '#e2e8f0', background: otherSelected ? accent + '12' : undefined, color: otherSelected ? accent : '#94a3b8' }}
                            >
                                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                    style={{ borderColor: otherSelected ? accent : '#cbd5e1', background: otherSelected ? accent : undefined }}>
                                    {otherSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                                Khác...
                            </button>
                            {otherSelected && (
                                <input
                                    autoFocus
                                    value={otherText}
                                    onChange={e => { setOtherText(e.target.value); onAnswer({ answer_text: `__other__:${e.target.value}` }); }}
                                    placeholder="Nhập ý kiến của bạn..."
                                    className="mt-2 w-full px-4 py-2.5 rounded-xl border-2 text-sm focus:outline-none"
                                    style={{ borderColor: accent }}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Multi choice */}
            {block.type === 'multi_choice' && (
                <div className="flex flex-col gap-2">
                    {(block.options ?? []).map(opt => {
                        const selected: string[] = (answer?.answer_json as string[]) ?? [];
                        const isSelected = selected.includes(opt.value);
                        const toggle = () => onAnswer({ answer_json: isSelected ? selected.filter(v => v !== opt.value) : [...selected, opt.value] });
                        return (
                            <button key={opt.id} onClick={toggle}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left text-sm font-medium"
                                style={{ borderColor: isSelected ? accent : '#e2e8f0', background: isSelected ? accent + '12' : undefined, color: isSelected ? accent : textColor }}
                            >
                                <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                                    style={{ borderColor: isSelected ? accent : '#cbd5e1', background: isSelected ? accent : undefined }}>
                                    {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                {opt.label}
                            </button>
                        );
                    })}
                    {block.allowOther && (
                        <div>
                            <button onClick={() => {
                                const selected: string[] = (answer?.answer_json as string[]) ?? [];
                                const hasOther = selected.some(v => v.startsWith('__other__'));
                                if (hasOther) { onAnswer({ answer_json: selected.filter(v => !v.startsWith('__other__')) }); setOtherSelected(false); }
                                else { setOtherSelected(true); onAnswer({ answer_json: [...selected, `__other__:${otherText}`] }); }
                            }}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left text-sm font-medium w-full"
                                style={{ borderColor: otherSelected ? accent : '#e2e8f0', background: otherSelected ? accent + '12' : undefined, color: otherSelected ? accent : '#94a3b8' }}
                            >
                                <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                                    style={{ borderColor: otherSelected ? accent : '#cbd5e1', background: otherSelected ? accent : undefined }}>
                                    {otherSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                Khác...
                            </button>
                            {otherSelected && (
                                <input autoFocus value={otherText}
                                    onChange={e => {
                                        setOtherText(e.target.value);
                                        const selected: string[] = (answer?.answer_json as string[]) ?? [];
                                        onAnswer({ answer_json: [...selected.filter(v => !v.startsWith('__other__')), `__other__:${e.target.value}`] });
                                    }}
                                    placeholder="Nhập ý kiến của bạn..."
                                    className="mt-2 w-full px-4 py-2.5 rounded-xl border-2 text-sm focus:outline-none"
                                    style={{ borderColor: accent }}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Dropdown */}
            {block.type === 'dropdown' && (
                <div className="relative">
                    <Select
                        value={answer?.answer_text ?? ''}
                        onChange={val => onAnswer({ answer_text: val })}
                        options={[
                            { value: '', label: '— Chọn một đáp án —' },
                            ...(block.options ?? []).map(opt => ({ value: opt.value, label: opt.label }))
                        ]}
                        placeholder="— Chọn một đáp án —"
                        className="w-full"
                    />
                </div>
            )}

            {/* Star rating */}
            {block.type === 'star_rating' && (
                <div className={`flex gap-2 ${justifyClass}`}>
                    {Array.from({ length: block.maxValue ?? 5 }).map((_, i) => {
                        const val = i + 1;
                        const filled = (answer?.answer_num ?? 0) >= val;
                        return (
                            <button key={i} onClick={() => onAnswer({ answer_num: val })} className="transition-transform hover:scale-110">
                                <Star className="w-8 h-8" fill={filled ? accent : 'none'} stroke={filled ? accent : '#cbd5e1'} />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* NPS — neutral on inactive to match builder */}
            {block.type === 'nps' && (
                <div className="space-y-2">
                    <div className={`flex gap-1 flex-wrap ${justifyClass}`}>
                        {Array.from({ length: 11 }).map((_, i) => {
                            const isSelected = answer?.answer_num === i;
                            return (
                                <button key={i} onClick={() => onAnswer({ answer_num: i })}
                                    className="w-9 h-9 rounded-xl font-bold text-sm transition-all border-2"
                                    style={{
                                        borderColor: isSelected ? accent : '#e2e8f0',
                                        background: isSelected ? accent : '#ffffff',
                                        color: isSelected ? '#ffffff' : '#64748b',
                                    }}
                                >{i}</button>
                            );
                        })}
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 px-1">
                        <span>{block.minLabel ?? 'Hoàn toàn không'}</span>
                        <span>{block.maxLabel ?? 'Chắc chắn có'}</span>
                    </div>
                </div>
            )}

            {/* Likert */}
            {block.type === 'likert' && (() => {
                const likertItems: Array<{ value: number; label: string }> =
                    Array.isArray((block as any).likertPoints) && (block as any).likertPoints.length > 0
                        ? (block as any).likertPoints.map((pt: any, i: number) => ({
                              value: pt.value !== undefined && pt.value !== '' ? Number(pt.value) : i + 1,
                              label: pt.label ?? String(i + 1),
                          }))
                        : (block.likertLabels ?? ['1', '2', '3', '4', '5']).map((label, i) => ({
                              value: i + 1,
                              label,
                          }));
                return (
                    <div className={`flex gap-2 flex-wrap ${justifyClass}`}>
                        {likertItems.map((pt, i) => {
                            const isSelected = answer?.answer_num === pt.value;
                            return (
                                <button key={i} type="button" onClick={() => onAnswer({ answer_num: pt.value })}
                                    className="flex flex-col items-center gap-1 flex-1 min-w-[50px] py-2 px-1 rounded-xl border-2 transition-all"
                                    style={{
                                        borderColor: isSelected ? accent : '#e2e8f0',
                                        background: isSelected ? accent + '15' : undefined,
                                        filter: isSelected ? 'none' : 'grayscale(30%)',
                                    }}
                                >
                                    <span className="text-base font-black" style={{ color: isSelected ? accent : '#64748b' }}>{pt.value}</span>
                                    <span className="text-[9px] text-slate-400 text-center leading-tight">{pt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                );
            })()}

            {/* Emoji rating */}
            {block.type === 'emoji_rating' && (
                <div className={`flex gap-4 flex-wrap ${justifyClass}`}>
                    {(block.emojis ?? ['😠', '😕', '😐', '🙂', '😁']).map((emoji, i) => {
                        const isSelected = answer?.answer_num === i + 1;
                        return (
                            <button key={i} onClick={() => onAnswer({ answer_num: i + 1 })}
                                className="flex flex-col items-center gap-1.5 transition-all hover:scale-105"
                                style={{ filter: isSelected ? 'none' : 'grayscale(50%) opacity(0.7)' }}
                            >
                                <span className="text-3xl">{emoji}</span>
                                <div className="w-6 h-1.5 rounded-full transition-all" style={{ background: isSelected ? accent : '#e2e8f0' }} />
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Slider */}
            {block.type === 'slider' && (
                <div className="space-y-2">
                    <input
                        type="range" min={block.minValue ?? 0} max={block.maxValue ?? 100} step={block.step ?? 1}
                        value={answer?.answer_num ?? Math.round(((block.minValue ?? 0) + (block.maxValue ?? 100)) / 2)}
                        onChange={e => onAnswer({ answer_num: +e.target.value })}
                        className="w-full"
                        style={{ accentColor: accent }}
                    />
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>{block.minLabel ?? block.minValue ?? 0}</span>
                        <span className="font-bold" style={{ color: accent }}>{answer?.answer_num ?? '—'}</span>
                        <span>{block.maxLabel ?? block.maxValue ?? 100}</span>
                    </div>
                </div>
            )}

            {/* Matrix single/multi */}
            {(block.type === 'matrix_single' || block.type === 'matrix_multi') && (
                <div className="overflow-x-auto w-full mt-2">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="p-2 border-b border-slate-200"></th>
                                {(block.matrixCols ?? []).map(col => (
                                    <th key={col.id} className="p-2 border-b border-slate-200 text-center font-semibold text-slate-600 leading-tight">{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(block.matrixRows ?? []).map((row, rIdx) => (
                                <tr key={row.id} className={rIdx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>
                                    <td className="p-2.5 font-medium text-slate-700 min-w-[120px]">{row.label}</td>
                                    {(block.matrixCols ?? []).map(col => {
                                        const ansObj = (answer?.answer_json as Record<string, string[]>) ?? {};
                                        const isSelected = (ansObj[row.id] ?? []).includes(col.id);
                                        const toggle = () => {
                                            const curList = ansObj[row.id] ?? [];
                                            const newList = block.type === 'matrix_single'
                                                ? [col.id]
                                                : (isSelected ? curList.filter(id => id !== col.id) : [...curList, col.id]);
                                            onAnswer({ answer_json: { ...ansObj, [row.id]: newList } as any });
                                        };
                                        return (
                                            <td key={col.id} className="p-2.5 text-center" onClick={toggle}>
                                                <div className={`mx-auto w-5 h-5 flex items-center justify-center cursor-pointer transition-all ${block.type === 'matrix_single' ? 'rounded-full' : 'rounded-md'} border-2`}
                                                    style={{ borderColor: isSelected ? accent : '#cbd5e1', background: isSelected ? accent : 'white' }}
                                                >
                                                    {isSelected && (block.type === 'matrix_single' ? <div className="w-2 h-2 bg-white rounded-full" /> : <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>)}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Ranking */}
            {block.type === 'ranking' && (
                <div className="flex flex-col gap-2">
                    {(() => {
                        const allStrs = block.options?.map(o => o.value) ?? [];
                        const currentRank: string[] = Array.isArray(answer?.answer_json) && (answer?.answer_json as string[]).length === allStrs.length
                            ? (answer?.answer_json as string[])
                            : allStrs;
                        return currentRank.map((val, idx) => {
                            const opt = block.options?.find(o => o.value === val);
                            return (
                                <div key={val} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                                    <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs shrink-0">
                                        #{idx + 1}
                                    </div>
                                    <div className="flex-1 text-sm font-medium text-slate-700">{opt?.label ?? val}</div>
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button disabled={idx === 0} onClick={() => {
                                            const copy = [...currentRank];
                                            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                                            onAnswer({ answer_json: copy });
                                        }} className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                                        </button>
                                        <button disabled={idx === currentRank.length - 1} onClick={() => {
                                            const copy = [...currentRank];
                                            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                                            onAnswer({ answer_json: copy });
                                        }} className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors ${idx === currentRank.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            )}

            {/* File Upload */}
            {block.type === 'file_upload' && (() => {
                const maxMB = block.maxFileSizeMB ?? 5;
                const acceptAttr = (block.acceptedTypes ?? []).length > 0 ? (block.acceptedTypes ?? []).join(',') : undefined;
                const selectedFileName = answer?.answer_text || (answer?.answer_json as any)?.name || '';
                const handleFileSelect = (file: File | undefined | null) => {
                    if (!file) return;
                    if (file.size > maxMB * 1024 * 1024) {
                        toast.error(`Kích thước tệp vượt quá giới hạn ${maxMB}MB`);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        onAnswer({
                            answer_text: file.name,
                            answer_json: {
                                name: file.name,
                                size: file.size,
                                type: file.type,
                                dataUrl: typeof reader.result === 'string' ? reader.result : '',
                            },
                        });
                    };
                    reader.onerror = () => {
                        onAnswer({
                            answer_text: file.name,
                            answer_json: { name: file.name, size: file.size, type: file.type },
                        });
                    };
                    reader.readAsDataURL(file);
                };

                return (
                    <div
                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleFileSelect(e.dataTransfer.files?.[0]);
                        }}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center bg-slate-50 transition-colors hover:bg-slate-100"
                        style={{ borderColor: selectedFileName ? accent : undefined }}
                    >
                        <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <p className="text-sm font-semibold text-slate-600 mb-1">Click tải lên hoặc kéo thả tệp vào đây</p>
                        <p className="text-xs text-slate-400 mb-4">Các định dạng hỗ trợ: {(block.acceptedTypes ?? []).join(', ') || 'Tất cả'}. Tối đa {maxMB}MB</p>
                        <input
                            type="file"
                            className="hidden"
                            id={`file_${block.id}`}
                            accept={acceptAttr}
                            onChange={e => handleFileSelect(e.target.files?.[0])}
                        />
                        <div className="flex items-center gap-2">
                            <label htmlFor={`file_${block.id}`} className="px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 cursor-pointer transition-colors shadow-sm text-slate-700">
                                {selectedFileName ? 'Đổi tệp khác' : 'Chọn tệp'}
                            </label>
                            {selectedFileName && (
                                <button
                                    type="button"
                                    onClick={() => onAnswer({ answer_text: '', answer_json: undefined })}
                                    className="px-3 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                                >
                                    Xoá
                                </button>
                            )}
                        </div>
                        {selectedFileName && (
                            <p className="mt-3 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                                Đã chọn: {selectedFileName}
                            </p>
                        )}
                    </div>
                );
            })()}
            {hasError && (
                <p className="text-xs text-red-500 mt-2 font-medium">{errorMsg}</p>
            )}
        </div>
    );
};

export default PublicSurvey;

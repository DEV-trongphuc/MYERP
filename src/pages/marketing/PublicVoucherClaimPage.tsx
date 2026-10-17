import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Gift, CheckCircle2, AlertCircle, ArrowRight, Scan, ShieldCheck } from 'lucide-react';
import { EXTERNAL_API_BASE } from '../../components/marketing/utils/config';
import Button from '../../components/marketing/components/common/Button';
import Input from '../../components/marketing/components/common/Input';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import CanvasConfetti from '../../components/marketing/components/common/CanvasConfetti';

const PUBLIC_API = `${EXTERNAL_API_BASE}/voucher_claim.php`;

export const PublicClaim: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [campaign, setCampaign] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<any>(null); // { status, code, message }

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: ''
    });

    useEffect(() => {
        if (!id) return;
        fetch(`${PUBLIC_API}?action=info&id=${id}`)
            .then(r => r.json())
            .then(res => {
                if (res.success) setCampaign(res.data);
                else setCampaign(null);
                setLoading(false);
            }).catch(() => setLoading(false));
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.email) {
            toast.error('Vui lòng nhập Email hợp lệ!');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${PUBLIC_API}?action=claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voucher_id: id,
                    ...formData
                })
            }).then(r => { if (!r.ok) throw new Error("Claim failed"); return r.json(); });

            if (res.success) {
                // Determine if code is returned directly or pending (future proof)
                const finalResult = {
                    status: res.code ? 'approved' : 'pending',
                    code: res.code || (res.data ? res.data.code : undefined)
                };
                setResult(finalResult);
            } else {
                toast.error(res.message || 'Có lỗi xảy ra.');
            }
        } catch (error) {
            toast.error('Máy chủ không phản hồi.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F19] p-6">
                <div className="max-w-md w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/[0.07] rounded-[20px] shadow-sm p-8 space-y-6">
                    <div className="flex flex-col items-center space-y-3">
                        <div className="w-16 h-16 rounded-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                        <div className="h-7 w-48 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                        <div className="h-4 w-64 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[10px]" />
                    </div>
                    <div className="space-y-4">
                        <div className="h-11 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                        <div className="h-11 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                        <div className="h-11 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                        <div className="h-12 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px] mt-4" />
                    </div>
                </div>
            </div>
        );
    }

    if (!campaign) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-6">
                    <AlertCircle className="w-10 h-10" />
                </div>
                <h1 className="text-xl font-black text-slate-800">Không tìm thấy Ưu đãi</h1>
                <p className="text-sm text-slate-500 mt-2">Đường dẫn không hợp lệ hoặc chiến dịch đã tạm dừng.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-rose-50/60 to-slate-50 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-200/30 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-rose-100/40 blur-[100px] rounded-full -ml-48 -mb-48 pointer-events-none" />

            <div className="max-w-md w-full bg-white/90 backdrop-blur-2xl border border-slate-200/80 rounded-[18px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] p-8 sm:p-10 relative z-10 overflow-hidden">
                <AnimatePresence mode="wait">
                    {result ? (
                        <motion.div 
                            key="result"
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                            transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
                            className="text-center py-8 relative"
                        >
                            {result.status === 'approved' && <CanvasConfetti particleCount={150} />}
                            {result.status === 'pending' ? (
                                <>
                                    <motion.div 
                                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
                                        className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 relative"
                                    >
                                        <ShieldCheck className="w-12 h-12 text-[var(--color-primary)]" />
                                        <span className="absolute top-0 right-0 w-6 h-6 bg-rose-400 rounded-full animate-ping opacity-20"></span>
                                    </motion.div>
                                    <h2 className="text-2xl font-black text-slate-800 mb-3">Đã gửi yêu cầu nhận Mã!</h2>
                                    <p className="text-sm text-slate-600 mb-6 font-medium">Yêu cầu của bạn đang được duyệt. Mã ưu đãi sẽ được gửi qua Email <strong className="text-slate-800">{formData.email}</strong> nếu đủ điều kiện.</p>
                                </>
                            ) : (
                                <>
                                    <motion.div 
                                        initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                                        className="w-24 h-24 bg-gradient-to-tr from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner shadow-emerald-200/50"
                                    >
                                        <CheckCircle2 className="w-12 h-12 text-emerald-500 drop-shadow-md" />
                                    </motion.div>
                                    <h2 className="text-2xl font-black text-slate-800 mb-2">Chúc mừng bạn!</h2>
                                    <p className="text-sm text-slate-500 mb-6 font-medium">Bạn đã nhận ưu đãi thành công. Đây là mã của bạn:</p>

                                    <motion.div 
                                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                                        className="relative bg-gradient-to-r from-rose-50 via-white to-rose-50 border border-rose-200 rounded-[18px] p-6 mb-8 overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all"
                                        onClick={() => { navigator.clipboard.writeText(result.code); toast.success('Đã sao chép mã!'); }}
                                    >
                                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/80 to-transparent group-hover:animate-shimmer" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-primary)]/70 absolute top-2 left-1/2 transform -translate-x-1/2 bg-rose-50/50 backdrop-blur-sm px-3 rounded-full">Mã giảm giá</span>
                                        <p className="text-3xl font-black text-[var(--color-primary)] tracking-wider mt-2 font-mono select-all drop-shadow-sm">
                                            {result.code}
                                        </p>
                                        <div className="absolute inset-0 bg-[var(--color-primary)] text-white font-bold text-xs flex items-center justify-center rounded-[18px] opacity-0 group-hover:opacity-100 transition-all duration-300">Bấm để sao chép</div>
                                    </motion.div>

                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Đã gửi 1 bản sao vào Email của bạn.</p>
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                        >
                            <div className="text-center mb-8">
                                <motion.div 
                                    whileHover={{ rotate: 0, scale: 1.05 }}
                                    transition={{ type: 'spring' }}
                                    className="w-16 h-16 bg-white shadow-xl rounded-full flex items-center justify-center mx-auto mb-6 transform -rotate-12 border border-slate-100"
                                >
                                    {campaign.thumbnail_url ? (
                                        <img src={campaign.thumbnail_url} className="w-full h-full object-cover rounded-full" alt="Gift" />
                                    ) : (
                                        <Gift className="w-8 h-8 text-[var(--color-primary)]" />
                                    )}
                                </motion.div>
                                <h1 className="text-3xl font-black text-slate-800 tracking-tight leading-tight mb-3">
                                    {campaign.name}
                                </h1>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                    {campaign.description || 'Vui lòng cung cấp thông tin để xác nhận danh tính và nhận ngay ưu đãi từ chương trình.'}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input 
                                    label="Họ và Tên" 
                                    placeholder="Nhập tên của bạn" 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="bg-white/80 transition-shadow focus-within:shadow-md" 
                                />
                                <Input 
                                    label="Địa chỉ Email *" 
                                    type="email"
                                    placeholder="Cần chính xác để nhận mã" 
                                    value={formData.email} 
                                    onChange={e => setFormData({...formData, email: e.target.value})} 
                                    className="bg-white/80 transition-shadow focus-within:shadow-md" 
                                    required
                                />
                                <Input 
                                    label="Số điện thoại" 
                                    type="tel"
                                    placeholder="0901234567" 
                                    value={formData.phone} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                                    className="bg-white/80 transition-shadow focus-within:shadow-md" 
                                />

                                <motion.button 
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit" 
                                    disabled={submitting}
                                    className="w-full mt-6 bg-[var(--color-primary)] hover:opacity-95 text-white font-black uppercase tracking-widest text-sm py-3.5 rounded-[14px] shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-white/20 -translate-x-full skew-x-12 group-hover:animate-shimmer" />
                                    {submitting ? <Scan className="w-5 h-5 animate-pulse" /> : 'Nhận Mã Ngay'} 
                                    {!submitting && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                                </motion.button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <p className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                Secured by MYERP Anti-Fraud &trade;
            </p>
        </div>
    );
};

export default PublicClaim;

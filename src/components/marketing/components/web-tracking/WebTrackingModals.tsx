import { EXTERNAL_ASSET_BASE } from '../../utils/config';
import React from 'react';
import { Copy, Check } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import { WebProperty } from './types';
import ConfirmModal from '../common/ConfirmModal';
import Modal from '../common/Modal';

interface WebTrackingModalsProps {
    isAddOpen: boolean;
    setIsAddOpen: (open: boolean) => void;
    newSiteData: { name: string; domain: string };
    setNewSiteData: (data: { name: string; domain: string }) => void;
    handleAddWebsite: () => void;
    showScript: boolean;
    setShowScript: (show: boolean) => void;
    includeAiChat: boolean;
    setIncludeAiChat: (include: boolean) => void;
    selectedWebsite: WebProperty | null;
    copyScript: () => void;
    copied: boolean;

    // Delete Modal Props
    isDeleteOpen: boolean;
    setIsDeleteOpen: (open: boolean) => void;
    siteToDelete: WebProperty | null;
    confirmDeleteAction: () => void;
    isDarkTheme?: boolean;
}

const WebTrackingModals: React.FC<WebTrackingModalsProps> = ({
    isAddOpen,
    setIsAddOpen,
    newSiteData,
    setNewSiteData,
    handleAddWebsite,
    showScript,
    setShowScript,
    includeAiChat,
    setIncludeAiChat,
    selectedWebsite,
    copyScript,
    copied,
    isDeleteOpen,
    setIsDeleteOpen,
    siteToDelete,
    confirmDeleteAction,
    isDarkTheme
}) => {
    return (
        <>
            {/* Add Website Modal */}
            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                size="sm"
                isDarkTheme={isDarkTheme}
                title="Thêm Website Mới"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="px-6" isDarkTheme={isDarkTheme}>Hủy</Button>
                        <Button onClick={handleAddWebsite} className="px-8 shadow-none" isDarkTheme={isDarkTheme}>Kích hoạt ngay</Button>
                    </div>
                }
            >
                <div className="space-y-5 py-2">
                    <div>
                        <Input
                            label="Tên Website"
                            placeholder="VD: My Awesome Blog"
                            value={newSiteData.name}
                            onChange={(e) => setNewSiteData({ ...newSiteData, name: e.target.value })}
                            isDarkTheme={isDarkTheme}
                        />
                    </div>
                    <div>
                        <Input
                            label="Tên miền (Domain)"
                            placeholder="VD: example.com"
                            value={newSiteData.domain}
                            onChange={(e) => setNewSiteData({ ...newSiteData, domain: e.target.value })}
                            isDarkTheme={isDarkTheme}
                        />
                        <p className={`text-[10px] mt-2 ml-1 italic font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>* Chỉ dữ liệu từ domain này mới được hệ thống bảo mật chấp nhận.</p>
                    </div>
                </div>
            </Modal>

            {/* Script Modal */}
            <Modal
                isOpen={showScript && !!selectedWebsite}
                onClose={() => setShowScript(false)}
                size="lg"
                isDarkTheme={isDarkTheme}
                title="Cài đặt Mã theo dõi"
                footer={
                    <div className="flex justify-end w-full">
                        <Button onClick={() => setShowScript(false)} className="px-10 shadow-none h-12" isDarkTheme={isDarkTheme}>Đóng</Button>
                    </div>
                }
            >
                {selectedWebsite && (
                    <div className="space-y-6 py-2">
                        <p className={`text-sm leading-relaxed ${isDarkTheme ? 'text-slate-450' : 'text-slate-500'}`}>
                            Sao chép đoạn mã dưới đây và dán vào trước thẻ đóng <code className={`font-bold rounded px-1.5 ${isDarkTheme ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>&lt;/head&gt;</code> trên website của bạn để bắt đầu thu thập dữ liệu và kích hoạt hệ thống bảo mật.
                        </p>

                        <div className={`border rounded-[14px] p-4 flex items-center justify-between group ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border group-hover:scale-105 transition-transform ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    {includeAiChat ? (
                                        <div className="animate-in zoom-in duration-300">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.484 3.53 1.331 5L2 22l5-1.331C8.47 21.516 10.179 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <span className={`text-[10px] font-black uppercase ${isDarkTheme ? 'text-slate-600' : 'text-slate-300'}`}>OFF</span>
                                    )}
                                </div>
                                <div>
                                    <h4 className={`text-sm font-black uppercase tracking-tight ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Tích hợp AI Chatbot</h4>
                                    <p className={`text-[10px] font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>Kích hoạt cửa sổ chat hỗ trợ Khách hàng ngay lập tức.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIncludeAiChat(!includeAiChat)}
                                className={`relative w-12 h-6 rounded-full transition-colors duration-205 outline-none ${includeAiChat ? 'bg-[var(--color-primary)]' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 shadow-sm ${includeAiChat ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className={`rounded-[14px] p-6 relative group border shadow-inner ${isDarkTheme ? 'bg-slate-950 border-slate-850' : 'bg-slate-900 border-slate-805'}`}>
                            <pre className={`font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all leading-relaxed ${isDarkTheme ? 'text-slate-350' : 'text-slate-300'}`}>
                                {includeAiChat ? (
                                    `<!-- MailFlow Pro Tracker & AI Chat -->
<script>
  window._mf_config = {
    property_id: "${selectedWebsite.id}",
    ai_chat: true
  };
</script>
<script src="${EXTERNAL_ASSET_BASE}/tracker.js" async></script>`
                                ) : (
                                    `<!-- MailFlow Pro Tracker -->
<script src="${EXTERNAL_ASSET_BASE}/tracker.js" data-website-id="${selectedWebsite.id}" async></script>`
                                )}
                            </pre>
                            <button
                                onClick={copyScript}
                                className={`absolute top-4 right-4 p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-95 border ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800' : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'}`}
                            >
                                {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Security Features Highlight - Simple & Sophisticated */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { title: 'Domain Lockdown', desc: `Chỉ chấp nhận dữ liệu từ domain <b>${selectedWebsite.domain}</b>. Chặn tuyệt đối mã nhúng lậu.` },
                                { title: 'Smart Anti-DDoS', desc: 'Tự động phát hiện và ngăn chặn các đợt tấn công flood bot, bảo vệ băng thông website.' },
                                { title: 'AI Security Shield', desc: 'Lớp màng bảo vệ WAF lọc bỏ lưu lượng truy cập ảo, đảm bảo dữ liệu luôn làm sạch và an toàn.' },
                                { title: 'Privacy Compliance', desc: 'Mã hóa dữ liệu định danh theo chuẩn quốc tế, bảo vệ quyền riêng tư người dùng tối đa.' }
                            ].map((feat, i) => (
                                <div key={i} className={`p-4 border rounded-[14px] group/feat transition-all duration-300 ${isDarkTheme ? 'bg-slate-900 border-slate-850 hover:bg-slate-850/30 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-300'}`}>
                                    <h4 className={`flex items-center gap-2 font-bold text-sm mb-1.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isDarkTheme ? 'bg-slate-600 group-hover/feat:bg-slate-400' : 'bg-slate-400 group-hover/feat:bg-slate-600'}`}></div>
                                        {feat.title}
                                    </h4>
                                    <p className={`text-xs leading-relaxed font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`} dangerouslySetInnerHTML={{ __html: feat.desc }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            {/* DELETE CONFIRMATION MODAL */}
            <ConfirmModal
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDeleteAction}
                isDarkTheme={isDarkTheme}
                title="Xác nhận xóa dữ liệu"
                message={
                    <span>
                        Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu của website <span className="text-slate-900 font-bold">{siteToDelete?.name}</span>. Không thể hoàn tác.
                    </span>
                }
                confirmLabel="Xác nhận xóa"
                variant="danger"
                requireConfirmText={siteToDelete?.domain || ''}
                confirmPlaceholder="Nhập tên miền để xác nhận"
            />
        </>
    );
};

export default WebTrackingModals;

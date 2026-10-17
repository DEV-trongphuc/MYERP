import React from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { Trash2, FolderPlus, Save, Globe, Info, Zap, ArrowRight, Braces, List, CheckCircle2, Cpu, ExternalLink, Share2, Bot, HelpCircle, Building, Sparkles, X, BrainCircuit, Image as ImageIcon, FileText, Search, Edit2, BookOpen, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface AIModalsProps {
    isDeleteModalOpen: boolean;
    setIsDeleteModalOpen: (o: boolean) => void;
    confirmDelete: () => void;
    deleteTarget?: { id?: string; batchId?: string; name?: string; docType?: string } | null;
    loading: boolean;

    isFolderModalOpen: boolean;
    setIsFolderModalOpen: (o: boolean) => void;
    handleCreateFolder: () => void;
    folderName: string;
    setFolderName: (s: string) => void;

    isEditFolderModalOpen: boolean;
    setIsEditFolderModalOpen: (o: boolean) => void;
    setEditingFolder: (f: any) => void;
    handleUpdateFolder: () => void;

    infoDoc: any;
    setInfoDoc: (d: any) => void;
    tagInput: string;
    setTagInput: (s: string) => void;
    handleSaveTags: () => void;

    isOptimizationModalOpen: boolean;
    setIsOptimizationModalOpen: (o: boolean) => void;

    isEmbeddingModalOpen: boolean;
    setIsEmbeddingModalOpen: (o: boolean) => void;

    isTipsModalOpen: boolean;
    setIsTipsModalOpen: (o: boolean) => void;

    isBulkMoveModalOpen: boolean;
    setIsBulkMoveModalOpen: (o: boolean) => void;
    bulkActionType: 'copy' | 'move' | null;
    chatbots: any[];
    properties: any[];
    selectedProperty: string;
    targetPropertyId: string;
    setTargetPropertyId: (id: string) => void;
    handleBulkMoveOrCopy: () => void;

    isBulkDeleteConfirmModalOpen: boolean;
    setIsBulkDeleteConfirmModalOpen: (o: boolean) => void;
    deleteVerifyText: string;
    setDeleteVerifyText: (s: string) => void;
    confirmBulkDelete: () => void;

    isCreateCategoryModalOpen: boolean;
    setIsCreateCategoryModalOpen: (o: boolean) => void;
    newCategoryName: string;
    setNewCategoryName: (s: string) => void;
    newCategoryDesc: string;
    setNewCategoryDesc: (s: string) => void;
    newCategoryAvatar: string;
    setNewCategoryAvatar: (s: string) => void;
    newCategoryColor: string;
    setNewCategoryColor: (s: string) => void;
    newCategoryApiKey: string;
    setNewCategoryApiKey: (s: string) => void;
    newCategorySlug: string;
    setNewCategorySlug: (s: string) => void;
    handleCreateCategory: () => void;

    isEditCategoryModalOpen: boolean;
    setIsEditCategoryModalOpen: (o: boolean) => void;
    editingCategory: any;
    setEditingCategory: (c: any) => void;
    handleUpdateCategory: () => void;

    isCreateBotModalOpen: boolean;
    setIsCreateBotModalOpen: (o: boolean) => void;
    newBotName: string;
    setNewBotName: (s: string) => void;
    newBotDesc: string;
    setNewBotDesc: (s: string) => void;
    handleCreateBot: () => void;

    isEditBotModalOpen: boolean;
    setIsEditBotModalOpen: (o: boolean) => void;
    editingBot: any;
    setEditingBot: (b: any) => void;
    newBotColor: string;
    setNewBotColor: (s: string) => void;
    newBotApiKey: string;
    setNewBotApiKey: (s: string) => void;
    newBotAvatar: string;
    setNewBotAvatar: (s: string) => void;
    newBotSlug: string;
    setNewBotSlug: (s: string) => void;
    handleUpdateBot: () => void;

    isShareLinkModalOpen: boolean;
    setIsShareLinkModalOpen: (o: boolean) => void;
    shareLinkToCopy: string;

    isDeleteConfirmModalOpen: boolean;
    setIsDeleteConfirmModalOpen: (o: boolean) => void;
    deleteConfig: any;
    deleteConfirmText: string;
    setDeleteConfirmText: (s: string) => void;

    brandColor?: string;
    confirmDeleteChatbot: (id: string) => void;
    confirmDeleteCategory: (id: string) => void;

    isSynonymsModalOpen: boolean;
    setIsSynonymsModalOpen: (o: boolean) => void;
    synonyms: any;
    newSynKey: string;
    setNewSynKey: (s: string) => void;
    newSynValues: string;
    setNewSynValues: (s: string) => void;
    handleAddSynonym: () => void;
    startEditSynonym: (k: string, v: any) => void;
    handleDeleteSynonym: (k: string) => void;
    editingSynKey: string | null;
    setEditingSynKey: (k: string | null) => void;
    editSynKeyVal: string;
    setEditSynKeyVal: (s: string) => void;
    editSynValuesVal: string;
    setEditSynValuesVal: (s: string) => void;
    handleSaveSynonymEdit: () => void;
    cancelEditSynonym: () => void;
    handleSaveSynonyms: () => void;
    handleAutoLearnSynonyms: () => void;

    newQuickAction: string;
    setNewQuickAction: (s: string) => void;
    addQuickAction: () => void;
    removeQuickAction: (index: number) => void;

    setIsTargetDropdownOpen?: (o: boolean) => void;
    isTargetDropdownOpen?: boolean;

    isAddModalOpen: boolean;
    setIsAddModalOpen: (o: boolean) => void;
    handleAddManual: () => void;
    groupedDocs: any[];
    newDoc: any;
    setNewDoc: (doc: any) => void;
    isEditModalOpen: boolean;
    setIsEditModalOpen: (o: boolean) => void;
    handleUpdateDoc: () => void;
    editingDoc: any;
    setEditingDoc: (doc: any) => void;
    isDarkTheme?: boolean;
}

const AIModals: React.FC<AIModalsProps> = (props) => {
    const {
        isDeleteModalOpen, setIsDeleteModalOpen, confirmDelete, deleteTarget, loading,
        isFolderModalOpen, setIsFolderModalOpen, handleCreateFolder, folderName, setFolderName,
        isEditFolderModalOpen, setIsEditFolderModalOpen, setEditingFolder, handleUpdateFolder,
        infoDoc, setInfoDoc, tagInput, setTagInput, handleSaveTags,
        isOptimizationModalOpen, setIsOptimizationModalOpen,
        isEmbeddingModalOpen, setIsEmbeddingModalOpen,
        isTipsModalOpen, setIsTipsModalOpen,
        isBulkMoveModalOpen, setIsBulkMoveModalOpen, bulkActionType, chatbots, targetPropertyId, setTargetPropertyId, handleBulkMoveOrCopy,
        isBulkDeleteConfirmModalOpen, setIsBulkDeleteConfirmModalOpen, deleteVerifyText, setDeleteVerifyText, confirmBulkDelete,
        isCreateCategoryModalOpen, setIsCreateCategoryModalOpen, newCategoryName, setNewCategoryName, newCategoryDesc, setNewCategoryDesc, newCategoryAvatar, setNewCategoryAvatar, newCategoryColor, setNewCategoryColor, newCategoryApiKey, setNewCategoryApiKey, newCategorySlug, setNewCategorySlug, handleCreateCategory,
        isEditCategoryModalOpen, setIsEditCategoryModalOpen, editingCategory, setEditingCategory, handleUpdateCategory,
        isCreateBotModalOpen, setIsCreateBotModalOpen, newBotName, setNewBotName, newBotDesc, setNewBotDesc, handleCreateBot,
        isEditBotModalOpen, setIsEditBotModalOpen, editingBot, setEditingBot, newBotColor, setNewBotColor, newBotApiKey, setNewBotApiKey, newBotAvatar, setNewBotAvatar, newBotSlug, setNewBotSlug, handleUpdateBot,
        isShareLinkModalOpen, setIsShareLinkModalOpen, shareLinkToCopy,
        isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen, deleteConfig, deleteConfirmText, setDeleteConfirmText, confirmDeleteChatbot, confirmDeleteCategory,
        isSynonymsModalOpen, setIsSynonymsModalOpen, synonyms, newSynKey, setNewSynKey, newSynValues, setNewSynValues, handleAddSynonym, startEditSynonym, handleDeleteSynonym, editingSynKey, setEditingSynKey, editSynKeyVal, setEditSynKeyVal, editSynValuesVal, setEditSynValuesVal, handleSaveSynonymEdit, handleSaveSynonyms, handleAutoLearnSynonyms,
        brandColor = '#a33025', isDarkTheme
    } = props;

    return (
        <>
            {/* Modal: Confirm Delete */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Xác nhận xóa tài liệu"
                size="sm"
                isDarkTheme={isDarkTheme}
                footer={
                    <div className="flex justify-between w-full">
                        <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)} isDarkTheme={isDarkTheme}>Hủy bỏ</Button>
                        <Button variant="danger" icon={Trash2} onClick={confirmDelete} isLoading={loading} isDarkTheme={isDarkTheme}>Xóa vĩnh viễn</Button>
                    </div>
                }
            >
                <div className="py-4 space-y-4">
                    {/* Icon + title */}
                    <div className="text-center">
                        <div className={`w-16 h-16 rounded-[14px] flex items-center justify-center mx-auto mb-3 ${isDarkTheme ? 'bg-rose-500/10 text-rose-500' : 'bg-rose-50 text-rose-500'}`}>
                            <Trash2 className="w-8 h-8" />
                        </div>
                        <p className={`text-sm font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Bạn có chắc chắn muốn xóa?</p>
                        {deleteTarget?.name && (
                            <p className={`text-xs mt-1 font-mono px-3 py-1 rounded-lg inline-block mt-2 ${isDarkTheme ? 'bg-slate-800 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>
                                📄 {deleteTarget.name}
                            </p>
                        )}
                    </div>

                    {/* Consequences warning */}
                    <div className={`rounded-xl border p-4 space-y-2.5 ${isDarkTheme ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-rose-400' : 'text-rose-500'}`}>⚠️ Hậu quả khi xóa</p>
                        <ul className={`space-y-1.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>
                            {(deleteTarget?.docType === 'folder' || deleteTarget?.batchId) ? (
                                <>
                                    <li className="flex items-start gap-2 text-xs">
                                        <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                        <span>Toàn bộ tài liệu trong thư mục này sẽ bị xóa vĩnh viễn.</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-xs">
                                        <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                        <span>AI sẽ mất toàn bộ kiến thức từ nhóm dữ liệu này ngay lập tức.</span>
                                    </li>
                                </>
                            ) : deleteTarget?.docType === 'pdf' || deleteTarget?.name?.toLowerCase().endsWith('.pdf') ? (
                                <>
                                    <li className="flex items-start gap-2 text-xs">
                                        <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                        <span>File PDF và tất cả các chunk dữ liệu đã được trích xuất từ file này sẽ bị <strong>xóa vĩnh viễn</strong>.</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-xs">
                                        <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                        <span>AI sẽ <strong>không còn nhớ</strong> bất kỳ nội dung nào từ tài liệu PDF này.</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-xs">
                                        <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                        <span>Các câu trả lời liên quan đến nội dung PDF này sẽ bị ảnh hưởng hoặc sai lệch.</span>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className="flex items-start gap-2 text-xs">
                                        <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                        <span>Khối kiến thức này sẽ bị <strong>xóa vĩnh viễn</strong> và không thể khôi phục.</span>
                                    </li>
                                    <li className="flex items-start gap-2 text-xs">
                                        <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                        <span>AI sẽ mất đi phần kiến thức này và có thể trả lời sai các câu hỏi liên quan.</span>
                                    </li>
                                </>
                            )}
                            <li className="flex items-start gap-2 text-xs">
                                <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                <span className="font-semibold">Hành động này không thể hoàn tác.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </Modal>

            {/* Modal: Create Folder */}
            <Modal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                title="Tạo Thư Mục Mới"
                size="sm"
                isDarkTheme={isDarkTheme}
                footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => setIsFolderModalOpen(false)} isDarkTheme={isDarkTheme}>Hủy</Button><Button className={`font-bold border-none shadow-md hover:shadow-lg transition-all ${isDarkTheme ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'}`} icon={FolderPlus} onClick={handleCreateFolder} isLoading={loading} isDarkTheme={isDarkTheme}>Tạo thư mục</Button></div>}
            >
                <div className="py-4 space-y-4">
                    <Input
                        label="Tên thư mục / Nhóm"
                        placeholder="VD: Sản phẩm mới, Quy định bảo hành..."
                        value={folderName}
                        onChange={e => setFolderName(e.target.value)}
                        autoFocus
                        isDarkTheme={isDarkTheme}
                    />
                    <p className={`text-[10px] italic ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>Thư mục giúp bạn nhóm các dữ liệu liên quan để dễ quản lý.</p>
                </div>
            </Modal>

            {/* Modal: Edit Folder */}
            <Modal
                isOpen={isEditFolderModalOpen}
                onClose={() => { setIsEditFolderModalOpen(false); setEditingFolder(null); setFolderName(''); }}
                title="Đổi Tên Thư Mục"
                size="sm"
                isDarkTheme={isDarkTheme}
                footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => { setIsEditFolderModalOpen(false); setEditingFolder(null); setFolderName(''); }} isDarkTheme={isDarkTheme}>Hủy</Button><Button className={`font-bold border-none shadow-md hover:shadow-lg transition-all duration-500 ${isDarkTheme ? 'bg-gradient-to-r from-[#BD1D2D] to-[#9A1523] text-white' : 'bg-gradient-to-r from-[#BD1D2D] to-[#9A1523] text-white'}`} icon={Save} onClick={handleUpdateFolder} isLoading={loading} isDarkTheme={isDarkTheme}>Lưu Thay Đổi</Button></div>}
            >
                <div className="py-4 space-y-4">
                    <Input
                        label="Tên thư mục / Nhóm"
                        placeholder="VD: Sản phẩm mới, Quy định bảo hành..."
                        value={folderName}
                        onChange={e => setFolderName(e.target.value)}
                        autoFocus
                        isDarkTheme={isDarkTheme}
                    />
                </div>
            </Modal>

            {/* Modal: Info Detail */}
            <Modal
                isOpen={!!infoDoc}
                onClose={() => setInfoDoc(null)}
                title="Thông tin chi tiết khối dữ liệu"
                size="md"
                isDarkTheme={isDarkTheme}
            >
                {infoDoc && (
                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className={`p-4 rounded-[14px] border ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Thời gian cào</label>
                                <p className={`text-xs font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{new Date(infoDoc.created_at).toLocaleString()}</p>
                            </div>
                            <div className={`p-4 rounded-[14px] border ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Định danh đợt (Batch)</label>
                                <p className={`text-[10px] font-bold break-all ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>{infoDoc._meta?.batch_id || 'N/A'}</p>
                            </div>
                        </div>

                        {/* TAGS EDITOR */}
                        <div className={`p-4 rounded-[14px] border ${isDarkTheme ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                            <label className={`text-[9px] font-black uppercase tracking-widest block mb-2 ${isDarkTheme ? 'text-emerald-500/70' : 'text-emerald-400'}`}>
                                TAGS PHÂN LOẠI (Hỗ trợ AI tìm kiếm)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className={`flex-1 text-xs font-bold border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${isDarkTheme ? 'bg-slate-900 text-slate-200 border-slate-700' : 'bg-white text-slate-700 border-emerald-200'}`}
                                    placeholder="VD: EMBA, HocPhi, MonHoc (cách nhau dấu phẩy)"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                />
                                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white border-none" icon={Save} onClick={handleSaveTags} isLoading={loading} isDarkTheme={isDarkTheme}>Lưu</Button>
                            </div>
                            <div className={`mt-3 p-2 rounded-lg border flex gap-2 ${isDarkTheme ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/50 border-emerald-100'}`}>
                                <Info className={`w-3 h-3 shrink-0 mt-0.5 ${isDarkTheme ? 'text-emerald-500' : 'text-emerald-400'}`} />
                                <p className={`text-[9px] leading-relaxed ${isDarkTheme ? 'text-emerald-200/70' : 'text-emerald-700'}`}>
                                    Tag giúp AI bắt được đúng tài liệu khi khách hỏi ngắn hoặc hỏi nhanh.
                                    <br />VD: Gắn tag <span className={`font-bold font-mono ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-800'}`}>maubang</span> cho các file chứa hình ảnh mẫu văn bằng.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Các liên kết có trong khối này ({infoDoc._meta?.urls?.length || 0})</label>
                            <div className={`p-4 rounded-[14px] border max-h-60 overflow-y-auto custom-scrollbar ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
                                {infoDoc._meta?.urls ? (
                                    <div className="space-y-2">
                                        {infoDoc._meta.urls.map((u: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 group">
                                                <Globe className="w-3 h-3 text-slate-500 group-hover:text-emerald-500 transition-colors" />
                                                <span className={`text-[10px] font-medium truncate ${isDarkTheme ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-300'}`} title={u}>{u}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-500 italic">Không tìm thấy danh sách link chi tiết.</p>
                                )}
                            </div>
                        </div>

                        <div className={`p-4 border rounded-[14px] flex gap-3 ${isDarkTheme ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                            <Zap className="w-5 h-5 text-emerald-500 shrink-0" />
                            <p className={`text-[10px] font-medium leading-relaxed ${isDarkTheme ? 'text-emerald-200/70' : 'text-emerald-900'}`}>
                                Khối dữ liệu này chứa nội dung từ các trang web liệt kê phía trên. Dữ liệu này đã được AI Vector hóa để phản hồi Khách hàng.
                            </p>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={isOptimizationModalOpen}
                onClose={() => setIsOptimizationModalOpen(false)}
                title="Gợi ý tối ưu dữ liệu huấn luyện (RAG)"
                size="lg"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    <a
                        href="https://ai.google.dev/gemini-api/docs/prompting-strategies?hl=vi"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-4 rounded-[14px] border flex items-center gap-3 transition-all group cursor-pointer no-underline mb-4 ${isDarkTheme ? 'bg-slate-900 border-slate-800 hover:shadow-slate-950/50 hover:border-blue-500/30 hover:bg-slate-800/50' : 'bg-white border-slate-200 hover:shadow-lg hover:border-blue-200'}`}
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 text-white group-hover:scale-110 transition-transform">
                            <ArrowRight className="w-4 h-4 -rotate-45" />
                        </div>
                        <div>
                            <h4 className={`text-[11px] font-bold transition-colors ${isDarkTheme ? 'text-slate-200 group-hover:text-blue-400' : 'text-slate-700 group-hover:text-blue-600'}`}>Tài liệu Prompting Strategies (Google)</h4>
                            <p className={`text-[10px] mt-0.5 ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>Xem hướng dẫn chính thức để tối ưu hóa câu lệnh cho AI.</p>
                        </div>
                    </a>

                    <div className={`p-4 rounded-[14px] border flex items-start gap-4 ${isDarkTheme ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-100/50'}`}>
                        <Zap className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className={`text-xs leading-relaxed font-medium ${isDarkTheme ? 'text-emerald-300' : 'text-slate-600'}`}>
                            Dữ liệu đầu vào chất lượng quyết định 80% độ thông minh của AI. Hãy cấu trúc văn bản theo cách AI dễ "tìm thấy" nhất.
                        </p>
                    </div>


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`p-5 border rounded-[18px] space-y-3 shadow-sm ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <h5 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                                <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><Braces className="w-3 h-3 text-emerald-500" /></div>
                                Ngữ cảnh độc lập
                            </h5>
                            <p className={`text-[11px] leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                Đảm bảo mỗi đoạn văn bản đều đầy đủ ý. Thay vì ghi <span className={`font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>"Giá nó là 5tr"</span>, hãy ghi <span className={`font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>"Giá của khóa đào tạo EMBA là 5 triệu VNĐ"</span>.
                            </p>
                        </div>
                        <div className={`p-5 border rounded-[18px] space-y-3 shadow-sm ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <h5 className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                                <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}><List className="w-3 h-3 text-emerald-500" /></div>
                                Cấu trúc Q&A
                            </h5>
                            <p className={`text-[11px] leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                Định dạng Hỏi - Đáp (Ví dụ: "Hỏi: [Câu hỏi]? Đáp: [Câu trả lời]") giúp AI so khớp các vector câu hỏi của người dùng cực kỳ chính xác.
                            </p>
                        </div>
                    </div>

                    <div className={`p-5 rounded-[18px] border ${isDarkTheme ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/80 border-slate-200/50'}`}>
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Checklist "Vàng" cho Content:</h5>
                        <ul className="space-y-3">
                            {[
                                'Sử dụng gạch đầu dòng cho các thông số, danh sách tính năng.',
                                'Giới hạn mỗi đoạn/file không quá 15.000 ký tự để tối ưu tốc độ.',
                                'Lặp lại từ khóa chính (Tên sản phẩm/dịch vụ) trong từng đoạn.',
                                'Loại bỏ ký tự rác, format bảng biểu phức tạp trước khi nạp.'
                            ].map((item, id) => (
                                <li key={id} className={`flex items-start gap-3.5 text-[11px] font-medium leading-[1.6] ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${isDarkTheme ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <CheckCircle2 className={`w-3 h-3 ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-600'}`} />
                                    </div>
                                    <span className="flex-1">{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </Modal>

            {/* Modal: Giải thích Embedding & Similarity Score */}
            <Modal
                isOpen={isEmbeddingModalOpen}
                onClose={() => setIsEmbeddingModalOpen(false)}
                title="Training AI & Similarity Score"
                size="lg"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    <div className="space-y-5">
                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 border ${isDarkTheme ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                <Cpu className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className={`text-sm font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Embedding là gì?</h4>
                                <p className={`text-[11px] leading-relaxed mt-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                    AI không đọc chữ như con người. Nó biến văn bản thành các tọa độ <span className="text-blue-500 font-bold">768 chiều</span>. Các câu có ý nghĩa giống nhau sẽ nằm gần nhau trong không gian này.
                                </p>
                            </div>
                        </div>

                        {/* Animated Vector Visualization */}
                        <div className={`relative h-32 rounded-[18px] overflow-hidden border shadow-inner group ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
                            <style>{`
                                @keyframes float-dot {
                                    0% { transform: translate(0, 0); opacity: 0; }
                                    20% { opacity: 0.4; }
                                    80% { opacity: 0.4; }
                                    100% { transform: translate(var(--tw-translateX), var(--tw-translateY)); opacity: 0; }
                                }
                                .animate-float-dot {
                                    animation: float-dot linear infinite;
                                }
                            `}</style>

                            {/* Background Particles */}
                            <div className="absolute inset-0 opacity-30">
                                {[...Array(15)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-1 h-1 bg-blue-400 rounded-full animate-float-dot"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `${Math.random() * 100}%`,
                                            '--tw-translateX': `${(Math.random() - 0.5) * 100}px`,
                                            '--tw-translateY': `${(Math.random() - 0.5) * 100}px`,
                                            animationDuration: `${3 + Math.random() * 5}s`,
                                            animationDelay: `${Math.random() * 5}s`
                                        } as any}
                                    />
                                ))}
                            </div>

                            <div className="relative z-10 h-full flex items-center justify-between px-8">
                                <div className="text-center group-hover:scale-105 transition-transform">
                                    <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Input Text</div>
                                    <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-100 font-bold">
                                        "Chào bạn"
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-1 group-hover:px-4 transition-all duration-500">
                                    <div className="text-[8px] text-slate-600 font-bold">MODE: text-embedding-004</div>
                                    <ArrowRight className="w-5 h-5 text-blue-500 animate-pulse" />
                                </div>

                                <div className="text-center group-hover:scale-105 transition-transform">
                                    <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-1">Vector Coordinates</div>
                                    <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-100 font-mono">
                                        [0.12, -0.45, ...]
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Lines */}
                            <div className="absolute top-0 right-0 p-4">
                                <div className="flex gap-1">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="w-1 h-1 bg-blue-500/20 rounded-full" />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 border ${isDarkTheme ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-100'}`}>
                                <Search className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className={`text-sm font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Similarity Score (Điểm tương đồng)</h4>
                                <p className={`text-[11px] leading-relaxed mt-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                    Là chỉ số (từ 0 đến 1) thể hiện độ "giống nhau" về ý nghĩa giữa câu hỏi của khách và kiến thức. Điểm càng cao nghĩa là AI càng "kén chọn" thông tin.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Lựa chọn chỉ số thông minh:</h5>

                        <div className="relative space-y-3">
                            {/* Timeline Connector */}
                            <div className={`absolute left-[25px] top-4 bottom-8 w-0.5 ${isDarkTheme ? 'bg-gradient-to-b from-slate-800 via-slate-700 to-transparent' : 'bg-gradient-to-b from-slate-100 via-slate-200 to-transparent'}`} />

                            {[
                                {
                                    range: '0.3 - 0.45',
                                    label: 'Tìm rộng',
                                    desc: 'Dễ gặp ảo giác',
                                    color: 'blue',
                                    bg: 'bg-blue-500',
                                    border: 'border-blue-200',
                                    text: 'text-blue-600',
                                    icon: Globe
                                },
                                {
                                    range: '0.5 - 0.65',
                                    label: 'Còn bằng',
                                    desc: 'Khuyên dùng (Optimal)',
                                    color: 'emerald',
                                    bg: 'bg-emerald-500',
                                    border: 'border-emerald-200',
                                    text: 'text-emerald-600',
                                    icon: Zap,
                                    isRecommended: true
                                },
                                {
                                    range: '0.7 - 0.9',
                                    label: 'Tìm chặt',
                                    desc: 'Chính xác từng chữ',
                                    color: 'indigo',
                                    bg: 'bg-indigo-500',
                                    border: 'border-indigo-200',
                                    text: 'text-indigo-600',
                                    icon: Search
                                }
                            ].map((item, idx) => (
                                <div key={idx} className="relative z-10 flex items-center gap-4 group py-1">
                                    {/* Timeline Node */}
                                    <div className={`w-12 h-12 rounded-full border-[3px] flex items-center justify-center shrink-0 transition-all shadow-sm z-20 ${item.isRecommended
                                        ? (isDarkTheme ? 'border-emerald-900 bg-emerald-950' : 'border-emerald-100 bg-emerald-50')
                                        : (isDarkTheme ? 'border-slate-800 bg-slate-900' : 'border-white bg-slate-50')}`}>
                                        <div className={`w-8 h-8 rounded-full ${isDarkTheme ? 'bg-opacity-20' : 'bg-opacity-10'} ${item.bg} flex items-center justify-center`}>
                                            <item.icon className={`w-4 h-4 ${item.text}`} />
                                        </div>
                                        {item.isRecommended && (
                                            <div className={`absolute -right-1 -top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 flex items-center justify-center ${isDarkTheme ? 'border-slate-900' : 'border-white'}`}>
                                                <CheckCircle2 className="w-2 h-2 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Card */}
                                    <div className={`flex-1 flex items-center justify-between p-3 rounded-[14px] border transition-all duration-300 ${item.isRecommended
                                        ? (isDarkTheme ? 'bg-emerald-500/5 border-emerald-500/20 shadow-sm' : 'bg-emerald-50/20 border-emerald-200/60 shadow-sm')
                                        : (isDarkTheme ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200')
                                        }`}>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className={`text-[11px] font-black uppercase tracking-wide ${item.text}`}>{item.label}</span>
                                                {item.isRecommended && <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${isDarkTheme ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>Recommended</span>}
                                            </div>
                                            <p className={`text-[10px] font-medium truncate ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>{item.desc}</p>
                                        </div>
                                        <div className={`ml-4 px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {item.range}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={`p-4 rounded-[14px] border flex items-start gap-3 ${isDarkTheme ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100/50'}`}>
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-sm ${isDarkTheme ? 'bg-slate-900 border-indigo-500/20' : 'bg-white border-indigo-100'}`}>
                            <Info className="w-4 h-4 text-indigo-500" />
                        </div>
                        <p className={`text-[10px] italic leading-relaxed font-medium ${isDarkTheme ? 'text-indigo-300' : 'text-indigo-700'}`}>
                            Mẹo vận hành: Nếu AI hay báo "Không biết", hãy <span className="underline decoration-2 underline-offset-2">HẠ Score</span> này xuống. Nếu AI hay trả lời lạc đề, hãy <span className="underline decoration-2 underline-offset-2">TĂNG Score</span> lên.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Modal: Tips & Smart Links */}
            <Modal
                isOpen={isTipsModalOpen}
                onClose={() => setIsTipsModalOpen(false)}
                title="Mẹo Chatbox: Nhận diện Link, Ảnh & File"
                size="md"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-8 py-4">
                    {/* Intro */}
                    <div className={`p-5 rounded-[2rem] border flex gap-4 items-center shadow-inner ${isDarkTheme ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100/50'}`}>
                        <div className={`w-14 h-14 rounded-[14px] shadow-sm flex items-center justify-center shrink-0 ${isDarkTheme ? 'bg-slate-900 text-emerald-400' : 'bg-white text-emerald-500'}`}>
                            <Sparkles className="w-7 h-7 animate-pulse" />
                        </div>
                        <p className={`text-xs font-bold leading-relaxed ${isDarkTheme ? 'text-emerald-300' : 'text-emerald-800'}`}>
                            BOX thông minh có khả năng tự động "biến" các đường Link trong kho kiến thức của bạn thành giao diện trực quan cực đẹp trong Chatbox.
                        </p>
                    </div>

                    {/* Links Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border italic font-black text-xs ${isDarkTheme ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-500 border-blue-100'}`}>01</div>
                            <h4 className={`text-[11px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Link Website (Nút bấm thông minh)</h4>
                        </div>
                        <p className="text-[11px] text-slate-500 pl-11">
                            Nếu kiến thức có Link Web, Chatbox sẽ tự trích xuất thành **Nút mời bấm lớn** ở dưới cùng để khách dễ thấy.
                        </p>

                        <div className={`ml-11 border rounded-[14px] p-4 space-y-3 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`p-3 rounded-xl border border-dashed text-[10px] font-mono italic ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-400'}`}>
                                "Xem thêm tại: https://ideas.edu.vn/kho-hang"
                            </div>
                            <div className={`p-4 rounded-[14px] rounded-tl-none shadow-xl ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-900'}`}>
                                <div className={`backdrop-blur-md rounded-xl p-3 flex items-center justify-between border ${isDarkTheme ? 'bg-white/5 border-white/10' : 'bg-white/10 border-white/20'}`}>
                                    <div className="flex flex-col min-w-0 pr-2">
                                        <span className="text-[8px] font-bold text-white/50 uppercase">Đường dẫn đề xuất</span>
                                        <span className="text-[10px] font-bold text-white truncate">Truy cập liên kết</span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Image Link */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100 italic font-black text-xs">02</div>
                            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700">Link Ảnh (Tự hiện ảnh)</h4>
                        </div>
                        <p className="text-[11px] text-slate-500 pl-11">
                            Link kết thúc bằng <span className="font-bold text-rose-600">.jpg, .png, .webp...</span> sẽ tự động hiện thành ảnh xem trực tiếp ngay trong chat.
                        </p>

                        <div className={`ml-11 border rounded-[14px] p-4 space-y-3 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`p-3 rounded-xl border border-dashed text-[10px] font-mono italic ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-400'}`}>
                                "Ảnh mẫu: https://domain.com/san-pham.jpg"
                            </div>
                            <div className={`p-1 rounded-xl border shadow-sm overflow-hidden w-40 ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                                <div className="w-full h-24 bg-gradient-to-br from-emerald-400 to-teal-400 rounded-lg flex items-center justify-center"><ImageIcon className="w-8 h-8 text-white/80" /></div>
                            </div>
                        </div>
                    </div>

                    {/* 3. File Link */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border italic font-black text-xs ${isDarkTheme ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-blue-50 text-blue-500 border-blue-100'}`}>03</div>
                            <h4 className={`text-[11px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Link File (Tự hiện Card tải)</h4>
                        </div>
                        <p className={`text-[11px] pl-11 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                            Link kết thúc bằng <span className={`font-bold ${isDarkTheme ? 'text-blue-400' : 'text-blue-600'}`}>.pdf, .docx, .csv...</span> sẽ hiện thành khung tải file chuyên nghiệp.
                        </p>
                    </div>      <div className={`ml-11 border rounded-[14px] p-4 space-y-3 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`p-3 rounded-xl border border-dashed text-[10px] font-mono italic ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-white border-slate-300 text-slate-400'}`}>
                            "Báo giá: https://domain.com/bao-gia.pdf"
                        </div>
                        <div className={`flex items-center gap-3 p-3 border rounded-xl shadow-sm max-w-[240px] ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDarkTheme ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-500'}`}><FileText className="w-5 h-5" /></div>
                            <div className="min-w-0 pr-2">
                                <div className={`text-[10px] font-bold truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>bao-gia.pdf</div>
                                <div className={`text-[8px] font-bold uppercase tracking-tight ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>PDF FILE • Bấm để tải</div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100 flex items-center gap-3 text-slate-300">
                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">Khám phá sức mạnh của AI thông qua dữ liệu của bạn</p>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isBulkMoveModalOpen}
                onClose={() => setIsBulkMoveModalOpen(false)}
                title={bulkActionType === 'move' ? 'Di chuyển kiến thức' : 'Sao chép kiến thức'}
                size="md"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    <div className={`p-4 rounded-[14px] border flex gap-4 items-start ${isDarkTheme ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20' : 'bg-amber-50 border-amber-100'}`}>
                        <Info className="w-5 h-5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                        <p className={`text-xs leading-relaxed font-medium ${isDarkTheme ? 'text-amber-300' : 'text-amber-900'}`}>
                            Toàn bộ dữ liệu được chọn sẽ được {bulkActionType === 'move' ? 'chuyển' : 'nhân bản'} sang bot đích.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-400'}`}>Chọn Chatbot đích</label>
                        <select
                            value={targetPropertyId}
                            onChange={(e) => setTargetPropertyId(e.target.value)}
                            className={`w-full h-12 px-4 border-2 rounded-xl text-xs font-bold outline-none transition-colors appearance-none cursor-pointer ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:bg-slate-950 focus:border-[var(--color-primary)]/50' : 'bg-slate-50 border-slate-100 text-slate-700 focus:bg-white focus:border-[var(--color-primary)]'}`}
                        >
                            <option value="">-- Chọn AI Chatbot --</option>
                            {chatbots.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className={`flex justify-end gap-3 pt-4 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-50'}`}>
                        <Button variant="ghost" onClick={() => setIsBulkMoveModalOpen(false)} isDarkTheme={isDarkTheme}>Hủy</Button>
                        <Button
                            className={`font-bold ${isDarkTheme ? 'bg-slate-100 text-slate-900 hover:bg-white' : 'bg-slate-900 text-white'}`}
                            onClick={handleBulkMoveOrCopy}
                            isLoading={loading}
                        >
                            Thực hiện ngay
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isBulkDeleteConfirmModalOpen}
                onClose={() => setIsBulkDeleteConfirmModalOpen(false)}
                title="Xóa kiến thức hàng loạt"
                size="sm"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6 text-center">
                    <div className={`w-16 h-16 rounded-[14px] flex items-center justify-center mx-auto ${isDarkTheme ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-rose-50 text-rose-500'}`}>
                        <Trash2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className={`text-sm font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Cònh báo quan trọng!</h4>
                        <p className={`text-xs mt-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Dữ liệu đã xóa không thể khôi phục. Vui lòng nhập <span className="font-black text-rose-500">DELETE</span> để xác nhận.</p>
                    </div>

                    <input
                        type="text"
                        value={deleteVerifyText}
                        onChange={(e) => setDeleteVerifyText(e.target.value)}
                        placeholder="Nhập DELETE..."
                        className={`w-full h-11 px-4 border-2 rounded-xl text-center text-xs font-black uppercase outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-rose-500/30 text-rose-400 focus:bg-slate-950 focus:border-rose-500' : 'bg-slate-50 border-rose-100 text-rose-500 focus:bg-white focus:border-rose-500'}`}
                    />

                    <div className="flex flex-col gap-2 pt-2">
                        <Button
                            variant="danger"
                            className="w-full h-11 font-black"
                            disabled={deleteVerifyText.toUpperCase() !== 'DELETE'}
                            onClick={confirmBulkDelete}
                            isLoading={loading}
                            isDarkTheme={isDarkTheme}
                        >
                            Xóa vĩnh viễn
                        </Button>
                        <Button variant="ghost" onClick={() => setIsBulkDeleteConfirmModalOpen(false)} isDarkTheme={isDarkTheme}>Quay lại</Button>
                    </div>
                </div>
            </Modal>

            {/* Category / Bot Management Modals */}
            <Modal
                isOpen={isCreateCategoryModalOpen}
                onClose={() => setIsCreateCategoryModalOpen(false)}
                title="Tạo nhóm mới"
                size="md"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Tên nhóm</label>
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Nhập tên nhóm..."
                            className={`w-full px-4 py-2 border rounded-xl outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Đường dẫn (Slug)</label>
                        <div className="flex items-center group">
                            <div className={`h-[42px] px-3 flex items-center gap-2 border border-r-0 rounded-l-xl font-medium text-xs ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-50'}`}>
                                <Globe className="w-3.5 h-3.5" />
                                <span>/ai-space/</span>
                            </div>
                            <input
                                type="text"
                                value={newCategorySlug}
                                onChange={(e) => setNewCategorySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="marketing"
                                className={`flex-1 h-[42px] px-4 border rounded-r-xl outline-none text-sm font-bold transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Mô tả (Tùy chọn)</label>
                        <textarea
                            value={newCategoryDesc}
                            onChange={(e) => setNewCategoryDesc(e.target.value)}
                            placeholder="Mô tả về nhóm này..."
                            className={`w-full px-4 py-2 border rounded-xl outline-none resize-none h-24 transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Avatar URL (Tùy chọn)</label>
                        <div className="flex gap-3">
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden ${isDarkTheme ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
                                {newCategoryAvatar ? <img src={newCategoryAvatar} className="w-full h-full object-cover" /> : <Bot className="w-5 h-5 text-slate-400" />}
                            </div>
                            <input
                                type="text"
                                value={newCategoryAvatar}
                                onChange={(e) => setNewCategoryAvatar(e.target.value)}
                                placeholder="https://example.com/logo.png"
                                className={`flex-1 px-4 py-2 border rounded-xl outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Màu nhận diện</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={newCategoryColor}
                                    onChange={(e) => setNewCategoryColor(e.target.value)}
                                    className={`w-10 h-10 rounded-lg border cursor-pointer ${isDarkTheme ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
                                />
                                <input
                                    type="text"
                                    value={newCategoryColor}
                                    onChange={(e) => setNewCategoryColor(e.target.value)}
                                    className={`flex-1 px-3 py-2 border rounded-xl text-sm font-mono outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:border-slate-500'}`}
                                    placeholder="#000000"
                                />
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Gemini API Key</label>
                            <input
                                type="password"
                                value={newCategoryApiKey}
                                onChange={(e) => setNewCategoryApiKey(e.target.value)}
                                placeholder="AIza..."
                                className={`w-full px-4 py-2 border rounded-xl outline-none text-sm font-mono transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                            />
                        </div>
                    </div>
                    <div className={`flex justify-end gap-3 pt-4 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                        <Button variant="secondary" onClick={() => setIsCreateCategoryModalOpen(false)} isDarkTheme={isDarkTheme}>Hủy</Button>
                        <Button
                            className={`font-bold ${isDarkTheme ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-900 text-white'}`}
                            onClick={handleCreateCategory}
                            isLoading={loading}
                        >
                            Tạo Tổ chức
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isEditCategoryModalOpen}
                onClose={() => setIsEditCategoryModalOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: brandColor }}>
                            <Building className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className={`text-xl font-black tracking-tight ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Cấu hình nhóm</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{editingCategory?.name}</p>
                        </div>
                    </div>
                }
                size="lg"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    {/* Header Preview Section */}
                    <div className={`flex items-center gap-5 p-5 rounded-[18px] border shadow-inner ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                        <div className="relative group shrink-0">
                            <div
                                className={`w-20 h-20 rounded-[14px] flex items-center justify-center overflow-hidden shadow-xl border-4 transition-all duration-500 group-hover:scale-105 ${isDarkTheme ? 'bg-slate-950' : 'bg-white'}`}
                                style={{ borderColor: `${brandColor}${isDarkTheme ? '60' : '40'}`, backgroundColor: newCategoryAvatar ? (isDarkTheme ? '#0f172a' : 'white') : `${brandColor}10` }}
                            >
                                {newCategoryAvatar ? (
                                    <img src={newCategoryAvatar} className="w-full h-full object-cover" alt="Avatar" />
                                ) : (
                                    <Building className="w-10 h-10" style={{ color: brandColor }} />
                                )}
                            </div>
                            <div
                                className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-xl flex items-center justify-center shadow-lg border-2 ${isDarkTheme ? 'border-slate-900' : 'border-white'}`}
                                style={{ backgroundColor: brandColor }}
                            >
                                <Bot className="w-3.5 h-3.5 text-white" />
                            </div>
                        </div>

                        <div className="flex-1 space-y-1">
                            <h4 className={`text-base font-black tracking-tight ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Giao diện nhóm AI</h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[280px]">
                                Tùy chỉnh nhận diện thương hiệu cho nhóm <span className="font-bold" style={{ color: brandColor }}>{newCategoryName || 'mới'}</span>.
                            </p>
                            <div className="flex items-center gap-2 pt-1.5">
                                <button
                                    onClick={() => {
                                        const url = `${window.location.origin}/#/ai-space/${newCategorySlug || editingCategory?.id}`;
                                        navigator.clipboard.writeText(url);
                                        toast.success('Đã copy đường dẫn!');
                                    }}
                                    className="flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-bold text-white transition-all shadow-sm hover:brightness-110 active:scale-95"
                                    style={{ backgroundColor: brandColor }}
                                >
                                    <Share2 className="w-3 h-3" /> Copy link chia sẻ
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6 pb-24 custom-scrollbar">
                        {/* Name Field */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên nhóm</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                                    <Building className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="VD: Phòng Marketing..."
                                    className={`w-full pl-11 pr-4 py-3 border-2 rounded-[14px] outline-none transition-all text-sm font-bold ${isDarkTheme ? 'bg-slate-900 text-slate-200 focus:bg-slate-950' : 'bg-slate-50 text-slate-700 focus:bg-white'}`}
                                    style={{ borderColor: brandColor + (isDarkTheme ? '40' : '20') }}
                                />
                            </div>
                        </div>

                        {/* Link Slug Field */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đường dẫn (Slug)</label>
                            <div className="flex items-center group">
                                <div
                                    className={`h-[48px] px-4 flex items-center gap-2 border-2 border-r-0 rounded-l-[14px] font-bold text-[11px] ${isDarkTheme ? 'bg-slate-800 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-100 text-slate-400'}`}
                                    style={{ borderColor: brandColor + '10' }}
                                >
                                    <Globe className="w-3.5 h-3.5" />
                                    <span>/ai-space/</span>
                                </div>
                                <input
                                    type="text"
                                    value={newCategorySlug}
                                    onChange={(e) => setNewCategorySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                    placeholder="marketing"
                                    className={`flex-1 h-[48px] px-4 border-2 rounded-r-[14px] outline-none transition-all text-sm font-black ${isDarkTheme ? 'bg-slate-900 text-[var(--color-primary-light)] focus:bg-slate-950' : 'bg-slate-50 text-[var(--color-primary)] focus:bg-white'}`}
                                    style={{ borderColor: brandColor + (isDarkTheme ? '40' : '20') }}
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả</label>
                            <textarea
                                value={newCategoryDesc}
                                onChange={(e) => setNewCategoryDesc(e.target.value)}
                                placeholder="Mục tiêu của nhóm này..."
                                className={`w-full px-4 py-3 border-2 rounded-[14px] outline-none resize-none h-20 transition-all text-sm font-medium ${isDarkTheme ? 'bg-slate-900 text-slate-300 focus:bg-slate-950' : 'bg-slate-50 text-slate-600 focus:bg-white'}`}
                                style={{ borderColor: brandColor + (isDarkTheme ? '40' : '20') }}
                            />
                        </div>

                        {/* Logo Field */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Avatar URL</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                                    <ImageIcon className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={newCategoryAvatar}
                                    onChange={(e) => setNewCategoryAvatar(e.target.value)}
                                    placeholder="https://..."
                                    className={`w-full pl-11 pr-4 py-3 border-2 rounded-[14px] outline-none transition-all text-sm font-medium ${isDarkTheme ? 'bg-slate-900 text-slate-300 focus:bg-slate-950' : 'bg-slate-50 text-slate-600 focus:bg-white'}`}
                                    style={{ borderColor: brandColor + (isDarkTheme ? '40' : '20') }}
                                />
                            </div>
                        </div>

                        {/* Gemini API Key */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gemini API Key</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                                    <Zap className="w-4 h-4" />
                                </div>
                                <input
                                    type="password"
                                    value={newCategoryApiKey}
                                    onChange={(e) => setNewCategoryApiKey(e.target.value)}
                                    placeholder="AIza..."
                                    className={`w-full pl-11 pr-4 py-3 border-2 rounded-[14px] outline-none transition-all text-sm font-mono ${isDarkTheme ? 'bg-slate-900 text-slate-200 focus:bg-slate-950' : 'bg-slate-50 text-slate-800 focus:bg-white'}`}
                                    style={{ borderColor: brandColor + (isDarkTheme ? '40' : '20') }}
                                />
                            </div>
                        </div>

                        {/* Color Picker Section */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Màu chủ đạo</label>
                            <div className={`flex items-center gap-3 h-[48px] px-4 border-2 rounded-[14px] ${isDarkTheme ? 'bg-slate-900' : 'bg-slate-50'}`} style={{ borderColor: brandColor + (isDarkTheme ? '40' : '20') }}>
                                <div className="relative overflow-hidden w-7 h-7 rounded-lg shadow-inner group">
                                    <input
                                        type="color"
                                        value={newCategoryColor}
                                        onChange={(e) => setNewCategoryColor(e.target.value)}
                                        className="absolute -inset-2 w-[200%] h-[200%] cursor-pointer"
                                    />
                                </div>
                                <input
                                    type="text"
                                    value={newCategoryColor}
                                    onChange={(e) => setNewCategoryColor(e.target.value)}
                                    className={`bg-transparent text-xs font-mono font-black outline-none w-24 ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}
                                    placeholder="#RRGGBB"
                                />
                            </div>
                        </div>

                        {/* Small Guide Box */}
                        <div className={`p-4 rounded-[14px] border space-y-2 ${isDarkTheme ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50/50 border-blue-100/50'}`}>
                            <h5 className="text-[9px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-blue-400" /> Ghi chú
                            </h5>
                            <p className={`text-[9px] font-bold leading-relaxed ${isDarkTheme ? 'text-blue-300' : 'text-blue-500'}`}>
                                Cấu hình này sẽ được áp dụng chung cho tất cả các Bot trong nhóm nếu không được thiết lập riêng.
                            </p>
                        </div>
                    </div>

                    {/* Footer Actions - STICKY */}
                    <div className={`sticky bottom-0 -mx-6 px-6 py-4 border-t flex items-center justify-between z-10 rounded-b-[18px] ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <button
                            onClick={() => { setIsEditCategoryModalOpen(false); setEditingCategory(null); }}
                            className={`text-xs font-bold transition-colors ${isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Đóng
                        </button>

                        <button
                            onClick={handleUpdateCategory}
                            disabled={loading}
                            className="px-8 py-3 text-white rounded-[14px] text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            style={{ backgroundColor: brandColor }}
                        >
                            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {loading ? 'Đang lưu...' : 'Lưu cài đặt'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isCreateBotModalOpen}
                onClose={() => setIsCreateBotModalOpen(false)}
                title="Tạo AI Chatbot mới"
                size="md"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    <div className={`p-4 rounded-[14px] border flex gap-3 ${isDarkTheme ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                        <Info className="w-5 h-5 text-slate-400 shrink-0" />
                        <p className={`text-[11px] font-medium ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Chatbot mới sẽ được kế thừa cấu hình chung của nhóm. Bạn có thể tùy chỉnh lại sau.</p>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Tên AI Chatbot</label>
                        <input
                            type="text"
                            value={newBotName}
                            onChange={(e) => setNewBotName(e.target.value)}
                            placeholder="VD: Support Bot, Tư vấn khóa học..."
                            className={`w-full px-4 py-2 border rounded-xl outline-none font-bold transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Đường dẫn (Slug - Tùy chọn)</label>
                        <div className="flex items-center group">
                            <div className={`h-[42px] px-3 flex items-center gap-2 border border-r-0 rounded-l-xl font-medium text-xs ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-300 text-slate-50'}`}>
                                <Globe className="w-3.5 h-3.5" />
                                <span>/chat/</span>
                            </div>
                            <input
                                type="text"
                                value={newBotSlug}
                                onChange={(e) => setNewBotSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="my-bot"
                                className={`flex-1 h-[42px] px-4 border rounded-r-xl outline-none text-sm font-bold transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Mô tả mục đích</label>
                        <textarea
                            value={newBotDesc}
                            onChange={(e) => setNewBotDesc(e.target.value)}
                            placeholder="Bot dùng để trả lời về..."
                            className={`w-full px-4 py-2 border rounded-xl outline-none resize-none h-24 transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:ring-2 focus:ring-slate-700' : 'bg-white border-slate-300 text-slate-700 focus:ring-2 focus:ring-slate-500'}`}
                        />
                    </div>
                    <div className={`flex justify-end gap-3 pt-4 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                        <Button variant="secondary" onClick={() => setIsCreateBotModalOpen(false)} isDarkTheme={isDarkTheme}>Hủy</Button>
                        <Button
                            className={`font-bold ${isDarkTheme ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-slate-900 text-white'}`}
                            onClick={handleCreateBot}
                            isLoading={loading}
                        >
                            Khởi tạo ngay
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isEditBotModalOpen}
                onClose={() => setIsEditBotModalOpen(false)}
                title="Sửa thông tin AI Chatbot"
                size="md"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    {/* Info Note */}
                    <div className={`p-4 rounded-xl border-2 flex gap-3 ${isDarkTheme ? 'bg-slate-800/20 border-slate-800' : ''}`} style={{ backgroundColor: !isDarkTheme ? `${brandColor}08` : undefined, borderColor: !isDarkTheme ? `${brandColor}20` : undefined }}>
                        <Info className="w-5 h-5 shrink-0" style={{ color: brandColor }} />
                        <p className={`text-xs font-medium ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Màu nhận diện và API Key sẽ được kế thừa từ nhóm. Chỉ cần cập nhật tên, mô tả và avatar riêng cho chatbot này.</p>
                    </div>

                    <div>
                        <label className={`block text-sm font-bold mb-2.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>Tên AI Chatbot</label>
                        <input
                            type="text"
                            value={newBotName}
                            onChange={(e) => setNewBotName(e.target.value)}
                            placeholder="VD: Support Bot, Marketing Assistant..."
                            className={`w-full px-4 py-3.5 border-2 rounded-xl outline-none transition-all text-base font-semibold ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'}`}
                            onFocus={(e) => {
                                e.target.style.borderColor = brandColor;
                                e.target.style.boxShadow = `0 0 0 4px ${brandColor}15`;
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = isDarkTheme ? '#1e293b' : '#e2e8f0';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-bold mb-2.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>Mô tả mục đích</label>
                        <textarea
                            value={newBotDesc}
                            onChange={(e) => setNewBotDesc(e.target.value)}
                            placeholder="Mô tả về chức năng và mục đích của chatbot này..."
                            className={`w-full px-4 py-3.5 border-2 rounded-xl outline-none resize-none h-28 transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'}`}
                            onFocus={(e) => {
                                e.target.style.borderColor = brandColor;
                                e.target.style.boxShadow = `0 0 0 4px ${brandColor}15`;
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = isDarkTheme ? '#1e293b' : '#e2e8f0';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <div>
                        <label className={`block text-sm font-bold mb-2.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>Đường dẫn (Slug)</label>
                        <div className="flex items-center group">
                            <div className={`h-[48px] px-4 flex items-center gap-2 border-2 border-r-0 rounded-l-[14px] font-bold text-[11px] ${isDarkTheme ? 'bg-slate-800 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                <Globe className="w-3.5 h-3.5" />
                                <span>/chat/</span>
                            </div>
                            <input
                                type="text"
                                value={newBotSlug}
                                onChange={(e) => setNewBotSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                placeholder="my-bot"
                                className={`flex-1 h-[48px] px-4 border-2 rounded-r-[14px] outline-none transition-all text-sm font-black ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-[var(--color-primary-light)] focus:bg-slate-950' : 'bg-slate-50 border-slate-200 text-[var(--color-primary)] focus:bg-white'}`}
                                style={{ borderColor: brandColor + (isDarkTheme ? '40' : '20') }}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-bold mb-2.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>Avatar URL (Tùy chọn)</label>
                        <div className="flex gap-3">
                            <div
                                className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center shrink-0 overflow-hidden ${isDarkTheme ? 'bg-slate-950 border-slate-800' : ''}`}
                                style={{ borderColor: !isDarkTheme ? `${brandColor}30` : undefined, backgroundColor: !isDarkTheme ? `${brandColor}05` : undefined }}
                            >
                                {newBotAvatar ? <img src={newBotAvatar} className="w-full h-full object-cover" alt="Avatar" /> : <Bot className="w-5 h-5" style={{ color: brandColor }} />}
                            </div>
                            <input
                                type="text"
                                value={newBotAvatar}
                                onChange={(e) => setNewBotAvatar(e.target.value)}
                                placeholder="https://example.com/bot-avatar.png"
                                className={`flex-1 px-4 py-3 border-2 rounded-xl outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-900'}`}
                                onFocus={(e) => {
                                    e.target.style.borderColor = brandColor;
                                    e.target.style.boxShadow = `0 0 0 4px ${brandColor}15`;
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = isDarkTheme ? '#1e293b' : '#e2e8f0';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>
                        <p className={`text-xs mt-2 ml-1 ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>Để trống để sử dụng avatar của nhóm</p>
                    </div>

                    <div className={`flex justify-end gap-3 pt-6 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                        <Button variant="secondary" onClick={() => setIsEditBotModalOpen(false)} isDarkTheme={isDarkTheme}>Hủy</Button>
                        <button
                            onClick={handleUpdateBot}
                            disabled={loading}
                            className="px-6 py-2.5 text-white rounded-xl text-sm font-bold uppercase tracking-wide transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: brandColor }}
                        >
                            {loading ? 'Đang cập nhật...' : 'Cập nhật'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isShareLinkModalOpen}
                onClose={() => setIsShareLinkModalOpen(false)}
                title="Chia sẻ đường dẫn AI Chat"
                size="md"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6">
                    <div className={`p-4 rounded-[14px] border flex gap-3 ${isDarkTheme ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'}`}>
                        <Share2 className="w-5 h-5 text-emerald-500 shrink-0" />
                        <p className={`text-xs font-medium ${isDarkTheme ? 'text-emerald-300' : 'text-emerald-700'}`}>Bất kỳ ai có đường dẫn này đều có thể trò chuyện với AI của bạn mà không cần đăng nhập.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đường dẫn công khai (Public URL)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                value={shareLinkToCopy}
                                className={`flex-1 h-11 px-4 border-2 rounded-xl text-xs font-bold outline-none ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}
                            />
                            <Button
                                className={`font-bold ${isDarkTheme ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white'}`}
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLinkToCopy);
                                    toast.success('Đã copy link!');
                                }}
                                isDarkTheme={isDarkTheme}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>
                    <div className="flex justify-center pt-2">
                        <button
                            onClick={() => window.open(shareLinkToCopy, '_blank')}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4" /> Mở trong tab mới
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isDeleteConfirmModalOpen}
                onClose={() => { setIsDeleteConfirmModalOpen(false); setDeleteConfirmText(''); }}
                title={`Xác nhận xóa ${deleteConfig?.type === 'bot' ? 'AI Chatbot' : 'Nhóm'}`}
                size="sm"
                isDarkTheme={isDarkTheme}
            >
                <div className="space-y-6 text-center">
                    <div className={`w-16 h-16 rounded-[14px] flex items-center justify-center mx-auto ${isDarkTheme ? 'bg-rose-500/10 text-rose-500' : 'bg-rose-50 text-rose-500'}`}>
                        <Trash2 className="w-8 h-8" />
                    </div>
                    <div>
                        <p className={`text-sm font-bold ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>Bạn có chắc chắn muốn xóa <span className="text-rose-500">{deleteConfig?.name}</span> không?</p>
                        <p className={`text-xs mt-2 ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>Dữ liệu huấn luyện và lịch sử chat liên quan sẽ bị xóa vĩnh viễn.</p>
                        <p className={`text-xs font-bold mt-3 ${isDarkTheme ? 'text-rose-400' : 'text-rose-600'}`}>Vui lòng nhập <span className="font-black">DELETE</span> để xác nhận.</p>
                    </div>

                    <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Nhập DELETE..."
                        className={`w-full h-11 px-4 border-2 rounded-xl text-center text-xs font-black uppercase outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-rose-500/30 text-rose-400 focus:bg-slate-950 focus:border-rose-500' : 'bg-slate-50 border-rose-100 text-rose-500 focus:bg-white focus:border-rose-500'}`}
                    />

                    <div className="flex flex-col gap-2">
                        <Button
                            variant="danger"
                            className="w-full font-black"
                            disabled={deleteConfirmText !== 'DELETE'}
                            onClick={() => {
                                if (deleteConfig?.type === 'bot') confirmDeleteChatbot(deleteConfig.id);
                                else confirmDeleteCategory(deleteConfig.id);
                                setDeleteConfirmText('');
                            }}
                            isLoading={loading}
                            isDarkTheme={isDarkTheme}
                        >
                            Xác nhận xóa vĩnh viễn
                        </Button>
                        <Button variant="ghost" onClick={() => { setIsDeleteConfirmModalOpen(false); setDeleteConfirmText(''); }} isDarkTheme={isDarkTheme}>Hủy</Button>
                    </div>
                </div>
            </Modal>

            {/* Modal: Học Đồng Nghĩa */}
            <Modal
                isOpen={isSynonymsModalOpen}
                onClose={() => setIsSynonymsModalOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-white shadow-lg ${isDarkTheme ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-slate-800 to-slate-900'}`}>
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className={`text-xl font-black tracking-tight leading-none mb-1 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Học từ đồng nghĩa</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">AI Knowledge Synonyms</p>
                        </div>
                    </div>
                }
                size="xl"
                isDarkTheme={isDarkTheme}
            >
                <div className="flex flex-col h-full max-h-[85vh]">
                    {/* Header - Fixed Context */}
                    <div className={`flex items-center justify-between pb-6 border-b mb-6 shrink-0 ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                                <BrainCircuit className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h3 className={`text-lg font-bold tracking-tight leading-none mb-1 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Cấu hình từ đồng nghĩa</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em]">Đào tạo từ vựng thông minh cho AI</p>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                        {/* Minimal Info Box */}
                        <div className={`border rounded-[14px] p-5 text-left flex gap-4 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${isDarkTheme ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <Info className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="space-y-1.5">
                                <p className={`text-xs leading-relaxed font-medium ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                                    Giúp AI hiểu các từ lóng, tên viết tắt hoặc thuật ngữ riêng. Hệ thống sẽ quy đổi chúng về từ chuẩn trong Knowledge Base.
                                </p>
                                <div className="flex gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300" /> VD: "Hp" → "Học phí"</span>
                                    <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-slate-300" /> VD: "Cty" → "Công ty"</span>
                                </div>
                            </div>
                        </div>

                        {/* Flat Input Section */}
                        <div className={`border rounded-[14px] overflow-hidden shadow-sm ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2 text-left">
                                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>Nếu khách hỏi</label>
                                        <input
                                            placeholder="VD: Hp, cty, thcs..."
                                            value={newSynKey}
                                            onChange={e => setNewSynKey(e.target.value)}
                                            className={`w-full h-11 px-4 border rounded-xl text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-slate-800'}`}
                                        />
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>AI nên hiểu là</label>
                                        <input
                                            placeholder="VD: Học phí"
                                            value={newSynValues}
                                            onChange={e => setNewSynValues(e.target.value)}
                                            className={`w-full h-11 px-4 border rounded-xl text-sm font-medium outline-none transition-all placeholder:text-slate-400 ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-slate-800'}`}
                                        />
                                    </div>
                                </div>
                                <div className={`flex items-center justify-between pt-4 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-50'}`}>
                                    <button
                                        onClick={(e: any) => { e.preventDefault(); e.stopPropagation(); handleAutoLearnSynonyms(); }}
                                        disabled={loading}
                                        className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-800'}`}
                                    >
                                        <Sparkles className="w-3.5 h-3.5" /> AI đề xuất thêm
                                    </button>
                                    <button
                                        onClick={handleAddSynonym}
                                        disabled={loading || !newSynKey || !newSynValues}
                                        className={`h-10 px-6 border rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 ${isDarkTheme ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
                                    >
                                        <Save className="w-3.5 h-3.5" /> Thêm cấu hình
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Lean List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                    Danh sách vựng ({Object.keys(synonyms || {}).length})
                                </h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Object.entries(synonyms || {}).map(([key, val]: [string, any]) => (
                                    <div key={key} className={`group relative border rounded-xl p-4 flex items-center justify-between transition-all text-left ${isDarkTheme ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}>
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="shrink-0">
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">HỎI</div>
                                                <div className={`text-xs font-bold truncate max-w-[80px] ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>{key}</div>
                                            </div>
                                            <ArrowRight className="w-3 h-3 text-slate-300" />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">AI HIỂU</div>
                                                <div className={`text-xs font-bold truncate px-2 py-0.5 rounded border ${isDarkTheme ? 'text-slate-300 bg-slate-950 border-slate-800' : 'text-slate-600 bg-white border-slate-200'}`}>
                                                    {Array.isArray(val) ? val.join(', ') : val}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 ml-2 shrink-0">
                                            <button onClick={() => startEditSynonym(key, val)} className="p-1.5 text-slate-400 hover:text-slate-800"><Edit2 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => handleDeleteSynonym(key)} className="p-1.5 text-slate-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>

                                        {/* Inline Edit (Absolute) */}
                                        {editingSynKey === key && (
                                            <div className={`absolute inset-0 rounded-xl z-10 flex items-center px-3 gap-2 animate-in fade-in duration-200 ${isDarkTheme ? 'bg-slate-900/95' : 'bg-white/95'}`}>
                                                <input value={editSynKeyVal} onChange={e => setEditSynKeyVal(e.target.value)} className={`flex-1 h-8 px-2 border rounded text-[11px] font-bold outline-none ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-slate-700' : 'bg-white border-slate-300 text-slate-900 focus:border-slate-800'}`} />
                                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                                <input value={editSynValuesVal} onChange={e => setEditSynValuesVal(e.target.value)} className={`flex-1 h-8 px-2 border rounded text-[11px] font-bold outline-none ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-200 focus:border-slate-700' : 'bg-white border-slate-300 text-slate-900 focus:border-slate-800'}`} />
                                                <div className="flex gap-1 ml-1">
                                                    <button onClick={() => setEditingSynKey(null)} className="p-1 text-slate-400 hover:text-slate-800"><X className="w-3.5 h-3.5" /></button>
                                                    <button onClick={handleSaveSynonymEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {Object.keys(synonyms || {}).length === 0 && (
                                    <div className="col-span-full py-12 text-center bg-slate-50/50 border border-dashed border-slate-200 rounded-[14px]">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Chưa có cấu hình dữ liệu</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer - Sticky Bottom */}
                    <div className={`pt-6 border-t mt-8 shrink-0 flex justify-end gap-3 -mx-6 -mb-6 px-6 pb-6 sticky bottom-0 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] ${isDarkTheme ? 'bg-slate-900 border-slate-800 shadow-slate-900/50' : 'bg-white border-slate-100 shadow-white/50'}`}>
                        <button
                            onClick={() => setIsSynonymsModalOpen(false)}
                            className={`h-10 px-8 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border ${isDarkTheme ? 'text-slate-400 bg-slate-800 border-slate-700 hover:bg-slate-700' : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50'}`}
                        >
                            Đóng
                        </button>
                        <button
                            onClick={(e: any) => { e.preventDefault(); e.stopPropagation(); handleSaveSynonyms(); }}
                            disabled={loading}
                            className={`h-10 px-10 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${isDarkTheme ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20 hover:bg-indigo-500' : 'bg-slate-800 text-white shadow-xl shadow-slate-900/10 hover:bg-slate-900'}`}
                        >
                            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                            Lưu cấu hình ngay
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default React.memo(AIModals);

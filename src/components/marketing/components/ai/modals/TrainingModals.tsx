import React from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { Cpu, Info, Save } from 'lucide-react';

export const ManualAddModal = React.memo(({ isOpen, onClose, onAdd, loading, groupedDocs, newDoc, setNewDoc, isDarkTheme }: any) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Huấn luyện kiến thức (Nhập tay)"
            size="xl"
            isDarkTheme={isDarkTheme}
            footer={
                <div className="flex justify-between w-full">
                    <Button variant="ghost" onClick={onClose} isDarkTheme={isDarkTheme}>Hủy</Button>
                    <Button
                        className="font-semibold border-none transition-colors bg-[#BD1D2D] hover:bg-[#9A1523] text-white"
                        icon={Cpu}
                        onClick={onAdd}
                        disabled={(newDoc.content || '').length > 15000}
                        isLoading={loading}
                        isDarkTheme={isDarkTheme}
                    >
                        Bắt đầu huấn luyện
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2">
                <Input label="Tiêu đề khối kiến thức" placeholder="VD: Chính sách giao hàng TPHCM" value={newDoc.name} onChange={(e: any) => setNewDoc({ ...newDoc, name: e.target.value })} autoFocus isDarkTheme={isDarkTheme} />

                <div className="space-y-1.5">
                    <Input label="Tags Phân Loại (Ưu tiên tìm kiếm)" placeholder="VD: EMBA, HocPhi (cách nhau dấu phẩy)" value={newDoc.tags} onChange={(e: any) => setNewDoc({ ...newDoc, tags: e.target.value })} isDarkTheme={isDarkTheme} />
                    <div className={`mx-1 p-3 border rounded-xl flex gap-3 ${isDarkTheme ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50/50 border-blue-100'}`}>
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className={`text-[10px] leading-relaxed ${isDarkTheme ? 'text-blue-300' : 'text-blue-700'}`}>
                            <span className="font-bold">Mẹo tối ưu:</span> Gắn các từ khóa chính (vd: <span className="underline">hocphi, dba, mba, maubang</span>). Khi khách hỏi trúng Tag này, AI sẽ <span className={`font-bold ${isDarkTheme ? 'text-blue-200' : 'text-blue-800'}`}>ƯU TIÊN 100%</span> lấy tài liệu này để trả lời.
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>Lưu vào thư mục (Tùy chọn)</label>
                    <select
                        value={newDoc.batchName}
                        onChange={e => setNewDoc({ ...newDoc, batchName: e.target.value })}
                        className={`w-full h-11 px-4 border rounded-xl text-xs font-semibold outline-none transition-colors appearance-none cursor-pointer ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:bg-slate-950 focus:border-[#BD1D2D]' : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-[#BD1D2D]'}`}
                    >
                        <option value="">-- Lưu riêng lẻ (Không vào thư mục) --</option>
                        {groupedDocs.filter((d: any) => d.isGroup).map((f: any) => (
                            <option key={f.batchId} value={f.batchId}>{f.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                        <label className={`text-[10px] font-bold uppercase tracking-widest ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>Nội dung chi tiết</label>
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 tabular-nums">
                            {(newDoc.content || '').length.toLocaleString()} / 15,000
                        </div>
                    </div>
                    <div className="relative">
                        <textarea
                            value={newDoc.content}
                            onChange={e => setNewDoc({ ...newDoc, content: e.target.value })}
                            rows={20}
                            placeholder="Dán hoặc soạn nội dung để AI ghi nhớ..."
                            className={`w-full p-4 border rounded-xl text-xs font-medium outline-none transition-colors resize-none ${isDarkTheme
                                ? `bg-slate-900 text-slate-200 focus:bg-slate-950 ${(newDoc.content || '').length > 15000 ? 'border-rose-400 focus:border-rose-500' : 'border-slate-800 focus:border-[#BD1D2D]'}`
                                : `bg-slate-50 text-slate-700 focus:bg-white ${(newDoc.content || '').length > 15000 ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#BD1D2D]'}`
                                }`}
                        />
                        <div className="text-right text-[10px] text-slate-400 font-semibold tabular-nums mt-1">{(newDoc.content || '').length.toLocaleString()}/15,000 ký tự</div>
                        {(newDoc.content || '').length > 15000 && (
                            <div className="mt-1.5 text-[11px] font-semibold text-rose-500">
                                Nội dung vượt quá 15,000 ký tự. Vui lòng chia nhỏ để đảm bảo AI xử lý tốt nhất.
                            </div>
                        )}
                    </div>
                </div>
                <div className={`p-4 border rounded-xl flex gap-3 ${isDarkTheme ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <Cpu className={`w-5 h-5 shrink-0 ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`} strokeWidth={1.75} />
                    <p className={`text-[11px] font-medium leading-relaxed ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>Hệ thống sẽ tự động tách đoạn và tạo Vector Embedding để AI có thể tìm thấy dữ liệu này khi khách hỏi.</p>
                </div>
            </div>
        </Modal>
    );
});

export const EditDocModal = React.memo(({ isOpen, onClose, onUpdate, loading, editingDoc, setEditingDoc, isDarkTheme }: any) => {
    if (!editingDoc) return null;
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingDoc.source_type === 'upload' ? "Chỉnh sửa nội dung trích xuất" : "Chi tiết dữ liệu huấn luyện"}
            size="xl"
            isDarkTheme={isDarkTheme}
            footer={
                <div className="flex justify-between w-full">
                    <Button variant="ghost" onClick={onClose} isDarkTheme={isDarkTheme}>Hủy</Button>
                    <Button
                        className="font-semibold border-none transition-colors bg-[#BD1D2D] hover:bg-[#9A1523] text-white"
                        icon={Save}
                        onClick={onUpdate}
                        isLoading={loading}
                        isDarkTheme={isDarkTheme}
                    >
                        Cập nhật dữ liệu
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2">
                <Input label="Tiêu đề khối kiến thức" placeholder="VD: Chính sách giao hàng TPHCM" value={editingDoc.name} onChange={(e: any) => setEditingDoc({ ...editingDoc, name: e.target.value })} isDarkTheme={isDarkTheme} />

                <div className="space-y-1.5">
                    <Input label="Tags Phân Loại (Ưu tiên tìm kiếm)" placeholder="VD: EMBA, HocPhi (cách nhau dấu phẩy)" value={editingDoc.tags || ''} onChange={(e: any) => setEditingDoc({ ...editingDoc, tags: e.target.value })} isDarkTheme={isDarkTheme} />
                    <div className={`mx-1 p-3 border rounded-xl flex gap-3 ${isDarkTheme ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50/50 border-blue-100'}`}>
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className={`text-[10px] leading-relaxed ${isDarkTheme ? 'text-blue-300' : 'text-blue-700'}`}>
                            <span className="font-bold">Mẹo tối ưu:</span> Các Tag này giúp "ép" AI phải đọc tài liệu này khi khách hỏi từ khóa trùng khớp. Phân tách bằng dấu phẩy.
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${isDarkTheme ? 'text-slate-400' : 'text-slate-800'}`}>
                        {editingDoc.source_type === 'upload' ? 'Nội dung trích xuất (có thể chỉnh sửa)' : 'Nội dung chi tiết'}
                    </label>
                    <div className="relative">
                        {editingDoc.content === null ? (
                            <div className={`w-full h-[340px] rounded-xl border flex flex-col items-center justify-center gap-3 ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="w-6 h-6 border-2 border-[#BD1D2D] border-t-transparent rounded-full animate-spin"></div>
                                <span className={`text-[11px] font-semibold ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Đang tải nội dung...</span>
                            </div>
                        ) : (
                            <>
                                <textarea
                                    value={editingDoc.content || ''}
                                    onChange={e => setEditingDoc({ ...editingDoc, content: e.target.value })}
                                    rows={20}
                                    className={`w-full p-4 border rounded-xl text-xs font-medium outline-none transition-colors resize-none ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:bg-slate-950 focus:border-[#BD1D2D]' : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-[#BD1D2D]'}`}
                                />
                                {editingDoc.source_type === 'upload' && (
                                    <p className={`text-[10px] font-semibold mt-1.5 ml-1 ${isDarkTheme ? 'text-amber-400/80' : 'text-[#BD1D2D]/80'}`}>
                                        Lưu ý: Lần train lại sẽ ghi đè nội dung này bằng dữ liệu từ file gốc.
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className={`flex items-center justify-between p-4 rounded-xl border ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loại dữ liệu: <span className={isDarkTheme ? 'text-slate-300' : 'text-slate-700'}>{editingDoc.source_type}</span></div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-right tabular-nums">Cập nhật: <span className={isDarkTheme ? 'text-slate-300' : 'text-slate-700'}>{new Date(editingDoc.updated_at || editingDoc.created_at).toLocaleString()}</span></div>
            </div>
        </Modal>
    );
});

import React from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { Sparkles, Info } from 'lucide-react';

interface ManualAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: () => void;
    loading: boolean;
    groupedDocs: any[];
    newDoc: { name: string, content: string, tags: any, batchName?: string };
    setNewDoc: (doc: any) => void;
}

const ManualAddModal: React.FC<ManualAddModalProps> = ({ isOpen, onClose, onAdd, loading, groupedDocs, newDoc, setNewDoc }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Huấn luyện kiến thức (Nhập tay)"
            size="xl"
            footer={
                <div className="flex justify-between w-full">
                    <Button variant="ghost" onClick={onClose}>Hủy</Button>
                    <Button
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold border-none shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all"
                        icon={Sparkles}
                        onClick={onAdd}
                        disabled={(newDoc.content || '').length > 15000}
                        isLoading={loading}
                    >
                        Bắt đầu huấn luyện
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2">
                <Input label="Tiêu đề khối kiến thức" placeholder="VD: Chính sách giao hàng TPHCM" value={newDoc.name} onChange={e => setNewDoc({ ...newDoc, name: e.target.value })} autoFocus />

                <div className="space-y-1.5">
                    <Input label="Tags Phân Loại (Ưu tiên tìm kiếm)" placeholder="VD: EMBA, HocPhi (cách nhau dấu phẩy)" value={newDoc.tags} onChange={e => setNewDoc({ ...newDoc, tags: e.target.value })} />
                    <div className="mx-1 p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-3">
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-relaxed">
                            <span className="font-bold">Mẹo tối ưu:</span> Gắn các từ khóa chính (vd: <span className="underline">hocphi, dba, mba, maubang</span>). Khi khách hỏi trúng Tag này, AI sẽ <span className="font-bold text-blue-800">ƯU TIÊN 100%</span> lấy tài liệu này để trả lời.
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Lưu vào thư mục (Tùy chọn)</label>
                    <select
                        value={newDoc.batchName}
                        onChange={e => setNewDoc({ ...newDoc, batchName: e.target.value })}
                        className="w-full h-11 px-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                    >
                        <option value="">-- Lưu riêng lẻ (Không vào thư mục) --</option>
                        {groupedDocs.filter((d: any) => d.isGroup).map((f: any) => (
                            <option key={f.batchId} value={f.batchId}>{f.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Nội dung chi tiết</label>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {(newDoc.content || '').length.toLocaleString()} / 15,000
                        </div>
                    </div>
                    <div className="relative">
                        <textarea
                            value={newDoc.content}
                            onChange={e => setNewDoc({ ...newDoc, content: e.target.value })}
                            rows={20}
                            placeholder="Dán hoặc soạn nội dung để AI ghi nhớ..."
                            className={`w-full p-4 bg-slate-50 border-2 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white transition-all resize-none shadow-sm ${(newDoc.content || '').length > 15000 ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'}`}
                        />
                        <div className="text-right text-[10px] text-slate-400 font-bold mt-1">{(newDoc.content || '').length.toLocaleString()}/15,000 ký tự</div>
                        {(newDoc.content || '').length > 15000 && (
                            <div className="absolute -bottom-5 left-2 text-[9px] font-bold text-rose-500 uppercase animate-pulse">
                                Nội dung quá dài! Vui lòng chia nhỏ để đảm bảo AI đọc tốt nhất.
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3">
                    <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                    <p className="text-[10px] text-emerald-700 font-medium leading-relaxed">Hệ thống sẽ tự động tách đoạn và tạo Vector Embedding để AI có thể tìm thấy dữ liệu này khi khách hỏi.</p>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(ManualAddModal);

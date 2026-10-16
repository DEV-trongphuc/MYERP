import React from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { Save, Info } from 'lucide-react';

interface EditDocModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
    loading: boolean;
    editingDoc: any;
    setEditingDoc: (doc: any) => void;
}

const EditDocModal: React.FC<EditDocModalProps> = ({ isOpen, onClose, onUpdate, loading, editingDoc, setEditingDoc }) => {
    if (!editingDoc) return null;
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Chi tiết dữ liệu huấn luyện"
            size="xl"
            footer={
                <div className="flex justify-between w-full">
                    <Button variant="ghost" onClick={onClose}>Hủy</Button>
                    <Button
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold border-none shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all"
                        icon={Save}
                        onClick={onUpdate}
                        isLoading={loading}
                    >
                        Cập nhật dữ liệu
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2">
                <Input label="Tiêu đề khối kiến thức" placeholder="VD: Chính sách giao hàng TPHCM" value={editingDoc.name} onChange={e => setEditingDoc({ ...editingDoc, name: e.target.value })} />

                <div className="space-y-1.5">
                    <Input label="Tags Phân Loại (Ưu tiên tìm kiếm)" placeholder="VD: EMBA, HocPhi (cách nhau dấu phẩy)" value={editingDoc.tags || ''} onChange={e => setEditingDoc({ ...editingDoc, tags: e.target.value })} />
                    <div className="mx-1 p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-3">
                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-relaxed">
                            <span className="font-bold">Mẹo tối ưu:</span> Các Tag này giúp "ép" AI phải đọc tài liệu này khi khách hỏi từ khóa trùng khớp. Phân tách bằng dấu phẩy.
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-800 uppercase tracking-widest ml-1">Nội dung chi tiết</label>
                    <textarea
                        value={editingDoc.content}
                        onChange={e => setEditingDoc({ ...editingDoc, content: e.target.value })}
                        rows={20}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all resize-none shadow-inner"
                    />
                    <div className="text-right text-[10px] text-slate-400 font-bold mt-1">{(editingDoc.content || '').length.toLocaleString()}/15,000 ký tự</div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Loại dữ liệu: <span className="text-slate-700">{editingDoc.source_type}</span></div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Cập nhật: <span className="text-slate-700">{new Date(editingDoc.updated_at || editingDoc.created_at).toLocaleString()}</span></div>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(EditDocModal);

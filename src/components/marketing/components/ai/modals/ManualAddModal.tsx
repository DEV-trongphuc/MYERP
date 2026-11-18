import React from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Input from '../../common/Input';
import { Cpu, Info } from 'lucide-react';

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
                        className="bg-[#BD1D2D] hover:bg-[#9A1523] text-white font-semibold border-none transition-colors"
                        icon={Cpu}
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
                    <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest ml-1">Lưu vào thư mục (Tùy chọn)</label>
                    <select
                        value={newDoc.batchName}
                        onChange={e => setNewDoc({ ...newDoc, batchName: e.target.value })}
                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-[#BD1D2D] transition-colors appearance-none cursor-pointer"
                    >
                        <option value="">-- Lưu riêng lẻ (Không vào thư mục) --</option>
                        {groupedDocs.filter((d: any) => d.isGroup).map((f: any) => (
                            <option key={f.batchId} value={f.batchId}>{f.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Nội dung chi tiết</label>
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
                            className={`w-full p-4 bg-slate-50 border rounded-xl text-xs font-medium text-slate-700 outline-none focus:bg-white transition-colors resize-none ${(newDoc.content || '').length > 15000 ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-[#BD1D2D]'}`}
                        />
                        <div className="text-right text-[10px] text-slate-400 font-semibold tabular-nums mt-1">{(newDoc.content || '').length.toLocaleString()}/15,000 ký tự</div>
                        {(newDoc.content || '').length > 15000 && (
                            <div className="mt-1.5 text-[11px] font-semibold text-rose-600">
                                Nội dung vượt quá 15,000 ký tự. Vui lòng chia nhỏ để đảm bảo chất lượng xử lý.
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex gap-3">
                    <Cpu className="w-5 h-5 text-slate-600 shrink-0" strokeWidth={1.75} />
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">Hệ thống sẽ tự động tách đoạn và tạo Vector Embedding để AI có thể tìm thấy dữ liệu này khi khách hỏi.</p>
                </div>
            </div>
        </Modal>
    );
};

export default React.memo(ManualAddModal);

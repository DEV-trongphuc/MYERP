
import React, { useState, useEffect } from 'react';
import { Save, List, Trash2, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import ConfirmModal from '../common/ConfirmModal';

interface ListFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (listData: { name: string; source: string }, isNew: boolean) => void;
    onDelete?: (listId: string) => void;
    list?: any; // Optional, only present if editing
    isNew?: boolean; // New prop to indicate if creating a new list
}

const ListFormModal: React.FC<ListFormModalProps> = ({ isOpen, onClose, onSave, onDelete, list, isNew = false }) => {
    const [name, setName] = useState('');
    const [source, setSource] = useState('Manual');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) { // Reset on open
            setName(list?.name || '');
            setSource(list?.source || 'Manual');
        }
    }, [isOpen, list]);

    const handleConfirmDelete = () => {
        if (list && onDelete) {
            onDelete(list.id);
        }
        setIsConfirmOpen(false);
        onClose(); // Close parent modal as well
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            await Promise.resolve(onSave({ name, source }, isNew));
            toast.success(isNew ? 'Đã tạo danh sách' : 'Đã cập nhật danh sách');
            onClose();
        } catch (error) {
            toast.error('Có lỗi xảy ra');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={isNew ? "Tạo danh sách mới" : "Chỉnh sửa Danh sách"}
                size="sm"
                isLoading={isLoading}
                footer={
                    <div className="flex justify-between w-full items-center">
                        {!isNew && onDelete && (
                            <Button
                                variant="danger"
                                icon={Trash2}
                                size="md"
                                className="bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none px-3"
                                onClick={() => setIsConfirmOpen(true)}
                            >
                                Xóa
                            </Button>
                        )}
                        <Button variant="ghost" size="md" onClick={onClose} disabled={isLoading}>Hủy</Button>
                        <Button
                            size="lg"
                            icon={isLoading ? Loader2 : (isNew ? Plus : Save)}
                            onClick={handleSubmit}
                            disabled={!name.trim() || isLoading}
                        >
                            {isNew ? 'Tạo danh sách' : 'Lưu thay đổi'}
                        </Button>
                    </div>
                }

            >
                <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                        <div className="p-3 bg-white rounded-xl text-indigo-600 shadow-sm">
                            <List className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-indigo-900 uppercase">Static List</p>
                            <p className="text-[10px] text-indigo-600/80">Danh sách tĩnh không tự động cập nhật.</p>
                        </div>
                    </div>
                    <Input
                        label="Tên danh sách"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        placeholder="Ví dụ: Khách hàng thân thiết"
                    />
                </div>
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Xóa danh sách này?"
                message="CẢNH BÁO: Hành động này sẽ gỡ tất cả thành viên khỏi danh sách này. Không thể hoàn tác."
                variant="danger"
                confirmLabel="Xóa danh sách"
            />
        </>
    );
};

export default ListFormModal;

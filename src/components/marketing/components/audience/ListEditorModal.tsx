
import React, { useState, useEffect } from 'react';
import { Save, List, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import ConfirmModal from '../common/ConfirmModal';

interface ListEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (list: any) => void;
    onDelete: (listId: string) => void;
    list: any;
}

const ListEditorModal: React.FC<ListEditorModalProps> = ({ isOpen, onClose, onSave, onDelete, list }) => {
    const [name, setName] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    useEffect(() => {
        if (list) setName(list.name);
    }, [list]);

    const handleConfirmDelete = () => {
        onDelete(list.id);
        setIsConfirmOpen(false);
        onClose(); // Close parent modal as well
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Chỉnh sửa Danh sách"
                size="sm"
                footer={
                    <div className="flex justify-between w-full items-center">
                        <Button
                            variant="danger"
                            icon={Trash2}
                            className="bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none px-3"
                            onClick={() => setIsConfirmOpen(true)}
                        >
                            Xóa
                        </Button>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={onClose}>Hủy</Button>
                            <Button icon={Save} onClick={() => { onSave({ ...list, name }); onClose(); }}>Lưu thay đổi</Button>
                        </div>
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
                    />
                </div>
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Xóa danh sách này?"
                message="CẢNH BÁO: Nếu thành viên chỉ thuộc danh sách này, họ sẽ bị xóa vĩnh viễn khỏi hệ thống (bao gồm cả phân khúc)."
                variant="danger"
                confirmLabel="Xóa danh sách"
            />
        </>
    );
};

export default ListEditorModal;
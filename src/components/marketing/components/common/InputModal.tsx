import * as React from 'react';
import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmLabel?: string;
    isDarkTheme?: boolean;
    zIndex?: number;
}

const InputModal: React.FC<InputModalProps> = ({
    isOpen, onClose, onConfirm, title, message, placeholder, defaultValue = '', confirmLabel = 'Xác nhận', isDarkTheme, zIndex
}) => {
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isOpen) setValue(defaultValue);
    }, [isOpen, defaultValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(value);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            isDarkTheme={isDarkTheme}
            zIndex={zIndex}
            footer={
                <div className="flex gap-3 w-full justify-end">
                    <Button variant="ghost" onClick={onClose} className={isDarkTheme ? 'text-slate-400 hover:bg-slate-800' : ''}>Hủy bỏ</Button>
                    <Button variant="primary" onClick={() => onConfirm(value)}>
                        {confirmLabel}
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {message && <p className={`text-sm ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>{message}</p>}
                <input
                    autoFocus
                    type="text"
                    className={`w-full px-4 py-3 border rounded-xl outline-none transition-all ${isDarkTheme ? 'bg-slate-900 border-slate-700 text-slate-100 focus:border-brand' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-brand'}`}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />
            </form>
        </Modal>
    );
};

export default InputModal;

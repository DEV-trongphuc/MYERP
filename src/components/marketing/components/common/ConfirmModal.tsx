import * as React from 'react';
import { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2 } from 'lucide-react';
import Modal from './Modal';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<any>;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    isLoading?: boolean;
    requireConfirmText?: string;
    confirmPlaceholder?: string;
    confirmLabel?: string;
    dangerText?: string;
    dangerAction?: () => void;
    isDarkTheme?: boolean;
    zIndex?: number;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Xác nhận',
    confirmLabel,
    cancelText = 'Hủy',
    variant = 'warning',
    isLoading = false,
    requireConfirmText,
    confirmPlaceholder,
    dangerText,
    dangerAction,
    isDarkTheme,
    zIndex = 2147483645
}) => {
    const [confirmInput, setConfirmInput] = useState('');
    const [localLoading, setLocalLoading] = useState(false);

    const activeLoading = isLoading || localLoading;
    const isConfirmDisabled = Boolean(
        activeLoading || (requireConfirmText && confirmInput.trim().toLowerCase() !== requireConfirmText.trim().toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setLocalLoading(false);
            setConfirmInput('');
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (activeLoading) return;
        setLocalLoading(true);
        try {
            await onConfirm();
        } finally {
            setLocalLoading(false);
        }
    };

    const variantStyles = {
        danger: {
            icon: AlertCircle,
            iconBg: 'var(--color-danger-light)',
            iconColor: 'var(--color-danger)',
            buttonClass: 'btn danger'
        },
        warning: {
            icon: AlertTriangle,
            iconBg: 'var(--color-warning-light)',
            iconColor: 'var(--color-warning)',
            buttonClass: 'btn primary'
        },
        info: {
            icon: Info,
            iconBg: 'var(--color-info-light)',
            iconColor: 'var(--color-info)',
            buttonClass: 'btn primary'
        },
        success: {
            icon: CheckCircle2,
            iconBg: 'var(--color-success-light)',
            iconColor: 'var(--color-success)',
            buttonClass: 'btn success'
        }
    };

    const styles = variantStyles[variant];
    const Icon = styles.icon;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { if (!activeLoading) onClose(); }}
            title={title}
            size="sm"
            isLoading={false}
            isDarkTheme={isDarkTheme}
            zIndex={zIndex}
            footer={
                <div className="flex items-center justify-end gap-2.5 w-full">
                    {dangerText && dangerAction && (
                        <button
                            type="button"
                            onClick={dangerAction}
                            disabled={activeLoading}
                            className="btn danger mr-auto font-semibold text-sm"
                        >
                            {dangerText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={activeLoading}
                        className="btn outline font-semibold text-sm"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isConfirmDisabled}
                        className={`${styles.buttonClass} font-semibold text-sm inline-flex items-center gap-1.5`}
                    >
                        {activeLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                <span>{confirmLabel || confirmText}...</span>
                            </>
                        ) : (
                            confirmLabel || confirmText
                        )}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4 py-1">
                <div className="flex items-start gap-3.5">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: styles.iconBg, color: styles.iconColor }}
                    >
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5 text-sm leading-relaxed text-[var(--color-text)] whitespace-pre-line">
                        {typeof message === 'string' ? message.split('\n').map((line, i, arr) => (
                            <React.Fragment key={i}>
                                {line}
                                {i < arr.length - 1 && <br />}
                            </React.Fragment>
                        )) : message}
                    </div>
                </div>

                {requireConfirmText && (
                    <div className="mt-2 w-full text-left p-4 rounded-[var(--radius-lg)] bg-[var(--color-bg)] border border-[var(--color-border)] space-y-2.5">
                        <label className="text-xs font-semibold text-[var(--color-text-light)] block">
                            Nhập <span className="text-[var(--color-text)] font-bold select-all px-1.5 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded">"{requireConfirmText}"</span> để xác nhận tiếp tục:
                        </label>
                        <input
                            type="text"
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder={confirmPlaceholder || 'Nhập mã xác nhận...'}
                            className="form-input w-full"
                            autoFocus
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ConfirmModal;


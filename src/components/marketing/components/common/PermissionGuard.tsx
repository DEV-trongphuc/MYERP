import React, { useState } from 'react';
import { ShieldX, Lock } from 'lucide-react';
import Modal from './Modal';

// ─── Permission Modal ──────────────────────────────────────────────────────────
const PermissionDeniedModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    action?: string;
}> = ({ isOpen, onClose, action }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="sm"
            noHeader
        >
            <div className="flex flex-col items-center text-center gap-4 py-2">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center">
                    <ShieldX className="w-8 h-8 text-rose-500" />
                </div>

                {/* Text */}
                <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 mb-1">
                        Không đủ quyền truy cập
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {action
                            ? <>Bạn không có quyền thực hiện <b className="text-slate-700 dark:text-slate-300">{action}</b>.</>
                            : 'Bạn không có quyền thực hiện thao tác này.'
                        }
                        <br />
                        <span className="text-xs mt-1 block">Vui lòng liên hệ <b>Admin</b> để được cấp quyền.</span>
                    </p>
                </div>

                {/* Button */}
                <button
                    onClick={onClose}
                    className="w-full py-2.5 px-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-700 dark:hover:bg-white transition-colors"
                >
                    Đã hiểu
                </button>
            </div>
        </Modal>
    );
};

// ─── PermissionGuard ───────────────────────────────────────────────────────────
/**
 * Wraps any clickable element. If user does NOT have permission, clicking
 * shows a "no permission" modal instead of performing the action.
 *
 * Usage:
 * <PermissionGuard allowed={isAdmin} action="xóa chiến dịch">
 *   <button onClick={handleDelete}>Xóa</button>
 * </PermissionGuard>
 */
interface PermissionGuardProps {
    /** Whether the current user has permission */
    allowed: boolean;
    /** Human-readable description of the action for the modal */
    action?: string;
    children: React.ReactNode;
    /** Additional class on the wrapper div */
    className?: string;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
    allowed,
    action,
    children,
    className = '',
}) => {
    const [modalOpen, setModalOpen] = useState(false);

    if (allowed) {
        // Pass-through: render children normally
        return <>{children}</>;
    }

    // Not allowed: intercept click and show modal
    return (
        <>
            <div
                className={`relative inline-flex ${className}`}
                style={{ cursor: 'not-allowed' }}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setModalOpen(true);
                }}
                title="Bạn không có quyền thực hiện thao tác này"
            >
                {/* Overlay to capture clicks on disabled children */}
                <div className="absolute inset-0 z-10 rounded-inherit" />
                {/* Lock badge */}
                <span className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center shadow-sm">
                    <Lock className="w-2.5 h-2.5 text-white" />
                </span>
                {/* Children with reduced opacity */}
                <div className="opacity-50 pointer-events-none select-none">
                    {children}
                </div>
            </div>

            <PermissionDeniedModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                action={action}
            />
        </>
    );
};

export default PermissionGuard;

// Also export the modal standalone for programmatic use
export { PermissionDeniedModal };

// ─── Hook: usePermissionGuard ─────────────────────────────────────────────────
/**
 * Returns a handler that checks permission before executing an action.
 * Useful for cases where you need to guard onClick handlers directly.
 *
 * Usage:
 * const { guard, PermModal } = usePermissionGuard(isAdmin);
 * <button onClick={guard(handleDelete, 'xóa chiến dịch')}>Xóa</button>
 * {PermModal}
 */
export function usePermissionGuard(allowed: boolean) {
    const [modal, setModal] = useState<{ open: boolean; action?: string }>({ open: false });

    const guard = (fn: (...args: any[]) => void, action?: string) => (...args: any[]) => {
        if (allowed) {
            fn(...args);
        } else {
            setModal({ open: true, action });
        }
    };

    const PermModal = (
        <PermissionDeniedModal
            isOpen={modal.open}
            onClose={() => setModal({ open: false })}
            action={modal.action}
        />
    );

    return { guard, PermModal };
}

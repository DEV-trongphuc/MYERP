import React from 'react';
import Modal from '../../../common/Modal';
import { X, Download, Edit3, Globe, Trash2 } from 'lucide-react';

interface ImagePreviewModalProps {
    previewImage: string | null;
    onClose: () => void;
    onDownload: () => void;
    onEdit: (e: React.MouseEvent) => void;
    onMakeGlobal?: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    isGlobal?: boolean;
    isDarkTheme?: boolean;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
    previewImage,
    onClose,
    onDownload,
    onEdit,
    onMakeGlobal,
    onDelete,
    isGlobal,
    isDarkTheme = false
}) => {
    return (
        <Modal
            isOpen={!!previewImage}
            onClose={onClose}
            noHeader={true}
            noPadding={true}
            size="full"
            isDarkTheme={isDarkTheme}
        >
            <div className="relative w-full h-full flex items-center justify-center bg-black group select-none" onClick={onClose}>
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 backdrop-blur-md"
                >
                    <X className="w-6 h-6" />
                </button>

                {previewImage && (
                    <div className="relative flex items-center justify-center max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={previewImage}
                            className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                            alt="Preview"
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/60 backdrop-blur-md p-2 rounded-full border border-white/10">
                            <a
                                href={previewImage}
                                download={`image_${Date.now()}.png`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDownload();
                                }}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                title="Download"
                            >
                                <Download className="w-5 h-5" />
                            </a>
                            <button
                                onClick={onEdit}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                title="Edit with AI"
                            >
                                <Edit3 className="w-5 h-5" />
                            </button>
                            {onMakeGlobal && !isGlobal && (
                                <button
                                    onClick={onMakeGlobal}
                                    className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors hover:bg-emerald-500/20 hover:text-emerald-400"
                                    title="Make Global"
                                >
                                    <Globe className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                onClick={onDelete}
                                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors hover:text-rose-500 hover:bg-rose-500/10"
                                title="Delete"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ImagePreviewModal;

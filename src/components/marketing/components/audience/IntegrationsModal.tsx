import * as React from 'react';
import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { ChevronRight } from 'lucide-react';

const GoogleSheetsSetup = React.lazy(() => import('./GoogleSheetsSetup'));
const MisaSetup = React.lazy(() => import('./MisaSetup'));

interface IntegrationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingIntegration?: any;
}

const IntegrationsModal: React.FC<IntegrationsModalProps> = ({ isOpen, onClose, editingIntegration }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    useEffect(() => {
        if (editingIntegration) {
            setSelectedType(editingIntegration.type);
        } else {
            setSelectedType(null);
        }
    }, [editingIntegration, isOpen]);

    const renderContent = () => {
        if (selectedType === 'google_sheets') {
            return (
                <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--color-text-muted)]">Đang tải cấu hình...</div>}>
                    <GoogleSheetsSetup
                        onBack={() => editingIntegration ? onClose() : setSelectedType(null)}
                        onComplete={onClose}
                        initialData={editingIntegration}
                    />
                </React.Suspense>
            );
        }
        if (selectedType === 'misa') {
            return (
                <React.Suspense fallback={<div className="p-8 text-center text-xs text-[var(--color-text-muted)]">Đang tải cấu hình...</div>}>
                    <MisaSetup
                        onBack={() => editingIntegration ? onClose() : setSelectedType(null)}
                        onComplete={onClose}
                        initialData={editingIntegration}
                    />
                </React.Suspense>
            );
        }

        return (
            <div className="p-8 space-y-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Chọn nguồn dữ liệu</h3>
                    <p className="text-sm text-slate-500 mt-1">Kết nối với các ứng dụng bên ngoài để tự động đồng bộ Khách hàng.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {/* Google Sheets */}
                    <div
                        onClick={() => setSelectedType('google_sheets')}
                        className="group flex items-center p-4 border border-slate-200 rounded-2xl hover:border-green-500 hover:bg-green-50/30 cursor-pointer transition-all"
                    >
                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center p-2 shadow-sm group-hover:scale-110 transition-transform">
                            <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-full h-full object-contain" alt="Google Sheets" />
                        </div>
                        <div className="ml-4 flex-1">
                            <h4 className="font-bold text-slate-800 group-hover:text-green-700">Google Sheets</h4>
                            <p className="text-xs text-slate-500">Đồng bộ từ bảng tính online</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-green-500" />
                    </div>

                    {/* MISA CRM */}
                    <div
                        onClick={() => setSelectedType('misa')}
                        className="group flex items-center p-4 border border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer transition-all"
                    >
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 border border-slate-100 shadow-sm group-hover:scale-110 transition-transform">
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s" className="w-full h-full object-contain" alt="MISA AMIS CRM" />
                        </div>
                        <div className="ml-4 flex-1">
                            <h4 className="font-bold text-slate-800 group-hover:text-blue-700">MISA AMIS CRM</h4>
                            <p className="text-xs text-slate-500">Đồng bộ Khách hàng từ CRM</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                    </div>
                </div>
            </div>
        );
    };

    const getTitle = () => {
        if (selectedType === 'google_sheets') return "Kết nối Google Sheets";
        if (selectedType === 'misa') return "Kết nối MISA AMIS CRM";
        return "Tích hợp mới";
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={getTitle()}
            size="lg"
            noPadding={true}
        >
            {renderContent()}
        </Modal>
    );
};

export default IntegrationsModal;

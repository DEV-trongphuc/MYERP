import React, { useState } from 'react';
import { ShieldAlert, FileInput, ShoppingCart, Zap, BookOpen, Database, CheckCircle2 } from 'lucide-react';
import PageHero from '../components/common/PageHero';
import Tabs from '../components/common/Tabs';
import FormsTab from '../components/triggers/FormsTab';
import PurchasesTab from '../components/triggers/PurchasesTab';
import CustomEventsTab from '../components/triggers/CustomEventsTab';
import OTPTriggersTab from '../components/triggers/OTPTriggersTab';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';

const DB_FIELDS_REF = [
    { field: 'email', type: 'String', req: 'YES', desc: 'Định danh Khách hàng duy nhất (Bắt buộc).' },
    { field: 'firstName', type: 'String', req: 'No', desc: 'Tên Khách hàng (First Name).' },
    { field: 'lastName', type: 'String', req: 'No', desc: 'Họ Khách hàng (Last Name).' },
    { field: 'phoneNumber', type: 'String', req: 'No', desc: 'Số điện thoại.' },
    { field: 'gender', type: 'String', req: 'No', desc: 'Giới tính (male / female / other).' },
    { field: 'dateOfBirth', type: 'Date', req: 'No', desc: 'Ngày sinh, định dạng YYYY-MM-DD.' },
    { field: 'tags', type: 'Array', req: 'No', desc: 'Mảng các thẻ nhãn phân loại (VD: ["VIP", "Lead"]).' },
    { field: 'city', type: 'String', req: 'No', desc: 'Thành phố.' },
    { field: 'country', type: 'String', req: 'No', desc: 'Quốc gia.' },
    { field: 'jobTitle', type: 'String', req: 'No', desc: 'Chức danh công việc.' },
    { field: 'companyName', type: 'String', req: 'No', desc: 'Tên công ty / tổ chức.' },
];

const ApiTriggers: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'forms' | 'purchases' | 'custom' | 'otp'>('forms');
    const [showDocs, setShowDocs] = useState(false);

    return (
        <div className="animate-fade-in space-y-8  mx-auto pb-40">
            <PageHero
                title={<>API & <span className="text-slate-500 dark:text-slate-400">Events</span></>}
                subtitle="Quản lý Biểu mẫu, Đơn hàng và Sự kiện thông qua hệ thống API Webhook."
                showStatus={true}
                statusText="API Gateway Online"
                actions={[
                    { label: 'Tài liệu Data', icon: BookOpen, onClick: () => setShowDocs(true), primary: true }
                ]}
            />

            <div className="bg-white rounded-3xl lg:rounded-[32px] border border-slate-200 shadow-sm p-4 lg:p-6 min-h-[600px]">
                <Tabs
                    activeId={activeTab}
                    onChange={setActiveTab as any}
                    variant="segmented"
                    className="mb-8"
                    items={[
                        { id: 'forms', label: 'Biểu mẫu (Forms)', icon: FileInput },
                        { id: 'purchases', label: 'Mua hàng (Purchases)', icon: ShoppingCart },
                        { id: 'custom', label: 'Sự kiện (Custom)', icon: Zap },
                        { id: 'otp', label: 'OTP & Access', icon: ShieldAlert },
                    ]}
                />

                <div className="animate-in fade-in duration-300">
                    {activeTab === 'forms' && <FormsTab />}
                    {activeTab === 'purchases' && <PurchasesTab />}
                    {activeTab === 'custom' && <CustomEventsTab />}
                    {activeTab === 'otp' && <OTPTriggersTab />}
                </div>
            </div>

            {/* GLOBAL DATABASE REFERENCE MODAL */}
            <Modal isOpen={showDocs} onClose={() => setShowDocs(false)} title="Cấu trúc Dữ liệu Khách hàng (Database)" size="lg">
                <div className="space-y-6 pb-6">
                    <div className="p-5 bg-blue-50 border border-blue-100 rounded-[24px] flex gap-4">
                        <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm h-fit"><Database className="w-6 h-6" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-blue-900 uppercase tracking-tight">Quy chuẩn trường dữ liệu</h4>
                            <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                                Khi gọi API (Purchase, Custom Event hoặc Form), bạn có thể gửi kèm các thông tin dưới đây để hệ thống tự động cập nhật vào hồ sơ Khách hàng (Subscriber Profile).
                            </p>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider">
                                <tr>
                                    <th className="px-5 py-4">Tên trường (Key)</th>
                                    <th className="px-5 py-4">Loại dữ liệu</th>
                                    <th className="px-5 py-4">Mô tả chi tiết</th>
                                    <th className="px-5 py-4 text-right">Bắt buộc</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {DB_FIELDS_REF.map((f, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 font-mono text-blue-600 font-bold text-sm">{f.field}</td>
                                        <td className="px-5 py-3 text-slate-500 font-medium">{f.type}</td>
                                        <td className="px-5 py-3 text-slate-700">{f.desc}</td>
                                        <td className="px-5 py-3 text-right">
                                            {f.req === 'YES' ? (
                                                <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                                                    <CheckCircle2 className="w-4 h-4" /> YES
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 font-bold">NO</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ApiTriggers;

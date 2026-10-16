import { API_BASE_URL } from '../../../utils/config';

import React, { useState } from 'react';
import { Copy, Check, Code, Globe, Terminal, FileCode, CheckCircle2, Info, BookOpen, Braces, List, Tag } from 'lucide-react';
import Modal from '../../common/Modal';
import { FormField } from '../../../types';

interface IntegrationGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    formId: string;
    formName: string;
    fields: FormField[];
}

const IntegrationGuideModal: React.FC<IntegrationGuideModalProps> = ({ isOpen, onClose, formId, formName, fields }) => {
    const [copied, setCopied] = useState<string | null>(null);
        const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/forms.php?route=submit`;

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    // Tự động sinh danh sách các trường cho code JS
    // [FIX] Custom fields dùng customKey làm key gửi API, không dùng '__custom__'
    const getFieldKey = (f: FormField) => f.isCustom ? (f.customKey || f.dbField) : f.dbField;
    const jsFields = fields.map(f => `        ${getFieldKey(f)}: "giá_trị_nhập_từ_web", // ${f.label}${f.isCustom ? ' (custom field)' : ''}`).join('\n');

    const htmlSnippet = `<!-- MailFlow Pro: Form Tích hợp cho "${formName}" -->
<form action="${endpoint}" method="POST">
    <!-- ID bắt buộc để hệ thống nhận diện kịch bản -->
    <input type="hidden" name="form_id" value="${formId}">
    
${fields.map(f => `    <div style="margin-bottom: 15px;">
        <label style="display:block; font-size:12px; font-weight:bold;">${f.label}:</label>
        <input type="${f.type}" name="${getFieldKey(f)}" ${f.required ? 'required' : ''} style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px;">
    </div>`).join('\n')}
    
    <button type="submit" style="background: #2563eb; color: white; padding: 12px 30px; border: none; cursor: pointer; border-radius: 8px; font-weight: bold; width: 100%;">
        ĐĂNG KÝ NGAY
    </button>
</form>`;

    const jsSnippet = `// Tích hợp bằng JavaScript (Fetch API)
const submitToMailFlow = async () => {
    const payload = {
        form_id: "${formId}",
${jsFields}
    };

    try {
        const response = await fetch("${endpoint}", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            alert("Cảm ơn bạn đã đăng ký!");
        } else {
            console.error("Lỗi từ server:", result.message);
        }
    } catch (err) {
        console.error("Lỗi kết nối API:", err);
    }
};`;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Tài liệu tích hợp API" size="lg">
            <div className="space-y-6 pb-10">
                <div className="p-6 bg-orange-50 border-2 border-orange-100 rounded-[32px] flex gap-5">
                    <div className="p-3 bg-white rounded-2xl text-[#ca7900] shadow-sm shrink-0 h-fit"><BookOpen className="w-6 h-6" /></div>
                    <div>
                        <p className="text-sm font-black text-orange-900 mb-1">Quy định tham số truyền tin</p>
                        <p className="text-[11px] text-orange-700 leading-relaxed font-medium">
                            Để kích hoạt Automation cho <b className="font-black">"${formName}"</b>, bạn phải gửi dữ liệu lên endpoint bằng phương thức <code className="bg-white px-1.5 py-0.5 rounded border border-orange-200">POST</code>. Dưới đây là danh sách các Key (trường dữ liệu) mà hệ thống yêu cầu:
                        </p>
                    </div>
                </div>

                {/* Bảng quy định các trường */}
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                        <List className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Danh sách Keys cần gửi</span>
                    </div>
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50/50 text-slate-400 font-bold uppercase text-[9px]">
                                <th className="px-5 py-2.5">Key tham số</th>
                                <th className="px-5 py-2.5">Tên hiển thị</th>
                                <th className="px-5 py-2.5">Kiểu dữ liệu</th>
                                <th className="px-5 py-2.5 text-right">Bắt buộc</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr>
                                <td className="px-5 py-3 font-mono text-blue-600 font-bold">form_id</td>
                                <td className="px-5 py-3 text-slate-500 italic">ID Biểu mẫu</td>
                                <td className="px-5 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold">STRING</span></td>
                                <td className="px-5 py-3 text-right"><CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" /></td>
                            </tr>
                            {fields.map(f => (
                                <tr key={f.id} className={f.isCustom ? 'bg-blue-50/40' : ''}>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-mono font-bold ${f.isCustom ? 'text-blue-600' : 'text-orange-600'}`}>
                                                {f.isCustom ? (f.customKey || f.dbField) : f.dbField}
                                            </span>
                                            {f.isCustom && (
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded">
                                                    <Tag className="w-2.5 h-2.5" /> custom
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-slate-700 font-medium">{f.label}</td>
                                    <td className="px-5 py-3"><span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold uppercase">{f.type}</span></td>
                                    <td className="px-5 py-3 text-right">
                                        {f.required ? <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" /> : <span className="text-[10px] text-slate-300 font-bold uppercase">Option</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="space-y-6">
                    {/* JS Snippet */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileCode className="w-3.5 h-3.5" /> JavaScript API (Fetch)</span>
                            <button onClick={() => handleCopy(jsSnippet, 'js')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                                {copied === 'js' ? <><Check className="w-3 h-3" /> ĐÃ CHÉP</> : <><Copy className="w-3 h-3" /> SAO CHÉP CODE</>}
                            </button>
                        </div>
                        <div className="bg-[#0f172a] rounded-3xl p-6 overflow-x-auto border-b-4 border-slate-800 shadow-xl">
                            <pre className="text-[11px] font-mono text-emerald-300 leading-relaxed">{jsSnippet}</pre>
                        </div>
                    </div>

                    {/* HTML Snippet */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> HTML Form Embed (Dán vào Website)</span>
                            <button onClick={() => handleCopy(htmlSnippet, 'html')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                                {copied === 'html' ? <><Check className="w-3 h-3" /> ĐÃ CHÉP</> : <><Copy className="w-3 h-3" /> SAO CHÉP CODE</>}
                            </button>
                        </div>
                        <div className="bg-[#0f172a] rounded-3xl p-6 overflow-x-auto border-b-4 border-slate-800 shadow-xl">
                            <pre className="text-[11px] font-mono text-indigo-200 leading-relaxed">{htmlSnippet}</pre>
                        </div>
                    </div>

                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-[28px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> API Endpoint (POST)</p>
                        <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-inner overflow-hidden">
                            <code className="text-[10px] text-slate-600 truncate font-mono">{endpoint}</code>
                            <button onClick={() => handleCopy(endpoint, 'url')} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 shrink-0">
                                {copied === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default IntegrationGuideModal;

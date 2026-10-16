import * as React from 'react';
import { useState, useEffect } from 'react';
import {
    X, Check, Loader2, Smartphone, Plus, Trash2,
    Image as ImageIcon, Type, Link as LinkIcon, BrainCircuit,
    AlertCircle, Info, ShieldCheck, FileCheck, Tag,
    Layout, MousePointerClick, AlignLeft
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Select from '../common/Select';
import ZbsGuidelinesModal from './ZbsGuidelinesModal';

interface ZaloTemplate {
    id: string;
    template_id: string;
    template_name: string;
    status: string;
    template_type: string;
    template_data: any; // JSON with detail & layout
    preview_data: any; // params
    oa_config_id?: string;
}

interface ZaloTemplateCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    oaId: string;
    onSuccess: () => void;
    editData?: ZaloTemplate | null;
}

// Helper types for our visual builder state
interface TemplateBuilderState {
    header: {
        type: 'LOGO' | 'IMAGE';
        light_image?: string; // media_id
        dark_image?: string; // media_id
    };
    body: {
        title: string;
        content: string; // The main paragraph
        hasTable: boolean;
        tableRows: { title: string; value: string }[];
        otp?: string;
        voucher?: { name: string; condition: string; voucher_code: string; start_date: string; end_date: string };
        payment?: { bank_code: string; account_name: string; account_number: string; amount: string; note: string };
    };
    footer: {
        buttons: { title: string; type: string; value: string }[];
    };
}

const TEMPLATE_TYPES = [
    { value: '1', label: 'Tùy chỉnh (Giao dịch)', desc: 'Thông báo đơn hàng, lịch hẹn, cập nhật Trạng thái', icon: FileCheck },
    { value: '2', label: 'Mã xác thực (OTP)', desc: 'Gửi mã OTP xác thực người dùng', icon: ShieldCheck },
    { value: '3', label: 'Yêu cầu thanh toán', desc: 'Gửi thông tin chuyển khoản, thanh toán hoá đơn', icon: Layout },
    { value: '4', label: 'Hậu mãi (Voucher)', desc: 'Chăm sóc Khách hàng, gửi mã giảm giá', icon: Tag },
    { value: '5', label: 'Đánh giá dịch vụ', desc: 'Thu thập đánh giá từ Khách hàng sau dịch vụ', icon: Check },
];

const TAG_OPTIONS = [
    { value: '1', label: 'Giao dịch (Transaction)' },
    { value: '2', label: 'Chăm sóc Khách hàng (CSKH)' },
    { value: '3', label: 'Quảng cáo (Promotion)' }
];

const PARAM_TYPES = [
    { value: '1', label: 'Tên Khách hàng (String)' },
    { value: '2', label: 'Số điện thoại (Phone)' },
    { value: '3', label: 'Địa chỉ (Address)' },
    { value: '4', label: 'Mã số (Code)' },
    { value: '5', label: 'Nhãn tùy chỉnh (Label)' },
    { value: '6', label: 'Trạng thái giao dịch' },
    { value: '7', label: 'Thông tin liên hệ' },
    { value: '8', label: 'Giới tính / Danh xưng' },
    { value: '9', label: 'Tên sản phẩm / Thương hiệu' },
    { value: '10', label: 'Số lượng / Số tiền' },
    { value: '11', label: 'Thời gian' },
    { value: '12', label: 'OTP' },
    { value: '13', label: 'URL' },
    { value: '14', label: 'Tiền tệ (VNĐ)' },
    { value: '15', label: 'Ghi chú chuyển khoản' }
];

const BUTTON_TYPES = [
    { value: '1', label: 'Mở Website (Link)' },
    { value: '2', label: 'Gọi điện (Call)' }
];

const ZaloTemplateCreateModal: React.FC<ZaloTemplateCreateModalProps> = ({ isOpen, onClose, oaId, onSuccess, editData }) => {
    // Basic Info
    const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState('1');
    const [tag, setTag] = useState('1');
    const [note, setNote] = useState('');

    // Visual Builder State
    const [builder, setBuilder] = useState<TemplateBuilderState>({
        header: { type: 'LOGO', light_image: '', dark_image: '' },
        body: {
            title: 'Tiêu đề thông báo',
            content: 'Xin chào <customer_name>, đơn hàng <order_code> của bạn đã được xác nhận.',
            hasTable: false,
            tableRows: [
                { title: 'Mã Khách hàng', value: '<customer_code>' },
                { title: 'Tổng tiền', value: '<amount>' }
            ],
            otp: '<otp>',
            voucher: { name: 'Giảm 10%', condition: 'Đơn > 500k', voucher_code: '<code_voucher>', start_date: '<start>', end_date: '<end>' },
            payment: { bank_code: '9704xx', account_name: 'CONG TY ABC', account_number: '123456789', amount: '<amount>', note: 'THANH TOAN DON HANG' }
        },
        footer: {
            buttons: [
                { title: 'Xem chi tiết', type: '1', value: 'https://example.com' }
            ]
        }
    });

    // Auto-detected Params
    const [detectedParams, setDetectedParams] = useState<{ name: string, type: string, sample_value: string }[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrls, setPreviewUrls] = useState<{ logo?: string; banner?: string }>({});

    useEffect(() => {
        // Auto-select correct Tag base on Template Type rules
        if (type === '2' || type === '3') setTag('1');
        else if (type === '5') setTag('2');
    }, [type]);

    // Initial Load - Check for Edit Data
    useEffect(() => {
        if (isOpen && editData) {
            // Safe Parse Helper
            const safeParse = (data: any) => {
                if (typeof data === 'string') {
                    try { return JSON.parse(data); } catch (e) { return {}; }
                }
                return data || {};
            };

            const parsedTemplateData = safeParse(editData.template_data);
            const parsedPreviewData = safeParse(editData.preview_data); // Array of params



            // Mapping helpers
            const mapType = (t: string) => {
                const s = t.toLowerCase();
                if (s.includes('otp')) return '2';
                if (s.includes('billing') || s.includes('finance')) return '3';
                if (s.includes('promotion') || s.includes('ad')) return '4';
                if (s.includes('transaction')) return '1';
                if (s.includes('cs') || s.includes('care')) return '5';
                return t || '1';
            };
            const mapTag = (t: string) => {
                const s = t.toLowerCase();
                if (s.includes('transaction')) return '1';
                if (s.includes('care') || s.includes('cs')) return '2';
                if (s.includes('promotion') || s.includes('ad')) return '3';
                return t || '1';
            };

            // Populate form with existing data
            setName(editData.template_name);
            setType(mapType(String(editData.template_type || '1')));

            // Try to find tag in multiple places
            const rawData = parsedTemplateData.raw || {};
            const detailData = parsedTemplateData.detail || {};

            const tagValue = (editData as any).tag || detailData.templateTag || rawData.tag || '1';
            setTag(mapTag(String(tagValue)));

            // Reconstruct Builder State from Layout
            // Priority: Local Layout > Zalo Detail Layout > Raw Data Layout
            const layout = parsedTemplateData.layout || detailData.layout || rawData.layout;

            if (!layout) {
                console.warn("Layout data missing for template ID:", editData.template_id);
            }

            const activeLayout = layout || {};
            const layoutBody = activeLayout.body || detailData.layout?.body || {};
            const layoutHeader = activeLayout.header || detailData.layout?.header || {};
            const layoutFooter = activeLayout.footer || detailData.layout?.footer || {};

            let newHeader = { type: 'LOGO' as 'LOGO' | 'IMAGE', light_image: '', dark_image: '' };
            let newBody = {
                title: '',
                content: '',
                hasTable: false,
                tableRows: [] as any[],
                otp: '',
                voucher: undefined as any,
                payment: undefined as any
            };
            let newFooter = { buttons: [] as any[] };

            // Parse Header
            if (layoutHeader && Array.isArray(layoutHeader.components)) {
                const comps = layoutHeader.components;
                const logoComp = comps.find((c: any) => c.LOGO || c.logo);
                const imgComp = comps.find((c: any) => c.IMAGES || c.images);

                if (logoComp) {
                    const data = logoComp.LOGO || logoComp.logo;
                    newHeader.type = 'LOGO';
                    newHeader.light_image = data.light?.media_id || '';
                    newHeader.dark_image = data.dark?.media_id || '';
                } else if (imgComp) {
                    const data = imgComp.IMAGES || imgComp.images || imgComp.BANNER || imgComp.banner;
                    newHeader.type = 'IMAGE';
                    if (data.items) {
                        const item = data.items?.[0] || {};
                        newHeader.light_image = item.media_id || '';
                        newHeader.dark_image = item.media_id || '';
                    } else {
                        newHeader.light_image = data.media_id || '';
                        newHeader.dark_image = data.media_id || '';
                    }
                }
            }

            // Parse Body
            if (layoutBody && Array.isArray(layoutBody.components)) {
                const comps = layoutBody.components;
                const titleComp = comps.find((c: any) => c.TITLE || c.title);
                const paraComp = comps.find((c: any) => c.PARAGRAPH || c.paragraph);
                const tableComp = comps.find((c: any) => c.TABLE || c.table);

                newBody.title = (titleComp?.TITLE || titleComp?.title)?.value || '';
                newBody.content = (paraComp?.PARAGRAPH || paraComp?.paragraph)?.value || '';
                newBody.hasTable = !!tableComp;
                const tbl = tableComp?.TABLE || tableComp?.table;
                newBody.tableRows = tbl?.rows?.map((r: any) => ({
                    title: r.title || '',
                    value: r.value || ''
                })) || [];

                const otpComp = comps.find((c: any) => c.OTP || c.otp);
                newBody.otp = (otpComp?.OTP || otpComp?.otp)?.value || '<otp>';

                const vComp = comps.find((c: any) => c.VOUCHER || c.voucher);
                const vData = vComp?.VOUCHER || vComp?.voucher;
                if (vData) {
                    newBody.voucher = {
                        ...vData,
                        voucher_code: vData.voucher_code || vData.code || '<code_voucher>'
                    };
                } else {
                    newBody.voucher = { name: 'Giảm 10%', condition: 'Đơn > 500k', voucher_code: '<code_voucher>', start_date: '<start>', end_date: '<end>' };
                }

                const pComp = comps.find((c: any) => c.PAYMENT || c.payment);
                const pData = pComp?.PAYMENT || pComp?.payment;
                if (pData) {
                    newBody.payment = pData;
                } else {
                    newBody.payment = { bank_code: '9704xx', account_name: 'CONG TY ABC', account_number: '123456789', amount: '<amount>', note: 'THANH TOAN DON HANG' };
                }
            } else {
                // FALLBACK: If absolutely no layout, but we have text in detail (rare but possible)
                // or just set a placeholder to help the user
                if (!layout) {
                    newBody.content = "Nội dung template này chưa được đồng bộ từ Zalo. Vui lòng nhập nội dung ở đây.";
                }
            }

            // Parse Footer
            if (layoutFooter && Array.isArray(layoutFooter.components)) {
                const comps = layoutFooter.components;
                const btnComp = comps.find((c: any) => c.BUTTONS || c.buttons);
                const bData = btnComp?.BUTTONS || btnComp?.buttons;
                if (bData?.items) {
                    newFooter.buttons = bData.items.map((b: any) => ({
                        title: b.title || '',
                        type: String(b.type || '1'),
                        value: b.content || b.value || ''
                    }));
                }
            } else if (detailData.listButtons) {
                // Fallback for Synced Templates with no Layout
                newFooter.buttons = detailData.listButtons.map((b: any) => ({
                    title: b.title || '',
                    type: String(b.type === 3 ? '1' : b.type || '1'),
                    value: b.content || '#'
                }));
            }

            console.log("Zalo Debug - Edit Template Data:", {
                templateId: editData.template_id,
                hasLayout: !!layout,
                layoutSource: parsedTemplateData.layout ? 'local' : (detailData.layout ? 'detail' : 'none'),
                newBody,
                fullData: editData
            });

            setBuilder({
                header: newHeader,
                body: newBody,
                footer: newFooter
            });

            // Existing params
            if (Array.isArray(parsedPreviewData) && parsedPreviewData.length > 0) {
                setDetectedParams(parsedPreviewData.map((p: any) => ({
                    name: p.name,
                    type: String(p.type || '1'),
                    sample_value: p.sample_value || ''
                })));
            } else if (Array.isArray(detailData.listParams)) {
                // Fallback for Synced Params
                setDetectedParams(detailData.listParams.map((p: any) => ({
                    name: p.name,
                    type: '1', // Default to string as API returns 'STRING' etc which needs mapping logic if we want perfection, but '1' is safe
                    sample_value: `${p.name}_sample`
                })));
            }


        } else if (isOpen && !editData) {
            // Reset to defaults for Create mode
            setName('');
            setType('1');
            setTag('1');
            setNote('');
            setBuilder({
                header: { type: 'LOGO', light_image: '', dark_image: '' },
                body: {
                    title: 'Tiêu đề thông báo',
                    content: 'Xin chào <customer_name>, đơn hàng <order_code> của bạn đã được xác nhận.',
                    hasTable: false,
                    tableRows: [
                        { title: 'Mã Khách hàng', value: '<customer_code>' },
                        { title: 'Tổng tiền', value: '<amount>' }
                    ],
                    otp: '<otp>',
                    voucher: { name: 'Giảm 10%', condition: 'Đơn > 500k', voucher_code: '<code_voucher>', start_date: '<start>', end_date: '<end>' },
                    payment: { bank_code: '9704xx', account_name: 'CONG TY ABC', account_number: '123456789', amount: '<amount>', note: 'THANH TOAN DON HANG' }
                },
                footer: {
                    buttons: [
                        { title: 'Xem chi tiết', type: '1', value: 'https://example.com' }
                    ]
                }
            });
            setDetectedParams([]);
        }
    }, [isOpen, editData]);


    // Auto-detect params from content when builder state changes 
    // IMPORTANT: Only do this if NOT in edit mode initially, or be careful not to overwrite existing param types
    // actually, for better UX in Edit, we should probably merge: detect new ones, keep existing ones.
    useEffect(() => {
        let textToScan = `${builder.body.title} ${builder.body.content}`;

        // Only include table in scan if it's enabled
        if (builder.body.hasTable) {
            textToScan += ` ${builder.body.tableRows.map(r => r.value).join(' ')}`;
        }

        // Scan special fields based on Type
        if (type === '2' && builder.body.otp) textToScan += ` ${builder.body.otp}`;
        if (type === '4' && builder.body.voucher) textToScan += ` ${builder.body.voucher.voucher_code} ${builder.body.voucher.start_date} ${builder.body.voucher.end_date}`;
        if (type === '3' && builder.body.payment) textToScan += ` ${builder.body.payment.amount}`;

        const regex = /<(\w+)>/g;
        const matches = new Set<string>();
        let match;
        while ((match = regex.exec(textToScan)) !== null) {
            matches.add(match[1]);
        }

        setDetectedParams(prev => {
            const newParams = Array.from(matches).map(paramName => {
                const existing = prev.find(p => p.name === paramName);
                if (existing) return existing;

                // Intelligent default sample values based on name
                let sampleValue = 'Dữ liệu mẫu';
                const lower = paramName.toLowerCase();
                if (lower.includes('name') || lower.includes('customer')) sampleValue = 'Nguyễn Văn A';
                else if (lower.includes('phone')) sampleValue = '0901234567';
                else if (lower.includes('code') || lower.includes('id')) sampleValue = 'DH' + Math.floor(1000 + Math.random() * 9000);
                else if (lower.includes('date')) sampleValue = '25/12/2024';
                else if (lower.includes('amount') || lower.includes('price')) sampleValue = '1.000.000đ';
                else if (lower.includes('otp')) sampleValue = '123456';

                return {
                    name: paramName,
                    type: '1',
                    sample_value: sampleValue
                };
            });

            // Simple deep compare to avoid unnecessary re-renders
            if (JSON.stringify(newParams) === JSON.stringify(prev)) return prev;
            return newParams;
        });
    }, [builder.body]);

    // Construct final JSON payload for Zalo API
    const constructPayload = () => {
        // 1. Construct Layout
        const layout: any = {
            header: { components: [] },
            body: { components: [] },
            footer: { components: [] }
        };

        // Header
        if (builder.header.type === 'LOGO') {
            layout.header.components.push({
                LOGO: {
                    light: { type: 'IMAGE', media_id: builder.header.light_image || 'sample_id' },
                    dark: { type: 'IMAGE', media_id: builder.header.dark_image || 'sample_id' }
                }
            });
        } else {
            layout.header.components.push({
                IMAGES: {
                    items: [{ type: 'IMAGE', media_id: builder.header.light_image || 'sample_id' }]
                }
            });
        }

        // Body - Title
        layout.body.components.push({ TITLE: { value: builder.body.title } });
        // Body - Paragraph
        layout.body.components.push({ PARAGRAPH: { value: builder.body.content } });
        // Body - Table (Optional)
        if (builder.body.hasTable && builder.body.tableRows.length > 0) {
            layout.body.components.push({
                TABLE: {
                    rows: builder.body.tableRows.map(r => ({
                        title: r.title,
                        value: r.value
                    }))
                }
            });
        }

        // Body - Special Components based on Type
        if (type === '2' && builder.body.otp) {
            layout.body.components.push({ OTP: { value: builder.body.otp } });
        }
        if (type === '3' && builder.body.payment) {
            layout.body.components.push({ PAYMENT: builder.body.payment });
        }
        if (type === '4' && builder.body.voucher) {
            layout.body.components.push({
                VOUCHER: {
                    name: builder.body.voucher.name,
                    condition: builder.body.voucher.condition,
                    voucher_code: builder.body.voucher.voucher_code,
                    start_date: builder.body.voucher.start_date,
                    end_date: builder.body.voucher.end_date
                }
            });
        }

        // Footer - Buttons
        if (builder.footer.buttons.length > 0) {
            layout.footer.components.push({
                BUTTONS: {
                    items: builder.footer.buttons.map(b => ({
                        title: b.title,
                        type: parseInt(b.type),
                        content: b.value
                    }))
                }
            });
        }

        // 2. Construct Params - Direct use of numeric type IDs as per Doc
        const params = detectedParams.map(p => ({
            name: p.name,
            type: p.type, // Map directly to "1", "11", "15" etc.
            sample_value: p.sample_value
        }));

        return { layout, params };
    };

    const handleSubmit = async () => {
        setError(null);
        if (!name) { setError("Vui lòng nhập tên Template"); return; }
        if (name.length < 10 || name.length > 60) {
            setError("Tên Template phải từ 10 đến 60 ký tự theo quy định của Zalo.");
            return;
        }

        // Validate Param names length (min 3 chars as per Zalo rules)
        const invalidParams = detectedParams.filter(p => p.name.length < 3);
        if (invalidParams.length > 0) {
            setError(`Tham số <${invalidParams[0].name}> quá ngắn. Zalo yêu cầu tên tham số phải từ 3 đến 36 ký tự. Vui lòng đổi tên biến trong nội dung.`);
            return;
        }

        setIsLoading(true);

        try {
            const payloadData = constructPayload();

            // Base payload
            const payload: any = {
                oa_config_id: oaId,
                template_name: name,
                template_type: type,
                tag: tag,
                layout: payloadData.layout,
                params: payloadData.params,
                note: note || "Tạo từ hệ thống DOMATION",
                tracking_id: (editData ? "edit_" : "create_") + Date.now()
            };

            // Switch Endpoint based on Edit Mode
            let endpoint = 'zalo_templates';
            if (editData) {
                endpoint = 'zalo_templates?route=edit';
                payload.template_id = editData.template_id; // Important for edit
            }

            const res = await api.post(endpoint, payload);

            if (res.success) {
                onSuccess();
                onClose();
            } else {
                setError(res.message || (editData ? "Cập nhật thất bại." : "Tạo template thất bại."));
            }
        } catch (err: any) {
            setError(err.message || "Đã có lỗi xảy ra");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        if (file.size > 500 * 1024) {
            setError("File quá lớn. Tối đa 500KB.");
            return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            setError("Chỉ chấp nhận định dạng JPG hoặc PNG.");
            return;
        }

        // Generate local preview URL immediately
        const localUrl = URL.createObjectURL(file);
        if (builder.header.type === 'LOGO') {
            setPreviewUrls(prev => ({ ...prev, logo: localUrl }));
        } else {
            setPreviewUrls(prev => ({ ...prev, banner: localUrl }));
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('oa_config_id', oaId);

            const res = await api.post<{ media_id: string }>('zalo_templates?route=upload_image', formData);

            if (res.success && res.data && res.data.media_id) {
                setBuilder(prev => ({
                    ...prev,
                    header: {
                        ...prev.header,
                        light_image: res.data.media_id,
                        dark_image: res.data.media_id
                    }
                }));
            } else {
                setError(res.message || "Upload ảnh thất bại.");
            }
        } catch (err: any) {
            setError("Lỗi kết nối: " + err.message);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    // --- Visual Form Handlers ---
    const updateBody = (field: keyof TemplateBuilderState['body'], value: any) => {
        setBuilder(prev => ({ ...prev, body: { ...prev.body, [field]: value } }));
    };

    const addTableRow = () => {
        setBuilder(prev => ({
            ...prev,
            body: {
                ...prev.body,
                tableRows: [...prev.body.tableRows, { title: 'Tiêu đề', value: 'Giá trị' }]
            }
        }));
    };

    const removeTableRow = (index: number) => {
        const newRows = [...builder.body.tableRows];
        newRows.splice(index, 1);
        updateBody('tableRows', newRows);
    };

    const updateTableRow = (index: number, field: 'title' | 'value', val: string) => {
        const newRows = [...builder.body.tableRows];
        newRows[index][field] = val;
        updateBody('tableRows', newRows);
    };

    const addButton = () => {
        if (builder.footer.buttons.length >= 2) return;
        setBuilder(prev => ({
            ...prev,
            footer: {
                buttons: [...prev.footer.buttons, { title: 'Nút hành động', type: '1', value: '' }]
            }
        }));
    };

    const updateButton = (index: number, field: string, val: string) => {
        const newButtons = [...builder.footer.buttons];
        (newButtons[index] as any)[field] = val;
        setBuilder(prev => ({ ...prev, footer: { buttons: newButtons } }));
    };

    const removeButton = (index: number) => {
        const newButtons = [...builder.footer.buttons];
        newButtons.splice(index, 1);
        setBuilder(prev => ({ ...prev, footer: { buttons: newButtons } }));
    };

    return (
        <>
            <ZbsGuidelinesModal isOpen={isGuidelinesOpen} onClose={() => setIsGuidelinesOpen(false)} />
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editData ? "Chỉnh Sửa Template ZNS" : "Thiết Kế Template ZNS"}
            size="4xl"
            footer={
                <div className="flex justify-between w-full items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs text-slate-500 font-medium">Hệ thống đang hoạt động</span>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                            Hủy bỏ
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={isLoading || !name}
                            className="min-w-[160px] shadow-lg shadow-blue-500/20"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            {editData ? "Cập nhật Zalo" : "Gửi duyệt Zalo"}
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="flex overflow-hidden -mx-6 -my-6 relative" style={{ height: '80vh' }}>
                {/* --- LEFT: CONFIGURATION FORM --- */}
                <div className="w-1/2 lg:w-7/12 overflow-y-auto custom-scrollbar border-r border-slate-200/60 p-6 bg-[#f8fafc]/80">
                    <div className="space-y-6 max-w-2xl mx-auto pb-10">

                        {error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div><p className="font-bold">Đã xảy ra lỗi</p><p>{error}</p></div>
                            </div>
                        )}

                        {editData && (
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                <span>Bạn đang sửa template <b>{editData.template_name}</b> (ID: {editData.template_id}). Sau khi lưu, template sẽ chuyển sang Trạng thái chờ duyệt.</span>
                            </div>
                        )}

                        {/* ZBS Guidelines Link */}
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 text-sm flex items-start justify-between gap-4 mb-6 shadow-sm">
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                    <FileCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-black text-emerald-800 tracking-tight">Quy chuẩn thiết kế Zalo ZBS</p>
                                    <p className="text-xs mt-1 text-emerald-600/90 leading-relaxed max-w-sm">
                                        Nắm vững TẤT CẢ yêu cầu để template được <b className="text-emerald-800">duyệt ngay trong 15 phút</b>.
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" variant="primary" className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md shadow-emerald-600/20" onClick={() => setIsGuidelinesOpen(true)}>
                                Đọc Đầy Đủ
                            </Button>
                        </div>

                        {/* SECTION 1: GLOBAL SETTINGS */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Cấu hình chung
                            </h3>

                            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Tên Template</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-400"
                                        placeholder="Ví dụ: Thông báo xác nhận đơn hàng #123"
                                        value={name} onChange={e => setName(e.target.value)}
                                    />
                                </div>

                                {/* Custom Radio Group for Type */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-2">Loại Template</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {TEMPLATE_TYPES.map((t) => (
                                            <div
                                                key={t.value}
                                                onClick={() => setType(t.value)}
                                                className={`
                                                    cursor-pointer p-3 rounded-xl border transition-all flex items-center gap-3 relative overflow-hidden group
                                                    ${type === t.value
                                                        ? 'bg-blue-50 border-blue-500 shadow-[0_0_0_1px_#3b82f6]'
                                                        : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                                                    }
                                                `}
                                            >
                                                <div className={`
                                                    w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                                    ${type === t.value ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'}
                                                `}>
                                                    <t.icon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`text-sm font-bold ${type === t.value ? 'text-blue-700' : 'text-slate-700'}`}>{t.label}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
                                                </div>
                                                {type === t.value && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                            <Check className="w-3 h-3 text-white" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Tag Select */}
                                <div>
                                    <Select
                                        label="Thẻ phân loại (Tag)"
                                        options={TAG_OPTIONS}
                                        value={tag}
                                        onChange={setTag}
                                        variant="filled"
                                        icon={Tag}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Giúp Zalo phân loại mục đích gửi tin của bạn.</p>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: HEADER */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <Layout className="w-4 h-4" />
                                Thiết kế Header
                            </h3>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-5">
                                {/* Header Type Cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div
                                        onClick={() => setBuilder(prev => ({ ...prev, header: { ...prev.header, type: 'LOGO' } }))}
                                        className={`cursor-pointer p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${builder.header.type === 'LOGO' ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'hover:bg-slate-50 border-slate-200'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${builder.header.type === 'LOGO' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <ImageIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">Logo Doanh Nghiệp</span>
                                    </div>
                                    <div
                                        onClick={() => setBuilder(prev => ({ ...prev, header: { ...prev.header, type: 'IMAGE' } }))}
                                        className={`cursor-pointer p-3 rounded-xl border flex flex-col items-center justify-center text-center gap-2 transition-all ${builder.header.type === 'IMAGE' ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'hover:bg-slate-50 border-slate-200'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${builder.header.type === 'IMAGE' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            <ImageIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700">Banner Ảnh Bìa</span>
                                    </div>
                                </div>

                                {/* Zalo Image Guidelines */}
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600" />
                                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Lưu ý QUY ĐỊNH HÌNH ẢNH:</span>
                                    </div>
                                    <div className="space-y-3 text-[11px] text-amber-800/90 leading-relaxed font-medium">
                                        <div>
                                            <p className="font-bold flex items-center gap-1.5 text-amber-900">
                                                <div className="w-1 h-1 rounded-full bg-amber-400" />
                                                Quy định về Logo (
                                                <a href="https://developers.zalo.me/docs/business-messages/zalo-notification-service/zns-guidelines/quy-dinh-chung-khi-kiem-duyet-mau-zns-template-message"
                                                    target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-950 transition-colors">
                                                    Xem chi tiết
                                                </a>):
                                            </p>
                                            <ul className="ml-3.5 mt-1 grid grid-cols-2 gap-2">
                                                <li className="flex items-center gap-1.5">• Định dạng: <b className="text-amber-900">PNG</b></li>
                                                <li className="flex items-center gap-1.5">• Kích thước: <b className="text-amber-900">400x96 px</b></li>
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="font-bold flex items-center gap-1.5 text-amber-900">
                                                <div className="w-1 h-1 rounded-full bg-amber-400" />
                                                Quy định về hình ảnh (
                                                <a href="https://developers.zalo.me/docs/business-messages/zalo-notification-service/zns-guidelines/quy-dinh-chung-khi-kiem-duyet-mau-zns-template-message"
                                                    target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-950 transition-colors">
                                                    Xem chi tiết
                                                </a>):
                                            </p>
                                            <ul className="ml-3.5 mt-1 grid grid-cols-2 gap-2">
                                                <li className="flex items-center gap-1.5">• Định dạng: <b className="text-amber-900">JPG, PNG</b></li>
                                                <li className="flex items-center gap-1.5">• Tỷ lệ <b className="text-amber-900">16:9</b></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Image Upload */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                        {builder.header.type === 'LOGO' ? 'Logo Doanh nghiệp' : 'Banner Ảnh bìa'}
                                    </label>

                                    <div className="flex gap-2 items-start">
                                        <div className="flex-1">
                                            <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 transition-all">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs font-mono p-3 outline-none bg-transparent text-slate-600"
                                                    placeholder="Media ID (Hoặc upload ảnh bên cạnh)"
                                                    value={builder.header.light_image}
                                                    onChange={e => setBuilder(prev => ({ ...prev, header: { ...prev.header, light_image: e.target.value } }))}
                                                />
                                                {isUploading && (
                                                    <div className="absolute inset-0 bg-white/90 flex items-center justify-center backdrop-blur-sm z-10">
                                                        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <label className="shrink-0 cursor-pointer group">
                                            <input
                                                type="file"
                                                accept=".jpg,.jpeg,.png"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={isUploading}
                                            />
                                            <div className={`
                                                h-[42px] px-4 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all
                                                ${isUploading
                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                                    : 'bg-white text-slate-600 border-slate-200 group-hover:border-purple-500 group-hover:text-purple-500 shadow-sm group-hover:shadow-md'
                                                }
                                            `}>
                                                <ImageIcon className="w-4 h-4" />
                                                Upload
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: BODY */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <AlignLeft className="w-4 h-4" />
                                Nội dung chính
                            </h3>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tiêu đề (Title)</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:outline-none focus:border-blue-500 transition-all"
                                        value={builder.body.title}
                                        onChange={e => updateBody('title', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nội dung tin nhắn</label>
                                    <div className="relative">
                                        <textarea
                                            className="w-full h-32 resize-none p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-500 transition-all leading-relaxed"
                                            value={builder.body.content}
                                            onChange={e => updateBody('content', e.target.value)}
                                        />
                                        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-slate-200 shadow-sm pointer-events-none">
                                            <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1 rounded">{'<biến>'}</span>
                                            <span className="text-[10px] text-slate-400">để dùng dữ liệu động</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Special Forms for Types */}
                                {type === '2' && (
                                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
                                        <h4 className="text-xs font-bold text-orange-700 uppercase">Cấu hình OTP</h4>
                                        <div className="flex gap-2">
                                            <input type="text" className="w-1/2 px-3 py-2 rounded-lg border border-orange-200 text-xs font-mono text-orange-600 outline-none bg-white"
                                                value={builder.body.otp || ''} placeholder="Biến OTP (VD: <otp>)"
                                                onChange={e => updateBody('otp', e.target.value)} />
                                            <p className="text-[10px] text-orange-500 flex-1">Nhập tên biến OTP sẽ được thay thế khi gửi tin.</p>
                                        </div>
                                    </div>
                                )}

                                {type === '3' && builder.body.payment && (
                                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                                        <h4 className="text-xs font-bold text-blue-700 uppercase">Thông tin thanh toán</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input type="text" className="px-3 py-2 rounded-lg border border-blue-200 text-xs outline-none" placeholder="Mã Ngân Hàng (VD: 9704xx)"
                                                value={builder.body.payment.bank_code} onChange={e => updateBody('payment', { ...builder.body.payment, bank_code: e.target.value })} />
                                            <input type="text" className="px-3 py-2 rounded-lg border border-blue-200 text-xs outline-none" placeholder="Tên Tài Khoản"
                                                value={builder.body.payment.account_name} onChange={e => updateBody('payment', { ...builder.body.payment, account_name: e.target.value })} />
                                            <input type="text" className="px-3 py-2 rounded-lg border border-blue-200 text-xs outline-none" placeholder="Số Tài Khoản"
                                                value={builder.body.payment.account_number} onChange={e => updateBody('payment', { ...builder.body.payment, account_number: e.target.value })} />
                                            <input type="text" className="px-3 py-2 rounded-lg border border-blue-200 text-xs outline-none text-blue-600 font-mono" placeholder="Số tiền (VD: <amount>)"
                                                value={builder.body.payment.amount} onChange={e => updateBody('payment', { ...builder.body.payment, amount: e.target.value })} />
                                            <input type="text" className="col-span-2 px-3 py-2 rounded-lg border border-blue-200 text-xs outline-none" placeholder="Nội dung chuyển khoản"
                                                value={builder.body.payment.note} onChange={e => updateBody('payment', { ...builder.body.payment, note: e.target.value })} />
                                        </div>
                                    </div>
                                )}

                                {type === '4' && builder.body.voucher && (
                                    <div className="p-4 bg-pink-50 rounded-xl border border-pink-100 space-y-3">
                                        <h4 className="text-xs font-bold text-pink-700 uppercase">Thông tin Voucher</h4>
                                        <div className="space-y-3">
                                            <input type="text" className="w-full px-3 py-2 rounded-lg border border-pink-200 text-xs outline-none" placeholder="Tên Voucher (VD: Giảm 20%)"
                                                value={builder.body.voucher.name} onChange={e => updateBody('voucher', { ...builder.body.voucher, name: e.target.value })} />
                                            <input type="text" className="w-full px-3 py-2 rounded-lg border border-pink-200 text-xs outline-none" placeholder="Điều kiện (VD: Đơn > 200k)"
                                                value={builder.body.voucher.condition} onChange={e => updateBody('voucher', { ...builder.body.voucher, condition: e.target.value })} />
                                            <div className="flex gap-2">
                                                <input type="text" className="w-1/3 px-3 py-2 rounded-lg border border-pink-200 text-xs outline-none font-mono text-pink-600" placeholder="Biến Code (VD: <code>)"
                                                    value={builder.body.voucher.voucher_code} onChange={e => updateBody('voucher', { ...builder.body.voucher, voucher_code: e.target.value })} />
                                                <input type="text" className="w-1/3 px-3 py-2 rounded-lg border border-pink-200 text-xs outline-none font-mono text-pink-600" placeholder="Ngày BD (VD: <start>)"
                                                    value={builder.body.voucher.start_date} onChange={e => updateBody('voucher', { ...builder.body.voucher, start_date: e.target.value })} />
                                                <input type="text" className="w-1/3 px-3 py-2 rounded-lg border border-pink-200 text-xs outline-none font-mono text-pink-600" placeholder="Ngày KT (VD: <end>)"
                                                    value={builder.body.voucher.end_date} onChange={e => updateBody('voucher', { ...builder.body.voucher, end_date: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-slate-100">
                                    <label className="flex items-center gap-3 cursor-pointer mb-4 p-2 hover:bg-slate-50 rounded-lg transition-colors -ml-2 w-fit">
                                        <div className={`w-9 h-5 rounded-full transition-colors relative ${builder.body.hasTable ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all shadow-sm ${builder.body.hasTable ? 'left-[20px]' : 'left-[3px]'}`} />
                                        </div>
                                        <div>
                                            <span className="text-sm font-bold text-slate-700 block">Kèm Bảng thông tin</span>
                                            <span className="text-[10px] text-slate-400 block">Hiển thị thông tin dạng key-value</span>
                                        </div>
                                        <input type="checkbox" className="hidden" checked={builder.body.hasTable} onChange={e => updateBody('hasTable', e.target.checked)} />
                                    </label>

                                    {builder.body.hasTable && (
                                        <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                            {builder.body.tableRows.map((row, idx) => (
                                                <div key={idx} className="flex gap-2 items-center group">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</div>
                                                    <input type="text" className="w-1/2 px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={row.title} placeholder="Tiêu đề (VD: Mã đơn)"
                                                        onChange={e => updateTableRow(idx, 'title', e.target.value)} />
                                                    <input type="text" className="w-1/2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none"
                                                        value={row.value} placeholder="Giá trị (VD: <id>)"
                                                        onChange={e => updateTableRow(idx, 'value', e.target.value)} />
                                                    <button onClick={() => removeTableRow(idx)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                            <Button size="sm" variant="ghost" onClick={addTableRow} icon={Plus} className="text-blue-600 hover:bg-blue-50 hover:text-blue-700 w-full border border-dashed border-blue-200">
                                                Thêm dòng mới
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SECTION 4: BUTTONS */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                <MousePointerClick className="w-4 h-4" />
                                Nút hành động
                            </h3>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                                {builder.footer.buttons.map((btn, idx) => (
                                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 relative group transition-all hover:shadow-sm">
                                        <button onClick={() => removeButton(idx)} className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 transition-colors"><X className="w-4 h-4" /></button>
                                        <div className="flex gap-3">
                                            <div className="w-[140px] shrink-0">
                                                <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase">Loại nút</label>
                                                <Select
                                                    options={BUTTON_TYPES}
                                                    value={btn.type}
                                                    onChange={(val) => updateButton(idx, 'type', val)}
                                                    size="xs"
                                                    variant="outline"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase">Tên hiển thị</label>
                                                <input type="text" className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none focus:border-blue-500"
                                                    value={btn.title} onChange={e => updateButton(idx, 'title', e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-slate-400 block mb-1 uppercase">
                                                {btn.type === '1' ? 'Đường dẫn (URL)' : 'Số điện thoại'}
                                            </label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                    {btn.type === '1' ? <LinkIcon className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                                                </div>
                                                <input type="text" className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-xs text-blue-600 font-medium focus:outline-none focus:border-blue-500"
                                                    value={btn.value} onChange={e => updateButton(idx, 'value', e.target.value)}
                                                    placeholder={btn.type === '1' ? 'https://website.com/...' : '09xxxxxxxxx'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {builder.footer.buttons.length < 2 && (
                                    <Button variant="secondary" className="w-full border-dashed border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-500" icon={Plus} onClick={addButton}>
                                        Thêm nút hành động (Tối đa 2)
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* SECTION 5: DETECTED PARAMS */}
                        {detectedParams.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                                    <Type className="w-4 h-4" />
                                    Cấu hình tham số
                                </h3>

                                <div className="bg-white p-5 rounded-2xl border-l-4 border-l-indigo-500 shadow-sm space-y-4">
                                    <p className="text-xs text-slate-500">
                                        Hệ thống tự động phát hiện <b>{detectedParams.length} biến</b> trong nội dung.
                                        Vui lòng định nghĩa loại dữ liệu và giá trị mẫu để Zalo duyệt nhanh hơn.
                                        {detectedParams.some(p => p.name.length < 3) && (
                                            <span className="block mt-2 font-bold text-rose-500 flex items-center gap-1.5 animate-pulse">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Lưu ý: Tên biến (VD: {detectedParams.find(p => p.name.length < 3)?.name}) phải từ 3 ký tự trở lên.
                                            </span>
                                        )}
                                    </p>
                                    <div className="space-y-3">
                                        {detectedParams.map((p, idx) => (
                                            <div key={idx} className="flex gap-3 items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                                                <div className={`w-32 shrink-0 font-mono text-xs font-bold px-3 py-1.5 rounded-lg text-center truncate ${p.name.length < 3 ? 'bg-rose-100 text-rose-600 ring-2 ring-rose-500' : 'bg-indigo-100 text-indigo-600'}`} title={p.name}>
                                                    {p.name}
                                                </div>
                                                <div className="w-[180px] shrink-0">
                                                    <Select
                                                        options={PARAM_TYPES}
                                                        value={p.type}
                                                        onChange={(val) => {
                                                            const newParams = [...detectedParams];
                                                            newParams[idx].type = val;
                                                            setDetectedParams(newParams);
                                                        }}
                                                        size="xs"
                                                        variant="outline"
                                                    />
                                                </div>
                                                <input
                                                    type="text"
                                                    className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-200 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    placeholder="Giá trị mẫu..."
                                                    value={p.sample_value}
                                                    onChange={(e) => {
                                                        const newParams = [...detectedParams];
                                                        newParams[idx].sample_value = e.target.value;
                                                        setDetectedParams(newParams);
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* --- RIGHT: REALTIME PREVIEW --- */}
                <div className="w-1/2 lg:w-5/12 bg-slate-100 flex items-center justify-center p-6 relative">
                    <div className="absolute top-6 right-6 bg-white/80 backdrop-blur px-4 py-2 rounded-full text-[10px] text-slate-500 font-bold border border-slate-200 shadow-sm flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" />
                        LIVE PREVIEW
                    </div>

                    {/* PHONE SIMULATOR - ZNS PREVIEW */}
                    <div className="w-[340px] h-[660px] bg-slate-50 rounded-[44px] border-[12px] border-slate-800 shadow-2xl overflow-hidden flex flex-col relative transform scale-[0.95] translate-y-4">
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-20"></div>

                        {/* Status Bar */}
                        <div className="h-12 flex items-end justify-between px-6 pb-2 select-none z-10 shrink-0">
                            <span className="text-[11px] font-bold text-slate-800">9:41</span>
                            <div className="flex gap-1.5 items-center pb-0.5">
                                <div className="w-4 h-3 bg-slate-800 rounded-[2px] opacity-80" />
                                <div className="w-3.5 h-3.5 bg-slate-800 rounded-full opacity-80" />
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-8 pt-4">
                            {/* ZNS WHITE CARD */}
                            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden relative">
                                
                                {/* 1. Header Img */}
                                {builder.header.type === 'LOGO' ? (
                                    <div className="pt-5 px-5 pb-2">
                                        {previewUrls.logo ? (
                                            <img src={previewUrls.logo} className="h-10 max-w-[200px] object-contain object-left" alt="ZNS Logo" />
                                        ) : (
                                            <div className="w-32 h-8 bg-slate-100 rounded flex items-center justify-center border border-dashed border-slate-300">
                                                <span className="text-[10px] text-slate-400 font-medium">Logo (400x96)</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="aspect-video bg-slate-100 w-full flex flex-col items-center justify-center overflow-hidden relative">
                                        {previewUrls.banner ? (
                                            <img src={previewUrls.banner} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 opacity-50">
                                                <ImageIcon className="w-8 h-8 text-slate-400" />
                                                <span className="text-[10px] font-medium text-slate-400">Banner Ảnh Bìa (16:9)</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 2. Body Content */}
                                <div className="p-5 space-y-4">
                                    <h3 className="font-bold text-[17px] text-slate-900 leading-tight">
                                        {builder.body.title || 'Tiêu đề tin nhắn ZNS'}
                                    </h3>

                                    <div className="text-slate-700 text-[14px] leading-relaxed whitespace-pre-wrap">
                                        {builder.body.content.split(/(<[^>]+>)/g).map((part, i) =>
                                            part.match(/^<[^>]+>$/) ?
                                                <span key={i} className="font-bold text-slate-900">{part}</span> :
                                                part
                                        )}
                                        {!builder.body.content && <span className="text-slate-300 italic">Nhập nội dung mẫu...</span>}
                                    </div>

                                    {/* Table (Borderless grid layout like user image) */}
                                    {builder.body.hasTable && builder.body.tableRows.length > 0 && (
                                        <div className="pt-2 flex flex-col gap-3">
                                            {builder.body.tableRows.map((r, i) => (
                                                <div key={i} className="flex text-[13px]">
                                                    <span className="text-slate-500 w-[110px] shrink-0 leading-tight">{r.title}</span>
                                                    <span className="font-bold text-slate-900 flex-1 leading-tight">{r.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 3. Footer / Buttons */}
                                    {builder.footer.buttons.length > 0 && (
                                        <div className="pt-4 space-y-2">
                                            {builder.footer.buttons.map((btn, i) => (
                                                <div key={i} className="w-full py-3 bg-[#4c6ef5] text-white rounded-xl text-center font-bold text-[14px] shadow-sm">
                                                    {btn.title || 'Nút hành động'}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </Modal>
        </>
    );
};

export default ZaloTemplateCreateModal;

// components/templates/EmailEditor/utils/blockUtils.ts
import { EmailBlock, EmailBlockType, EmailBlockStyle, ListItem } from '../../../../types';

const createUniqueId = () => crypto.randomUUID();

const createStyle = (overrides: EmailBlockStyle = {}): EmailBlockStyle => ({
    paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px',
    marginTop: '0px', marginBottom: '0px', marginLeft: '0px', marginRight: '0px',
    ...overrides
});

export const createBlock = (type: string, layout?: string): EmailBlock => {
    const id = createUniqueId();
    if (type === 'layout') {
        const count = parseInt(layout || '1');
        const widths = layout === '1-2' ? ['33%', '67%'] : (layout === '2-1' ? ['67%', '33%'] : Array(count).fill(`${100 / count}%`));
        const cols = widths.map((w, i) => ({
            id: createUniqueId(), type: 'column' as const, content: '',
            style: createStyle({
                width: w,
                paddingTop: '0px',
                paddingRight: (count > 1 && i < count - 1) ? '10px' : '0px',
                paddingBottom: '0px',
                paddingLeft: (count > 1 && i > 0) ? '10px' : '0px',
                verticalAlign: 'top' as const
            }),
            children: []
        }));
        return {
            id, type: 'section', content: '',
            style: createStyle({ paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#ffffff', contentBackgroundColor: 'transparent' }),
            children: [{ id: createUniqueId(), type: 'row', content: '', style: createStyle({ display: 'table', backgroundColor: 'transparent', width: '100%', paddingTop: '15px', paddingRight: '15px', paddingBottom: '15px', paddingLeft: '15px' }), children: cols }]
        };
    }

    let content = '';
    let items: ListItem[] = [];
    let rating = 5;
    let styleOverrides: EmailBlockStyle = { paddingTop: '15px', paddingRight: '15px', paddingBottom: '15px', paddingLeft: '15px', textAlign: 'center' };

    if (type === 'text') { content = '<p style="margin: 0;">Nhập văn bản...</p>'; styleOverrides.textAlign = 'left'; }
    if (type === 'button') {
        content = 'Nút Bấm';
        styleOverrides.contentBackgroundColor = '#d97706';
        styleOverrides.color = '#ffffff';
        styleOverrides.display = 'inline-block';
        styleOverrides.paddingTop = '12px';
        styleOverrides.paddingBottom = '12px';
        styleOverrides.paddingLeft = '24px';
        styleOverrides.paddingRight = '24px';
        styleOverrides.marginTop = '10px';
        styleOverrides.marginBottom = '10px';
        styleOverrides.fontSize = '16px';
        styleOverrides.fontWeight = 'bold';
        styleOverrides.width = 'auto'; // Default to auto width
        styleOverrides.borderRadius = '8px';
    }
    if (type === 'quote') {
        content = 'Đây là nội dung trích dẫn nổi bật của bạn.';
        styleOverrides = createStyle({
            paddingTop: '20px', paddingRight: '20px', paddingBottom: '20px', paddingLeft: '20px', textAlign: 'left',
            backgroundColor: '#f8fafc', borderLeftWidth: '4px', borderStyle: 'solid', borderColor: '#d97706', fontStyle: 'italic', color: '#334155',
        });
    }
    if (type === 'timeline') {
        items = [
            { id: createUniqueId(), title: 'Sự kiện 1', date: '09:00', description: 'Mô tả sự kiện quan trọng' },
            { id: createUniqueId(), title: 'Sự kiện 2', date: '10:30', description: 'Mô tả bước tiếp theo' },
        ];
        styleOverrides.backgroundColor = 'transparent';
        styleOverrides.timelineDotColor = '#d97706';
        styleOverrides.timelineLineColor = '#e2e8f0';
        styleOverrides.timelineLineStyle = 'solid';
        styleOverrides.textAlign = 'left';
    }
    if (type === 'review') {
        content = 'Dịch vụ tuyệt vời, tôi rất hài lòng với trải nghiệm này!';
        rating = 5;
        styleOverrides.backgroundColor = 'transparent';
        styleOverrides.borderRadius = '8px';
        styleOverrides.paddingTop = '20px';
        styleOverrides.paddingBottom = '20px';
        styleOverrides.color = '#334155';
    }
    if (type === 'countdown') {
        styleOverrides.targetDate = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
        styleOverrides.backgroundColor = 'transparent';
        styleOverrides.contentBackgroundColor = '#1e293b';
        styleOverrides.digitColor = '#ffffff';
        styleOverrides.labelColor = '#64748b';
        styleOverrides.borderRadius = '8px';
        styleOverrides.paddingTop = '20px';
        styleOverrides.paddingBottom = '20px';
    }

    if (type === 'image') {
        content = ''; // Standard image block doesn't need content if it's just a URL
        styleOverrides.paddingTop = '10px';
        styleOverrides.paddingBottom = '10px';
        styleOverrides.borderRadius = '8px';
    }
    if (type === 'video') {
        styleOverrides.paddingTop = '10px';
        styleOverrides.paddingBottom = '10px';
        styleOverrides.borderRadius = '12px';
        styleOverrides.playButtonColor = '#d97706';
    }
    if (type === 'order_list') {
        styleOverrides.paddingTop = '20px';
        styleOverrides.paddingBottom = '20px';
        styleOverrides.backgroundColor = '#ffffff';
    }
    if (type === 'social') {
        styleOverrides.iconMode = 'color';
        styleOverrides.iconSize = '32';
        styleOverrides.gap = '10';
        styleOverrides.textAlign = 'center';
        styleOverrides.paddingTop = '15px';
        styleOverrides.paddingBottom = '15px';
    }
    if (type === 'divider') {
        styleOverrides.paddingTop = '15px';
        styleOverrides.paddingBottom = '15px';
        styleOverrides.borderTopWidth = '1px';
        styleOverrides.borderStyle = 'solid';
        styleOverrides.borderColor = '#eeeeee';
    }
    if (type === 'spacer') {
        styleOverrides.height = '20px';
        styleOverrides.paddingTop = '0px';
        styleOverrides.paddingBottom = '0px';
    }

    if (type === 'check_list') {
        items = [
            { id: createUniqueId(), title: 'Tính năng 1', description: 'Mô tả ngắn gọn về tính năng hoặc lợi ích tuyệt vời của sản phẩm.' },
            { id: createUniqueId(), title: 'Tính năng 2', description: 'Mô tả ngắn gọn về tính năng hoặc lợi ích tuyệt vời của sản phẩm.' },
            { id: createUniqueId(), title: 'Tính năng 3', description: 'Mô tả ngắn gọn về tính năng hoặc lợi ích tuyệt vời của sản phẩm.' },
        ];
        styleOverrides.checkIconColor = '#d97706';
        styleOverrides.checkIconSize = '20';
        styleOverrides.showCheckListTitle = true;
        styleOverrides.textAlign = 'left';
        styleOverrides.paddingTop = '20px';
        styleOverrides.paddingBottom = '20px';
    }

    if (type === 'table') {
        const rows = 3; // 1 header + 2 data rows
        const cols = 4;
        const headerLabels = ['Tiêu đề 1', 'Tiêu đề 2', 'Tiêu đề 3', 'Tiêu đề 4'];
        const cells: { content: string; align: 'left' | 'center' | 'right' }[][] = [];
        // Header row
        cells.push(headerLabels.slice(0, cols).map(h => ({ content: h, align: 'center' as const })));
        // Data rows
        for (let r = 0; r < rows - 1; r++) {
            cells.push(Array.from({ length: cols }, (_, c) => ({ content: `Ô ${r + 1}-${c + 1}`, align: 'left' as const })));
        }
        return {
            id, type: 'table' as EmailBlockType,
            content: JSON.stringify(cells),
            style: createStyle({
                paddingTop: '15px', paddingRight: '15px', paddingBottom: '15px', paddingLeft: '15px',
                tableRows: rows,
                tableCols: cols,
                tableHeaderRow: true,
                tableHeaderBg: '#1e293b',
                tableHeaderTextColor: '#ffffff',
                tableStripe: 'alternate',
                tableEvenBg: '#f8fafc',
                tableOddBg: '#ffffff',
                tableSolidBg: '#ffffff',
                tableBorderColor: '#e2e8f0',
                tableBorderWidth: '1px',
                tableCellPadding: '10px 14px',
                tableColWidths: Array(cols).fill('auto'),
                tableColAligns: Array(cols).fill('left'),
            })
        };
    }


    // NEW: Header Block (Logo Left, Menu Right)
    if (type === 'header') {
        content = 'https://cdn-icons-png.flaticon.com/512/6124/6124998.png'; // Default Logo
        items = [
            { id: createUniqueId(), title: 'Home', description: 'https://example.com' },
            { id: createUniqueId(), title: 'Features', description: 'https://example.com' },
            { id: createUniqueId(), title: 'Contact', description: 'https://example.com' },
        ];
        styleOverrides.backgroundColor = '#ffffff';
        styleOverrides.paddingTop = '15px';
        styleOverrides.paddingBottom = '15px';
        styleOverrides.paddingLeft = '30px';
        styleOverrides.paddingRight = '30px';
        styleOverrides.textAlign = 'right'; // For menu items
        // Custom properties for header
        (styleOverrides as any).logoWidth = '120px';
        (styleOverrides as any).headerMenuType = 'link'; // 'link' or 'button'
        (styleOverrides as any).menuGap = '20px';
        (styleOverrides as any).buttonBg = '#d97706';
        (styleOverrides as any).buttonColor = '#ffffff';
    }

    // NEW: Footer Block
    if (type === 'footer') {
        content = '<p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">' +
            '© 2024 Your Company. All rights reserved.<br>' +
            '<a href="#" style="text-decoration: underline; color: #64748b;">Terms of Service</a>' +
            '&nbsp;&nbsp;|&nbsp;&nbsp;' +
            '<a href="#" style="text-decoration: underline; color: #64748b;">Privacy Policy</a>' +
            '&nbsp;&nbsp;|&nbsp;&nbsp;' +
            '<a href="{{unsubscribe_url}}" style="text-decoration: underline; color: #64748b;">Unsubscribe</a>' +
            '</p>';
        styleOverrides.backgroundColor = '#f8fafc';
        styleOverrides.paddingTop = '30px';
        styleOverrides.paddingBottom = '30px';
        styleOverrides.paddingLeft = '20px';
        styleOverrides.paddingRight = '20px';
        styleOverrides.textAlign = 'center';
    }


    // NEW: Header Gradient (Google AI Style)
    if (type === 'header_gradient') {
        return {
            id, type: 'section', content: '',
            style: createStyle({
                backgroundColor: 'transparent',
                paddingTop: '0px', paddingBottom: '24px'
            }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ 
                    display: 'table', width: '100%', textAlign: 'center', 
                    backgroundImage: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%)', // Gradient requested
                    backgroundColor: '#1e1b4b', // Fallback color
                    paddingTop: '48px', paddingBottom: '48px', borderRadius: '16px' 
                }),
                children: [{
                    id: createUniqueId(), type: 'column' as const, content: '',
                    style: createStyle({ width: '100%', textAlign: 'center' }),
                    children: [
                        {
                            id: createUniqueId(), type: 'image' as const,
                            content: 'https://cdn-icons-png.flaticon.com/512/6124/6124998.png',
                            style: createStyle({ width: '60px', height: 'auto', display: 'block', marginLeft: 'auto', marginRight: 'auto' }),
                            altText: 'Logo'
                        },
                        {
                            id: createUniqueId(), type: 'text' as const,
                            content: '<div style="font-size: 32px; font-weight: 400; color: #ffffff; font-family: Google Sans, Roboto, sans-serif;">Welcome to Our Service</div>',
                            style: createStyle({ textAlign: 'center', marginBottom: '16px' })
                        },
                        {
                            id: createUniqueId(), type: 'text' as const,
                            content: '<div style="max-width: 600px; font-size: 16px; color: #cbd5e1; line-height: 1.5; margin: 0 auto;">Thank you for joining us. You now have full access to our ecosystem. Enjoy your stay and explore infinite possibilities.</div>',
                            style: createStyle({ textAlign: 'center' })
                        }
                    ]
                }]
            }]
        };
    }

    // NEW: Article List
    if (type === 'article_list') {
        const createRow = (img: string, title: string, desc: string, isReverse?: boolean) => {
            const imgCol = {
                id: createUniqueId(), type: 'column' as const, content: '',
                style: createStyle({ width: '30%', verticalAlign: 'middle', paddingRight: isReverse ? '0' : '20px', paddingLeft: isReverse ? '20px' : '0' }),
                children: [{ id: createUniqueId(), type: 'image' as const, content: img, style: createStyle({ width: '100%', height: 'auto', borderRadius: '12px' }) }]
            };
            const textCol = {
                id: createUniqueId(), type: 'column' as const, content: '',
                style: createStyle({ width: '70%', verticalAlign: 'middle' }),
                children: [
                    { id: createUniqueId(), type: 'text' as const, content: `<h3 style="margin: 0 0 8px; font-size: 16px; font-weight: bold; color: #1e293b;">${title}</h3><p style="margin: 0 0 12px; font-size: 13px; color: #64748b; line-height: 1.5;">${desc}</p><a href="#" style="font-size: 13px; font-weight: 600; color: #2563eb; text-decoration: none;">Đọc thêm →</a>`, style: createStyle({ textAlign: 'left' }) }
                ]
            };
            return {
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ display: 'table', width: '100%', paddingBottom: '24px', noStack: true }),
                children: isReverse ? [textCol, imgCol] : [imgCol, textCol]
            };
        };

        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '24px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ display: 'table', width: '100%', backgroundColor: '#ffffff', paddingTop: '24px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: '0px', borderRadius: '16px', borderTopWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px', borderRightWidth: '1px', borderStyle: 'solid', borderColor: '#e2e8f0' }),
                children: [{
                    id: createUniqueId(), type: 'column' as const, content: '',
                    style: createStyle({ width: '100%' }),
                    children: [
                        { id: createUniqueId(), type: 'text' as const, content: '<h2 style="margin: 0 0 24px; font-size: 20px; font-weight: bold; color: #0f172a; text-align: left; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">Tin tức mới nhất</h2>', style: createStyle({ textAlign: 'left' }) },
                        createRow('https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300&h=200&fit=crop', 'Cập nhật tính năng mới', 'Trải nghiệm sức mạnh của hệ thống giúp tăng tốc quy trình làm việc của bạn mỗi ngày.'),
                        createRow('https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&h=200&fit=crop', 'Báo cáo xu hướng 2024', 'Khám phá những chiến lược dữ liệu thông minh sẽ định hình thị trường trong năm nay.')
                    ]
                }]
            }]
        };
    }

    // NEW: E-Commerce Product
    if (type === 'ecommerce_product') {
        const createProduct = (img: string, title: string, oldPrice: string, newPrice: string) => ({
            id: createUniqueId(), type: 'column' as const, content: '',
            style: createStyle({ width: '33.33%', verticalAlign: 'top', paddingLeft: '10px', paddingRight: '10px', paddingBottom: '20px' }),
            children: [
                { id: createUniqueId(), type: 'image' as const, content: img, style: createStyle({ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px' }) },
                { id: createUniqueId(), type: 'text' as const, content: `<h4 style="margin: 12px 0 4px; font-size: 14px; font-weight: 600; color: #1e293b; text-align: center;">${title}</h4><div style="text-align: center;"><span style="color: #94a3b8; text-decoration: line-through; font-size: 12px; margin-right: 8px;">${oldPrice}</span><span style="color: #e11d48; font-weight: bold; font-size: 14px;">${newPrice}</span></div>`, style: createStyle({ textAlign: 'center'}) },
                { id: createUniqueId(), type: 'button' as const, content: 'MUA NGAY', style: createStyle({ width: '100%', display: 'block', paddingLeft: '0', paddingRight: '0', paddingTop: '8px', paddingBottom: '8px', fontSize: '12px', contentBackgroundColor: '#0f172a', borderRadius: '8px', marginTop: '12px', color: '#ffffff' }) }
            ]
        });

        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '24px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ display: 'table', width: '100%', backgroundColor: '#ffffff', paddingTop: '32px', paddingBottom: '16px', paddingLeft: '14px', paddingRight: '14px', borderRadius: '16px' }),
                children: [
                    createProduct('https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop', 'Tai nghe ANC Pro', '2.500.000đ', '1.890.000đ'),
                    createProduct('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop', 'Smartwatch Series X', '4.200.000đ', '3.450.000đ'),
                    createProduct('https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&h=300&fit=crop', 'Máy ảnh Retro XL', '12.000.000đ', '9.900.000đ')
                ]
            }]
        };
    }

    // NEW: Steps Flow (Hình Ảnh / Icon)
    if (type === 'steps_flow') {
        const createStep = (img: string, title: string, desc: string, isLast: boolean) => ({
            id: createUniqueId(), type: 'column' as const, content: '',
            style: createStyle({ width: '33.33%', verticalAlign: 'top', paddingLeft: '12px', paddingRight: '12px', textAlign: 'center' }),
            children: [
                { id: createUniqueId(), type: 'image' as const, content: img, style: createStyle({ width: '48px', height: '48px', display: 'block', marginLeft: 'auto', marginRight: 'auto', marginBottom: '16px', borderRadius: '100px' }) },
                { id: createUniqueId(), type: 'text' as const, content: `<div style="font-size: 15px; font-weight: bold; color: #1e293b;">${title}</div>`, style: createStyle({ textAlign: 'center', marginBottom: '8px' }) },
                { id: createUniqueId(), type: 'text' as const, content: `<div style="font-size: 13px; color: #64748b; line-height: 1.5;">${desc}</div>`, style: createStyle({ textAlign: 'center' }) }
            ]
        });

        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '24px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ display: 'table', width: '100%', backgroundColor: '#ffffff', paddingTop: '32px', paddingBottom: '32px', paddingLeft: '12px', paddingRight: '12px', borderRadius: '16px' }),
                children: [
                    createStep('https://img.icons8.com/ios-filled/50/4f46e5/user.png', 'Đăng ký', 'Tạo tài khoản miễn phí chỉ trong 2 phút với email của bạn.', false),
                    createStep('https://img.icons8.com/ios-filled/50/4f46e5/settings.png', 'Cài đặt', 'Tuỳ chỉnh giao diện và cấu hình hệ thống theo ý muốn.', false),
                    createStep('https://img.icons8.com/ios-filled/50/4f46e5/rocket.png', 'Bắt đầu', 'Kích hoạt chiến dịch và theo dõi kết quả tự động ngay.', true)
                ]
            }]
        };
    }

    // NEW: Steps Flow (Dạng Số)
    if (type === 'steps_flow_number') {
        const createStep = (num: string, title: string, desc: string, isLast: boolean) => ({
            id: createUniqueId(), type: 'column' as const, content: '',
            style: createStyle({ width: '33.33%', verticalAlign: 'top', paddingLeft: '12px', paddingRight: '12px', textAlign: 'center' }),
            children: [
                { 
                    id: createUniqueId(), type: 'button' as const, content: num,
                    style: createStyle({ 
                        display: 'inline-block',
                        width: '44px', height: '44px', lineHeight: '44px', 
                        borderRadius: '100px', contentBackgroundColor: '#eff6ff', color: '#2563eb', 
                        fontWeight: 'bold', fontSize: '18px', textAlign: 'center', 
                        marginBottom: '16px', borderStyle: 'none', borderTopWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px', borderRightWidth: '0px', borderColor: 'transparent',
                        paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px'
                    })
                },
                { id: createUniqueId(), type: 'text' as const, content: `<div style="font-size: 15px; font-weight: bold; color: #1e293b;">${title}</div>`, style: createStyle({ textAlign: 'center', marginBottom: '8px' }) },
                { id: createUniqueId(), type: 'text' as const, content: `<div style="font-size: 13px; color: #64748b; line-height: 1.5;">${desc}</div>`, style: createStyle({ textAlign: 'center' }) }
            ]
        });

        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '24px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ display: 'table', width: '100%', backgroundColor: '#ffffff', paddingTop: '32px', paddingBottom: '32px', paddingLeft: '12px', paddingRight: '12px', borderRadius: '16px' }),
                children: [
                    createStep('1', 'Đăng ký', 'Tạo tài khoản miễn phí chỉ trong 2 phút với email của bạn.', false),
                    createStep('2', 'Cài đặt', 'Tuỳ chỉnh giao diện và cấu hình hệ thống theo ý muốn.', false),
                    createStep('3', 'Bắt đầu', 'Kích hoạt chiến dịch và theo dõi kết quả tự động ngay.', true)
                ]
            }]
        };
    }

    // NEW: Double Card (Gemini Style)
    if (type === 'double_card') {
        const createCardCol = (img: string, title: string) => ({
            id: createUniqueId(), type: 'column' as const, content: '',
            style: createStyle({ width: '48%', verticalAlign: 'top', backgroundColor: '#f8fafc', borderRadius: '16px', paddingBottom: '20px', paddingLeft: '0px', paddingRight: '0px' }),
            children: [
                { id: createUniqueId(), type: 'image' as const, content: img, style: createStyle({ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '16px 16px 0 0' }) },
                { id: createUniqueId(), type: 'text' as const, content: `<h3 style="margin: 20px 20px 8px; padding: 0; font-size: 16px; font-weight: bold; color: #1e293b; text-align: left;">${title}</h3><p style="margin: 0; padding: 0 20px 20px; color: #64748b; font-size: 13px; line-height: 1.6; text-align: left;">Khám phá bộ sưu tập mới nhất với phong cách độc đáo của chúng tôi.</p>`, style: createStyle({ textAlign: 'left' }) },
                { id: createUniqueId(), type: 'text' as const, content: '<p style="margin: 0; padding: 0 20px; text-align: left;"><a href="#" style="text-decoration: none; color: #2563eb; font-weight: 600; font-size: 13px;">Xem chi tiết →</a></p>', style: createStyle({ textAlign: 'left' }) }
            ]
        });

        // Column for Gap (using empty column with width)
        const gapCol = {
            id: createUniqueId(), type: 'column' as const, content: '',
            style: createStyle({ width: '4%', verticalAlign: 'top' }),
            children: [{ id: createUniqueId(), type: 'spacer' as const, content: '', style: createStyle({ height: '1px' }) }]
        };

        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '24px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ display: 'table', width: '100%', backgroundColor: '#ffffff', paddingTop: '20px', paddingBottom: '20px', paddingLeft: '20px', paddingRight: '20px', borderRadius: '16px' }), // Added white bg and padding
                children: [
                    createCardCol('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=350&fit=crop&auto=format', 'Architecture & Design'),
                    gapCol,
                    createCardCol('https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=350&fit=crop&auto=format', 'Business Strategy')
                ]
            }]
        };
    }

    // NEW: Review Card (Avatar + Text)
    if (type === 'review_card') {
        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '24px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({ display: 'table', width: '100%', backgroundColor: '#ffffff', paddingTop: '24px', paddingRight: '24px', paddingBottom: '24px', paddingLeft: '24px', borderTopWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px', borderRightWidth: '1px', borderStyle: 'solid', borderColor: '#f1f5f9', borderRadius: '16px' }), // Removed boxShadow
                children: [
                    {
                        id: createUniqueId(), type: 'column' as const, content: '',
                        style: createStyle({ width: '15%', verticalAlign: 'top', paddingRight: '15px' }),
                        children: [{ id: createUniqueId(), type: 'image' as const, content: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&auto=format', style: createStyle({ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: '100px' }) }]
                    },
                    {
                        id: createUniqueId(), type: 'column' as const, content: '',
                        style: createStyle({ width: '85%', verticalAlign: 'top' }),
                        children: [
                            { id: createUniqueId(), type: 'text' as const, content: '<div style="font-size: 14px; font-weight: bold; color: #0f172a;">Sarah Johnston</div>', style: createStyle({ textAlign: 'left', marginBottom: '4px' }) },
                            { id: createUniqueId(), type: 'text' as const, content: '<div style="color: #fbbf24; font-size: 12px;">★★★★★</div>', style: createStyle({ textAlign: 'left', marginBottom: '8px' }) },
                            { id: createUniqueId(), type: 'text' as const, content: '<div style="font-size: 14px; color: #475569; line-height: 1.5; font-style: italic;">"MailFlow đã giúp đội nhóm của tôi tiết kiệm 50% thời gian xử lý email mỗi ngày. Một công cụ tuyệt vời!"</div>', style: createStyle({ textAlign: 'left' }) }
                        ]
                    }
                ]
            }]
        };
    }

    // NEW: Download Badges (Gemini App Style)
    if (type === 'download_badges') {
        const createBadgeCol = (imgData: { url: string, alt: string }) => ({
            id: createUniqueId(), type: 'column' as const, content: '',
            style: createStyle({ width: '50%', verticalAlign: 'middle', paddingLeft: '4px', paddingRight: '4px', textAlign: 'center' }),
            children: [{
                id: createUniqueId(), type: 'image' as const,
                content: imgData.url,
                altText: imgData.alt,
                url: '#',
                style: createStyle({ width: '135px', height: 'auto', display: 'block', marginLeft: 'auto', marginRight: 'auto', borderRadius: '0px' })
            }]
        });

        const badgesRow = {
            id: createUniqueId(), type: 'row' as const, content: '',
            style: createStyle({
                display: 'table',
                width: '300px', // Fixed width for the buttons container
                marginLeft: 'auto',
                marginRight: 'auto',
                backgroundColor: 'transparent',
                noStack: true
            }),
            children: [
                createBadgeCol({ url: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg', alt: 'Google Play' }),
                createBadgeCol({ url: 'https://developer.apple.com/app-store/marketing/guidelines/images/badge-download-on-the-app-store.svg', alt: 'App Store' })
            ]
        };

        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '24px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({
                    display: 'table', width: '100%', textAlign: 'center', backgroundColor: '#ffffff',
                    paddingTop: '32px', paddingBottom: '32px', paddingLeft: '24px', paddingRight: '24px',
                    borderRadius: '16px', borderTopWidth: '1px', borderLeftWidth: '1px', borderRightWidth: '1px', borderBottomWidth: '1px', borderColor: '#e2e8f0', borderStyle: 'solid'
                }),
                children: [{
                    id: createUniqueId(), type: 'column' as const, content: '',
                    style: createStyle({ width: '100%', textAlign: 'center' }), // Ensure column is full width
                    children: [
                        { id: createUniqueId(), type: 'image' as const, content: 'https://cdn-icons-png.flaticon.com/512/6124/6124998.png', style: createStyle({ width: '48px', height: 'auto', marginBottom: '16px' }), altText: 'Gemini Logo' }, // Restored stable logo
                        { id: createUniqueId(), type: 'text' as const, content: '<h2 style="font-size: 24px; font-weight: 700; color: #1e293b; margin: 0 0 12px; font-family: sans-serif; text-align: center; width: 100%;">Get the app</h2>', style: createStyle({ textAlign: 'center', width: '100%' }) },
                        { id: createUniqueId(), type: 'text' as const, content: '<p style="font-size: 15px; color: #64748b; margin: 0 auto 32px; max-width: 480px; line-height: 1.6; text-align: center; width: 100%;">Try new features and get access to our service wherever you go.</p>', style: createStyle({ textAlign: 'center', width: '100%' }) },
                        badgesRow
                    ]
                }]
            }]
        };
    }

    // NEW: Feature Card (Couple / Partners Style)
    if (type === 'feature_card') {
        return {
            id, type: 'section', content: '',
            style: createStyle({ backgroundColor: 'transparent', paddingBottom: '16px' }),
            children: [{
                id: createUniqueId(), type: 'row' as const, content: '',
                style: createStyle({
                    display: 'table', width: '90%', backgroundColor: '#f1f5f9', // Slate 100 Background
                    marginTop: '0', marginRight: 'auto', marginBottom: '0', marginLeft: 'auto',
                    paddingTop: '16px', paddingRight: '20px', paddingBottom: '16px', paddingLeft: '20px',
                    borderRadius: '12px', borderTopWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px', borderRightWidth: '0px', borderStyle: 'none', 
                    noStack: true
                }),
                children: [
                    {
                        id: createUniqueId(), type: 'column' as const, content: '',
                        style: createStyle({ width: '25%', verticalAlign: 'top', paddingRight: '16px', textAlign: 'center' }),
                        children: [{ 
                            id: createUniqueId(), type: 'image' as const, 
                            content: 'https://img.icons8.com/ios-filled/50/ffffff/user-group-man-man.png', 
                            style: createStyle({ width: '44px', height: 'auto', display: 'inline-block', backgroundColor: '#4f46e5', borderRadius: '12px', paddingTop: '10px', paddingBottom: '10px', paddingLeft: '10px', paddingRight: '10px' }), 
                            altText: 'Icon' 
                        }]
                    },
                    {
                        id: createUniqueId(), type: 'column' as const, content: '',
                        style: createStyle({ width: '75%', verticalAlign: 'middle' }),
                        children: [
                            { id: createUniqueId(), type: 'text' as const, content: '<h3 style="font-size: 16px; font-weight: bold; margin: 0 0 4px; color: #1e293b; text-align: left;">Couples and partners:</h3><p style="font-size: 14px; color: #475569; margin: 0; line-height: 1.5; text-align: left;">One for each person keeps habits aligned.</p>', style: createStyle({ textAlign: 'left' }) }
                        ]
                    }
                ]
            }]
        };
    }

    // NEW: OTP Block
    if (type === 'otp') {
        content = '[short_code]';
        styleOverrides.backgroundColor = '#f0fdf4';
        styleOverrides.contentBackgroundColor = '#f0fdf4';
        styleOverrides.color = '#166534';
        styleOverrides.fontSize = '36px';
        styleOverrides.fontWeight = 'bold';
        styleOverrides.textAlign = 'center';
        styleOverrides.letterSpacing = '12px';
        styleOverrides.paddingTop = '24px';
        styleOverrides.paddingBottom = '24px';
        styleOverrides.paddingLeft = '24px';
        styleOverrides.paddingRight = '24px';
        styleOverrides.borderRadius = '12px';
        styleOverrides.borderColor = '#86efac';
        styleOverrides.borderTopWidth = '2px';
        styleOverrides.borderRightWidth = '2px';
        styleOverrides.borderBottomWidth = '2px';
        styleOverrides.borderLeftWidth = '2px';
        styleOverrides.borderStyle = 'dashed';
        styleOverrides.marginTop = '20px';
        styleOverrides.marginBottom = '20px';
        styleOverrides.display = 'block';
    }

    return {
        id, type: (type === 'footer' ? 'text' : type) as EmailBlockType,
        content,
        url: (type === 'button' || type === 'image') ? '#' : undefined,
        socialLinks: type === 'social' ? [
            { id: createUniqueId(), network: 'facebook', url: '#' },
            { id: createUniqueId(), network: 'instagram', url: '#' },
            { id: createUniqueId(), network: 'twitter', url: '#' },
            { id: createUniqueId(), network: 'website', url: '#' }
        ] : undefined,
        items: items.length > 0 ? items : undefined,
        rating: type === 'review' ? rating : undefined,
        style: createStyle(styleOverrides),
        checkListTitle: type === 'check_list' ? 'VÌ SAO NÊN CHỌN CHÚNG TÔI?' : undefined,
        videoUrl: type === 'video' ? '' : undefined,
        thumbnailUrl: type === 'video' ? '' : undefined,
    };
};

export const wrapElement = (block: EmailBlock): EmailBlock => {
    if (block.type === 'section') return block;

    const col = {
        id: createUniqueId(), type: 'column' as const, content: '',
        style: createStyle({ width: '100%', paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px', verticalAlign: 'top' }),
        children: [block]
    };

    const row = {
        id: createUniqueId(), type: 'row' as const, content: '',
        style: createStyle({ display: 'table', backgroundColor: '#ffffff', width: '100%', paddingTop: '15px', paddingRight: '15px', paddingBottom: '15px', paddingLeft: '15px' }),
        children: [col]
    };

    const sec = {
        id: createUniqueId(), type: 'section' as const, content: '',
        style: createStyle({ paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#ffffff', contentBackgroundColor: 'transparent' }),
        children: [row]
    };

    return sec;
};

export const findBlock = (id: string, list: EmailBlock[]): EmailBlock | null => {
    for (const b of list) {
        if (b.id === id) return b;
        if (b.children) {
            const found = findBlock(id, b.children);
            if (found) return found;
        }
    }
    return null;
};

export const isDescendant = (parentId: string, childId: string, list: EmailBlock[]): boolean => {
    const parent = findBlock(parentId, list);
    if (!parent || !parent.children) return false;
    return !!findBlock(childId, parent.children);
};

export const deleteBlockDeep = (list: EmailBlock[], id: string): EmailBlock[] => {
    return list.filter(b => b.id !== id).map(b => {
        if (b.children) return { ...b, children: deleteBlockDeep(b.children, id) };
        return b;
    });
};

export const duplicateBlockDeep = (b: EmailBlock): EmailBlock => ({
    ...b,
    id: createUniqueId(),
    children: b.children?.map(duplicateBlockDeep)
});

export const insertDeep = (list: EmailBlock[], targetId: string, block: EmailBlock, pos: 'top' | 'bottom' | 'inside' | 'left' | 'right'): EmailBlock[] => {
    if (targetId === 'root') {
        const finalBlock = (block.type !== 'section') ? wrapElement(block) : block;
        return pos === 'top' ? [finalBlock, ...list] : [...list, finalBlock];
    }
    const idx = list.findIndex(b => b.id === targetId);
    if (idx !== -1) {
        const copy = [...list];
        // Determine the parent's type to decide on wrapping
        // We need to know what the target's siblings are to know the parent type.
        // Actually, we can check the target's type if we are inserting AT the target's level.
        // If we are at this level, we are essentially children of some parent.
        // We need to know that parent's type.
        // Since we don't have parentType here, we can infer it from the target type if they are siblings.
        // In this editor:
        // - Siblings of a 'section' are always 'section's. Parent is root.
        // - Siblings of a 'row' are always 'row's. Parent is 'section'.
        // - Siblings of a 'column' are always 'column's. Parent is 'row'.
        // - Siblings of a content block are always in a 'column'.

        const targetSibling = copy[idx];
        let blockToInsert = block;

        if (pos === 'inside') {
            if (['section', 'row', 'column'].includes(targetSibling.type)) {
                if (targetSibling.type === 'section' && block.type !== 'row') {
                    const wrapped = wrapElement(block); blockToInsert = wrapped.children![0];
                } else if (targetSibling.type === 'row' && block.type !== 'column') {
                    const col = createBlock('column'); col.children = [block]; col.style.width = '100%'; blockToInsert = col;
                }
                copy[idx] = { ...targetSibling, children: [...(targetSibling.children || []), blockToInsert] };
            }
        } else if (pos === 'left' || pos === 'right') {
            if (targetSibling.type === 'column') {
                if (block.type !== 'column') {
                    blockToInsert = createBlock('column');
                    blockToInsert.children = [block];
                }
                copy.splice(pos === 'left' ? idx : idx + 1, 0, blockToInsert);
                const newCount = copy.length;
                const equalWidth = (100 / newCount).toFixed(2) + '%';
                copy.forEach((c, i) => {
                    if (c.style) {
                        c.style.width = equalWidth;
                        if (newCount > 1) {
                            c.style.paddingLeft = i > 0 ? '10px' : '0px';
                            c.style.paddingRight = i < newCount - 1 ? '10px' : '0px';
                        }
                    }
                });
            } else {
                copy.splice(pos === 'left' ? idx : idx + 1, 0, block);
            }
        } else {
            // Top/Bottom drop. Check if we are inside a section/row/column by checking sibling type.
            if (targetSibling.type === 'section' && block.type !== 'section') {
                // If dropping next to a section (at root), must be a section
                blockToInsert = wrapElement(block);
            } else if (targetSibling.type === 'row' && block.type !== 'row' && block.type !== 'section') {
                // We are inside a section, but trying to drop a non-row block. Wrap it.
                const wrapped = wrapElement(block); blockToInsert = wrapped.children![0];
            } else if (targetSibling.type === 'column' && block.type !== 'column') {
                // This shouldn't happen much as columns are side-by-side, but if so:
                blockToInsert = createBlock('column'); blockToInsert.children = [block];
            }
            copy.splice(pos === 'top' ? idx : idx + 1, 0, blockToInsert);
        }
        return copy;
    }
    return list.map(b => b.children ? { ...b, children: insertDeep(b.children, targetId, block, pos) } : b);
};

export const moveBlockOrder = (id: string, direction: 'up' | 'down', blocks: EmailBlock[]): EmailBlock[] => {
    const process = (items: EmailBlock[]): EmailBlock[] => {
        const idx = items.findIndex(x => x.id === id);
        if (idx !== -1) {
            const copy = [...items];
            if (direction === 'up' && idx > 0) [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]];
            else if (direction === 'down' && idx < copy.length - 1) [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
            return copy;
        }
        return items.map(item => item.children ? { ...item, children: process(item.children) } : item);
    };
    return process(blocks);
};

export const swapColumnsInRow = (colId: string, blocks: EmailBlock[]): EmailBlock[] => {
    const process = (items: EmailBlock[]): EmailBlock[] => {
        return items.map(item => {
            if (item.type === 'row' && item.children) {
                const idx = item.children.findIndex(c => c.id === colId);
                if (idx !== -1) {
                    const newCols = [...item.children];
                    const nextIdx = (idx + 1) % newCols.length;
                    [newCols[idx], newCols[nextIdx]] = [newCols[nextIdx], newCols[idx]];
                    return { ...item, children: newCols };
                }
            }
            return item.children ? { ...item, children: process(item.children) } : item;
        });
    };
    return process(blocks);
};

export const ensureUniqueIds = (list: EmailBlock[]): EmailBlock[] => {
    return list.map(b => ({
        ...b,
        id: createUniqueId(),
        children: b.children ? ensureUniqueIds(b.children) : undefined
    }));
};

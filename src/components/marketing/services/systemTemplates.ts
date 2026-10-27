
import { EmailBlock, Template, EmailBodyStyle, EmailBlockStyle, ListItem, EmailBlockType } from '../types';

// --- ASSETS ---
const IMAGES = {
    logos: {
        dark: 'https://placehold.co/150x40/1e293b/ffffff?text=BRAND',
        light: 'https://placehold.co/150x40/ffffff/1e293b?text=BRAND',
        color: 'https://placehold.co/150x40/transparent/2563eb?text=BRAND'
    },
    fashion: [
        'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80', // Hero
        'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=400&q=80', // Clothes
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80', // Shoes
    ],
    tech: [
        'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80', // Workplace
        'https://images.unsplash.com/photo-1498049860654-af1a5c5668ba?auto=format&fit=crop&w=400&q=80', // Laptop
        'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=400&q=80'  // Circuit
    ],
    event: [
        'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80', // Conference
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80', // Speaker 1
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80'  // Speaker 2
    ],
    minimal: [
        'https://cdn-icons-png.flaticon.com/512/148/148767.png' // Checkmark
    ]
};

// --- THEMES ---
const THEMES = {
    modern: {
        bg: '#F3F4F6', card: '#FFFFFF', primary: '#2563EB', text: '#1F2937', secText: '#6B7280',
        font: 'Helvetica, sans-serif', radius: '12px'
    },
    dark_luxury: {
        bg: '#0F172A', card: '#1E293B', primary: '#d97706', text: '#F9FAFB', secText: '#9CA3AF',
        font: "'Playfair Display', serif", radius: '0px'
    },
    vibrant: {
        bg: '#FFF7ED', card: '#FFFFFF', primary: '#EA580C', text: '#431407', secText: '#9A3412',
        font: 'Arial, sans-serif', radius: '24px'
    },
    minimal: {
        bg: '#FFFFFF', card: '#FFFFFF', primary: '#10B981', text: '#111827', secText: '#6B7280',
        font: "'Courier New', monospace", radius: '4px'
    }
};

// --- HELPERS ---
const createId = () => crypto.randomUUID();
const createStyle = (overrides: EmailBlockStyle = {}): EmailBlockStyle => ({
    paddingTop: '0px', paddingBottom: '0px', paddingLeft: '0px', paddingRight: '0px',
    marginTop: '0px', marginBottom: '0px', marginLeft: '0px', marginRight: '0px',
    ...overrides
});

const createBlock = (type: EmailBlockType, content: string = '', style: EmailBlockStyle = {}, children: EmailBlock[] = [], extra: any = {}): EmailBlock => ({
    id: createId(), type, content, style: createStyle(style), children, ...extra
});

// Updated helper signatures to be more flexible with style overrides
const createSection = (children: EmailBlock[], styleOverrides: EmailBlockStyle = {}) =>
    createBlock('section', '', styleOverrides, children);

const createRow = (children: EmailBlock[], styleOverrides: EmailBlockStyle = {}) =>
    createBlock('row', '', styleOverrides, children);

const createColumn = (children: EmailBlock[], styleOverrides: EmailBlockStyle = {}) =>
    createBlock('column', '', styleOverrides, children);

const createText = (content: string, styleOverrides: EmailBlockStyle = {}) =>
    createBlock('text', content, styleOverrides);

const createImage = (src: string, alt: string, styleOverrides: EmailBlockStyle = {}) =>
    createBlock('image', src, styleOverrides, [], { altText: alt });

const createButton = (text: string, url: string, styleOverrides: EmailBlockStyle = {}) =>
    createBlock('button', text, styleOverrides, [], { url });

const createSpacer = (styleOverrides: EmailBlockStyle = {}) =>
    createBlock('spacer', '', styleOverrides);

const createDivider = (styleOverrides: EmailBlockStyle = {}) =>
    createBlock('divider', '', styleOverrides);

// --- TEMPLATE BUILDERS ---

// 1. Welcome Series (Modern)




// 5. SaaS / Academy Welcome (Premium)
const buildSaaSWelcome = (): Template => {
    const blocks: EmailBlock[] = [
        createSection([
            createRow([
                createColumn([
                    createImage('https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop', 'Logo', { width: '120px', textAlign: 'center', marginBottom: '20px' }),
                    createBlock('text', '<h1 style="text-align: center; font-size: 28px; color: #1e293b; margin-bottom: 10px;">Chào mừng {{fullName}} đến với Viện Quốc Tế IDEAS!</h1><p style="text-align: center; color: #64748b; font-size: 16px;">Cảm ơn Anh/Chị đã quan tâm đến chương trình <strong>{{program}}</strong>. Chuyên viên tư vấn <strong>{{consultantName}}</strong> ({{consultantPhone}}) sẽ đồng hành cùng Anh/Chị.</p>', { textAlign: 'center' })
                ])
            ], { backgroundColor: 'transparent' })
        ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f9fafb' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<h3 style="text-align: center; margin-bottom: 20px;">3 Bước lộ trình nhập học</h3>', { textAlign: 'center' }),
                    createBlock('timeline', '', { textAlign: 'left', paddingLeft: '40px', paddingRight: '40px' }, [], {
                        items: [
                            { id: createId(), date: 'Bước 1', title: 'Tư vấn chuyên sâu 1-1', description: 'Đánh giá hồ sơ năng lực và định hướng lộ trình học phù hợp.' },
                            { id: createId(), date: 'Bước 2', title: 'Xét duyệt học bổng & Hồ sơ', description: 'Hoàn thiện thủ tục đăng ký và nhận ưu đãi học phí.' },
                            { id: createId(), date: 'Bước 3', title: 'Kích hoạt tài khoản học tập', description: 'Bắt đầu chương trình quốc tế cùng đội ngũ giảng viên và cố vấn.' }
                        ]
                    })
                ], { width: '100%', paddingTop: '30px', paddingBottom: '30px' })
            ], { width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', borderStyle: 'solid', borderTopWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px', borderRightWidth: '1px', borderColor: '#f1f5f9' })
        ], { paddingTop: '20px', paddingBottom: '20px', backgroundColor: '#ffffff', paddingLeft: '20px', paddingRight: '20px' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('check_list', '', { textAlign: 'left', checkIconColor: '#2563eb', color: '#1e293b' }, [], {
                        checkListTitle: 'Đặc quyền học viên tại Viện Quốc Tế IDEAS',
                        items: [
                            { id: createId(), title: 'Bằng cấp quốc tế kiểm định', description: 'Được công nhận toàn cầu từ các trường đại học đối tác Thụy Sĩ, Anh, Pháp.' },
                            { id: createId(), title: 'Lịch học linh hoạt 100% Online / Blended', description: 'Thiết kế tối ưu cho nhà quản lý và nhân sự cấp cao bận rộn.' },
                            { id: createId(), title: 'Đồng hành học thuật 1-1', description: 'Đội ngũ trợ giảng và cố vấn hỗ trợ xuyên suốt khóa học.' }
                        ]
                    }),
                    createButton('Khám phá chương trình ngay', 'https://ideas.edu.vn', { contentBackgroundColor: '#2563eb', color: '#ffffff', borderRadius: '30px', marginTop: '30px', fontWeight: 'bold' })
                ])
            ], { backgroundColor: 'transparent' })
        ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f9fafb' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<p style="color: #94a3b8; font-size: 11px; margin: 0;">© {{current_year}} Viện Quốc Tế IDEAS. Bảo lưu mọi quyền.<br><a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Hủy đăng ký nhận bản tin</a></p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '20px', paddingBottom: '20px' })
        ], { backgroundColor: '#f8fafc' })
    ];

    return {
        id: 'sys_saas_welcome',
        name: 'Chào mừng Học viên / Khách hàng (IDEAS Welcome)',
        thumbnail: '/uploads/template_thumbs/tpl_sys_saas_welcome.webp?v=1',
        category: 'welcome',
        lastModified: new Date().toISOString(),
        blocks,
        bodyStyle: { backgroundColor: '#ffffff', contentWidth: '600px', fontFamily: 'Inter, sans-serif', contentBackgroundColor: '#ffffff', linkColor: '#2563eb' }
    };
};

// 6. Product Launch (Luxury)
const buildProductLaunch = (): Template => {
    const blocks: EmailBlock[] = [
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<span style="color: #2563eb; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">CHƯƠNG TRÌNH MỚI</span><h1 style="color: #ffffff; font-size: 38px; margin: 10px 0;">{{program}}: Lãnh Đạo Kỷ Nguyên Số</h1><p style="color: #cbd5e1; font-size: 15px;">Dành riêng cho {{fullName}} — Cơ hội nhận học bổng ưu đãi đặc biệt trong tháng này.</p>', { textAlign: 'center' }),
                    createImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop', 'Product Hero', { width: '100%', marginTop: '30px', borderRadius: '24px' })
                ])
            ], { backgroundColor: '#000000', paddingTop: '60px', paddingBottom: '60px' })
        ], { paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#000000' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('check_list', '', { textAlign: 'left', checkIcon: 'Zap', checkIconColor: '#2563eb' }, [], {
                        checkListTitle: 'Điểm nổi bật của chương trình',
                        items: [
                            { id: createId(), title: 'Giáo trình chuẩn quốc tế', description: 'Cập nhật thực tiễn quản trị và chiến lược kinh doanh hiện đại.' },
                            { id: createId(), title: 'Ứng dụng AI & Chuyển đổi số', description: 'Tích hợp công cụ phân tích và lãnh đạo trong kỷ nguyên AI.' },
                            { id: createId(), title: 'Mạng lưới C-Level & Alumni', description: 'Kết nối hơn 2.000 học viên là CEO, Giám đốc và Quản lý cấp cao.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#ffffff' })
        ], { backgroundColor: '#ffffff' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<h2 style="text-align: center; margin-bottom: 30px;">Lộ trình triển khai khóa học</h2>', { textAlign: 'center' }),
                    createBlock('timeline', '', { textAlign: 'left', timelineDotColor: '#000000' }, [], {
                        items: [
                            { id: createId(), date: 'Giai đoạn 1', title: 'Nền tảng Quản trị Chiến lược', description: 'Xây dựng tư duy hệ thống và năng lực ra quyết định.' },
                            { id: createId(), date: 'Giai đoạn 2', title: 'Chuyên đề Chuyên sâu', description: 'Thực hành giải quyết Case Study thực tế tại doanh nghiệp.' },
                            { id: createId(), date: 'Giai đoạn 3', title: 'Luận văn & Tốt nghiệp Quốc tế', description: 'Bảo vệ đề án cuối khóa và nhận bằng từ trường đại học đối tác.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f8fafc' })
        ], { backgroundColor: '#f8fafc' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<p style="color: #94a3b8; font-size: 11px; margin: 0;">© {{current_year}} Viện Quốc Tế IDEAS. Bảo lưu mọi quyền.<br><a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Hủy đăng ký nhận bản tin</a></p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '20px', paddingBottom: '20px' })
        ], { backgroundColor: '#ffffff' })
    ];

    return {
        id: 'sys_prod_launch',
        name: 'Giới thiệu Chương trình / Sản phẩm (Luxury)',
        thumbnail: '/uploads/template_thumbs/tpl_sys_prod_launch.webp?v=1',
        category: 'promotional',
        lastModified: new Date().toISOString(),
        blocks,
        bodyStyle: { backgroundColor: '#ffffff', contentWidth: '600px', fontFamily: 'Inter, sans-serif', contentBackgroundColor: '#ffffff', linkColor: '#2563eb' }
    };
};

// 7. Tech Summit (Event)
const buildEventInvite = (): Template => {
    const blocks: EmailBlock[] = [
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<h1 style="color: #ffffff; font-size: 36px; line-height: 1.2;">EXECUTIVE SUMMIT {{current_year}}</h1><p style="color: #c084fc; font-size: 18px; font-weight: bold; margin-top: 10px;">Kính mời {{fullName}} tham dự Hội thảo Lãnh đạo & AI</p>', { textAlign: 'center' }),
                    createButton('Xác nhận tham dự ngay', 'https://ideas.edu.vn', { contentBackgroundColor: '#ffffff', color: '#581c87', borderRadius: '12px', marginTop: '30px', fontWeight: 'bold' })
                ])
            ], { backgroundColor: 'transparent', paddingTop: '80px', paddingBottom: '80px' })
        ], { paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#581c87' }),
        createSection([
            createRow([
                createColumn([
                    createImage('https://images.unsplash.com/photo-1540575861501-7ad0582371f3?q=80&w=800&auto=format&fit=crop', 'Event Detail', { width: '100%', borderRadius: '20px', marginBottom: '30px' }),
                    createBlock('timeline', '', { textAlign: 'left', timelineDotColor: '#581c87' }, [], {
                        items: [
                            { id: createId(), date: '08:30', title: 'Đón khách & Networking', description: 'Check-in và giao lưu cùng các diễn giả quốc tế.' },
                            { id: createId(), date: '09:00', title: 'Phiên tham luận chính', description: 'Chiến lược quản trị doanh nghiệp trong kỷ nguyên AI.' },
                            { id: createId(), date: '10:30', title: 'Tư vấn Học bổng {{program}}', description: 'Gặp gỡ trực tiếp ban giám khảo và chuyên viên {{consultantName}}.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#ffffff' })
        ], { backgroundColor: '#ffffff' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<p style="color: #94a3b8; font-size: 11px; margin: 0;">© {{current_year}} Viện Quốc Tế IDEAS. Bảo lưu mọi quyền.<br><a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Hủy đăng ký nhận bản tin</a></p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '20px', paddingBottom: '20px' })
        ], { backgroundColor: '#f9fafb' })
    ];

    return {
        id: 'sys_event_summit',
        name: 'Thư mời Sự kiện & Hội thảo (Executive Summit)',
        thumbnail: '/uploads/template_thumbs/tpl_sys_event_summit.webp?v=1',
        category: 'event',
        lastModified: new Date().toISOString(),
        blocks,
        bodyStyle: { backgroundColor: '#f9fafb', contentWidth: '600px', fontFamily: 'Inter, sans-serif', contentBackgroundColor: '#ffffff', linkColor: '#581c87' }
    };
};

// 8. Agency Portfolio (Review)
const buildPortfolioReview = (): Template => {
    const blocks: EmailBlock[] = [
        createSection([
            createRow([
                createColumn([
                    createImage('https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop', 'Portfolio', { width: '100%', borderRadius: '20px' }),
                    createBlock('text', '<h2 style="margin-top: 30px;">Dấu ấn Học viên & Đối tác tại IDEAS</h2><p style="color: #64748b;">Kính gửi {{fullName}}, cùng khám phá hành trình bứt phá sự nghiệp của cộng đồng học viên chương trình {{program}}.</p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#ffffff' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('review', '"Chương trình thực tiễn, đội ngũ cố vấn tận tâm và luôn bám sát mục tiêu nghề nghiệp. Tôi thực sự ấn tượng với giá trị nhận được."', { textAlign: 'center', color: '#1e293b', fontStyle: 'italic', fontSize: '18px' }, [], { rating: 5 })
                ])
            ], { paddingTop: '30px', paddingBottom: '30px', backgroundColor: '#f1f5f9' })
        ], { backgroundColor: '#f1f5f9' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('check_list', '', { textAlign: 'left', checkIcon: 'Sparkles', checkIconColor: '#10b981' }, [], {
                        checkListTitle: 'Những con số biết nói',
                        items: [
                            { id: createId(), title: '2.000+ Học viên & Cựu học viên', description: 'Đang nắm giữ vị trí quản lý và lãnh đạo tại các tập đoàn lớn.' },
                            { id: createId(), title: 'Kiểm định Quốc tế uy tín', description: 'Các chương trình đạt chuẩn ASIC, IACBE, EDUQUA, ACBSP.' },
                            { id: createId(), title: '98% Học viên hài lòng', description: 'Hệ thống hỗ trợ học thuật chuyên nghiệp xuyên suốt.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#ffffff' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<p style="color: #94a3b8; font-size: 11px; margin: 0;">© {{current_year}} Viện Quốc Tế IDEAS. Bảo lưu mọi quyền.<br><a href="{{unsubscribe_url}}" style="color: #64748b; text-decoration: underline;">Hủy đăng ký nhận bản tin</a></p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '20px', paddingBottom: '20px' })
        ], { backgroundColor: '#f8fafc' })
    ];

    return {
        id: 'sys_portfolio',
        name: 'Đánh giá & Thành tựu Học viên (Portfolio)',
        thumbnail: '/uploads/template_thumbs/tpl_sys_portfolio.webp?v=1',
        category: 'promotional',
        lastModified: new Date().toISOString(),
        blocks,
        bodyStyle: { backgroundColor: '#ffffff', contentWidth: '600px', fontFamily: 'Inter, sans-serif', contentBackgroundColor: '#ffffff', linkColor: '#2563eb' }
    };
};

// 9. Weekly Digest (Newsletter)
const buildNewsletterDigest = (): Template => {
    const blocks: EmailBlock[] = [
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<span style="color: #db2777; font-weight: bold; font-size: 12px; letter-spacing: 2px;">WEEKLY DIGEST</span><h1 style="color: #831843; font-size: 32px; margin: 10px 0;">Bản tin Quản trị & Học thuật tuần này</h1><p style="color: #be185d;">Kính gửi {{fullName}}, tổng hợp những thông tin và góc nhìn quản trị đáng chú ý nhất trong 7 ngày qua.</p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#fdf2f8' }),
        createSection([
            createRow([
                createColumn([createImage('https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop', 'News 1', { width: '100%', borderRadius: '12px' })], { width: '40%' }),
                createColumn([createBlock('text', '<h4 style="margin: 0 0 10px 0; color: #1e293b;">AI đang thay đổi cách các CEO ra quyết định</h4><p style="font-size: 13px; color: #64748b; margin: 0;">Khám phá cách ứng dụng dữ liệu và AI vào quản trị chiến lược hiện đại.</p><a href="https://ideas.edu.vn" style="color: #db2777; font-size: 12px; font-weight: bold; text-decoration: none; display: block; margin-top: 10px;">Đọc thêm →</a>', { textAlign: 'left' })], { width: '60%', paddingLeft: '20px' })
            ], { paddingTop: '20px', paddingBottom: '20px', borderStyle: 'solid', borderBottomWidth: '1px', borderColor: '#f1f5f9' }),
            createRow([
                createColumn([createImage('https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=400&auto=format&fit=crop', 'News 2', { width: '100%', borderRadius: '12px' })], { width: '40%' }),
                createColumn([createBlock('text', '<h4 style="margin: 0 0 10px 0; color: #1e293b;">Xu hướng phát triển lãnh đạo bền vững ESG</h4><p style="font-size: 13px; color: #64748b; margin: 0;">Những tiêu chuẩn mới dành cho nhà quản lý cấp cao trên toàn cầu.</p><a href="https://ideas.edu.vn" style="color: #db2777; font-size: 12px; font-weight: bold; text-decoration: none; display: block; margin-top: 10px;">Đọc thêm →</a>', { textAlign: 'left' })], { width: '60%', paddingLeft: '20px' })
            ], { paddingTop: '20px', paddingBottom: '20px' })
        ], { backgroundColor: '#ffffff', paddingLeft: '20px', paddingRight: '20px' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('social', '', { textAlign: 'center', iconMode: 'light', iconSize: '24' }, [], {
                        socialLinks: [{ id: createId(), network: 'facebook', url: 'https://ideas.edu.vn' }, { id: createId(), network: 'twitter', url: 'https://ideas.edu.vn' }, { id: createId(), network: 'instagram', url: 'https://ideas.edu.vn' }]
                    }),
                    createBlock('text', '<p style="color: #94a3b8; font-size: 11px; margin-top: 20px;">Bạn nhận được email này vì đã đăng ký nhận thông tin từ Viện Quốc Tế IDEAS.<br>© {{current_year}} Viện Quốc Tế IDEAS. <a href="{{unsubscribe_url}}" style="color: #2563eb;">Hủy đăng ký</a></p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#1e293b' })
    ];

    return {
        id: 'sys_newsletter_digest',
        name: 'Bản tin tuần (Weekly Digest)',
        thumbnail: '/uploads/template_thumbs/tpl_sys_newsletter_digest.webp?v=1',
        category: 'newsletter',
        lastModified: new Date().toISOString(),
        blocks,
        bodyStyle: { backgroundColor: '#ffffff', contentWidth: '600px', fontFamily: 'Inter, sans-serif', contentBackgroundColor: '#ffffff', linkColor: '#2563eb' }
    };
};

// 10. ESTIAM Student Onboarding (Academic Welcome)
const buildEstiamStudentOnboarding = (): Template => {
    const blocks: EmailBlock[] = [
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<div style="text-align: center;"><span style="color: #ffffff; font-weight: 800; font-size: 24px; letter-spacing: 2px;">IDEAS</span><p style="color: rgba(255,255,255,0.92); font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 6px; letter-spacing: 0.5px;">THÔNG BÁO TIẾP NHẬN HỌC VIÊN &amp; HƯỚNG DẪN HỌC TẬP - PARIS EDUCATION / ESTIAM</p></div>', { textAlign: 'center' })
                ])
            ], { backgroundColor: '#BD1D2D', paddingTop: '26px', paddingBottom: '26px', paddingLeft: '20px', paddingRight: '20px' })
        ], { paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#BD1D2D' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', `<div style="font-size: 14.5px; line-height: 1.7; color: #334155; text-align: left;">
<p style="margin: 0 0 12px 0;">Kính gửi Quý Anh/Chị học viên <strong>{{full_name}}</strong>,</p>
<p style="margin: 0 0 16px 0;">Lời đầu tiên, Ban Công tác Sinh viên IDEAS xin gửi lời chúc mừng và trân trọng cảm ơn Anh/Chị đã tin chọn IDEAS làm người bạn đồng hành trên chặng đường chinh phục tấm bằng từ <strong>Paris Education/ESTIAM</strong>. Chúng tôi cam kết đồng hành và hỗ trợ Anh/Chị xuyên suốt quá trình học tập và nghiên cứu.</p>

<p style="margin: 18px 0 8px 0;"><strong style="color: #BD1D2D; font-size: 15px;">A. KÊNH LIÊN LẠC CHÍNH THỨC</strong></p>
<p style="margin: 0 0 16px 0;">1. <strong>Kênh Hỗ trợ Nhanh (Zalo/Hotline):</strong> 098 736 3935<br/>
2. <strong>Kênh Hỗ trợ Học vụ (Email):</strong><br/>
&nbsp;&nbsp;- Tiếp nhận yêu cầu: <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a><br/>
&nbsp;&nbsp;- CC (Đồng gửi): <a href="mailto:it.dept@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">it.dept@ideas.edu.vn</a>, <a href="mailto:student.notice@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">student.notice@ideas.edu.vn</a>, <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a> <em>(Vui lòng luôn CC các địa chỉ này để hệ thống ghi nhận và xử lý nhanh nhất)</em></p>

<p style="margin: 18px 0 8px 0;"><strong style="color: #BD1D2D; font-size: 15px;">B. TÀI KHOẢN HỌC TẬP</strong></p>
<p style="margin: 0 0 8px 0;">Anh/Chị sẽ được cấp 3 tài khoản học tập, sử dụng xuyên suốt chương trình:</p>
<ul style="padding-left: 20px; margin: 0 0 10px 0; line-height: 1.8;">
  <li><strong>1. Tài khoản LMS IDEAS</strong> (xem tài liệu, video record buổi học, hỗ trợ học thuật): <a href="https://lms.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://lms.ideas.edu.vn/</a> | Video hướng dẫn: <a href="https://drive.google.com/file/d/1wXQtghJSd7CHoek_hPXOfXuVuGuT8bMv/view?usp=sharing" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></li>
  <li><strong>2. Tài khoản học tập Paris Education</strong> (làm bài, nộp bài chính thức): <a href="https://pariseducation-global.org/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://pariseducation-global.org/</a></li>
  <li><strong>3. Platform IDEAS AI</strong> (công cụ bổ trợ học tập): <a href="https://ai.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://ai.ideas.edu.vn/</a></li>
</ul>
<p style="margin: 0 0 16px 0;"><em>(thông tin tài khoản sẽ được gửi trực tiếp đến email cá nhân của học viên đã đăng ký học tập)</em></p>

<p style="margin: 18px 0 8px 0;"><strong style="color: #BD1D2D; font-size: 15px;">C. TÀI LIỆU ĐÍNH KÈM</strong></p>
<ul style="padding-left: 20px; margin: 0 0 10px 0; line-height: 1.8;">
  <li>File Template format APA</li>
  <li>File hướng dẫn sử dụng các hệ thống học tập</li>
</ul>
<p style="margin: 0 0 16px 0;">Link tổng hợp tài liệu hướng dẫn: <a href="https://drive.google.com/drive/folders/1tBzBTLL9WPT-OOjKWRNz5qFx8YGSptKG?usp=drive_link" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></p>

<p style="margin: 0 0 18px 0;">Nếu có bất kỳ vướng mắc nào, Anh/Chị vui lòng liên hệ CTSV để được hỗ trợ kịp thời. Chúc Anh/Chị có hành trình học tập, nghiên cứu thật thuận lợi và thành công!</p>

<p style="margin: 20px 0 0 0;">Trân trọng,<br/><strong>Ban Công tác Sinh viên IDEAS</strong></p>
</div>`, { textAlign: 'left' })
                ])
            ], { paddingTop: '28px', paddingBottom: '28px', paddingLeft: '28px', paddingRight: '28px', backgroundColor: '#ffffff' })
        ], { backgroundColor: '#ffffff' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<div style="text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;"><strong style="color: #334155;">Ban Công tác Sinh viên &amp; Học vụ - Viện Quốc Tế IDEAS</strong><br/>Hotline / Zalo: <strong style="color: #BD1D2D;">098 736 3935</strong> | Email: <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; text-decoration: none;">support@ideas.edu.vn</a><br/>© {{current_year}} Viện Quốc Tế IDEAS. Bảo lưu mọi quyền.</div>', { textAlign: 'center' })
                ])
            ], { paddingTop: '18px', paddingBottom: '18px', paddingLeft: '20px', paddingRight: '20px' })
        ], { backgroundColor: '#f8fafc' })
    ];

    return {
        id: 'sys_estiam_onboarding',
        name: '[ESTIAM] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - Paris Education/ESTIAM',
        thumbnail: '/uploads/template_thumbs/tpl_sys_saas_welcome.webp?v=1',
        category: 'welcome',
        lastModified: new Date().toISOString(),
        blocks,
        bodyStyle: { backgroundColor: '#f8fafc', contentWidth: '600px', fontFamily: 'Inter, sans-serif', contentBackgroundColor: '#ffffff', linkColor: '#BD1D2D' }
    };
};

export const SYSTEM_TEMPLATES: Template[] = [
    buildEstiamStudentOnboarding(),
    buildSaaSWelcome(),
    buildProductLaunch(),
    buildEventInvite(),
    buildPortfolioReview(),
    buildNewsletterDigest(),
];

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




// 5. SaaS Welcome (Premium)
const buildSaaSWelcome = (): Template => {
    const blocks: EmailBlock[] = [
        createSection([
            createRow([
                createColumn([
                    createImage('https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop', 'Logo', { width: '120px', textAlign: 'center', marginBottom: '20px' }),
                    createBlock('text', '<h1 style="text-align: center; font-size: 28px; color: #1e293b; margin-bottom: 10px;">Chào mừng bạn đến với MailFlow Pro!</h1><p style="text-align: center; color: #64748b; font-size: 16px;">Hãy cùng bắt đầu hành trình tối ưu hóa trải nghiệm khách hàng của bạn.</p>', { textAlign: 'center' })
                ])
            ], { backgroundColor: 'transparent' })
        ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f9fafb' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<h3 style="text-align: center; margin-bottom: 20px;">3 Bước để bắt đầu</h3>', { textAlign: 'center' }),
                    createBlock('timeline', '', { textAlign: 'left', paddingLeft: '40px', paddingRight: '40px' }, [], {
                        items: [
                            { id: createId(), date: 'Bước 1', title: 'Kết nối tài khoản', description: 'Liên kết các kênh mạng xã hội và email của bạn.' },
                            { id: createId(), date: 'Bước 2', title: 'Thiết lập kịch bản', description: 'Tạo quy trình trả lời tự động thông minh.' },
                            { id: createId(), date: 'Bước 3', title: 'Kích hoạt chiến dịch', description: 'Bắt đầu gửi email và thu về kết quả.' }
                        ]
                    })
                ], { width: '100%', paddingTop: '30px', paddingBottom: '30px' })
            ], { width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', borderStyle: 'solid', borderTopWidth: '1px', borderBottomWidth: '1px', borderLeftWidth: '1px', borderRightWidth: '1px', borderColor: '#f1f5f9' })
        ], { paddingTop: '20px', paddingBottom: '20px', backgroundColor: '#ffffff', paddingLeft: '20px', paddingRight: '20px' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('check_list', '', { textAlign: 'left', checkIconColor: '#2563eb', color: '#1e293b' }, [], {
                        checkListTitle: 'Lợi ích khi sử dụng MailFlow Pro',
                        items: [
                            { id: createId(), title: 'Tự động hóa 24/7', description: 'Không bỏ lỡ bất kỳ khách hàng nào.' },
                            { id: createId(), title: 'Báo cáo chi tiết', description: 'Phân tích dữ liệu theo thời gian thực.' },
                            { id: createId(), title: 'Tiết kiệm 80% thời gian', description: 'Tập trung vào việc chốt đơn hàng.' }
                        ]
                    }),
                    createButton('Khám phá ngay', '#', { contentBackgroundColor: '#2563eb', color: '#ffffff', borderRadius: '30px', marginTop: '30px', fontWeight: 'bold' })
                ])
            ], { backgroundColor: 'transparent' })
        ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f9fafb' })
    ];

    return {
        id: 'sys_saas_welcome',
        name: 'Chào mừng (SaaS Premium)',
        thumbnail: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=600&q=80',
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
                    createBlock('text', '<span style="color: #2563eb; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">New Arrival</span><h1 style="color: #ffffff; font-size: 42px; margin: 10px 0;">Product X: The Future</h1>', { textAlign: 'center' }),
                    createImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop', 'Product Hero', { width: '100%', marginTop: '30px', borderRadius: '24px' })
                ])
            ], { backgroundColor: '#000000', paddingTop: '60px', paddingBottom: '60px' })
        ], { paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#000000' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('check_list', '', { textAlign: 'left', checkIcon: 'Zap', checkIconColor: '#2563eb' }, [], {
                        checkListTitle: 'Tính năng cốt lõi',
                        items: [
                            { id: createId(), title: 'Thiết kế tối giản', description: 'Phù hợp với mọi không gian hiện đại.' },
                            { id: createId(), title: 'Hiệu năng mạnh mẽ', description: 'Xử lý mọi tác vụ chỉ trong nháy mắt.' },
                            { id: createId(), title: 'Pin 48 giờ', description: 'Sử dụng thoải mái không lo sạc.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#ffffff' })
        ], { backgroundColor: '#ffffff' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('text', '<h2 style="text-align: center; margin-bottom: 30px;">Lộ trình phát triển</h2>', { textAlign: 'center' }),
                    createBlock('timeline', '', { textAlign: 'left', timelineDotColor: '#000000' }, [], {
                        items: [
                            { id: createId(), date: 'Tháng 1', title: 'Nghiên cứu thị trường', description: 'Lắng nghe phản hồi từ 1000 người dùng đầu tiên.' },
                            { id: createId(), date: 'Tháng 3', title: 'Phiên bản Beta', description: 'Thử nghiệm giới hạn cho các đối tác chiến lược.' },
                            { id: createId(), date: 'Tháng 6', title: 'Ra mắt toàn cầu', description: 'Chính thức có mặt tại hơn 50 quốc gia.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f8fafc' })
        ], { backgroundColor: '#f8fafc' })
    ];

    return {
        id: 'sys_prod_launch',
        name: 'Ra mắt sản phẩm (Luxury)',
        thumbnail: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
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
                    createBlock('text', '<h1 style="color: #ffffff; font-size: 36px; line-height: 1.2;">TECH SUMMIT 2024</h1><p style="color: #c084fc; font-size: 18px; font-weight: bold; margin-top: 10px;">The Next Generation of AI</p>', { textAlign: 'center' }),
                    createButton('Đăng ký ngay', '#', { contentBackgroundColor: '#ffffff', color: '#581c87', borderRadius: '12px', marginTop: '30px', fontWeight: 'bold' })
                ])
            ], { backgroundColor: 'transparent', paddingTop: '80px', paddingBottom: '80px' })
        ], { paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#581c87' }),
        createSection([
            createRow([
                createColumn([
                    createImage('https://images.unsplash.com/photo-1540575861501-7ad0582371f3?q=80&w=800&auto=format&fit=crop', 'Event Detail', { width: '100%', borderRadius: '20px', marginBottom: '30px' }),
                    createBlock('timeline', '', { textAlign: 'left', timelineDotColor: '#581c87' }, [], {
                        items: [
                            { id: createId(), date: '08:00', title: 'Check-in & Coffee', description: 'Đón khách và giao lưu tự do.' },
                            { id: createId(), date: '09:00', title: 'Khai mạc', description: 'Chia sẻ tầm nhìn AI từ CEO.' },
                            { id: createId(), date: '11:00', title: 'Workshop 1', description: 'Ứng dụng AI vào quy trình Marketing.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#ffffff' })
        ], { backgroundColor: '#ffffff' })
    ];

    return {
        id: 'sys_event_summit',
        name: 'Thư mời sự kiện (Tech Summit)',
        thumbnail: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=600&q=80',
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
                    createBlock('text', '<h2 style="margin-top: 30px;">Hợp tác cùng Agency X</h2><p style="color: #64748b;">Khám phá cách chúng tôi đã giúp doanh nghiệp tăng trưởng 200% doanh thu chỉ trong 6 tháng.</p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#ffffff' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('review', '"Đội ngũ chuyên nghiệp, sáng tạo và luôn bám sát mục tiêu. Tôi thực sự ấn tượng với kết quả đạt được."', { textAlign: 'center', color: '#1e293b', fontStyle: 'italic', fontSize: '18px' }, [], { rating: 5 })
                ])
            ], { paddingTop: '30px', paddingBottom: '30px', backgroundColor: '#f1f5f9' })
        ], { backgroundColor: '#f1f5f9' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('check_list', '', { textAlign: 'left', checkIcon: 'Sparkles', checkIconColor: '#10b981' }, [], {
                        checkListTitle: 'Kết quả đạt được',
                        items: [
                            { id: createId(), title: '+200% Doanh thu', description: 'Tối ưu hóa các chiến dịch quảng cáo.' },
                            { id: createId(), title: '50k Lead mới', description: 'Xây dựng phễu thu hút khách hàng tiềm năng.' },
                            { id: createId(), title: '95% Khách hàng hài lòng', description: 'Dịch vụ chăm sóc khách hàng tự động.' }
                        ]
                    })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#ffffff' })
    ];

    return {
        id: 'sys_portfolio',
        name: 'Đánh giá & Kết quả (Portfolio)',
        thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
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
                    createBlock('text', '<span style="color: #db2777; font-weight: bold; font-size: 12px; letter-spacing: 2px;">WEEKLY DIGEST</span><h1 style="color: #831843; font-size: 32px; margin: 10px 0;">Bản tin Công nghệ tuần này</h1><p style="color: #be185d;">Tổng hợp những thông tin đáng chú ý nhất trong 7 ngày qua.</p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#fdf2f8' }),
        createSection([
            createRow([
                createColumn([createImage('https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop', 'News 1', { width: '100%', borderRadius: '12px' })], { width: '40%' }),
                createColumn([createBlock('text', '<h4 style="margin: 0 0 10px 0; color: #1e293b;">AI đang thay đổi cách chúng ta làm việc</h4><p style="font-size: 13px; color: #64748b; margin: 0;">Khám phá 10 công cụ AI giúp tăng hiệu suất lao động ngay lập tức.</p><a href="#" style="color: #db2777; font-size: 12px; font-weight: bold; text-decoration: none; display: block; margin-top: 10px;">Đọc thêm →</a>', { textAlign: 'left' })], { width: '60%', paddingLeft: '20px' })
            ], { paddingTop: '20px', paddingBottom: '20px', borderStyle: 'solid', borderBottomWidth: '1px', borderColor: '#f1f5f9' }),
            createRow([
                createColumn([createImage('https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=400&auto=format&fit=crop', 'News 2', { width: '100%', borderRadius: '12px' })], { width: '40%' }),
                createColumn([createBlock('text', '<h4 style="margin: 0 0 10px 0; color: #1e293b;">Tương lai của Robot dân dụng</h4><p style="font-size: 13px; color: #64748b; margin: 0;">Liệu Robot có trở thành người bạn đồng hành trong mỗi gia đình?</p><a href="#" style="color: #db2777; font-size: 12px; font-weight: bold; text-decoration: none; display: block; margin-top: 10px;">Đọc thêm →</a>', { textAlign: 'left' })], { width: '60%', paddingLeft: '20px' })
            ], { paddingTop: '20px', paddingBottom: '20px' })
        ], { backgroundColor: '#ffffff', paddingLeft: '20px', paddingRight: '20px' }),
        createSection([
            createRow([
                createColumn([
                    createBlock('social', '', { textAlign: 'center', iconMode: 'light', iconSize: '24' }, [], {
                        socialLinks: [{ id: createId(), network: 'facebook', url: '#' }, { id: createId(), network: 'twitter', url: '#' }, { id: createId(), network: 'instagram', url: '#' }]
                    }),
                    createBlock('text', '<p style="color: #94a3b8; font-size: 11px; margin-top: 20px;">Bạn nhận được email này vì đã đăng ký bản tin của chúng tôi.<br>© 2024 Tech News Inc. <a href="#" style="color: #2563eb;">Hủy đăng ký</a></p>', { textAlign: 'center' })
                ])
            ], { paddingTop: '40px', paddingBottom: '40px' })
        ], { backgroundColor: '#1e293b' })
    ];

    return {
        id: 'sys_newsletter_digest',
        name: 'Bản tin tuần (Digest)',
        thumbnail: 'https://images.unsplash.com/photo-1504711331083-9c895941bf81?auto=format&fit=crop&w=600&q=80',
        category: 'newsletter',
        lastModified: new Date().toISOString(),
        blocks,
        bodyStyle: { backgroundColor: '#ffffff', contentWidth: '600px', fontFamily: 'Inter, sans-serif', contentBackgroundColor: '#ffffff', linkColor: '#2563eb' }
    };
};

export const SYSTEM_TEMPLATES: Template[] = [];
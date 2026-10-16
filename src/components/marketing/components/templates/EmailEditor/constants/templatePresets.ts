
const createId = () => crypto.randomUUID();

export const TEMPLATE_PRESETS = [
    {
        name: 'Chào mừng (SaaS Welcome)',
        id: 'welcome_saas',
        icon: 'Sparkles',
        blocks: [
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f9fafb' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%', backgroundColor: 'transparent' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'image', content: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600&auto=format&fit=crop', style: { width: '120px', textAlign: 'center', marginBottom: '20px' } },
                            { id: createId(), type: 'text', content: '<h1 style="text-align: center; font-size: 28px; color: #1e293b; margin-bottom: 10px;">Chào mừng bạn đến với MailFlow Pro!</h1><p style="text-align: center; color: #64748b; font-size: 16px;">Hãy cùng bắt đầu hành trình tối ưu hóa trải nghiệm khách hàng của bạn.</p>', style: { textAlign: 'center' } }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '20px', paddingBottom: '20px', backgroundColor: '#ffffff' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%', paddingTop: '30px', paddingBottom: '30px' },
                        children: [
                            { id: createId(), type: 'text', content: '<h3 style="text-align: center; margin-bottom: 20px;">3 Bước để bắt đầu</h3>', style: { textAlign: 'center' } },
                            {
                                id: createId(),
                                type: 'timeline',
                                items: [
                                    { id: createId(), date: 'Bước 1', title: 'Kết nối tài khoản', description: 'Liên kết các kênh mạng xã hội và email của bạn.' },
                                    { id: createId(), date: 'Bước 2', title: 'Thiết lập kịch bản', description: 'Tạo quy trình trả lời tự động thông minh.' },
                                    { id: createId(), date: 'Bước 3', title: 'Kích hoạt chiến dịch', description: 'Bắt đầu gửi email và thu về kết quả.' }
                                ],
                                style: { textAlign: 'left', paddingLeft: '40px', paddingRight: '40px' }
                            }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f9fafb' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%', backgroundColor: 'transparent' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            {
                                id: createId(),
                                type: 'check_list',
                                checkListTitle: 'Lợi ích khi sử dụng MailFlow Pro',
                                items: [
                                    { id: createId(), title: 'Tự động hóa 24/7', description: 'Không bỏ lỡ bất kỳ khách hàng nào.' },
                                    { id: createId(), title: 'Báo cáo chi tiết', description: 'Phân tích dữ liệu theo thời gian thực.' },
                                    { id: createId(), title: 'Tiết kiệm 80% thời gian', description: 'Tập trung vào việc chốt đơn hàng.' }
                                ],
                                style: { textAlign: 'left', checkIconColor: '#d97706', color: '#1e293b' }
                            },
                            { id: createId(), type: 'button', content: 'Khám phá ngay', style: { contentBackgroundColor: '#d97706', color: '#ffffff', borderRadius: '30px', marginTop: '30px' } }
                        ]
                    }]
                }]
            }
        ]
    },
    {
        name: 'Ra mắt sản phẩm (Product Launch)',
        id: 'product_launch',
        icon: 'Rocket',
        blocks: [
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#000000' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%', backgroundColor: '#000000', paddingTop: '60px', paddingBottom: '60px' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'text', content: '<span style="color: #d97706; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">New Arrival</span><h1 style="color: #ffffff; font-size: 42px; margin: 10px 0;">Product X: The Future</h1>', style: { textAlign: 'center' } },
                            { id: createId(), type: 'image', content: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop', style: { width: '100%', marginTop: '30px', borderRadius: '24px' } }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#ffffff' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            {
                                id: createId(),
                                type: 'check_list',
                                checkListTitle: 'Tính năng cốt lõi',
                                items: [
                                    { id: createId(), title: 'Thiết kế tối giản', description: 'Phù hợp với mọi không gian hiện đại.' },
                                    { id: createId(), title: 'Hiệu năng mạnh mẽ', description: 'Xử lý mọi tác vụ chỉ trong nháy mắt.' },
                                    { id: createId(), title: 'Pin 48 giờ', description: 'Sử dụng thoải mái không lo sạc.' }
                                ],
                                style: { textAlign: 'left', checkIcon: 'Zap', checkIconColor: '#d97706' }
                            }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#f8fafc' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'text', content: '<h2 style="text-align: center; margin-bottom: 30px;">Lộ trình phát triển</h2>', style: { textAlign: 'center' } },
                            {
                                id: createId(),
                                type: 'timeline',
                                items: [
                                    { id: createId(), date: 'Tháng 1', title: 'Nghiên cứu thị trường', description: 'Lắng nghe phản hồi từ 1000 người dùng đầu tiên.' },
                                    { id: createId(), date: 'Tháng 3', title: 'Phiên bản Beta', description: 'Thử nghiệm giới hạn cho các đối tác chiến lược.' },
                                    { id: createId(), date: 'Tháng 6', title: 'Ra mắt toàn cầu', description: 'Chính thức có mặt tại hơn 50 quốc gia.' }
                                ],
                                style: { textAlign: 'left', timelineDotColor: '#000000' }
                            }
                        ]
                    }]
                }]
            }
        ]
    },
    {
        name: 'Thư mời sự kiện (Event Invite)',
        id: 'event_invite',
        icon: 'Calendar',
        blocks: [
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '0px', paddingBottom: '0px', backgroundColor: '#581c87' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%', backgroundColor: 'transparent', paddingTop: '80px', paddingBottom: '80px' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'text', content: '<h1 style="color: #ffffff; font-size: 36px; line-height: 1.2;">TECH SUMMIT 2024</h1><p style="color: #c084fc; font-size: 18px; font-weight: bold; margin-top: 10px;">The Next Generation of AI</p>', style: { textAlign: 'center' } },
                            { id: createId(), type: 'button', content: 'Đăng ký ngay', style: { contentBackgroundColor: '#ffffff', color: '#581c87', borderRadius: '12px', marginTop: '30px', fontWeight: 'bold' } }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#ffffff' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'image', content: 'https://images.unsplash.com/photo-1540575861501-7ad0582371f3?q=80&w=800&auto=format&fit=crop', style: { width: '100%', borderRadius: '20px', marginBottom: '30px' } },
                            {
                                id: createId(),
                                type: 'timeline',
                                items: [
                                    { id: createId(), date: '08:00', title: 'Check-in & Coffee', description: 'Đón khách và giao lưu tự do.' },
                                    { id: createId(), date: '09:00', title: 'Khai mạc', description: 'Chia sẻ tầm nhìn AI từ CEO.' },
                                    { id: createId(), date: '11:00', title: 'Workshop 1', description: 'Ứng dụng AI vào quy trình Marketing.' }
                                ],
                                style: { textAlign: 'left', timelineDotColor: '#581c87' }
                            }
                        ]
                    }]
                }]
            }
        ]
    },
    {
        name: 'Đánh giá & Kết quả (Portfolio/Review)',
        id: 'portfolio_review',
        icon: 'BarChart',
        blocks: [
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#ffffff' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'image', content: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&auto=format&fit=crop', style: { width: '100%', borderRadius: '20px' } },
                            { id: createId(), type: 'text', content: '<h2 style="margin-top: 30px;">Hợp tác cùng Agency X</h2><p style="color: #64748b;">Khám phá cách chúng tôi đã giúp doanh nghiệp tăng trưởng 200% doanh thu chỉ trong 6 tháng.</p>', style: { textAlign: 'center' } }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '30px', paddingBottom: '30px', backgroundColor: '#f1f5f9' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            {
                                id: createId(),
                                type: 'review',
                                rating: 5,
                                content: '"Đội ngũ chuyên nghiệp, sáng tạo và luôn bám sát mục tiêu. Tôi thực sự ấn tượng với kết quả đạt được."',
                                style: { textAlign: 'center', color: '#1e293b', fontStyle: 'italic', fontSize: '18px' }
                            }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            {
                                id: createId(),
                                type: 'check_list',
                                checkListTitle: 'Kết quả đạt được',
                                items: [
                                    { id: createId(), title: '+200% Doanh thu', description: 'Tối ưu hóa các chiến dịch quảng cáo.' },
                                    { id: createId(), title: '50k Lead mới', description: 'Xây dựng phễu thu hút khách hàng tiềm năng.' },
                                    { id: createId(), title: '95% Khách hàng hài lòng', description: 'Dịch vụ chăm sóc khách hàng tự động.' }
                                ],
                                style: { textAlign: 'left', checkIcon: 'Sparkles', checkIconColor: '#d97706' }
                            }
                        ]
                    }]
                }]
            }
        ]
    },
    {
        name: 'Bản tin tuần (Weekly Newsletter)',
        id: 'newsletter_digest',
        icon: 'Mail',
        blocks: [
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#fdf2f8' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'text', content: '<span style="color: #db2777; font-weight: bold; font-size: 12px; letter-spacing: 2px;">WEEKLY DIGEST</span><h1 style="color: #831843; font-size: 32px; margin: 10px 0;">Bản tin Công nghệ tuần này</h1><p style="color: #be185d;">Tổng hợp những thông tin đáng chú ý nhất trong 7 ngày qua.</p>', style: { textAlign: 'center' } }
                        ]
                    }]
                }]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '20px', paddingBottom: '20px', backgroundColor: '#ffffff' },
                children: [
                    {
                        id: createId(),
                        type: 'row',
                        style: { width: '100%', paddingTop: '20px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' },
                        children: [
                            { id: createId(), type: 'column', style: { width: '40%' }, children: [{ id: createId(), type: 'image', content: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=400&auto=format&fit=crop', style: { width: '100%', borderRadius: '12px' } }] },
                            { id: createId(), type: 'column', style: { width: '60%', paddingLeft: '20px' }, children: [{ id: createId(), type: 'text', content: '<h4 style="margin: 0 0 10px 0; color: #1e293b;">AI đang thay đổi cách chúng ta làm việc</h4><p style="font-size: 13px; color: #64748b; margin: 0;">Khám phá 10 công cụ AI giúp tăng hiệu suất lao động ngay lập tức.</p><a href="#" style="color: #db2777; font-size: 12px; font-weight: bold; text-decoration: none; display: block; margin-top: 10px;">Đọc thêm →</a>', style: { textAlign: 'left' } }] }
                        ]
                    },
                    {
                        id: createId(),
                        type: 'row',
                        style: { width: '100%', paddingTop: '20px', paddingBottom: '20px' },
                        children: [
                            { id: createId(), type: 'column', style: { width: '40%' }, children: [{ id: createId(), type: 'image', content: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?q=80&w=400&auto=format&fit=crop', style: { width: '100%', borderRadius: '12px' } }] },
                            { id: createId(), type: 'column', style: { width: '60%', paddingLeft: '20px' }, children: [{ id: createId(), type: 'text', content: '<h4 style="margin: 0 0 10px 0; color: #1e293b;">Tương lai của Robot dân dụng</h4><p style="font-size: 13px; color: #64748b; margin: 0;">Liệu Robot có trở thành người bạn đồng hành trong mỗi gia đình?</p><a href="#" style="color: #db2777; font-size: 12px; font-weight: bold; text-decoration: none; display: block; margin-top: 10px;">Đọc thêm →</a>', style: { textAlign: 'left' } }] }
                        ]
                    }
                ]
            },
            {
                id: createId(),
                type: 'section',
                style: { paddingTop: '40px', paddingBottom: '40px', backgroundColor: '#1e293b' },
                children: [{
                    id: createId(),
                    type: 'row',
                    style: { width: '100%', backgroundColor: 'transparent' },
                    children: [{
                        id: createId(),
                        type: 'column',
                        style: { width: '100%' },
                        children: [
                            { id: createId(), type: 'social', style: { textAlign: 'center', iconMode: 'light', iconSize: '24' }, socialLinks: [{ id: createId(), network: 'facebook', url: '#' }, { id: createId(), network: 'twitter', url: '#' }, { id: createId(), network: 'instagram', url: '#' }] },
                            { id: createId(), type: 'text', content: '<p style="color: #94a3b8; font-size: 11px; margin-top: 20px;">Bạn nhận được email này vì đã đăng ký bản tin của chúng tôi.<br>© 2024 Tech News Inc. <a href="#" style="color: #d97706;">Hủy đăng ký</a></p>', style: { textAlign: 'center' } }
                        ]
                    }]
                }]
            }
        ]
    }
];

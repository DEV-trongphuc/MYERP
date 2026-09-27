export interface ChatSticker {
  id: string;
  name: string;
  category: 'work' | 'mood' | 'celebrate';
  icon: string;
  badgeText: string;
  color: string;
  bgGradient: string;
}

export const CHAT_STICKERS: ChatSticker[] = [
  {
    id: 'stk_approved',
    name: 'Đã Duyệt',
    category: 'work',
    icon: '✅',
    badgeText: 'ĐÃ PHÊ DUYỆT',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  },
  {
    id: 'stk_deal_closed',
    name: 'Chốt Đơn',
    category: 'work',
    icon: '🎯',
    badgeText: 'CHỐT DEAL THÀNH CÔNG',
    color: '#d97706',
    bgGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  },
  {
    id: 'stk_urgent_meeting',
    name: 'Họp Gấp',
    category: 'work',
    icon: '🚨',
    badgeText: 'HỌP KHẨN CẤP',
    color: '#dc2626',
    bgGradient: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
  },
  {
    id: 'stk_deadline',
    name: 'Deadline Tới',
    category: 'work',
    icon: '⏳',
    badgeText: 'HỐI DEADLINE',
    color: '#ea580c',
    bgGradient: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)'
  },
  {
    id: 'stk_excellent',
    name: 'Xuất Sắc',
    category: 'celebrate',
    icon: '🌟',
    badgeText: 'QUÁ XUẤT SẮC',
    color: '#7c3aed',
    bgGradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
  },
  {
    id: 'stk_heart_thanks',
    name: 'Bắn Tim Cảm Ơn',
    category: 'mood',
    icon: '💖',
    badgeText: 'CẢM ƠN NHIỀU NHA',
    color: '#db2777',
    bgGradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
  },
  {
    id: 'stk_ok_chot',
    name: 'OK Nhất Trí',
    category: 'work',
    icon: '👍',
    badgeText: 'OK CHỐT LUÔN',
    color: '#2563eb',
    bgGradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
  },
  {
    id: 'stk_fighting',
    name: 'Cố Lên Nào',
    category: 'mood',
    icon: '💪',
    badgeText: 'CỐ LÊN ANH EM',
    color: '#0891b2',
    bgGradient: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)'
  },
  {
    id: 'stk_coffee_break',
    name: 'Cafe Đi',
    category: 'mood',
    icon: '☕',
    badgeText: 'LÀM TÁCH CAFE NHÉ',
    color: '#92400e',
    bgGradient: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)'
  },
  {
    id: 'stk_party',
    name: 'Ăn Mừng',
    category: 'celebrate',
    icon: '🎉',
    badgeText: 'PARTY THÔI NÀO',
    color: '#4f46e5',
    bgGradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)'
  },
  {
    id: 'stk_checkin_done',
    name: 'Đã Check-in',
    category: 'work',
    icon: '⏰',
    badgeText: 'ĐÃ VÀO CA LÀM',
    color: '#059669',
    bgGradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
  },
  {
    id: 'stk_on_leave',
    name: 'Xin Nghỉ',
    category: 'work',
    icon: '🌴',
    badgeText: 'HÔM NAY EM NGHỈ PHÉP',
    color: '#64748b',
    bgGradient: 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)'
  }
];

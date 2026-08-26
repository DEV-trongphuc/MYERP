import React, { createContext, useContext, useCallback, useMemo } from 'react';

type Language = 'vi' | 'en' | 'ja' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isTranslationLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const viOverrides: Record<string, string> = {
  "Hoạt động (Nhật ký)": "Hoạt động",
  
  // Navigation / Sidebar / Page titles
  "Dự án": "Danh mục sản phẩm",
  "Căn hộ": "Mã sản phẩm / SKU",
  "Giỏ hàng": "Danh sách sản phẩm",
  "Giỏ hàng dự án": "Danh sách sản phẩm",
  "Chi tiết căn hộ": "Chi tiết sản phẩm",
  "Mã căn": "Mã sản phẩm",
  "Tên dự án": "Nhóm sản phẩm",
  "Tiến độ thanh toán": "Đợt thanh toán",
  "Bảng hàng": "Bảng sản phẩm",
  "Bảng hàng dự án": "Bảng sản phẩm",
  "Đổi căn": "Đổi sản phẩm",
  "Bể cọc": "Hủy giao dịch",
  "Phiếu đặt cọc": "Đơn đặt hàng",
  "Phiếu hợp tác": "Hợp đồng CTV / Đối tác",
  "Phí môi giới": "Chiết khấu hoa hồng",
  "Hoa hồng": "Chiết khấu hoa hồng",
  "Ráp căn": "Chọn sản phẩm",
  "Giữ chỗ": "Đăng ký giữ chỗ",
  "Kho hàng": "Kho hàng",
  "Danh sách dự án": "Danh sách chiến dịch / sản phẩm",
  "Chủ đầu tư": "Nhà cung cấp",
  
  // Statuses / Pipeline stages
  "Đặt Cọc": "Đơn đặt hàng",
  "Booking": "Giữ chỗ / Đăng ký trước",
  "Đã Gặp": "Đã Gặp / Tư Vấn",
  "Đã Nhận Cọc": "Đã Thanh Toán / Tạm Ứng",
  "Bể cọc sau khi đã có doanh thu": "Hủy đơn hàng đã phát sinh doanh thu",
  "Bể cọc trước khi phát sinh doanh thu": "Hủy đơn hàng chưa có doanh thu",
  
  // Documents / Details / Modals
  "Phiếu giữ chỗ": "Đơn giữ chỗ / Tạm ứng",
  "Tạo phiếu đặt cọc mới": "Tạo đơn đặt hàng mới",
  "Lịch trình thanh toán cọc": "Lịch thanh toán đơn hàng",
  "Đợt 1 - Cọc giữ chỗ": "Đợt 1 - Tạm ứng / Đặt cọc",
  "Minh chứng chuyển tiền Đợt 1 (UNC)": "Minh chứng chuyển khoản (Ủy nhiệm chi / UNC)",
  "Doanh thu dự kiến (Giá bán)": "Doanh thu dự kiến (Giá trị)",
  "Dự án giao dịch": "Chiến dịch / Nhóm",
  "Mã căn hộ/Lô đất": "Mã sản phẩm / SKU",
  "Thêm đợt thanh toán": "Thêm đợt thanh toán",
  "Báo báo học phí": "Báo cáo thanh toán",
  "Báo cáo BĐS": "Báo cáo Kinh doanh",
  "Doanh số BĐS": "Doanh số Bán hàng",
  "Khách hàng tiềm năng": "Khách hàng",
  "Cơ hội giao dịch": "Giao dịch / Đơn hàng",
  "Thêm data nhanh": "Thêm khách hàng",
  "Thêm data cá nhân": "Tự thêm khách hàng",
  "Lưu & Giao Data": "Lưu & Phân bổ Khách hàng",
  
  // Rule settings / Business rules / Administration
  "Bể cọc (Deposit Cancellation trước doanh thu)": "Hủy đơn hàng trước khi phát sinh doanh thu",
  "Bể cọc sau khi có doanh thu (Deposit Cancellation sau doanh thu)": "Hủy đơn hàng sau khi có doanh thu",
  "Đổi căn (Unit Switching)": "Đổi sản phẩm giao dịch",
  "Đồng hồ bảo mật": "Thời hạn chăm sóc Khách hàng",
  "giải phóng ra Kho data chung": "thu hồi về Kho khách hàng dùng chung",
  "Kho Databank": "Kho khách hàng chung",
  "Vòng phân bổ": "Vòng chia Lead",
  "Quy tắc định tuyến": "Quy tắc chia số",
  "Tích hợp Data": "Tích hợp Lead/Data",
  "Vòng xoay chia số (Rounds)": "Vòng xoay chia số",
  "Quy tắc chia số (Rules)": "Quy tắc chia số",
  "Trung tâm Phê duyệt Quy trình (Workflow Hub)": "Quy trình hệ thống",
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const t = useCallback((key: string): string => {
    return viOverrides[key] || key;
  }, []);

  const contextValue = useMemo(() => ({
    language: 'vi' as Language,
    setLanguage: () => {},
    t,
    isTranslationLoading: false
  }), [t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

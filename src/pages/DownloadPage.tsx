import React, { useState, useEffect } from 'react';
import { 
  Download, Monitor, BellRing, 
  AlertCircle, CheckCircle2,
  Send, Info, LayoutGrid,
  Share2, X, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function DownloadPage() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [installPromptAvailable, setInstallPromptAvailable] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>('default');
  const [testNotificationSent, setTestNotificationSent] = useState(false);
  const [activeBrowserTab, setActiveBrowserTab] = useState<'chrome' | 'edge' | 'safari'>('chrome');
  const [detectedOS, setDetectedOS] = useState<'windows' | 'mac' | 'other'>('windows');
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('Ideas_token') || localStorage.getItem('access_token');
    setHasToken(Boolean(token));

    // Detect OS
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('mac') || userAgent.includes('os x')) {
      setDetectedOS('mac');
      if (userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('edg/')) {
        setActiveBrowserTab('safari');
      } else if (userAgent.includes('edg/')) {
        setActiveBrowserTab('edge');
      } else {
        setActiveBrowserTab('chrome');
      }
    } else {
      setDetectedOS('windows');
      if (userAgent.includes('edg/')) {
        setActiveBrowserTab('edge');
      } else {
        setActiveBrowserTab('chrome');
      }
    }

    // Check if running in standalone mode (already installed app)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // Check deferredPrompt availability
    if ((window as any).deferredPrompt) {
      setInstallPromptAvailable(true);
    }

    const handlePromptAvailable = () => {
      setInstallPromptAvailable(true);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setInstallSuccess(true);
      setInstallPromptAvailable(false);
    };

    window.addEventListener('pwa-install-available', handlePromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check notification permission
    if ('Notification' in window) {
      setNotificationStatus(Notification.permission);
    }

    return () => {
      window.removeEventListener('pwa-install-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleTriggerInstall = async () => {
    const promptEvent = (window as any).deferredPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setInstallSuccess(true);
          setIsStandalone(true);
        }
        (window as any).deferredPrompt = null;
        setInstallPromptAvailable(false);
      } catch (e) {
        setShowInstallGuideModal(true);
      }
    } else {
      setShowInstallGuideModal(true);
    }
  };

  const handleRequestNotification = async () => {
    if (!('Notification' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ Web Notification.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationStatus(perm);
      if (perm === 'granted') {
        new Notification('MYERP - Đã kết nối thông báo', {
          body: 'Bạn sẽ nhận được thông báo thời gian thực ngay trên màn hình máy tính.',
          icon: '/LOGO.jpg',
          badge: '/LOGO.jpg'
        });
        setTestNotificationSent(true);
        setTimeout(() => setTestNotificationSent(false), 5000);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const handleSendTestNotification = () => {
    if (notificationStatus !== 'granted') {
      handleRequestNotification();
      return;
    }
    try {
      new Notification('MYERP Lead mới & Tin nhắn', {
        body: 'Khách hàng vừa gửi yêu cầu tư vấn mới lúc ' + new Date().toLocaleTimeString('vi-VN') + '. Bấm để xem chi tiết.',
        icon: '/LOGO.jpg',
        badge: '/LOGO.jpg'
      });
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 5000);
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  };

  return (
    <div className="download-premium-light" style={{
      width: '100%',
      minHeight: '100vh',
      background: '#FFFFFF',
      color: '#0F172A',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      overflowX: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Soft Clean Rose Gradient Background Backdrop */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '560px',
        background: 'linear-gradient(180deg, #FFF5F5 0%, #FFFFFF 100%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Top Navigation Bar */}
      <header style={{ 
        width: '100%', 
        maxWidth: '1200px', 
        padding: '24px 32px',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'relative',
        zIndex: 10,
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/LOGO.jpg" 
            alt="MYERP Logo" 
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              objectFit: 'cover', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)' 
            }} 
          />
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.2 }}>
              MYERP
              <span style={{ 
                fontSize: '0.65rem', 
                padding: '2px 8px', 
                background: '#FEE2E2', 
                color: '#991B1B', 
                borderRadius: '6px', 
                fontWeight: 700,
                letterSpacing: '0.04em'
              }}>
                DESKTOP APP
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
              Windows PC & macOS Desktop Client
            </div>
          </div>
        </div>

        <a href={hasToken ? "/" : "/login"} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#334155',
          textDecoration: 'none',
          padding: '8px 16px',
          borderRadius: '10px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1)'
        }} className="nav-dashboard-btn">
          <LayoutGrid size={15} style={{ color: '#BD1D2D' }} />
          {hasToken ? 'Vào Dashboard' : 'Đăng nhập'}
        </a>
      </header>

      {/* Main Container */}
      <main style={{ 
        width: '100%', 
        maxWidth: '1200px', 
        padding: '16px 32px 64px 32px',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '64px',
        position: 'relative',
        zIndex: 2,
        boxSizing: 'border-box'
      }}>

        {/* Hero Banner Section */}
        <div style={{ 
          textAlign: 'center', 
          maxWidth: '840px', 
          margin: '0 auto', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center' 
        }}>
          {/* IDEAS Mascot Sticker */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'relative', marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <img 
              src="/stickers/ideas/ideas_1.webp" 
              alt="IDEAS Mascot Sticker" 
              style={{ 
                width: '110px', 
                height: '110px', 
                objectFit: 'contain',
                filter: 'drop-shadow(0 10px 18px rgba(15, 23, 42, 0.08))'
              }} 
            />
          </motion.div>

          {/* Pill Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
              padding: '6px 16px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#991B1B',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '24px'
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
            Hỗ trợ cài đặt trực tiếp trên cả Windows và macOS
          </motion.div>

          {/* Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.25 }}
            style={{ 
              fontSize: '2.75rem', 
              fontWeight: 800, 
              lineHeight: 1.2,
              color: '#0F172A',
              margin: '0 0 20px 0',
              letterSpacing: '-0.03em'
            }}
          >
            Cài đặt <span style={{ color: '#BD1D2D' }}>MYERP</span> trên Máy tính {detectedOS === 'mac' ? 'macOS' : 'Windows'}
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            style={{ 
              fontSize: '1.08rem', 
              color: '#475569', 
              lineHeight: 1.6,
              margin: '0 0 32px 0',
              maxWidth: '680px'
            }}
          >
            Chạy độc lập như một phần mềm Desktop riêng biệt. Mở nhanh tức thì từ thanh Taskbar/Dock, không tốn RAM và nhận <strong>thông báo Realtime</strong> ngay cả khi đang làm việc ở ứng dụng khác.
          </motion.p>

          {/* Action Button Row */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12, duration: 0.25 }}
            style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}
          >
            {isStandalone ? (
              <div style={{
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#047857',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={20} />
                Bạn đang sử dụng MYERP ở chế độ Desktop App
              </div>
            ) : (
              <button 
                onClick={handleTriggerInstall}
                className="main-cta-btn"
                style={{
                  background: '#BD1D2D',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 28px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(189, 29, 45, 0.22)',
                  transition: 'background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                <Download size={18} />
                Cài đặt MYERP Ngay
              </button>
            )}

            <button 
              onClick={handleSendTestNotification}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
                borderRadius: '10px',
                padding: '14px 24px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
                transition: 'background-color 0.2s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s cubic-bezier(0.22, 1, 0.36, 1)'
              }}
              className="test-notify-btn"
            >
              <BellRing size={18} style={{ color: '#D97706' }} />
              {testNotificationSent ? 'Đã gửi thông báo' : 'Thử thông báo Desktop'}
            </button>
          </motion.div>
        </div>

        {/* SECTION 1: CLEAN BROWSER OMNIBOX SPOTLIGHT */}
        <div id="browser-omnibox-guide" style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 12px 32px -10px rgba(15, 23, 42, 0.05)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Monitor size={22} style={{ color: '#BD1D2D' }} />
                Hướng dẫn cài đặt theo Trình duyệt của bạn
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
                Hỗ trợ đầy đủ Google Chrome, Microsoft Edge (Windows & Mac) và Safari (macOS Sonoma / Sequoia).
              </p>
            </div>

            {/* Browser Tabs */}
            <div style={{ display: 'flex', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '3px', flexWrap: 'wrap', gap: '2px' }}>
              <button 
                onClick={() => setActiveBrowserTab('chrome')}
                style={{
                  background: activeBrowserTab === 'chrome' ? '#FFFFFF' : 'transparent',
                  color: activeBrowserTab === 'chrome' ? '#BD1D2D' : '#64748B',
                  boxShadow: activeBrowserTab === 'chrome' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: activeBrowserTab === 'chrome' ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                Google Chrome (Win/Mac)
              </button>
              <button 
                onClick={() => setActiveBrowserTab('edge')}
                style={{
                  background: activeBrowserTab === 'edge' ? '#FFFFFF' : 'transparent',
                  color: activeBrowserTab === 'edge' ? '#BD1D2D' : '#64748B',
                  boxShadow: activeBrowserTab === 'edge' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: activeBrowserTab === 'edge' ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                Microsoft Edge
              </button>
              <button 
                onClick={() => setActiveBrowserTab('safari')}
                style={{
                  background: activeBrowserTab === 'safari' ? '#FFFFFF' : 'transparent',
                  color: activeBrowserTab === 'safari' ? '#BD1D2D' : '#64748B',
                  boxShadow: activeBrowserTab === 'safari' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  borderRadius: '7px',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: activeBrowserTab === 'safari' ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
              >
                Apple Safari (macOS)
              </button>
            </div>
          </div>

          {/* SLEEK LIGHT BROWSER CHROME MOCKUP */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
            marginBottom: '28px'
          }}>
            {/* Window Top Bar */}
            <div style={{
              background: '#EEF2F6',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #E2E8F0'
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
              </div>

              <div style={{
                background: '#FFFFFF',
                padding: '6px 20px',
                borderRadius: '8px 8px 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: '#0F172A',
                fontWeight: 700,
                border: '1px solid #E2E8F0',
                borderBottom: 'none'
              }}>
                <img src="/LOGO.jpg" alt="Logo" style={{ width: '14px', height: '14px', borderRadius: '3px' }} />
                <span>MYERP - {activeBrowserTab === 'safari' ? 'Safari macOS' : 'Hệ Thống Quản Trị'}</span>
              </div>

              <div style={{ width: '50px' }} />
            </div>

            {/* Omnibox / Search Bar */}
            <div style={{
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: '#FFFFFF',
              borderBottom: '1px solid #F1F5F9'
            }}>
              <div style={{ display: 'flex', gap: '10px', color: '#94A3B8', fontSize: '0.9rem' }}>
                <span>←</span>
                <span>→</span>
                <span>↻</span>
              </div>

              {/* URL Address Input Bar */}
              <div style={{
                flex: 1,
                background: '#F8FAFC',
                borderRadius: '999px',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid #FCA5A5',
                boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.06)',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem' }}>
                  <Lock size={13} style={{ color: '#10B981' }} />
                  <span style={{ color: '#94A3B8' }}>https://</span>
                  <span style={{ color: '#0F172A', fontWeight: 600 }}>{typeof window !== 'undefined' && window.location?.host ? window.location.host : 'app.your-domain.com'}</span>
                  <span style={{ color: '#64748B' }}>/download</span>
                </div>

                {/* THE TARGET INSTALL BADGE IN SEARCH BAR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeBrowserTab === 'safari' ? (
                    <div 
                      style={{
                        background: '#FFF1F2',
                        border: '1px solid #BD1D2D',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#BD1D2D'
                      }}
                    >
                      <Share2 size={13} style={{ color: '#BD1D2D' }} />
                      <span>Chia sẻ &gt; Thêm vào Dock</span>
                      <span style={{
                        background: '#BD1D2D',
                        color: '#FFFFFF',
                        fontSize: '0.62rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700
                      }}>MACOS</span>
                    </div>
                  ) : (
                    <div 
                      onClick={handleTriggerInstall}
                      style={{
                        background: '#FFF1F2',
                        border: '1px solid #BD1D2D',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#BD1D2D',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={13} style={{ color: '#BD1D2D' }} />
                      <span>{activeBrowserTab === 'chrome' ? 'Cài đặt MYERP' : 'Cài đặt ứng dụng'}</span>
                      <span style={{
                        background: '#BD1D2D',
                        color: '#FFFFFF',
                        fontSize: '0.62rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700
                      }}>BẤM VÀO ĐÂY</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 3 Step Instructions */}
          {activeBrowserTab === 'safari' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#FEE2E2', color: '#991B1B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums'
                  }}>1</div>
                  <img src="/stickers/ideas/ideas_4.webp" alt="Sticker 1" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Bấm nút Share trên Safari Mac
                </h4>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Trên thanh công cụ Safari ở góc trên bên phải, bấm vào biểu tượng <strong>Chia sẻ (Share)</strong> hoặc vào menu <strong>File (Tệp)</strong>.
                </p>
              </div>

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#FEE2E2', color: '#991B1B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums'
                  }}>2</div>
                  <img src="/stickers/ideas/ideas_2.webp" alt="Sticker 2" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Chọn "Thêm vào Dock" (Add to Dock)
                </h4>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Chọn tùy chọn <strong>Thêm vào Dock (Add to Dock)</strong> &gt; Bấm nút <strong>Thêm (Add)</strong> để hệ thống tự tạo app độc lập vào thư mục Applications của Mac.
                </p>
              </div>

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#DCFCE7', color: '#166534',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums'
                  }}>3</div>
                  <img src="/stickers/ideas/ideas_16.webp" alt="Sticker 3" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Mở app từ Dock / Launchpad
                </h4>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Ứng dụng MYERP sẽ xuất hiện trực tiếp trên thanh Dock của máy Mac, hoạt động với cửa sổ riêng và nhận thông báo Notification Banner mượt mà.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#FEE2E2', color: '#991B1B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums'
                  }}>1</div>
                  <img src="/stickers/ideas/ideas_4.webp" alt="Sticker 1" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Bấm biểu tượng trên thanh URL
                </h4>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Nhìn sang góc phải của thanh nhập địa chỉ trình duyệt, bấm vào biểu tượng <strong>Cài đặt / Install MYERP</strong> (hình màn hình máy tính có mũi tên tải xuống).
                </p>
              </div>

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#FEE2E2', color: '#991B1B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums'
                  }}>2</div>
                  <img src="/stickers/ideas/ideas_2.webp" alt="Sticker 2" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Xác nhận "Cài đặt" (Install)
                </h4>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Trình duyệt sẽ hiển thị hộp thoại xác nhận <strong>"Cài đặt ứng dụng MYERP?"</strong>. Bấm nút <strong>Cài đặt (Install)</strong> để hoàn tất.
                </p>
              </div>

              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '24px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#DCFCE7', color: '#166534',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums'
                  }}>3</div>
                  <img src="/stickers/ideas/ideas_16.webp" alt="Sticker 3" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                </div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                  Mở app & Ghim vào Taskbar / Dock
                </h4>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                  Ứng dụng tự động xuất hiện trên Desktop/Dock và mở ra dưới dạng cửa sổ độc lập. Bạn có thể ghim vào Taskbar (Windows) hoặc Keep in Dock (macOS).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: NOTIFICATIONS SETUP */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr',
          gap: '40px',
          alignItems: 'center'
        }} className="notify-grid">
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#B45309', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <BellRing size={16} /> BẢO ĐẢM THÔNG BÁO REALTIME TRÊN MÁY TÍNH
            </div>
            
            <h3 style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.3 }}>
              Nhận thông báo Lead và Tin nhắn tức thời ngay trên màn hình {detectedOS === 'mac' ? 'macOS' : 'PC'}
            </h3>

            <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.6, margin: 0 }}>
              Khi cài đặt app về máy, ứng dụng kết nối trực tiếp vào trung tâm thông báo Action Center (Windows) hoặc Notification Banner (macOS). Bạn sẽ không bao giờ bị bỏ lỡ số nóng hoặc tin nhắn khẩn từ khách hàng.
            </p>

            {/* Notification Status */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Trạng thái cấp quyền thông báo</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: notificationStatus === 'granted' ? '#059669' : '#D97706', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  {notificationStatus === 'granted' ? (
                    <>
                      <CheckCircle2 size={17} /> Đã cấp quyền thông báo
                    </>
                  ) : notificationStatus === 'denied' ? (
                    <>
                      <AlertCircle size={17} style={{ color: '#DC2626' }} /> Bị chặn (Bấm vào ổ khóa trên thanh URL để bật lại)
                    </>
                  ) : (
                    <>
                      <Info size={17} /> Chưa cấp quyền
                    </>
                  )}
                </div>
              </div>

              <button 
                onClick={handleRequestNotification}
                style={{
                  background: notificationStatus === 'granted' ? '#ECFDF5' : '#BD1D2D',
                  border: notificationStatus === 'granted' ? '1px solid #A7F3D0' : 'none',
                  color: notificationStatus === 'granted' ? '#047857' : '#FFFFFF',
                  borderRadius: '10px',
                  padding: '9px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {notificationStatus === 'granted' ? 'Cấp lại quyền' : 'Cho phép thông báo'}
              </button>
            </div>
          </div>

          {/* Notification Preview Card */}
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            padding: '1.75rem',
            boxShadow: '0 15px 35px -5px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                Mô phỏng thông báo Desktop Toast
              </div>
              <img src="/stickers/ideas/ideas_14.webp" alt="IDEAS Heart Sticker" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
            </div>

            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              gap: '12px',
              position: 'relative'
            }}>
              <img src="/LOGO.jpg" alt="Logo" style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#0F172A' }}>MYERP • Lead Mới Vừa Nhận</strong>
                  <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Vừa xong</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                  Khách hàng <strong>Nguyễn Văn A</strong> vừa đăng ký gói tư vấn. Bấm vào đây để mở thông tin chi tiết.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', background: '#BD1D2D', color: '#FFFFFF', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>Xem ngay</span>
                  <span style={{ fontSize: '0.72rem', background: '#E2E8F0', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>Bỏ qua</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSendTestNotification}
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#334155',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
              }}
              className="test-notify-btn"
            >
              <Send size={14} style={{ color: '#BD1D2D' }} />
              Bấm để bắn thử thông báo ra màn hình thật
            </button>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer style={{ 
        width: '100%',
        maxWidth: '1200px',
        borderTop: '1px solid #E2E8F0',
        marginTop: 'auto',
        padding: '2rem 2rem', 
        fontSize: '0.8125rem', 
        color: '#64748B', 
        textAlign: 'center',
        position: 'relative',
        zIndex: 2,
        boxSizing: 'border-box',
        lineHeight: 1.6
      }}>
        <div>© 2026 MYERP System • Tối ưu hóa cho Google Chrome &amp; Microsoft Edge trên Windows 10/11 &amp; macOS.</div>
        <div style={{ marginTop: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span>Power by</span>
          <img 
            src="/cropped-logofavicon-1.webp" 
            alt="Turnio DEV" 
            style={{ 
              width: '22px', 
              height: '22px', 
              borderRadius: '50%', 
              objectFit: 'cover', 
              border: '1.5px solid #E2E8F0', 
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)' 
            }}
            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
          />
          <a 
            href="https://fb.com/turni0" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: '#BD1D2D', 
              fontWeight: 700, 
              textDecoration: 'none'
            }}
          >
            Turnio DEV
          </a>
        </div>
      </footer>

      {/* Interactive Quick Install Instructions Modal */}
      <AnimatePresence>
        {showInstallGuideModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setShowInstallGuideModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                background: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid #E2E8F0',
                padding: 0,
                boxShadow: '0 24px 60px -15px rgba(0, 0, 0, 0.3)',
                maxWidth: '560px',
                width: '100%',
                overflow: 'hidden',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                background: '#FFF5F5',
                padding: '20px 24px',
                borderBottom: '1px solid #FEE2E2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src="/stickers/ideas/ideas_16.webp"
                    alt="Mascot"
                    style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                  />
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      Vị trí bấm Cài đặt ứng dụng
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0 0' }}>
                      Cài đặt trực tiếp qua trình duyệt {detectedOS === 'mac' ? 'macOS' : 'Windows'} (Không cần tải file exe)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallGuideModal(false)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748B',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s cubic-bezier(0.22, 1, 0.36, 1)'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {detectedOS === 'mac' && activeBrowserTab === 'safari' ? (
                  <div style={{
                    background: '#F8FAFC',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: '#FEE2E2', color: '#BD1D2D',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, flexShrink: 0
                    }}>
                      <Share2 size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                        Dành cho Apple Safari (macOS)
                      </div>
                      <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                        Bấm nút <strong>Chia sẻ (Share)</strong> trên góc Safari hoặc vào thanh menu <strong>Tệp (File)</strong> &gt; chọn <strong>Thêm vào Dock (Add to Dock)</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Cách 1: Nút trên thanh địa chỉ */}
                    <div style={{
                      background: '#FFF5F5',
                      border: '1px solid #FCA5A5',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: '#BD1D2D', color: '#FFFFFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums'
                      }}>
                        1
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                          Cách 1: Bấm biểu tượng Cài đặt trên thanh URL
                        </div>
                        <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                          Nhìn lên <strong>góc phải thanh địa chỉ (URL)</strong> của trình duyệt, bạn sẽ thấy biểu tượng <strong>máy tính có mũi tên xuống</strong>. Bấm vào đó &gt; chọn <strong>"Cài đặt"</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Cách 2: Menu 3 chấm */}
                    <div style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: '#F1F5F9', color: '#475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, fontVariantNumeric: 'tabular-nums'
                      }}>
                        2
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>
                          Cách 2: Qua Menu 3 chấm (⋮)
                        </div>
                        <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                          Bấm nút <strong>3 chấm (⋮)</strong> góc trên cùng bên phải trình duyệt &gt; chọn <strong>"Cài đặt MYERP"</strong> (hoặc <strong>Lưu và chia sẻ &gt; Cài đặt trang web dưới dạng ứng dụng</strong>).
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Footer button */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInstallGuideModal(false);
                      const el = document.getElementById('browser-omnibox-guide');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    style={{
                      flex: 1,
                      background: '#BD1D2D',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 20px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(189, 29, 45, 0.2)'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    Đã hiểu, xem hình minh họa
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Styles */}
      <style>{`
        .main-cta-btn:hover {
          background: #A81423 !important;
        }
        .test-notify-btn:hover {
          background: #F1F5F9 !important;
          border-color: #CBD5E1 !important;
        }
        .nav-dashboard-btn:hover {
          background: #F8FAFC !important;
          border-color: #CBD5E1 !important;
        }
        @media (max-width: 860px) {
          .notify-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

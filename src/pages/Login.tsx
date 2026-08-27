import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { LogIn, Lock, Mail, Share2, Bell, BarChart3, Sparkles, ShieldCheck, Zap, Bot, Shield, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { fetchAPI } from '../utils/api';
import toast from 'react-hot-toast';
import { CustomModal } from '../components/ui/CustomModal';
import { DigitPinInput } from '../components/ui/DigitPinInput';

export const Login = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState(() => localStorage.getItem('ideas_remembered_email') || '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('ideas_remembered_email'));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // 2FA Prompt State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [pending2FAData, setPending2FAData] = useState<{ tempToken: string; type: string; maskedEmail: string } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifying2FA, setVerifying2FA] = useState(false);

  // Forgot Password State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleGoogleLoginResponse = async (response: any) => {
    setLoading(true);
    setError('');

    if (localStorage.getItem('IDEAS_DEMO_MODE') === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500));
      login('demo_token_12345', { id: 1, username: 'admin', email: 'admin@ideas.edu.vn', name: 'Admin Demo', role: 'admin' });
      navigate('/');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/backend'}/api.php?action=login_google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const json = await res.json();
      if (json.success) {
        if (typeof (window as any).showSplashScreen === 'function') {
          (window as any).showSplashScreen('Đang đăng nhập...');
        }
        const userRole = json.user?.role || '';
        const targetPath = ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(userRole) ? '/workspace' : '/';
        login(json.token, json.user, json.refresh_token);
        navigate(targetPath);
      } else {
        setError(t(json.message) || t('Đăng nhập Google thất bại'));
      }
    } catch {
      setError(t('Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại.'));
    }
    setLoading(false);
  };

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    if (typeof (window as any).hideSplashScreen === 'function') {
      (window as any).hideSplashScreen();
    }
    let intervalId: any;
    
    const initGoogle = () => {
      if (renderedRef.current) {
        clearInterval(intervalId);
        return;
      }
      
      if ((window as any).google?.accounts?.id && googleBtnRef.current) {
        (window as any).google.accounts.id.initialize({
          client_id: '641158233158-nsg8a8tdsj3fdgb34dc9tugm8god7tho.apps.googleusercontent.com',
          callback: handleGoogleLoginResponse
        });
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('Ideas_theme') === 'dark';
        (window as any).google.accounts.id.renderButton(
          googleBtnRef.current,
          { theme: isDark ? 'filled_blue' : 'outline', size: 'large', width: 320, text: 'signin_with', shape: 'rectangular' }
        );
        renderedRef.current = true;
        clearInterval(intervalId);
      }
    };

    initGoogle();
    intervalId = setInterval(initGoogle, 500);

    return () => clearInterval(intervalId);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t('Vui lòng nhập đầy đủ Email và Mật khẩu'));
      return;
    }
    setLoading(true);
    setError('');

    if (rememberMe) {
      localStorage.setItem('ideas_remembered_email', email.trim());
    } else {
      localStorage.removeItem('ideas_remembered_email');
    }

    if (localStorage.getItem('IDEAS_DEMO_MODE') === 'true') {
      await new Promise(resolve => setTimeout(resolve, 500));
      const isSale = email.includes('sale') || email.includes('haidang') || email.includes('thao') || email.includes('dung') || email.includes('tuan');
      if (typeof (window as any).showSplashScreen === 'function') {
        (window as any).showSplashScreen('Đang đăng nhập...');
      }
      if (isSale) {
        let cId = 1;
        let name = 'Hải Đăng';
        let cEmail = 'haidang@ideas.edu.vn';
        if (email.includes('thao')) { cId = 2; name = 'Thanh Thảo'; cEmail = 'thanhthao@ideas.edu.vn'; }
        else if (email.includes('dung')) { cId = 3; name = 'Việt Dũng'; cEmail = 'vietdung@ideas.edu.vn'; }
        else if (email.includes('tuan')) { cId = 4; name = 'Minh Tuấn'; cEmail = 'minhtuan@ideas.edu.vn'; }

        login(`demo_token_sale_${cId}`, { id: cId, username: cEmail.split('@')[0], email: cEmail, name: name, role: 'sale', consultant_id: cId });
        navigate('/');
      } else {
        login('demo_token_12345', { id: 1, username: (email || 'admin@ideas.edu.vn').split('@')[0], email: email || 'admin@ideas.edu.vn', name: 'Admin Demo', role: 'admin' });
        navigate('/');
      }
      setLoading(false);
      return;
    }

    try {
      const res = await fetchAPI('auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (res.success && res.data) {
        if (res.data.requires_2fa) {
          setPending2FAData({
            tempToken: res.data.temp_token,
            type: res.data.two_factor_type,
            maskedEmail: res.data.masked_email
          });
          setOtpCode('');
          setShow2FAModal(true);
        } else {
          if (typeof (window as any).showSplashScreen === 'function') {
            (window as any).showSplashScreen('Đang tải dữ liệu...');
          }
          const userRole = res.data.user?.role || '';
          const targetPath = ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(userRole) ? '/workspace' : '/';
          login(res.data.access_token, res.data.user, res.data.refresh_token);
          navigate(targetPath);
        }
      } else {
        setError(t(res.message) || t('Email hoặc mật khẩu không chính xác'));
      }
    } catch (err: any) {
      setError(err.message || t('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'));
    }
    setLoading(false);
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error('Vui lòng nhập đủ 6 chữ số mã xác thực');
      return;
    }
    setVerifying2FA(true);
    try {
      const res = await fetchAPI('auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({
          temp_token: pending2FAData?.tempToken,
          otp_code: otpCode.trim()
        })
      });
      if (res.success && res.data) {
        if (typeof (window as any).showSplashScreen === 'function') {
          (window as any).showSplashScreen('Đang tải dữ liệu...');
        }
        const userRole = res.data.user?.role || '';
        const targetPath = ['academic', 'hoc_vu', 'tro_giang', 'teacher', 'giang_vien', 'viewer'].includes(userRole) ? '/workspace' : '/';
        login(res.data.access_token, res.data.user, res.data.refresh_token);
        setShow2FAModal(false);
        navigate(targetPath);
      } else {
        toast.error(res.message || 'Mã xác thực không chính xác');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xác thực 2FA');
    }
    setVerifying2FA(false);
  };

  const handleSendForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Vui lòng nhập Email');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetchAPI('auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      if (res.success) {
        toast.success(res.message || 'Đã gửi mã OTP đến email');
        setForgotStep(2);
      } else {
        toast.error(res.message || 'Không thể gửi mã OTP');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi yêu cầu');
    }
    setForgotLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp || !forgotNewPassword) {
      toast.error('Vui lòng nhập đầy đủ OTP và Mật khẩu mới');
      return;
    }
    const isLongEnough = forgotNewPassword.length >= 8;
    const hasLetter = /[A-Za-z]/.test(forgotNewPassword);
    const hasDigit = /\d/.test(forgotNewPassword);
    if (!isLongEnough || !hasLetter || !hasDigit) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm cả chữ và số');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetchAPI('auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp_code: forgotOtp.trim(),
          new_password: forgotNewPassword
        })
      });
      if (res.success) {
        toast.success(res.message || 'Đặt lại mật khẩu thành công!');
        setEmail(forgotEmail.trim());
        setPassword('');
        setShowForgotPasswordModal(false);
      } else {
        toast.error(res.message || 'Không thể đặt lại mật khẩu');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đặt lại mật khẩu');
    }
    setForgotLoading(false);
  };

  const ALL_MODULES = [
    { title: t('Tích Hợp Zalo Bot'), sub: t('Quản lý ticket, nhận thông báo chia số và phản hồi duyệt lỗi tức thì trên Zalo.'), icon: Bot, color: 'linear-gradient(135deg, #3b82f6, #6366f1)' },
    { title: t('Chia Data Thông Minh'), sub: t('Tự động phân bổ data theo vòng lặp, xử lý chống trùng lặp và đền bù lỗi.'), icon: Share2, color: 'linear-gradient(135deg, #f43f5e, #be123c)' },
    { title: t('Thông Báo Email'), sub: t('Gửi mail cảnh báo trùng lặp, thông báo kết quả duyệt ticket ngay lập tức.'), icon: Bell, color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { title: t('Báo Cáo & Thống Kê'), sub: t('Báo cáo thống kê gửi hàng ngày theo khung giờ, đo lường hiệu suất Sale.'), icon: BarChart3, color: 'linear-gradient(135deg, #10b981, #059669)' },
    { title: t('Đồng Hồ Bảo Mật'), sub: t('Tự động thu hồi khách hàng không tương tác và giải phóng về Databank chung.'), icon: ShieldCheck, color: 'linear-gradient(135deg, #a855f7, #6d28d9)' },
    { title: t('Bù Lượt Lỗi Ca Trực'), sub: t('Cơ chế đền bù lượt lỗi, bù lượt thiếu do nghỉ phép hoặc trực ngoài giờ.'), icon: Zap, color: 'linear-gradient(135deg, #06b6d4, #0891b2)' }
  ];

  const row1 = ALL_MODULES.slice(0, 3);
  const row2 = ALL_MODULES.slice(3);

  const isDemoMode = localStorage.getItem('IDEAS_DEMO_MODE') === 'true';

  return (
    <div className="login-container">
      {/* Background Decorative Blur Gradients */}
      <div className="blur-glow-1" />
      <div className="blur-glow-2" />

      {/* Left Side: Brand & Visual Marquee */}
      <div className="left-side">
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          <a href="https://portfo-turnio.vercel.app/" target="_blank" rel="noopener noreferrer" className="badge-container animate-float" style={{ textDecoration: 'none', display: 'inline-flex', width: 'fit-content' }}>
            <Sparkles size={14} style={{ color: '#f87171' }} />
            <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#fca5a5' }}>
              Power by TurnioDEV
            </span>
          </a>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h1 className="title-main">
              IDEAS ERP <br />
              <span className="title-gradient">AUTOMATION SYSTEM.</span>
            </h1>
            <p className="subtitle-main">
              {t("Giải pháp toàn diện giúp tự động hóa quy trình phân bổ khách hàng, tối ưu hóa điểm chạm và tăng tỷ lệ chuyển đổi.")}
            </p>
          </div>

          {/* Scrolling Features Marquee */}
          <div className="marquee-wrapper pause-on-hover mask-fade-edges">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', position: 'relative' }}>
              {/* Row 1 */}
              <div className="marquee-row animate-slide-infinite">
                {[...row1, ...row1, ...row1].map((f, i) => (
                  <div key={`r1-${i}`} className="marquee-item">
                    <div className="icon-box" style={{ background: f.color }}>
                      <f.icon size={20} color="white" />
                    </div>
                    <h3 className="item-title">{f.title}</h3>
                    <p className="item-sub">{f.sub}</p>
                  </div>
                ))}
              </div>

              {/* Row 2 */}
              <div className="marquee-row animate-slide-infinite-reverse">
                {[...row2, ...row2, ...row2].map((f, i) => (
                  <div key={`r2-${i}`} className="marquee-item">
                    <div className="icon-box" style={{ background: f.color }}>
                      <f.icon size={20} color="white" />
                    </div>
                    <h3 className="item-title">{f.title}</h3>
                    <p className="item-sub">{f.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Circular Lines Decor */}
        <div className="circle-decor-1" />
        <div className="circle-decor-2" />
        <div className="circle-decor-3" />
      </div>

      {/* Right Side: Identity Check Card */}
      <div className="right-side">
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Animated rotated logo container */}
            <div className="logo-box">
              <img src="/LOGO.webp" className="logo-img" style={{ objectFit: 'contain' }} alt="IDEAS Logo" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', letterSpacing: '-0.5px', margin: 0 }}>
                {t('Đăng Nhập Hệ Thống')}
              </h2>
              <p style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.875rem', marginTop: '6px', marginBottom: 0 }}>
                {t('Nhập thông tin tài khoản để truy cập hệ thống')}
              </p>
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '14px', fontSize: '13px', fontWeight: 600, color: '#f87171', textAlign: 'center', lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          <div className="login-card">
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              {/* Email */}
              <div>
                <label className="form-label-custom">{t('Email doanh nghiệp')}</label>
                <div className="input-wrapper" style={{ marginBottom: 0 }}>
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@ideas.edu.vn"
                    required
                    autoFocus
                    autoComplete="username"
                  />
                  <Mail className="input-icon" size={18} />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label-custom" style={{ margin: 0 }}>{t('Mật khẩu')}</label>
                </div>
                <div className="input-wrapper" style={{ marginBottom: 0 }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="input-icon-btn"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Options row: Remember Me & Forgot Password */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', marginTop: '2px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary, #BD1D2D)', width: '15px', height: '15px', cursor: 'pointer', borderRadius: '4px' }}
                  />
                  <span>{t('Ghi nhớ tài khoản')}</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email || '');
                    setForgotStep(1);
                    setShowForgotPasswordModal(true);
                  }}
                  className="forgot-btn"
                >
                  {t('Quên mật khẩu?')}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="submit-btn-custom"
                disabled={loading}
                style={{ marginTop: '0.5rem' }}
              >
                {loading ? (
                  <><Loader2 className="animate-spin" size={18} /> {t('Đang xác thực...')}</>
                ) : (
                  <><LogIn size={18} /> {t('Đăng Nhập')}</>
                )}
              </button>
            </form>

            {/* Google Sign-in / Divider */}
            <div className="divider-modern">
              <span>{t('Hoặc đăng nhập với')}</span>
            </div>

            <div ref={googleBtnRef} style={{ display: 'flex', justifyContent: 'center', minHeight: '44px', width: '100%' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '1.25rem', color: '#64748b', fontSize: '11px', fontWeight: 500 }}>
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              <span>{t('Bảo mật dữ liệu chuẩn doanh nghiệp SSL/TLS')}</span>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '24px', right: '24px', color: 'rgba(255,255,255,0.015)', fontSize: '80px', fontWeight: 900, pointerEvents: 'none', userSelect: 'none', transform: 'rotate(2deg) translateY(40px)' }}>
          IDEAS.
        </div>

        {/* 2FA Verification Modal */}
        {show2FAModal && (
          <CustomModal
            isOpen={show2FAModal}
            onClose={() => setShow2FAModal(false)}
            title={t("Xác thực 2 yếu tố (2FA)")}
            maxWidth="500px"
          >
            <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--color-bg-light)', padding: '12px 16px', borderRadius: '10px' }}>
                <Shield size={24} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                  {pending2FAData?.type === 'email'
                    ? t(`Đã gửi mã OTP 6 chữ số đến email: ${pending2FAData?.maskedEmail}`)
                    : t("Vui lòng mở ứng dụng Google Authenticator và nhập mã 6 chữ số")}
                </p>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ textAlign: 'center', display: 'block', fontWeight: 600 }}>{t("Nhập mã 6 chữ số")}</label>
                <DigitPinInput
                  value={otpCode}
                  onChange={setOtpCode}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn outline sm"
                  onClick={() => setShow2FAModal(false)}
                  disabled={verifying2FA}
                >
                  {t("Hủy")}
                </button>
                <button
                  type="submit"
                  className="btn primary sm"
                  disabled={verifying2FA || otpCode.length < 6}
                >
                  {verifying2FA ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}
                  {t("Xác thực & Đăng nhập")}
                </button>
              </div>
            </form>
          </CustomModal>
        )}

        {/* Forgot Password Modal */}
        {showForgotPasswordModal && (
          <CustomModal
            isOpen={showForgotPasswordModal}
            onClose={() => setShowForgotPasswordModal(false)}
            title={t("Quên mật khẩu")}
            maxWidth="500px"
          >
            {forgotStep === 1 ? (
              <form onSubmit={handleSendForgotOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {t("Nhập email tài khoản của bạn. Hệ thống sẽ gửi mã xác thực OTP 6 chữ số để bạn đặt lại mật khẩu.")}
                </p>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Email đăng ký")}</label>
                  <input
                    type="email"
                    className="form-input"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="email@ideas.edu.vn"
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    onClick={() => setShowForgotPasswordModal(false)}
                    disabled={forgotLoading}
                  >
                    {t("Hủy")}
                  </button>
                  <button
                    type="submit"
                    className="btn primary sm"
                    disabled={forgotLoading || !forgotEmail}
                  >
                    {forgotLoading ? <Loader2 size={14} className="spin" /> : <Mail size={14} />}
                    {t("Gửi mã OTP")}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px', color: '#166534', fontSize: '0.8125rem' }}>
                  {t(`Đã gửi mã OTP đến email ${forgotEmail}. Vui lòng kiểm tra hộp thư.`)}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ textAlign: 'center', display: 'block', fontWeight: 600 }}>{t("Mã OTP 6 chữ số")}</label>
                  <DigitPinInput
                    value={forgotOtp}
                    onChange={setForgotOtp}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t("Mật khẩu mới")}</label>
                  <input
                    type="password"
                    className="form-input"
                    value={forgotNewPassword}
                    onChange={e => setForgotNewPassword(e.target.value)}
                    placeholder={t("Nhập mật khẩu mới (tối thiểu 8 ký tự gồm cả chữ và số)")}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {t("← Gửi lại OTP")}
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn outline sm"
                      onClick={() => setShowForgotPasswordModal(false)}
                      disabled={forgotLoading}
                    >
                      {t("Hủy")}
                    </button>
                    <button
                      type="submit"
                      className="btn primary sm"
                      disabled={forgotLoading || !forgotOtp || !forgotNewPassword}
                    >
                      {forgotLoading ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
                      {t("Xác nhận đặt lại")}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </CustomModal>
        )}
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          flex-direction: row;
          background: #080d1a;
          position: relative;
          overflow: hidden;
        }
        .blur-glow-1 {
          position: absolute;
          top: 0;
          right: 0;
          width: 500px;
          height: 500px;
          background: rgba(239, 68, 68, 0.08);
          filter: blur(120px);
          border-radius: 50%;
          pointer-events: none;
        }
        .blur-glow-2 {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 500px;
          height: 500px;
          background: rgba(245, 158, 11, 0.08);
          filter: blur(120px);
          border-radius: 50%;
          pointer-events: none;
        }
        .left-side {
          position: relative;
          flex: 1;
          padding: 5rem 2rem 5rem 5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }
        .right-side {
          position: relative;
          width: 560px;
          background: rgba(12, 18, 32, 0.6);
          backdrop-filter: blur(30px);
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          padding: 4rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          overflow-y: auto;
        }
        .badge-container {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(239, 68, 68, 0.08);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(239, 68, 68, 0.25);
          border-radius: 9999px;
          margin-bottom: 2rem;
          align-self: flex-start;
        }
        .title-main {
          font-size: 4rem;
          font-weight: 900;
          color: white;
          line-height: 1.1;
          letter-spacing: -2px;
          margin-bottom: 1.5rem;
        }
        .title-gradient {
          background: linear-gradient(to right, #ff4d4d, #ff8080, #ffb366);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .subtitle-main {
          max-width: 450px;
          font-size: 1.125rem;
          color: #94a3b8;
          font-weight: 500;
          line-height: 1.6;
          margin-bottom: 3rem;
        }
        .logo-box {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #BD1D2D 0%, #a31422 100%);
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          box-shadow: 0 20px 40px rgba(189, 29, 45, 0.35);
          transform: rotate(3deg);
          overflow: hidden;
          padding: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 16px;
        }
        .login-card {
          width: 100%;
          max-width: 380px;
          padding: 2rem;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(20px);
        }
        .form-label-custom {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: block;
          margin-bottom: 6px;
        }
        .input-wrapper {
          position: relative;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          width: 100%;
        }
        .input-icon {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }
        .input-icon-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          transition: all 0.2s ease;
          z-index: 2;
        }
        .input-icon-btn:hover {
          color: #ef4444;
          background: rgba(255, 255, 255, 0.05);
        }
        .forgot-btn {
          background: none;
          border: none;
          color: #f87171;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: color 0.2s;
        }
        .forgot-btn:hover {
          color: #fca5a5;
          text-decoration: underline;
        }
        .divider-modern {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 1.25rem 0;
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .divider-modern::before,
        .divider-modern::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .divider-modern span {
          padding: 0 10px;
        }
        .input-field {
          width: 100%;
          height: 44px;
          padding-left: 16px;
          padding-right: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.8);
          color: white;
          font-size: 14px;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .input-field:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }
        .submit-btn-custom {
          width: 100%;
          height: 46px;
          background: linear-gradient(135deg, #a31422 0%, #d01d33 100%);
          color: white;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 16px rgba(163, 20, 34, 0.25);
        }
        .submit-btn-custom:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 20px rgba(163, 20, 34, 0.35);
        }
        .submit-btn-custom:active {
          transform: translateY(1px);
        }
        .marquee-wrapper {
          position: relative;
          width: 100%;
          overflow: hidden;
          margin-top: 2rem;
        }
        .marquee-row {
          display: flex;
          gap: 16px;
          width: max-content;
        }
        .marquee-item {
          width: 280px;
          flex-shrink: 0;
          padding: 1.25rem;
          background: rgba(18, 25, 42, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 24px;
          transition: all 0.3s ease;
        }
        .marquee-item:hover {
          background: rgba(30, 41, 59, 0.6);
          border-color: rgba(239, 68, 68, 0.3);
          transform: translateY(-2px);
        }
        .icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.15);
        }
        .item-title {
          font-size: 14px;
          font-weight: 700;
          color: white;
          margin-bottom: 4px;
        }
        .item-sub {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.5;
        }
        .circle-decor-1 {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
          width: 800px;
          height: 800px;
          border: 1px solid rgba(255,255,255,0.015);
          border-radius: 50%;
          pointer-events: none;
        }
        .circle-decor-2 {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%) translate(40px);
          width: 600px;
          height: 600px;
          border: 1px solid rgba(255,255,255,0.015);
          border-radius: 50%;
          pointer-events: none;
        }
        .circle-decor-3 {
          position: absolute;
          top: 50%;
          left: 0;
          transform: translateY(-50%) translate(80px);
          width: 400px;
          height: 400px;
          border: 1px solid rgba(255,255,255,0.02);
          border-radius: 50%;
          pointer-events: none;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        @keyframes slide-infinite {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.3333%); }
        }
        @keyframes slide-infinite-reverse {
          0% { transform: translateX(-33.3333%); }
          100% { transform: translateX(0); }
        }
        .animate-slide-infinite {
          animation: slide-infinite 25s linear infinite;
        }
        .animate-slide-infinite-reverse {
          animation: slide-infinite-reverse 25s linear infinite;
        }
        .pause-on-hover:hover .animate-slide-infinite,
        .pause-on-hover:hover .animate-slide-infinite-reverse {
          animation-play-state: paused;
        }
        .mask-fade-edges {
          mask-image: linear-gradient(to right, transparent, white 4%, white 98%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, white 4%, white 98%, transparent);
        }

        @media (max-width: 992px) {
          .login-container {
            flex-direction: column;
            overflow-y: auto;
            align-items: center;
            justify-content: center;
          }
          .left-side {
            display: none;
          }
          .right-side {
            width: 100%;
            min-height: 100vh;
            padding: 2rem 1.25rem;
            border-left: none;
            border-top: none;
            background: transparent;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .login-card {
            padding: 1.5rem 1.25rem;
            border-radius: 24px;
          }
          .right-side > div {
            gap: 1.25rem !important;
          }
          .logo-box {
            width: 70px;
            height: 70px;
            margin-bottom: 0.5rem;
          }
          .logo-box + div h2 {
            font-size: 1.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

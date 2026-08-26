import React, { useState, useEffect } from 'react';

export const SplashPreviewPage: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState<'glass' | 'misa_red' | 'cyber_dark'>('glass');
  const [deviceView, setDeviceView] = useState<'desktop' | 'mobile'>('desktop');
  const [progress, setProgress] = useState(35);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(p => (p >= 95 ? 20 : p + 8));
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      {/* Top Controller Bar */}
      <div style={{
        padding: '12px 24px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 9999
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 800, color: '#f43f5e', fontSize: '1.1rem' }}>🎨 IDEAS Splash Screen Studio (Xem trước Local)</span>
          <span style={{ fontSize: '0.75rem', background: '#334155', padding: '2px 8px', borderRadius: '6px', color: '#94a3b8' }}>Chưa deploy - Xem & chọn layout ưng ý</span>
        </div>

        {/* Theme Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: '#0f172a', padding: '4px', borderRadius: '10px' }}>
          <button
            onClick={() => setActiveTheme('glass')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.8125rem',
              background: activeTheme === 'glass' ? '#BD1D2D' : 'transparent',
              color: activeTheme === 'glass' ? '#fff' : '#94a3b8',
              transition: 'all 0.2s'
            }}
          >
            1. Glassmorphism Sang Trọng (Khuyên dùng)
          </button>
          <button
            onClick={() => setActiveTheme('misa_red')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.8125rem',
              background: activeTheme === 'misa_red' ? '#BD1D2D' : 'transparent',
              color: activeTheme === 'misa_red' ? '#fff' : '#94a3b8',
              transition: 'all 0.2s'
            }}
          >
            2. MISA Pastel Cloud (Mây Hồng Đỏ)
          </button>
          <button
            onClick={() => setActiveTheme('cyber_dark')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.8125rem',
              background: activeTheme === 'cyber_dark' ? '#BD1D2D' : 'transparent',
              color: activeTheme === 'cyber_dark' ? '#fff' : '#94a3b8',
              transition: 'all 0.2s'
            }}
          >
            3. Cyber Dark Neon (AI Hiện đại)
          </button>
        </div>

        {/* Device Mode Switcher */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setDeviceView('desktop')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #475569',
              background: deviceView === 'desktop' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            🖥️ PC / Laptop
          </button>
          <button
            onClick={() => setDeviceView('mobile')}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid #475569',
              background: deviceView === 'mobile' ? '#3b82f6' : '#1e293b',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📱 Điện thoại
          </button>
        </div>
      </div>

      {/* Preview Canvas Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: deviceView === 'mobile' ? '24px' : '0',
        background: '#0b0f19',
        overflow: 'hidden'
      }}>
        <div style={{
          width: deviceView === 'mobile' ? '390px' : '100%',
          height: deviceView === 'mobile' ? '800px' : 'calc(100vh - 65px)',
          borderRadius: deviceView === 'mobile' ? '40px' : '0',
          boxShadow: deviceView === 'mobile' ? '0 25px 60px -15px rgba(0,0,0,0.8), 0 0 0 12px #1e293b' : 'none',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>

          {/* ========================================================
              OPTION 1: CYBER GLASSMORPHISM LAUNCHPAD (SUPER LUXURY)
             ======================================================== */}
          {activeTheme === 'glass' && (
            <div style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'radial-gradient(ellipse at 50% 20%, #ffe4e6 0%, #fff1f2 40%, #ffffff 80%)',
              padding: '24px 20px',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              {/* Subtle Tech Grid lines */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(189, 29, 45, 0.08) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                pointerEvents: 'none',
                opacity: 0.8
              }} />

              {/* Ambient Glowing Halo */}
              <div style={{
                position: 'absolute',
                width: '450px',
                height: '450px',
                top: '15%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'radial-gradient(circle, rgba(244, 63, 94, 0.22) 0%, rgba(189, 29, 45, 0.08) 50%, transparent 75%)',
                filter: 'blur(40px)',
                pointerEvents: 'none'
              }} />

              {/* Top Header info */}
              <div style={{ zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.85 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>IDEAS CLOUD NODE • HO CHI MINH</span>
              </div>

              {/* Central Glassmorphic Card */}
              <div style={{
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.9)',
                borderRadius: '32px',
                padding: deviceView === 'mobile' ? '32px 24px' : '40px 48px',
                boxShadow: '0 25px 50px -12px rgba(189, 29, 45, 0.15), 0 0 0 1px rgba(244, 63, 94, 0.08)',
                maxWidth: '460px',
                width: '90%',
                boxSizing: 'border-box'
              }}>
                {/* 3D Robot Mascot with dynamic halo */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
                  <img
                    src="/ideas_bot.png"
                    alt="IDEAS AI"
                    style={{
                      width: deviceView === 'mobile' ? '150px' : '175px',
                      height: deviceView === 'mobile' ? '150px' : '175px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 20px 25px rgba(189, 29, 45, 0.25))',
                      animation: 'floatBot 3.6s ease-in-out infinite'
                    }}
                  />
                  <div style={{
                    width: '90px',
                    height: '12px',
                    background: 'radial-gradient(ellipse at center, rgba(189, 29, 45, 0.3) 0%, transparent 70%)',
                    borderRadius: '50%',
                    marginTop: '2px',
                    animation: 'shadowScale 3.6s ease-in-out infinite'
                  }} />
                </div>

                {/* Brand Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: deviceView === 'mobile' ? '1.75rem' : '2.1rem', fontWeight: 900, color: '#BD1D2D', letterSpacing: '-0.5px' }}>IDEAS</span>
                  <span style={{ fontSize: deviceView === 'mobile' ? '1.75rem' : '2.1rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.5px' }}>ERP</span>
                </div>

                {/* AI Badge */}
                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  letterSpacing: '1.2px',
                  color: '#BD1D2D',
                  background: 'rgba(189, 29, 45, 0.08)',
                  border: '1px solid rgba(189, 29, 45, 0.2)',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  textTransform: 'uppercase',
                  marginBottom: '24px'
                }}>
                  ✨ AI AUTOMATION & INTELLIGENT WORKFLOW
                </div>

                {/* High Tech Progress Bar */}
                <div style={{ width: '100%', maxWidth: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #BD1D2D, #f59e0b)',
                      borderRadius: '10px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                    Đang đồng bộ dữ liệu doanh nghiệp... {progress}%
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 800, color: '#BD1D2D' }}>
                  <img src="/LOGO.jpg" alt="Logo" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
                  <span>IDEAS - SÁNG TẠO & HIỆU QUẢ</span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Copyright © 2026 IDEAS JSC • All rights reserved.</span>
              </div>
            </div>
          )}

          {/* ========================================================
              OPTION 2: MISA AMIS REMIX (RED PASTEL CLOUD EDITION)
             ======================================================== */}
          {activeTheme === 'misa_red' && (
            <div style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(180deg, #fb7185 0%, #fda4af 35%, #fff1f2 70%, #ffffff 100%)',
              padding: '24px 20px',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              {/* Soft Dreamy Clouds */}
              <div style={{ position: 'absolute', width: '350px', height: '350px', top: '-60px', left: '-50px', background: 'rgba(255,255,255,0.45)', borderRadius: '50%', filter: 'blur(30px)' }} />
              <div style={{ position: 'absolute', width: '380px', height: '380px', top: '40px', right: '-80px', background: 'rgba(255,255,255,0.5)', borderRadius: '50%', filter: 'blur(35px)' }} />
              <div style={{ position: 'absolute', width: '500px', height: '260px', top: '35%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.65)', borderRadius: '50%', filter: 'blur(45px)' }} />

              {/* Sparkles */}
              <span style={{ position: 'absolute', top: '12%', left: '18%', color: '#fff', fontSize: '24px', textShadow: '0 0 10px #fff' }}>✦</span>
              <span style={{ position: 'absolute', top: '8%', right: '22%', color: '#fef08a', fontSize: '28px', textShadow: '0 0 10px #fef08a' }}>✦</span>
              <span style={{ position: 'absolute', top: '28%', right: '14%', color: '#fff', fontSize: '20px' }}>✦</span>

              <div style={{ height: '20px' }}></div>

              {/* Center Content */}
              <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                  <img
                    src="/ideas_bot.png"
                    alt="IDEAS Mascot"
                    style={{
                      width: deviceView === 'mobile' ? '165px' : '190px',
                      height: deviceView === 'mobile' ? '165px' : '190px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 20px 30px rgba(225, 29, 72, 0.28))',
                      animation: 'floatBot 3.6s ease-in-out infinite'
                    }}
                  />
                  <div style={{
                    width: '100px',
                    height: '14px',
                    background: 'radial-gradient(ellipse at center, rgba(225, 29, 72, 0.25) 0%, transparent 70%)',
                    borderRadius: '50%',
                    marginTop: '2px',
                    animation: 'shadowScale 3.6s ease-in-out infinite'
                  }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#BD1D2D', letterSpacing: '-0.5px' }}>IDEAS</span>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#1e293b', letterSpacing: '-0.5px' }}>ERP</span>
                </div>

                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  letterSpacing: '1px',
                  color: '#BD1D2D',
                  background: 'rgba(255, 255, 255, 0.9)',
                  padding: '5px 16px',
                  borderRadius: '20px',
                  boxShadow: '0 4px 12px rgba(189, 29, 45, 0.1)',
                  marginBottom: '24px'
                }}>
                  HỆ THỐNG QUẢN TRỊ DOANH NGHIỆP THÔNG MINH
                </div>

                <div style={{ width: '160px', height: '5px', background: 'rgba(255,255,255,0.8)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #BD1D2D, #f59e0b)',
                    borderRadius: '10px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <span style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#e11d48' }}>
                  Đang khởi động hệ thống...
                </span>
              </div>

              {/* Footer */}
              <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 800, color: '#BD1D2D' }}>
                  <img src="/LOGO.jpg" alt="Logo" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
                  <span>IDEAS - SÁNG TẠO & HIỆU QUẢ</span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#9f1239' }}>Copyright © 2026 IDEAS JSC • All rights reserved.</span>
              </div>
            </div>
          )}

          {/* ========================================================
              OPTION 3: CYBER OBSIDIAN DARK (AI ROBOT IN DARK SPACE)
             ======================================================== */}
          {activeTheme === 'cyber_dark' && (
            <div style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'radial-gradient(ellipse at 50% 30%, #1e1124 0%, #0b0f19 70%, #030712 100%)',
              padding: '24px 20px',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}>
              {/* Neon Cyber Ring Aura */}
              <div style={{
                position: 'absolute',
                width: '320px',
                height: '320px',
                top: '20%',
                left: '50%',
                transform: 'translateX(-50%)',
                borderRadius: '50%',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                boxShadow: '0 0 50px rgba(244, 63, 94, 0.25), inset 0 0 50px rgba(244, 63, 94, 0.15)',
                pointerEvents: 'none'
              }} />

              {/* Sparkles */}
              <span style={{ position: 'absolute', top: '15%', left: '20%', color: '#f43f5e', fontSize: '20px', textShadow: '0 0 12px #f43f5e' }}>✦</span>
              <span style={{ position: 'absolute', top: '10%', right: '20%', color: '#38bdf8', fontSize: '24px', textShadow: '0 0 12px #38bdf8' }}>✦</span>

              <div style={{ height: '20px' }}></div>

              {/* Center Content */}
              <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
                  <img
                    src="/ideas_bot.png"
                    alt="IDEAS Mascot"
                    style={{
                      width: deviceView === 'mobile' ? '160px' : '185px',
                      height: deviceView === 'mobile' ? '160px' : '185px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 0 35px rgba(244, 63, 94, 0.5))',
                      animation: 'floatBot 3.6s ease-in-out infinite'
                    }}
                  />
                  <div style={{
                    width: '90px',
                    height: '12px',
                    background: 'radial-gradient(ellipse at center, rgba(244, 63, 94, 0.45) 0%, transparent 70%)',
                    borderRadius: '50%',
                    marginTop: '2px',
                    animation: 'shadowScale 3.6s ease-in-out infinite'
                  }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#f43f5e', letterSpacing: '1px', textShadow: '0 0 20px rgba(244, 63, 94, 0.6)' }}>IDEAS</span>
                  <span style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', letterSpacing: '1px' }}>ERP</span>
                </div>

                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  letterSpacing: '1.5px',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  marginBottom: '24px',
                  boxShadow: '0 0 15px rgba(56, 189, 248, 0.2)'
                }}>
                  AI AUTOMATION & INTELLIGENT WORKFLOW
                </div>

                <div style={{ width: '180px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #f43f5e, #38bdf8)',
                    borderRadius: '10px',
                    boxShadow: '0 0 10px #f43f5e',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <span style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
                  Initializing Neural Workspace Engine... {progress}%
                </span>
              </div>

              {/* Footer */}
              <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 800, color: '#f43f5e' }}>
                  <img src="/LOGO.jpg" alt="Logo" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
                  <span>IDEAS - SÁNG TẠO & HIỆU QUẢ</span>
                </div>
                <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>Copyright © 2026 IDEAS JSC • All rights reserved.</span>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes floatBot {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1.2deg); }
        }
        @keyframes shadowScale {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(0.8); opacity: 0.15; }
        }
      `}</style>
    </div>
  );
};

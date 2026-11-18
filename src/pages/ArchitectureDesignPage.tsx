import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Copy,
  Check,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowUpRight,
  Menu,
  X,
  Layers,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { archChapters } from './architectureDesignData';
import type { ArchChapter } from './architectureDesignData';
import { ArchitectureDiagramRenderer } from './ArchitectureDiagrams';
import './ApiV1DocumentationPage.css';
import './ArchitectureDesignPage.css';

// SHA-256 hex digest of the required access passcode
const PASSCODE_DIGEST_HEX = 'a5bb4a9726e340f174e73e0681ff23f13ad6d44a09a402089836bdb194a912e9';
const SESSION_STORAGE_KEY = 'myerp_arch_design_unlocked_v1';

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256HexSync(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = dv.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
      const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return Array.from(H).map(x => x.toString(16).padStart(8, '0')).join('');
}

export const ArchitectureDesignPage: React.FC = () => {
  const navigate = useNavigate();

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_STORAGE_KEY) === PASSCODE_DIGEST_HEX;
    } catch {
      return false;
    }
  });
  const [passInput, setPassInput] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passError, setPassError] = useState('');

  const [selectedChapterId, setSelectedChapterId] = useState<string>(archChapters[0].id);
  const [activeSectionId, setActiveSectionId] = useState<string>(archChapters[0].sections[0].id);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() =>
    Array.from(new Set(archChapters.map(c => c.group)))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUnlocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked]);

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = passInput.trim();
    if (!candidate) {
      setPassError('Vui lòng nhập mật khẩu truy cập tài liệu.');
      return;
    }
    if (sha256HexSync(candidate) === PASSCODE_DIGEST_HEX) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, PASSCODE_DIGEST_HEX);
      } catch {
        // Ignore storage quota restrictions
      }
      setPassError('');
      setPassInput('');
      setIsUnlocked(true);
    } else {
      setPassError('Mật khẩu không chính xác. Vui lòng kiểm tra lại.');
    }
  };

  const handleLock = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setIsUnlocked(false);
    setPassInput('');
    setPassError('');
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const filteredChapters = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return archChapters;
    return archChapters.filter(ch => {
      if (
        ch.title.toLowerCase().includes(q) ||
        ch.shortTitle.toLowerCase().includes(q) ||
        ch.summary.toLowerCase().includes(q) ||
        ch.fileAnchors.some(a => a.toLowerCase().includes(q))
      ) {
        return true;
      }
      return ch.sections.some(sec => {
        if (sec.heading.toLowerCase().includes(q)) return true;
        if (sec.paragraphs?.some(p => p.toLowerCase().includes(q))) return true;
        if (sec.bullets?.some(b => (b.label || '').toLowerCase().includes(q) || b.text.toLowerCase().includes(q))) return true;
        if (sec.table?.rows.some(r => r.some(cell => cell.toLowerCase().includes(q)))) return true;
        if (sec.codeBlock?.code.toLowerCase().includes(q)) return true;
        return false;
      });
    });
  }, [searchQuery]);

  const groupedChapters = useMemo(() => {
    const groups = new Map<string, ArchChapter[]>();
    filteredChapters.forEach(ch => {
      if (!groups.has(ch.group)) groups.set(ch.group, []);
      groups.get(ch.group)!.push(ch);
    });
    return Array.from(groups.entries());
  }, [filteredChapters]);

  const currentChapterIndex = useMemo(() => {
    const idx = filteredChapters.findIndex(c => c.id === selectedChapterId);
    return idx >= 0 ? idx : 0;
  }, [filteredChapters, selectedChapterId]);

  const currentChapter = filteredChapters[currentChapterIndex] || archChapters[0];
  const prevChapter = currentChapterIndex > 0 ? filteredChapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex < filteredChapters.length - 1 ? filteredChapters[currentChapterIndex + 1] : null;

  const selectChapter = (chapterId: string, scrollTop = true) => {
    setSelectedChapterId(chapterId);
    const ch = archChapters.find(c => c.id === chapterId);
    if (ch?.sections[0]) {
      setActiveSectionId(ch.sections[0].id);
    }
    setIsMobileNavOpen(false);
    if (scrollTop && contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (secId: string) => {
    setActiveSectionId(secId);
    const el = document.getElementById(secId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupName) ? prev.filter(g => g !== groupName) : [...prev, groupName]
    );
  };

  if (!isUnlocked) {
    return (
      <div className="api-full-wrapper">
        <header className="api-full-header">
          <div className="api-header-left">
            <div className="api-brand" onClick={() => navigate('/')}>
              <span className="api-brand-title">MYERP ARCH</span>
              <span className="api-brand-badge">SYSTEM DESIGN</span>
            </div>
            <span className="api-header-sep">/</span>
            <span className="api-header-subtitle">Tài liệu Kiến trúc Hệ thống</span>
          </div>

          <div className="api-header-right">
            <button
              onClick={() => navigate('/api-docs')}
              className="api-nav-btn api-nav-btn-secondary"
            >
              <BookOpen size={14} />
              <span>API v1 Docs</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="api-nav-btn api-nav-btn-primary"
            >
              <span>Vào ERP</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </header>

        <div className="arch-gate-body">
          <form className="arch-gate-card" onSubmit={handleUnlockSubmit}>
            <div className="arch-gate-icon">
              <Lock size={20} />
            </div>
            <h1 className="arch-gate-title">Architecture Design Portal</h1>
            <p className="arch-gate-desc">
              Cổng tài liệu thiết kế kiến trúc hệ thống, State Machines, cơ sở dữ liệu đa tenant và sổ tay vận hành kỹ thuật MYERP. Nhập mật khẩu truy cập để tiếp tục.
            </p>

            <div className="arch-gate-meta-pills">
              <span className="arch-gate-pill">8 Chương Chi tiết</span>
              <span className="arch-gate-pill">6 Sơ đồ Trực quan</span>
              <span className="arch-gate-pill">C4 / ERD / Runbook</span>
            </div>

            <label htmlFor="arch-pass-input" className="arch-pass-label">
              Mật khẩu truy cập tài liệu
            </label>
            <div className="arch-pass-input-wrap">
              <input
                id="arch-pass-input"
                type={showPass ? 'text' : 'password'}
                className={`arch-pass-input ${passError ? 'has-error' : ''}`}
                placeholder="Nhập mật khẩu để mở tài liệu..."
                value={passInput}
                onChange={e => {
                  setPassInput(e.target.value);
                  if (passError) setPassError('');
                }}
                autoFocus
                autoComplete="off"
              />
              <button
                type="button"
                className="arch-pass-toggle"
                onClick={() => setShowPass(prev => !prev)}
                aria-label={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                title={showPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {passError && (
              <div className="arch-pass-error" role="alert">
                <AlertCircle size={14} />
                <span>{passError}</span>
              </div>
            )}

            <button type="submit" className="arch-pass-submit">
              <Unlock size={15} />
              <span>Mở tài liệu Architecture Design</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="api-full-wrapper">
      {/* Top Header */}
      <header className="api-full-header">
        <div className="api-header-left">
          <button
            className="api-mobile-toggle-btn"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            aria-label="Mở mục lục kiến trúc"
            title="Mở mục lục kiến trúc"
          >
            {isMobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div className="api-brand" onClick={() => selectChapter(archChapters[0].id)}>
            <span className="api-brand-title">MYERP ARCH</span>
            <span className="api-brand-badge">DESIGN v1.0</span>
          </div>
          <span className="api-header-sep">/</span>
          <span className="api-header-subtitle">
            {archChapters.length} Chương Kiến trúc • ~251 Bảng • Runbook
          </span>
        </div>

        {/* Header Search */}
        <div className="api-header-search-bar">
          <Search size={15} className="api-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm chương, controller, bảng DB, state machine (Ctrl + K)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="api-search-input"
          />
          {searchQuery && (
            <button className="api-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        {/* Right Actions */}
        <div className="api-header-right">
          <button
            onClick={() => navigate('/api-docs')}
            className="api-nav-btn api-nav-btn-secondary"
            title="Xem tài liệu REST API v1"
          >
            <BookOpen size={14} />
            <span>API v1 Docs</span>
          </button>

          <button
            onClick={handleLock}
            className="api-nav-btn api-nav-btn-secondary"
            title="Khóa lại trang tài liệu"
          >
            <Lock size={14} />
            <span>Khóa</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="api-nav-btn api-nav-btn-primary"
            title="Trở về bảng điều khiển ERP"
          >
            <span>Vào ERP</span>
            <ArrowUpRight size={14} />
          </button>
        </div>
      </header>

      {/* 3-Column Full Workspace */}
      <div className="api-full-container">
        {isMobileNavOpen && (
          <div
            className="api-mobile-backdrop"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Column 1: Left Directory */}
        <aside className={`api-col-sidebar ${isMobileNavOpen ? 'mobile-open' : ''}`}>
          <div className="api-col-sidebar-header-mobile">
            <div className="api-mobile-header-title">
              <Layers size={16} />
              <span>ARCHITECTURE DESIGN</span>
            </div>
            <button
              className="api-mobile-close-btn"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="Đóng menu"
            >
              <X size={18} />
            </button>
          </div>

          <div className="api-col-sidebar-inner">
            <div className="api-menu-caption">
              MỤC LỤC KIẾN TRÚC ({filteredChapters.length} CHƯƠNG)
            </div>

            {groupedChapters.length === 0 ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Không tìm thấy mục kiến trúc nào khớp "{searchQuery}"
              </div>
            ) : (
              groupedChapters.map(([groupName, items]) => {
                const isExpanded = expandedGroups.includes(groupName) || searchQuery.trim().length > 0;
                const hasSelected = items.some(ch => ch.id === currentChapter.id);

                return (
                  <div key={groupName} className="api-cat-block">
                    <div
                      className={`api-cat-heading ${hasSelected ? 'active' : ''}`}
                      onClick={() => toggleGroup(groupName)}
                    >
                      <span className="api-cat-heading-text">{groupName}</span>
                      <div className="api-cat-heading-right">
                        <span className="api-cat-count">{items.length}</span>
                        <ChevronDown
                          size={14}
                          className={`api-chevron-icon ${isExpanded ? 'open' : ''}`}
                        />
                      </div>
                    </div>

                    <div className={`api-cat-sublist-wrapper ${isExpanded ? 'open' : ''}`}>
                      <div className="api-cat-sublist">
                        {items.map(ch => {
                          const isSelected = ch.id === currentChapter.id;
                          return (
                            <div
                              key={ch.id}
                              className={`api-endpoint-item ${isSelected ? 'active' : ''}`}
                              onClick={() => selectChapter(ch.id)}
                            >
                              <span
                                className="method-pill"
                                style={{
                                  background: isSelected ? '#0284c7' : '#e2e8f0',
                                  color: isSelected ? '#ffffff' : '#475569',
                                  minWidth: '46px',
                                  textAlign: 'center',
                                }}
                              >
                                {ch.code.replace('ARCH ', '')}
                              </span>
                              <span className="api-endpoint-name">{ch.shortTitle}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Column 2: Center Architecture Article */}
        <main className="api-col-content" ref={contentRef}>
          <div className="api-content-article">
            {/* Hero */}
            <div className="api-hero-block" id="arch-hero">
              <div className="api-hero-meta">
                <span className="method-badge" style={{ background: '#0f172a', color: '#ffffff' }}>
                  {currentChapter.code}
                </span>
                {currentChapter.badges.map((b, idx) => (
                  <span key={idx} className={`arch-badge ${b.tone || 'slate'}`}>
                    {b.label}
                  </span>
                ))}
              </div>

              <h1 className="api-headline">{currentChapter.title}</h1>
              <p className="api-lead">{currentChapter.summary}</p>

              <div className="arch-anchor-row">
                {currentChapter.fileAnchors.map(f => (
                  <span key={f} className="arch-anchor-chip">
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Sections */}
            {currentChapter.sections.map(sec => (
              <section className="api-spec-section" key={sec.id} id={sec.id}>
                <h2>{sec.heading}</h2>

                {sec.paragraphs?.map((p, idx) => (
                  <p key={idx} style={{ color: '#334155', margin: '0 0 12px 0', lineHeight: 1.65 }}>
                    {p}
                  </p>
                ))}

                {sec.callout && (
                  <div className={`arch-callout ${sec.callout.tone}`}>
                    <div className="arch-callout-title">{sec.callout.title}</div>
                    <div className="arch-callout-body">{sec.callout.body}</div>
                  </div>
                )}

                {sec.diagram && <ArchitectureDiagramRenderer type={sec.diagram} />}

                {sec.bullets && (
                  <ul className="arch-bullet-list">
                    {sec.bullets.map((b, idx) => (
                      <li key={idx}>
                        {b.label && <strong>{b.label}: </strong>}
                        <span>{b.text}</span>
                        {b.code && (
                          <>
                            {' '}
                            <code style={{ fontSize: '11.5px', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#0284c7' }}>
                              {b.code}
                            </code>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {sec.table && (
                  <table className="api-table" style={{ marginTop: '10px' }}>
                    <thead>
                      <tr>
                        {sec.table.headers.map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sec.table.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>
                              {cIdx === 0 ? <strong>{cell}</strong> : cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {sec.codeBlock && (
                  <div style={{ marginTop: '14px' }}>
                    <div className="api-code-bar">
                      <span style={{ color: '#cbd5e1', fontSize: '12px', fontWeight: 600 }}>
                        {sec.codeBlock.title}
                      </span>
                      <button
                        onClick={() => handleCopy(sec.codeBlock!.code, sec.id)}
                        className="api-copy-btn"
                      >
                        {copiedKey === sec.id ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        <span>{copiedKey === sec.id ? 'Đã copy' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="api-code-terminal">
                      <pre>{sec.codeBlock.code}</pre>
                    </div>
                  </div>
                )}
              </section>
            ))}

            {/* Chapter Navigation Footer */}
            <div className="arch-chapter-pager">
              {prevChapter && (
                <button
                  className="arch-pager-btn"
                  onClick={() => selectChapter(prevChapter.id)}
                >
                  <span className="arch-pager-kicker">&lt;- Chương trước</span>
                  <span className="arch-pager-title">{prevChapter.shortTitle}</span>
                </button>
              )}
              {nextChapter && (
                <button
                  className="arch-pager-btn next"
                  onClick={() => selectChapter(nextChapter.id)}
                >
                  <span className="arch-pager-kicker">Chương tiếp theo -&gt;</span>
                  <span className="arch-pager-title">{nextChapter.shortTitle}</span>
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Column 3: Right Quick Jump */}
        <aside className="api-col-quick">
          <div className="api-col-quick-inner">
            <div className="api-quick-caption">TRONG CHƯƠNG NÀY</div>
            <div className="api-quick-list">
              <div
                className={`api-quick-item ${activeSectionId === 'arch-hero' ? 'active' : ''}`}
                onClick={() => scrollToSection('arch-hero')}
              >
                <span>Tổng quan chương</span>
              </div>
              {currentChapter.sections.map(sec => (
                <div
                  key={sec.id}
                  className={`api-quick-item ${activeSectionId === sec.id ? 'active' : ''}`}
                  onClick={() => scrollToSection(sec.id)}
                >
                  <span>{sec.heading}</span>
                </div>
              ))}
            </div>

            <div className="api-quick-card">
              <div className="api-card-title">System Stack Summary</div>
              <div className="api-card-url">React 19 + PHP 8.1 + MySQL 8</div>
              <p className="api-card-note">
                Dùng <code>Ctrl + K</code> hoặc <code>/</code> để tìm nhanh toàn bộ controller, bảng DB và cấu hình hệ thống.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ArchitectureDesignPage;

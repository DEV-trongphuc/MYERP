import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Copy, 
  Check, 
  Shield, 
  ChevronDown, 
  ArrowUpRight, 
  Download,
  Menu, 
  X, 
  Layers,
  Clock
} from 'lucide-react';
import { apiV1Categories } from './apiV1DocsData';
import type { ApiV1Endpoint } from './apiV1DocsData';
import './ApiV1DocumentationPage.css';

export const ApiV1DocumentationPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [selectedLang, setSelectedLang] = useState<'curl' | 'ts' | 'python' | 'php'>('curl');
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'GET' | 'POST' | 'PUT' | 'DELETE'>('ALL');
  const [selectedCatId, setSelectedCatId] = useState<string>('auth');
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('auth-login');
  const [expandedCatIds, setExpandedCatIds] = useState<string[]>(['auth', 'contacts', 'deals']);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedResponseTab, setSelectedResponseTab] = useState<'success' | 'error'>('success');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const baseUrl = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : "https://myerp.ideas.edu.vn";

  // Keyboard shortcut Ctrl+K or / to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleCategory = (catId: string) => {
    setExpandedCatIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSelectEndpoint = (catId: string, endpointId: string) => {
    setSelectedCatId(catId);
    setSelectedEndpointId(endpointId);
    setSelectedResponseTab('success');
    setIsMobileNavOpen(false);
    if (!expandedCatIds.includes(catId)) {
      setExpandedCatIds(prev => [...prev, catId]);
    }
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Filter categories and endpoints
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return apiV1Categories
      .map(cat => {
        const matchingEndpoints = cat.endpoints.filter(ep => {
          const matchesMethod = methodFilter === 'ALL' || ep.method === methodFilter;
          const matchesQuery =
            !q ||
            ep.title.toLowerCase().includes(q) ||
            ep.path.toLowerCase().includes(q) ||
            ep.description.toLowerCase().includes(q) ||
            cat.title.toLowerCase().includes(q) ||
            (ep.bodyParams && ep.bodyParams.some(bp => bp.name.toLowerCase().includes(q) || bp.desc.toLowerCase().includes(q))) ||
            (ep.queryParams && ep.queryParams.some(qp => qp.name.toLowerCase().includes(q) || qp.desc.toLowerCase().includes(q)));
          return matchesMethod && matchesQuery;
        });
        return {
          ...cat,
          endpoints: matchingEndpoints
        };
      })
      .filter(cat => cat.endpoints.length > 0);
  }, [searchQuery, methodFilter]);

  // Current selected category and endpoint
  const currentCategory = useMemo(() => {
    return filteredCategories.find(c => c.id === selectedCatId) || filteredCategories[0] || apiV1Categories[0];
  }, [filteredCategories, selectedCatId]);

  const currentEndpoint = useMemo(() => {
    if (!currentCategory) return apiV1Categories[0].endpoints[0];
    return (
      currentCategory.endpoints.find(ep => ep.id === selectedEndpointId) ||
      currentCategory.endpoints[0] ||
      apiV1Categories[0].endpoints[0]
    );
  }, [currentCategory, selectedEndpointId]);

  const totalEndpointsCount = useMemo(() => {
    return apiV1Categories.reduce((acc, cat) => acc + cat.endpoints.length, 0);
  }, []);

  // Code generator
  const generateSnippet = (endpoint: ApiV1Endpoint, lang: 'curl' | 'ts' | 'python' | 'php') => {
    const fullUrl = `${baseUrl}${endpoint.path}`;

    if (lang === 'curl') {
      let code = `curl -X ${endpoint.method} "${fullUrl}" \\\n`;
      if (endpoint.authRequired) {
        code += `  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\\n`;
      }
      if (endpoint.headers?.['X-Idempotency-Key']) {
        code += `  -H "X-Idempotency-Key: ${endpoint.headers['X-Idempotency-Key']}" \\\n`;
      }
      code += `  -H "Content-Type: application/json"`;
      if (endpoint.sampleBody && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        code += ` \\\n  -d '${JSON.stringify(endpoint.sampleBody, null, 2)}'`;
      }
      return code;
    }

    if (lang === 'ts') {
      return `import axios from 'axios';

const api = axios.create({
  baseURL: '${baseUrl}',
  headers: {
    ${endpoint.authRequired ? `'Authorization': 'Bearer \${accessToken}',\n    ` : ''}'Content-Type': 'application/json'${endpoint.headers?.['X-Idempotency-Key'] ? `,\n    'X-Idempotency-Key': '${endpoint.headers['X-Idempotency-Key']}'` : ''}
  }
});

async function callApi() {
  try {
    const response = await api.${endpoint.method.toLowerCase()}('${endpoint.path}'${
      endpoint.sampleBody && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)
        ? `,\n      ${JSON.stringify(endpoint.sampleBody, null, 6).trim()}`
        : ''
    });
    console.log('Result:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

callApi();`;
    }

    if (lang === 'python') {
      return `import requests

url = "${fullUrl}"
headers = {
    ${endpoint.authRequired ? '"Authorization": f"Bearer {access_token}",\n    ' : ''}"Content-Type": "application/json"${endpoint.headers?.['X-Idempotency-Key'] ? `,\n    "X-Idempotency-Key": "${endpoint.headers['X-Idempotency-Key']}"` : ''}
}
${
  endpoint.sampleBody && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)
    ? `payload = ${JSON.stringify(endpoint.sampleBody, null, 4)}

response = requests.${endpoint.method.toLowerCase()}(url, json=payload, headers=headers)
`
    : `response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)
`
}
print("Status Code:", response.status_code)
print("Response JSON:", response.json())`;
    }

    if (lang === 'php') {
      return `<?php
require 'vendor/autoload.php';

use GuzzleHttp\\Client;

$client = new Client(['base_uri' => '${baseUrl}']);
$headers = [
    ${endpoint.authRequired ? "'Authorization' => 'Bearer ' . $accessToken,\n    " : ''}'Content-Type'  => 'application/json'${endpoint.headers?.['X-Idempotency-Key'] ? `,\n    'X-Idempotency-Key' => '${endpoint.headers['X-Idempotency-Key']}'` : ''}
];

$response = $client->request('${endpoint.method}', '${endpoint.path}', [
    'headers' => $headers${
      endpoint.sampleBody && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)
        ? `,\n    'json'    => ${varExportFormat(endpoint.sampleBody, 4)}`
        : ''
    }
]);

echo $response->getBody();`;
    }

    return '';
  };

  const activeResponsePayload =
    selectedResponseTab === 'success'
      ? currentEndpoint.sampleResponse
      : currentEndpoint.errorResponses?.[0]?.response || currentEndpoint.sampleResponse;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="api-full-wrapper">
      {/* ── TOP HEADER ─────────────────────────────────────────────────── */}
      <header className="api-full-header">
        <div className="api-header-left">
          <button
            className="api-mobile-toggle-btn"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            aria-label="Mở menu API"
            title="Mở menu API"
          >
            {isMobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div className="api-brand" onClick={() => navigate('/')}>
            <span className="api-brand-title">MYERP DEV</span>
            <span className="api-brand-badge">API v1.0</span>
          </div>
          <span className="api-header-sep">/</span>
          <span className="api-header-subtitle">
            {apiV1Categories.length} Phân Hệ • {totalEndpointsCount} Endpoints
          </span>
        </div>

        {/* Global Search Bar in Header */}
        <div className="api-header-search-bar">
          <Search size={15} className="api-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm kiếm API theo đường dẫn, tên hoặc phương thức (Ctrl + K)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="api-search-input"
          />
          {searchQuery && (
            <button className="api-search-clear" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

        {/* Header Right Actions */}
        <div className="api-header-right">
          <a
            href="/openapi.json"
            download="myerp-v1-openapi.json"
            className="api-nav-btn api-nav-btn-secondary"
            title="Tải đặc tả chuẩn OpenAPI 3.0"
          >
            <Download size={14} />
            <span>Tải OpenAPI 3.0</span>
          </a>

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

      {/* ── 3-COLUMN FULL WORKSPACE ────────────────────────────────────── */}
      <div className="api-full-container">
        {/* Mobile Backdrop */}
        {isMobileNavOpen && (
          <div
            className="api-mobile-backdrop"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Column 1: Left Endpoints Directory Sidebar */}
        <aside className={`api-col-sidebar ${isMobileNavOpen ? 'mobile-open' : ''}`}>
          <div className="api-col-sidebar-header-mobile">
            <div className="api-mobile-header-title">
              <Layers size={16} />
              <span>DANH MỤC API &amp; SDKs</span>
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
              DANH MỤC PHÂN HỆ ({filteredCategories.length} PHÂN HỆ • {totalEndpointsCount} APIs)
            </div>

            {/* Method Filter Pills */}
            <div className="api-method-filter-bar">
              {(['ALL', 'GET', 'POST', 'PUT', 'DELETE'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMethodFilter(m)}
                  className={`api-method-filter-btn ${methodFilter === m ? 'active' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Category Accordion (Pure Text, No Decorative Icons) */}
            {filteredCategories.length === 0 ? (
              <div className="api-empty-tree" style={{ padding: '24px 8px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                Không tìm thấy API nào khớp với "{searchQuery}"
              </div>
            ) : (
              filteredCategories.map(cat => {
                const isCatActive = cat.id === selectedCatId;
                const isExpanded = expandedCatIds.includes(cat.id);

                return (
                  <div key={cat.id} className="api-cat-block">
                    <div
                      className={`api-cat-heading ${isCatActive ? 'active' : ''}`}
                      onClick={() => {
                        toggleCategory(cat.id);
                        if (!isExpanded && cat.endpoints.length > 0) {
                          handleSelectEndpoint(cat.id, cat.endpoints[0].id);
                        }
                      }}
                    >
                      <span className="api-cat-heading-text">{cat.title}</span>
                      <div className="api-cat-heading-right">
                        <span className="api-cat-count">{cat.endpoints.length}</span>
                        <ChevronDown
                          size={14}
                          className={`api-chevron-icon ${isExpanded ? 'open' : ''}`}
                        />
                      </div>
                    </div>

                    <div className={`api-cat-sublist-wrapper ${isExpanded ? 'open' : ''}`}>
                      <div className="api-cat-sublist">
                        {cat.endpoints.map(ep => {
                          const isSelected = ep.id === selectedEndpointId;
                          return (
                            <div
                              key={ep.id}
                              className={`api-endpoint-item ${isSelected ? 'active' : ''}`}
                              onClick={() => handleSelectEndpoint(cat.id, ep.id)}
                            >
                              <span className={`method-pill ${ep.method.toLowerCase()}`}>
                                {ep.method}
                              </span>
                              <span className="api-endpoint-name">{ep.title}</span>
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

        {/* Column 2: Center Content Specification */}
        <main className="api-col-content" ref={contentRef}>
          <div className="api-content-article">
            {/* Hero Section */}
            <div className="api-hero-block" id="sec-overview">
              <div className="api-hero-meta">
                <span className={`method-badge ${currentEndpoint.method.toLowerCase()}`}>
                  {currentEndpoint.method}
                </span>
                <span className="api-path-box">{currentEndpoint.path}</span>
                {currentEndpoint.authRequired ? (
                  <span className="api-badge-auth">
                    <Shield size={12} /> Bearer Token Auth
                  </span>
                ) : (
                  <span className="api-badge-public">Công khai (Public)</span>
                )}
                <span className="api-badge-rate">
                  <Clock size={11} /> {currentEndpoint.rateLimit}
                </span>
                {currentEndpoint.scopes?.map(s => (
                  <span key={s} className="api-badge-scope">
                    scope: {s}
                  </span>
                ))}
              </div>

              <h1 className="api-headline">{currentEndpoint.title}</h1>
              <p className="api-lead">{currentEndpoint.description}</p>
            </div>

            {/* Section 1: Request Headers Table */}
            <div className="api-spec-section" id="sec-headers">
              <h2>1. Request Headers</h2>
              <table className="api-table">
                <thead>
                  <tr>
                    <th style={{ width: '220px' }}>Tên Header</th>
                    <th style={{ width: '130px' }}>Bắt buộc</th>
                    <th>Mô tả chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEndpoint.authRequired && (
                    <tr>
                      <td><code>Authorization</code></td>
                      <td><span className="req-true">Bắt buộc</span></td>
                      <td>Định dạng: <code>Bearer &lt;access_token&gt;</code> hoặc API Key hợp lệ.</td>
                    </tr>
                  )}
                  <tr>
                    <td><code>Content-Type</code></td>
                    <td><span className="req-false">Khuyên dùng</span></td>
                    <td><code>application/json</code> cho các yêu cầu có thân dữ liệu POST / PUT / PATCH.</td>
                  </tr>
                  {currentEndpoint.headers?.['X-Idempotency-Key'] && (
                    <tr>
                      <td><code>X-Idempotency-Key</code></td>
                      <td><span className="req-false">Khuyên dùng</span></td>
                      <td>Khóa chống trừ tiền hoặc tạo trùng giao dịch (chuỗi UUID v4 ngẫu nhiên).</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 2: Query Parameters Table */}
            {currentEndpoint.queryParams && currentEndpoint.queryParams.length > 0 && (
              <div className="api-spec-section" id="sec-query">
                <h2>2. Query Parameters (URL)</h2>
                <table className="api-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Tham số</th>
                      <th style={{ width: '120px' }}>Kiểu</th>
                      <th style={{ width: '110px' }}>Bắt buộc</th>
                      <th style={{ width: '100px' }}>Mặc định</th>
                      <th>Mô tả &amp; Tùy chọn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEndpoint.queryParams.map(qp => (
                      <tr key={qp.name}>
                        <td><code>{qp.name}</code></td>
                        <td><span className="type-pill">{qp.type}</span></td>
                        <td>
                          {qp.required ? (
                            <span className="req-true">Bắt buộc</span>
                          ) : (
                            <span className="req-false">Tùy chọn</span>
                          )}
                        </td>
                        <td><code>{qp.default || '-'}</code></td>
                        <td>
                          <div>{qp.desc}</div>
                          {qp.enumOptions && (
                            <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#64748b' }}>
                              Lựa chọn cho phép: {qp.enumOptions.map(o => `"${o}"`).join(', ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 3: Body Parameters Table */}
            {currentEndpoint.bodyParams && currentEndpoint.bodyParams.length > 0 && (
              <div className="api-spec-section" id="sec-body">
                <h2>3. Body Parameters (JSON Payload)</h2>
                <table className="api-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Trường (Field)</th>
                      <th style={{ width: '120px' }}>Kiểu</th>
                      <th style={{ width: '110px' }}>Bắt buộc</th>
                      <th>Mô tả chi tiết &amp; Ràng buộc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEndpoint.bodyParams.map(bp => (
                      <tr key={bp.name}>
                        <td><code>{bp.name}</code></td>
                        <td><span className="type-pill">{bp.type}</span></td>
                        <td>
                          {bp.required ? (
                            <span className="req-true">Bắt buộc</span>
                          ) : (
                            <span className="req-false">Tùy chọn</span>
                          )}
                        </td>
                        <td>
                          <div>{bp.desc}</div>
                          {bp.enumOptions && (
                            <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#64748b' }}>
                              Giá trị hợp lệ: {bp.enumOptions.map(o => `"${o}"`).join(', ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Section 4: HTTP Status Codes Table */}
            <div className="api-spec-section" id="sec-status">
              <h2>4. Bảng Mã Phản Hồi (Status Codes)</h2>
              <table className="api-table">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Mã HTTP</th>
                    <th style={{ width: '180px' }}>Trạng thái</th>
                    <th>Mô tả ý nghĩa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>200 / 201</code></td>
                    <td><span className="req-true" style={{ color: '#16a34a' }}>Thành công (OK / Created)</span></td>
                    <td>Yêu cầu thực thi thành công, trả về dữ liệu JSON đầy đủ.</td>
                  </tr>
                  <tr>
                    <td><code>401</code></td>
                    <td><span className="req-true" style={{ color: '#d97706' }}>Unauthorized</span></td>
                    <td>Thiếu hoặc sai JWT Bearer Token / API Key.</td>
                  </tr>
                  <tr>
                    <td><code>422</code></td>
                    <td><span className="req-true" style={{ color: '#dc2626' }}>Unprocessable Entity</span></td>
                    <td>Dữ liệu không hợp lệ hoặc vi phạm chính sách bảo hộ/trùng lặp.</td>
                  </tr>
                  <tr>
                    <td><code>429</code></td>
                    <td><span className="req-true" style={{ color: '#0284c7' }}>Rate Limited</span></td>
                    <td>Vượt quá hạn ngạch tần số gọi cho phép. Thử lại sau.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 5: SDK Code Snippet */}
            <div className="api-spec-section" id="sec-code">
              <h2>5. Mẫu Gọi API (Code Snippet SDK)</h2>
              <div className="api-code-bar">
                <div className="api-lang-selector">
                  {(['curl', 'ts', 'python', 'php'] as const).map(l => (
                    <button
                      key={l}
                      className={`lang-tab-btn ${selectedLang === l ? 'active' : ''}`}
                      onClick={() => setSelectedLang(l)}
                    >
                      {l === 'curl' ? 'cURL' : l === 'ts' ? 'TypeScript (Axios)' : l === 'python' ? 'Python (Requests)' : 'PHP (cURL)'}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleCopy(generateSnippet(currentEndpoint, selectedLang), 'snippet')}
                  className="api-copy-btn"
                >
                  {copiedKey === 'snippet' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedKey === 'snippet' ? 'Đã copy' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="api-code-terminal">
                <pre>{generateSnippet(currentEndpoint, selectedLang)}</pre>
              </div>
            </div>

            {/* Section 6: Response Example */}
            <div className="api-spec-section" id="sec-response">
              <h2>6. Kết Quả Phản Hồi Mẫu (Response Example)</h2>
              <div className="api-code-bar response-bar">
                <div className="api-resp-selector">
                  <button
                    className={`resp-tab-btn ${selectedResponseTab === 'success' ? 'active' : ''}`}
                    onClick={() => setSelectedResponseTab('success')}
                  >
                    Status: 200 OK (Thành công)
                  </button>
                  {currentEndpoint.errorResponses && currentEndpoint.errorResponses.length > 0 && (
                    <button
                      className={`resp-tab-btn error ${selectedResponseTab === 'error' ? 'active' : ''}`}
                      onClick={() => setSelectedResponseTab('error')}
                    >
                      Mẫu Lỗi ({currentEndpoint.errorResponses[0].status})
                    </button>
                  )}
                </div>

                <button
                  onClick={() => handleCopy(JSON.stringify(activeResponsePayload, null, 2), 'response')}
                  className="api-copy-btn"
                >
                  {copiedKey === 'response' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedKey === 'response' ? 'Đã copy' : 'Copy Response'}</span>
                </button>
              </div>

              <div className="api-code-terminal response-terminal">
                <pre>{JSON.stringify(activeResponsePayload, null, 2)}</pre>
              </div>
            </div>
          </div>
        </main>

        {/* Column 3: Right Quick Jump Sidebar */}
        <aside className="api-col-quick">
          <div className="api-col-quick-inner">
            <div className="api-quick-caption">TIỂU MỤC ENDPOINT</div>
            <div className="api-quick-list">
              <div className="api-quick-item active" onClick={() => scrollToSection('sec-overview')}>
                <span>1. Tổng quan Endpoint</span>
              </div>
              <div className="api-quick-item" onClick={() => scrollToSection('sec-headers')}>
                <span>2. Request Headers</span>
              </div>
              {currentEndpoint.queryParams && currentEndpoint.queryParams.length > 0 && (
                <div className="api-quick-item" onClick={() => scrollToSection('sec-query')}>
                  <span>3. Query Parameters</span>
                </div>
              )}
              {currentEndpoint.bodyParams && currentEndpoint.bodyParams.length > 0 && (
                <div className="api-quick-item" onClick={() => scrollToSection('sec-body')}>
                  <span>4. Body Parameters</span>
                </div>
              )}
              <div className="api-quick-item" onClick={() => scrollToSection('sec-status')}>
                <span>5. Bảng Mã Phản Hồi</span>
              </div>
              <div className="api-quick-item" onClick={() => scrollToSection('sec-code')}>
                <span>6. Code Snippet SDK</span>
              </div>
              <div className="api-quick-item" onClick={() => scrollToSection('sec-response')}>
                <span>7. JSON Response Mẫu</span>
              </div>
            </div>

            <div className="api-quick-card">
              <div className="api-card-title">Base Server URL</div>
              <div className="api-card-url">{baseUrl}</div>
              <p className="api-card-note">Tất cả request yêu cầu Header <code>Content-Type: application/json</code>.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

// Helper function for PHP formatting
function varExportFormat(obj: any, indent: number): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(obj)) {
    const items = obj.map(i => varExportFormat(i, indent + 4)).join(', ');
    return `[${items}]`;
  }
  if (typeof obj === 'object' && obj !== null) {
    const entries = Object.entries(obj).map(
      ([k, v]) => `${pad}    '${k}' => ${varExportFormat(v, indent + 4)}`
    );
    return `[\n${entries.join(',\n')}\n${pad}]`;
  }
  if (typeof obj === 'string') return `'${obj}'`;
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  return String(obj);
}

export default ApiV1DocumentationPage;

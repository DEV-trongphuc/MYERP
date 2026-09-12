import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Code, 
  BookOpen, 
  Search, 
  Copy, 
  Check, 
  Home, 
  Shield, 
  Server, 
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Send,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { apiCategories } from './apiDocsData';
import type { ApiCategory, ApiEndpoint } from './apiDocsData';

export const ApiDocumentationPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState<'curl' | 'ts' | 'python' | 'php'>('curl');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('auth');
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState(0);
  const [expandedCatIds, setExpandedCatIds] = useState<string[]>(['auth']);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleSelectEndpoint = (catId: string, idx: number) => {
    setSelectedCatId(catId);
    setSelectedEndpointIndex(idx);
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleCat = (catId: string) => {
    setExpandedCatIds(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return apiCategories;
    const q = searchQuery.toLowerCase();
    return apiCategories
      .map(cat => ({
        ...cat,
        endpoints: cat.endpoints.filter(
          ep =>
            ep.title.toLowerCase().includes(q) ||
            ep.path.toLowerCase().includes(q) ||
            ep.description.toLowerCase().includes(q) ||
            ep.method.toLowerCase().includes(q) ||
            cat.title.toLowerCase().includes(q)
        )
      }))
      .filter(cat => cat.endpoints.length > 0);
  }, [searchQuery]);

  const categories = filteredCategories;
  const currentCategory = categories.find(c => c.id === selectedCatId) || categories[0] || apiCategories[0];
  const currentEndpoint = (currentCategory && currentCategory.endpoints[selectedEndpointIndex]) || (currentCategory && currentCategory.endpoints[0]) || apiCategories[0].endpoints[0];

  const generateSnippet = (endpoint: ApiEndpoint, lang: 'curl' | 'ts' | 'python' | 'php') => {
    const baseUrl = "https://myerp.ideas.edu.vn";
    const fullUrl = `${baseUrl}${endpoint.path}`;

    if (lang === 'curl') {
      let code = `curl -X ${endpoint.method} "${fullUrl}" \\\n`;
      if (endpoint.authRequired) {
        code += `  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\\n`;
      }
      code += `  -H "Content-Type: application/json"`;
      if (endpoint.sampleBody && endpoint.method !== 'GET') {
        code += ` \\\n  -d '${JSON.stringify(endpoint.sampleBody, null, 2)}'`;
      }
      return code;
    }

    if (lang === 'ts') {
      return `import axios from 'axios';

const api = axios.create({
  baseURL: '${baseUrl}',
  headers: {
    ${endpoint.authRequired ? `'Authorization': 'Bearer \${accessToken}',\n    ` : ''}'Content-Type': 'application/json'
  }
});

export const executeApi = async () => {
  try {
    const response = await api.${endpoint.method.toLowerCase()}('${endpoint.path}'${endpoint.sampleBody && endpoint.method !== 'GET' ? `, ${JSON.stringify(endpoint.sampleBody, null, 2)}` : ''});
    console.log('Result:', response.data);
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};`;
    }

    if (lang === 'python') {
      return `import requests
import json

url = "${fullUrl}"
headers = {
    "Content-Type": "application/json"${endpoint.authRequired ? ',\n    "Authorization": "Bearer YOUR_ACCESS_TOKEN"' : ''}
}
${endpoint.sampleBody && endpoint.method !== 'GET' ? `payload = ${JSON.stringify(endpoint.sampleBody, null, 4)}\n\nresponse = requests.${endpoint.method.toLowerCase()}(url, headers=headers, json=payload)` : `response = requests.${endpoint.method.toLowerCase()}(url, headers=headers)`}

print("Status Code:", response.status_code)
print("Response:", response.json())`;
    }

    if (lang === 'php') {
      return `<?php
$curl = curl_init();

curl_setopt_array($curl, array(
  CURLOPT_URL => '${fullUrl}',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => '${endpoint.method}',
  ${endpoint.sampleBody && endpoint.method !== 'GET' ? `CURLOPT_POSTFIELDS => '${JSON.stringify(endpoint.sampleBody)}',\n  ` : ''}CURLOPT_HTTPHEADER => array(
    'Content-Type: application/json'${endpoint.authRequired ? ",\n    'Authorization: Bearer ' . $accessToken" : ''}
  ),
));

$response = curl_exec($curl);
curl_close($curl);
echo $response;
`;
    }

    return '';
  };

  return (
    <div className="api-full-wrapper">
      {/* Header */}
      <header className="api-full-header">
        <div className="api-header-left">
          <div className="api-brand" onClick={() => navigate('/')}>
            <span className="api-brand-title">MYERP DEVELOPER</span>
            <span className="api-brand-badge">REST API REFERENCE</span>
          </div>
          <span className="api-header-sep">/</span>
          <span className="api-header-subtitle">{apiCategories.length} Chuyên Mục & 39 Controllers</span>
        </div>

        {/* Search Bar in Header */}
        <div className="api-header-search-bar">
          <Search size={15} className="api-search-icon" />
          <input 
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

        <div className="api-header-right">
          <button 
            onClick={() => navigate('/docs')}
            className="api-nav-btn api-nav-btn-secondary"
            title="Xem Tài Liệu Toàn Thể Sản Phẩm"
          >
            <BookOpen size={15} />
            <span>Product Docs (/docs)</span>
          </button>
          <button 
            onClick={() => navigate('/')}
            className="api-nav-btn api-nav-btn-primary"
          >
            <Home size={15} />
            <span>Vào Hệ Thống</span>
          </button>
        </div>
      </header>

      {/* Main Full-Width Layout (3 Columns) */}
      <div className="api-full-container">
        {/* Column 1: Endpoints Directory Sidebar */}
        <aside className="api-col-sidebar">
          <div className="api-col-sidebar-inner">
            <div className="api-menu-caption">
              DANH MỤC PHÂN HỆ ({categories.length} PHÂN HỆ • {categories.reduce((acc, c) => acc + c.endpoints.length, 0)} APIs)
            </div>

            {categories.map(cat => {
              const isCatActive = cat.id === selectedCatId;
              const isExpanded = expandedCatIds.includes(cat.id);

              return (
                <div key={cat.id} className="api-cat-block">
                  <div 
                    className={`api-cat-heading ${isCatActive ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      toggleCat(cat.id);
                      if (!isExpanded && cat.endpoints.length > 0) {
                        handleSelectEndpoint(cat.id, 0);
                      }
                    }}
                  >
                    <span className="api-cat-heading-text">{cat.title}</span>
                    <ChevronDown 
                      size={14} 
                      className={`api-chevron-icon ${isExpanded ? 'open' : ''}`} 
                    />
                  </div>

                  <div className={`api-cat-sublist-wrapper ${isExpanded ? 'open' : ''}`}>
                    <div className="api-cat-sublist-inner">
                      <div className="api-cat-sublist">
                        {cat.endpoints.map((ep, idx) => (
                          <div 
                            key={idx}
                            className={`api-endpoint-item ${isCatActive && idx === selectedEndpointIndex ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectEndpoint(cat.id, idx);
                            }}
                          >
                            <span className={`method-pill ${ep.method.toLowerCase()}`}>{ep.method}</span>
                            <span className="api-endpoint-name">{ep.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Column 2: Center API Detail Content (Expands Fluidly & Scrolls Independently) */}
        <main className="api-col-content" ref={contentRef}>
          <div className="api-content-article">
            {/* Hero Section */}
            <div className="api-hero-block">
              <div className="api-hero-meta">
                <span className={`method-badge ${currentEndpoint.method.toLowerCase()}`}>{currentEndpoint.method}</span>
                <span className="api-path-box">{currentEndpoint.path}</span>
                {currentEndpoint.authRequired && (
                  <span className="api-badge-auth">
                    <Shield size={12} /> Bearer Token Auth
                  </span>
                )}
                <span className="api-badge-compat" title="Hệ thống hỗ trợ đồng thời cả chuẩn RESTful ngắn gọn /api/... và định dạng truyền thống /backend/api.php?action=...">
                  Dual Routing (RESTful &amp; Legacy)
                </span>
              </div>

              <h1 className="api-headline">{currentEndpoint.title}</h1>
              <p className="api-lead">{currentEndpoint.description}</p>
            </div>

            {/* Parameters Table */}
            {currentEndpoint.queryParams && currentEndpoint.queryParams.length > 0 && (
              <div className="api-spec-section">
                <h2>Query Parameters (URL)</h2>
                <table className="api-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Tham số</th>
                      <th style={{ width: '120px' }}>Kiểu dữ liệu</th>
                      <th style={{ width: '100px' }}>Bắt buộc</th>
                      <th>Mô tả chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEndpoint.queryParams.map((p, idx) => (
                      <tr key={idx}>
                        <td><code>{p.name}</code></td>
                        <td><span className="type-pill">{p.type}</span></td>
                        <td>{p.required ? <span className="req-true">Bắt buộc</span> : <span className="req-false">Tùy chọn</span>}</td>
                        <td>{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {currentEndpoint.bodyParams && currentEndpoint.bodyParams.length > 0 && (
              <div className="api-spec-section">
                <h2>Body Parameters (JSON Payload)</h2>
                <table className="api-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Trường (Field)</th>
                      <th style={{ width: '120px' }}>Kiểu dữ liệu</th>
                      <th style={{ width: '100px' }}>Bắt buộc</th>
                      <th>Mô tả & Định dạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEndpoint.bodyParams.map((p, idx) => (
                      <tr key={idx}>
                        <td><code>{p.name}</code></td>
                        <td><span className="type-pill">{p.type}</span></td>
                        <td>{p.required ? <span className="req-true">Bắt buộc</span> : <span className="req-false">Tùy chọn</span>}</td>
                        <td>{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SDK Code Snippet */}
            <div className="api-spec-section">
              <div className="api-code-bar">
                <div className="api-lang-selector">
                  <button 
                    className={`lang-tab-btn ${selectedLang === 'curl' ? 'active' : ''}`}
                    onClick={() => setSelectedLang('curl')}
                  >
                    cURL
                  </button>
                  <button 
                    className={`lang-tab-btn ${selectedLang === 'ts' ? 'active' : ''}`}
                    onClick={() => setSelectedLang('ts')}
                  >
                    TypeScript (Axios)
                  </button>
                  <button 
                    className={`lang-tab-btn ${selectedLang === 'python' ? 'active' : ''}`}
                    onClick={() => setSelectedLang('python')}
                  >
                    Python (Requests)
                  </button>
                  <button 
                    className={`lang-tab-btn ${selectedLang === 'php' ? 'active' : ''}`}
                    onClick={() => setSelectedLang('php')}
                  >
                    PHP (cURL)
                  </button>
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

            {/* Response Example */}
            <div className="api-spec-section">
              <div className="api-code-bar response-bar">
                <span className="api-response-status">Status: 200 OK (application/json)</span>
                <button 
                  onClick={() => handleCopy(JSON.stringify(currentEndpoint.sampleResponse, null, 2), 'response')}
                  className="api-copy-btn"
                >
                  {copiedKey === 'response' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedKey === 'response' ? 'Đã copy' : 'Copy Response'}</span>
                </button>
              </div>
              <div className="api-code-terminal response-terminal">
                <pre>
                  {typeof currentEndpoint.sampleResponse === 'string' 
                    ? currentEndpoint.sampleResponse 
                    : JSON.stringify(currentEndpoint.sampleResponse, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </main>

        {/* Column 3: Right Quick Jump Sidebar */}
        <aside className="api-col-quick">
          <div className="api-col-quick-inner">
            <div className="api-quick-caption">TIỂU MỤC ENDPOINT</div>
            <div className="api-quick-list">
              <div className="api-quick-item active">
                <span>1. Tổng quan Endpoint</span>
              </div>
              {currentEndpoint.queryParams && (
                <div className="api-quick-item">
                  <span>2. Query Parameters</span>
                </div>
              )}
              {currentEndpoint.bodyParams && (
                <div className="api-quick-item">
                  <span>3. Request Body Payload</span>
                </div>
              )}
              <div className="api-quick-item">
                <span>4. Code Snippet SDK</span>
              </div>
              <div className="api-quick-item">
                <span>5. JSON Response Mẫu</span>
              </div>
            </div>

            <div className="api-quick-card">
              <div className="api-card-title">Base Server URL</div>
              <div className="api-card-url">https://myerp.ideas.edu.vn</div>
              <p className="api-card-note">Tất cả request yêu cầu Header <code>Content-Type: application/json</code>.</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Embedded 100% Full-Width Clean Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,400;1,500;1,700&display=swap');

        html:has(.api-full-wrapper),
        body:has(.api-full-wrapper),
        #root:has(.api-full-wrapper) {
          height: 100% !important;
          overflow: hidden !important;
        }

        .api-full-wrapper {
          width: 100%;
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background-color: #f8fafc;
          color: #0f172a;
          font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          font-size: 13.5px;
          line-height: 1.6;
          margin: 0;
          padding: 0;
        }

        .api-full-header {
          flex-shrink: 0;
          height: 60px;
          width: 100%;
          background-color: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          box-sizing: border-box;
          z-index: 50;
        }

        .api-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .api-brand {
          display: flex;
          align-items: baseline;
          gap: 6px;
          cursor: pointer;
        }

        .api-brand-title {
          font-weight: 800;
          font-size: 15px;
          letter-spacing: -0.5px;
          color: #0f172a;
        }

        .api-brand-badge {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.5px;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .api-header-sep {
          color: #cbd5e1;
        }

        .api-header-subtitle {
          font-size: 12px;
          font-weight: 500;
          color: #475569;
        }

        /* Search bar in API header */
        .api-header-search-bar {
          display: flex;
          align-items: center;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 0 12px;
          height: 36px;
          max-width: 440px;
          flex: 1;
          margin: 0 20px;
          transition: all 0.2s;
        }

        .api-header-search-bar:focus-within {
          background: #ffffff;
          border-color: #0284c7;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
        }

        .api-search-icon {
          color: #94a3b8;
          margin-right: 8px;
          flex-shrink: 0;
        }

        .api-search-input {
          border: none;
          background: transparent;
          outline: none;
          font-size: 12.5px;
          font-family: inherit;
          color: #0f172a;
          width: 100%;
        }

        .api-search-clear {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 11px;
          cursor: pointer;
          padding: 2px 4px;
        }

        .api-search-clear:hover {
          color: #0f172a;
        }

        .api-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .api-nav-btn {
          height: 36px;
          padding: 0 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .api-nav-btn-secondary {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
        }

        .api-nav-btn-secondary:hover {
          background: #f8fafc;
          border-color: #94a3b8;
        }

        .api-nav-btn-primary {
          background: #0f172a;
          border: 1px solid #0f172a;
          color: #ffffff;
        }

        .api-nav-btn-primary:hover {
          background: #1e293b;
        }

        /* 3-Column Full-Width Container */
        .api-full-container {
          display: flex;
          width: 100%;
          flex: 1;
          height: calc(100vh - 60px);
          overflow: hidden;
          box-sizing: border-box;
        }

        /* Column 1: Left Endpoints Directory */
        .api-col-sidebar {
          width: 320px;
          flex-shrink: 0;
          border-right: 1px solid #e2e8f0;
          background: #ffffff;
          height: 100%;
          overflow-y: auto;
        }

        .api-col-sidebar-inner {
          padding: 20px 14px 40px 18px;
        }

        .api-menu-caption {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #94a3b8;
          margin-bottom: 14px;
          padding-left: 6px;
        }

        .api-cat-block {
          margin-bottom: 8px;
        }

        .api-cat-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
        }

        .api-cat-heading:hover {
          background-color: #f1f5f9;
        }

        .api-cat-heading.active {
          background-color: #f0f9ff;
          color: #0284c7;
        }

        .api-chevron-icon {
          flex-shrink: 0;
          color: #94a3b8;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s;
        }

        .api-chevron-icon.open {
          transform: rotate(180deg);
          color: #0284c7;
        }

        /* Smooth Accordion Expansion */
        .api-cat-sublist-wrapper {
          display: grid;
          grid-template-rows: 0fr;
          opacity: 0;
          transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
        }

        .api-cat-sublist-wrapper.open {
          grid-template-rows: 1fr;
          opacity: 1;
          transition: grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        }

        .api-cat-sublist-inner {
          overflow: hidden;
        }

        .api-cat-sublist {
          margin-left: 10px;
          padding-left: 6px;
          padding-top: 4px;
          padding-bottom: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .api-endpoint-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
          border-left: none !important;
        }

        .api-endpoint-item:hover {
          background-color: #f8fafc;
          color: #0284c7;
        }

        .api-endpoint-item.active {
          background-color: #f0f9ff;
          color: #0284c7;
          font-weight: 600;
          border-left: none !important;
        }

        .method-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 3px;
          font-family: monospace;
          min-width: 38px;
          text-align: center;
        }

        .method-pill.get { background: #e0f2fe; color: #0284c7; }
        .method-pill.post { background: #dcfce7; color: #16a34a; }
        .method-pill.put { background: #fef3c7; color: #d97706; }
        .method-pill.delete { background: #fee2e2; color: #dc2626; }

        /* Column 2: Center Content (Expands Fluidly & Scrolls Independently) */
        .api-col-content {
          flex: 1;
          min-width: 0;
          height: 100%;
          overflow-y: auto;
          background: #ffffff;
          padding: 32px 48px 80px 48px;
          scroll-behavior: smooth;
        }

        .api-content-article {
          width: 100%;
        }

        .api-hero-block {
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 22px;
          margin-bottom: 28px;
        }

        .api-hero-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .method-badge {
          font-size: 12px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          font-family: monospace;
        }

        .method-badge.get { background: #e0f2fe; color: #0369a1; }
        .method-badge.post { background: #dcfce7; color: #15803d; }
        .method-badge.put { background: #fef3c7; color: #b45309; }
        .method-badge.delete { background: #fee2e2; color: #b91c1c; }

        .api-path-box {
          font-family: monospace;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          background: #f1f5f9;
          padding: 3px 10px;
          border-radius: 4px;
        }

        .api-badge-auth {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .api-badge-compat {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #0369a1;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .api-headline {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .api-lead {
          font-size: 14.5px;
          color: #475569;
          margin: 0;
        }

        .api-spec-section {
          margin-top: 32px;
        }

        .api-spec-section h2 {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 12px 0;
        }

        .api-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .api-table th, .api-table td {
          border: 1px solid #e2e8f0;
          padding: 10px 14px;
          text-align: left;
          white-space: normal !important;
          text-overflow: clip !important;
          overflow: visible !important;
          max-width: none !important;
          word-break: break-word !important;
          line-height: 1.6;
        }

        .api-table th {
          background-color: #f8fafc;
          font-weight: 700;
          color: #334155;
        }

        .api-table code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #0f172a;
          font-size: 12px;
        }

        .type-pill {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
        }

        .req-true {
          font-size: 11px;
          color: #dc2626;
          font-weight: 700;
        }

        .req-false {
          font-size: 11px;
          color: #94a3b8;
        }

        .api-code-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1e293b;
          border-top-left-radius: 6px;
          border-top-right-radius: 6px;
          padding: 6px 14px;
        }

        .api-code-bar.response-bar {
          background: #0f172a;
        }

        .api-response-status {
          color: #10b981;
          font-size: 12px;
          font-family: monospace;
          font-weight: 600;
        }

        .api-lang-selector {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .lang-tab-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .lang-tab-btn:hover {
          color: #ffffff;
        }

        .lang-tab-btn.active {
          background: #334155;
          color: #ffffff;
        }

        .api-copy-btn {
          background: transparent;
          border: 1px solid #475569;
          color: #cbd5e1;
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
        }

        .api-copy-btn:hover {
          background: #334155;
          color: #ffffff;
          border-color: #64748b;
        }

        .api-code-terminal {
          background: #0f172a;
          color: #f8fafc;
          padding: 16px 20px;
          border-bottom-left-radius: 6px;
          border-bottom-right-radius: 6px;
          overflow-x: auto;
          font-family: "JetBrains Mono", Consolas, Menlo, monospace;
          font-size: 12.5px;
          line-height: 1.6;
        }

        .api-code-terminal pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        /* Column 3: Right Quick Jump */
        .api-col-quick {
          width: 250px;
          flex-shrink: 0;
          border-left: 1px solid #e2e8f0;
          background: #f8fafc;
          height: 100%;
          overflow-y: auto;
        }

        .api-col-quick-inner {
          padding: 24px 16px;
        }

        .api-quick-caption {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #94a3b8;
          margin-bottom: 12px;
        }

        .api-quick-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .api-quick-item {
          font-size: 12px;
          color: #64748b;
          padding: 6px 10px;
          border-radius: 4px;
          border-left: none !important;
          transition: all 0.15s;
        }

        .api-quick-item.active {
          color: #0284c7;
          font-weight: 600;
          background: #f0f9ff;
          border-left: none !important;
        }

        .api-quick-card {
          margin-top: 36px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 14px;
        }

        .api-card-title {
          font-size: 11.5px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .api-card-url {
          font-family: monospace;
          font-size: 11px;
          color: #0284c7;
          word-break: break-all;
          margin-bottom: 8px;
        }

        .api-card-note {
          font-size: 11px;
          color: #64748b;
          margin: 0;
          line-height: 1.4;
        }

        @media (max-width: 1200px) {
          .api-col-quick {
            display: none;
          }
        }

        @media (max-width: 900px) {
          .api-col-sidebar {
            display: none;
          }
          .api-col-content {
            padding: 24px 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default ApiDocumentationPage;

import React from 'react';
import { AITrainingPanel } from '../components/ui/AITrainingPanel';
import { Brain } from 'lucide-react';

export const AITrainingPage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100vh', background: 'var(--color-bg-light)' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            background: 'rgba(189, 29, 45, 0.08)',
            color: '#BD1D2D',
            borderRadius: 10,
            border: '1px solid rgba(189, 29, 45, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Brain size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              Kho tri thức AI (Knowledge Base)
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>
              Huấn luyện tri thức doanh nghiệp, quản lý dữ liệu đối chiếu RAG và kiểm thử mô hình chatbot Gemini.
            </p>
          </div>
        </div>
      </div>

      {/* Main Training Panel Wrapper */}
      <div className="card" style={{ padding: '2rem', minHeight: '600px' }}>
        <AITrainingPanel />
      </div>
    </div>
  );
};
